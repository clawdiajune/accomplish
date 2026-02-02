import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { StreamParser } from './stream-parser.js';
import { OpenCodeLogWatcher, createLogWatcher, OpenCodeLogError } from './log-watcher.js';
import { CompletionEnforcer, CompletionEnforcerCallbacks } from './completion/index.js';
import type {
  TaskConfig,
  Task,
  TaskMessage,
  TaskResult,
  OpenCodeMessage,
  PermissionRequest,
  TodoItem,
} from '@accomplish/shared';

/**
 * Error thrown when OpenCode CLI is not available
 */
export class OpenCodeCliNotFoundError extends Error {
  constructor() {
    super(
      'OpenCode CLI is not available. The bundled CLI may be missing or corrupted. Please reinstall the application.'
    );
    this.name = 'OpenCodeCliNotFoundError';
  }
}

/**
 * Options for creating an OpenCodeAdapter
 */
export interface AdapterOptions {
  /** Platform-specific configuration */
  platform: NodeJS.Platform;
  /** Whether the app is packaged */
  isPackaged: boolean;
  /** Path to temporary directory (used as safe working directory) */
  tempPath: string;
  /** Function to get the CLI command and args */
  getCliCommand: () => { command: string; args: string[] };
  /** Function to build environment variables */
  buildEnvironment: () => Promise<NodeJS.ProcessEnv>;
  /** Function to build CLI arguments */
  buildCliArgs: (config: TaskConfig) => Promise<string[]>;
  /** Optional callback to run before starting a task (e.g., generate config) */
  onBeforeStart?: () => Promise<void>;
  /** Get model display name for progress events */
  getModelDisplayName?: (modelId: string) => string;
}

export interface OpenCodeAdapterEvents {
  message: [OpenCodeMessage];
  'tool-use': [string, unknown];
  'tool-result': [string];
  'permission-request': [PermissionRequest];
  progress: [{ stage: string; message?: string; modelName?: string }];
  complete: [TaskResult];
  error: [Error];
  debug: [{ type: string; message: string; data?: unknown }];
  'todo:update': [TodoItem[]];
  'auth-error': [{ providerId: string; message: string }];
}

export class OpenCodeAdapter extends EventEmitter<OpenCodeAdapterEvents> {
  private ptyProcess: pty.IPty | null = null;
  private streamParser: StreamParser;
  private logWatcher: OpenCodeLogWatcher | null = null;
  private currentSessionId: string | null = null;
  private currentTaskId: string | null = null;
  private messages: TaskMessage[] = [];
  private hasCompleted: boolean = false;
  private isDisposed: boolean = false;
  private wasInterrupted: boolean = false;
  private completionEnforcer: CompletionEnforcer;
  private lastWorkingDirectory: string | undefined;
  /** Current model ID for display name */
  private currentModelId: string | null = null;
  /** Timer for transitioning from 'connecting' to 'waiting' stage */
  private waitingTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether the first tool has been received (to stop showing startup stages) */
  private hasReceivedFirstTool: boolean = false;
  /** Whether start_task has been called this session (for hard enforcement) */
  private startTaskCalled: boolean = false;
  /** Adapter options */
  private options: AdapterOptions;

  /**
   * Create a new OpenCodeAdapter instance
   * @param options - Adapter configuration options
   * @param taskId - Optional task ID for this adapter instance (used for logging)
   */
  constructor(options: AdapterOptions, taskId?: string) {
    super();
    this.options = options;
    this.currentTaskId = taskId || null;
    this.streamParser = new StreamParser();
    this.completionEnforcer = this.createCompletionEnforcer();
    this.setupStreamParsing();
    this.setupLogWatcher();
  }

  /**
   * Create the CompletionEnforcer with callbacks that delegate to adapter methods.
   */
  private createCompletionEnforcer(): CompletionEnforcer {
    const callbacks: CompletionEnforcerCallbacks = {
      onStartContinuation: async (prompt: string) => {
        await this.spawnSessionResumption(prompt);
      },
      onComplete: () => {
        this.hasCompleted = true;
        this.emit('complete', {
          status: 'success',
          sessionId: this.currentSessionId || undefined,
        });
      },
      onDebug: (type: string, message: string, data?: unknown) => {
        this.emit('debug', { type, message, data });
      },
    };
    return new CompletionEnforcer(callbacks);
  }

  /**
   * Set up the log watcher to detect errors from OpenCode CLI logs.
   */
  private setupLogWatcher(): void {
    this.logWatcher = createLogWatcher();

    this.logWatcher.on('error', (error: OpenCodeLogError) => {
      // Only handle errors if we have an active task that hasn't completed
      if (!this.hasCompleted && this.ptyProcess) {
        console.log('[OpenCode Adapter] Log watcher detected error:', error.errorName);

        const errorMessage = OpenCodeLogWatcher.getErrorMessage(error);

        // Emit debug event so the error appears in the app's debug panel
        this.emit('debug', {
          type: 'error',
          message: `[${error.errorName}] ${errorMessage}`,
          data: {
            errorName: error.errorName,
            statusCode: error.statusCode,
            providerID: error.providerID,
            modelID: error.modelID,
            message: error.message,
          },
        });

        // Emit auth-error event if this is an authentication error
        if (error.isAuthError && error.providerID) {
          console.log('[OpenCode Adapter] Emitting auth-error for provider:', error.providerID);
          this.emit('auth-error', {
            providerId: error.providerID,
            message: errorMessage,
          });
        }

        this.hasCompleted = true;
        this.emit('complete', {
          status: 'error',
          sessionId: this.currentSessionId || undefined,
          error: errorMessage,
        });

        // Kill the PTY process since we've detected an error
        if (this.ptyProcess) {
          try {
            this.ptyProcess.kill();
          } catch (err) {
            console.warn('[OpenCode Adapter] Error killing PTY after log error:', err);
          }
          this.ptyProcess = null;
        }
      }
    });
  }

  /**
   * Start a new task with OpenCode CLI
   */
  async startTask(config: TaskConfig): Promise<Task> {
    // Check if adapter has been disposed
    if (this.isDisposed) {
      throw new Error('Adapter has been disposed and cannot start new tasks');
    }

    const taskId = config.taskId || this.generateTaskId();
    this.currentTaskId = taskId;
    this.currentSessionId = null;
    this.messages = [];
    this.streamParser.reset();
    this.hasCompleted = false;
    this.wasInterrupted = false;
    this.completionEnforcer.reset();
    this.lastWorkingDirectory = config.workingDirectory;
    this.hasReceivedFirstTool = false;
    this.startTaskCalled = false;
    // Clear any existing waiting transition timer
    if (this.waitingTransitionTimer) {
      clearTimeout(this.waitingTransitionTimer);
      this.waitingTransitionTimer = null;
    }

    // Start the log watcher to detect errors that aren't output as JSON
    if (this.logWatcher) {
      await this.logWatcher.start();
    }

    // Run pre-start callback (e.g., generate config)
    if (this.options.onBeforeStart) {
      await this.options.onBeforeStart();
    }

    const cliArgs = await this.options.buildCliArgs(config);

    // Get the CLI path
    const { command, args: baseArgs } = this.options.getCliCommand();
    const startMsg = `Starting: ${command} ${[...baseArgs, ...cliArgs].join(' ')}`;
    console.log('[OpenCode CLI]', startMsg);
    this.emit('debug', { type: 'info', message: startMsg });

    // Build environment with API keys
    const env = await this.options.buildEnvironment();

    const allArgs = [...baseArgs, ...cliArgs];
    const cmdMsg = `Command: ${command}`;
    const argsMsg = `Args: ${allArgs.join(' ')}`;
    // Use temp directory as default cwd to avoid permission prompts
    const safeCwd = config.workingDirectory || this.options.tempPath;
    const cwdMsg = `Working directory: ${safeCwd}`;

    // Create a minimal package.json in the working directory so OpenCode finds it there
    // and stops searching upward. This prevents EPERM errors on Windows.
    if (this.options.isPackaged && this.options.platform === 'win32') {
      const dummyPackageJson = path.join(safeCwd, 'package.json');
      if (!fs.existsSync(dummyPackageJson)) {
        try {
          fs.writeFileSync(dummyPackageJson, JSON.stringify({ name: 'opencode-workspace', private: true }, null, 2));
          console.log('[OpenCode CLI] Created workspace package.json at:', dummyPackageJson);
        } catch (err) {
          console.warn('[OpenCode CLI] Could not create workspace package.json:', err);
        }
      }
    }

    console.log('[OpenCode CLI]', cmdMsg);
    console.log('[OpenCode CLI]', argsMsg);
    console.log('[OpenCode CLI]', cwdMsg);

    this.emit('debug', { type: 'info', message: cmdMsg });
    this.emit('debug', { type: 'info', message: argsMsg, data: { args: allArgs } });
    this.emit('debug', { type: 'info', message: cwdMsg });

    // Spawn via shell for proper terminal emulation
    {
      const fullCommand = this.buildShellCommand(command, allArgs);

      const shellCmdMsg = `Full shell command: ${fullCommand}`;
      console.log('[OpenCode CLI]', shellCmdMsg);
      this.emit('debug', { type: 'info', message: shellCmdMsg });

      // Use platform-appropriate shell
      const shellCmd = this.getPlatformShell();
      const shellArgs = this.getShellArgs(fullCommand);
      const shellMsg = `Using shell: ${shellCmd} ${shellArgs.join(' ')}`;
      console.log('[OpenCode CLI]', shellMsg);
      this.emit('debug', { type: 'info', message: shellMsg });

      this.ptyProcess = pty.spawn(shellCmd, shellArgs, {
        name: 'xterm-256color',
        // Use very wide columns to minimize PTY line wrapping on Windows
        cols: 32000,
        rows: 30,
        cwd: safeCwd,
        env: env as { [key: string]: string },
      });
      const pidMsg = `PTY Process PID: ${this.ptyProcess.pid}`;
      console.log('[OpenCode CLI]', pidMsg);
      this.emit('debug', { type: 'info', message: pidMsg });

      // Emit 'loading' stage after PTY spawn
      this.emit('progress', { stage: 'loading', message: 'Loading agent...' });

      // Handle PTY data (combines stdout/stderr)
      this.ptyProcess.onData((data: string) => {
        // Filter out ANSI escape codes and control characters for cleaner parsing
        const cleanData = data
          .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')  // CSI sequences
          .replace(/\x1B\][^\x07]*\x07/g, '')       // OSC sequences with BEL terminator
          .replace(/\x1B\][^\x1B]*\x1B\\/g, '');    // OSC sequences with ST terminator
        if (cleanData.trim()) {
          // Truncate for console.log to avoid flooding terminal
          const truncated = cleanData.substring(0, 500) + (cleanData.length > 500 ? '...' : '');
          console.log('[OpenCode CLI stdout]:', truncated);
          // Send full data to debug panel
          this.emit('debug', { type: 'stdout', message: cleanData });

          this.streamParser.feed(cleanData);
        }
      });

      // Handle PTY exit
      this.ptyProcess.onExit(({ exitCode, signal }) => {
        const exitMsg = `PTY Process exited with code: ${exitCode}, signal: ${signal}`;
        console.log('[OpenCode CLI]', exitMsg);
        this.emit('debug', { type: 'exit', message: exitMsg, data: { exitCode, signal } });
        this.handleProcessExit(exitCode);
      });
    }

    return {
      id: taskId,
      prompt: config.prompt,
      status: 'running',
      messages: [],
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string, prompt: string): Promise<Task> {
    return this.startTask({
      prompt,
      sessionId,
    });
  }

  /**
   * Send user response for permission/question
   */
  async sendResponse(response: string): Promise<void> {
    if (!this.ptyProcess) {
      throw new Error('No active process');
    }

    this.ptyProcess.write(response + '\n');
    console.log('[OpenCode CLI] Response sent via PTY');
  }

  /**
   * Cancel the current task (hard kill)
   */
  async cancelTask(): Promise<void> {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }

  /**
   * Interrupt the current task (graceful Ctrl+C)
   */
  async interruptTask(): Promise<void> {
    if (!this.ptyProcess) {
      console.log('[OpenCode CLI] No active process to interrupt');
      return;
    }

    // Mark as interrupted
    this.wasInterrupted = true;

    // Send Ctrl+C (ASCII 0x03) to the PTY
    this.ptyProcess.write('\x03');
    console.log('[OpenCode CLI] Sent Ctrl+C interrupt signal');

    // On Windows, batch files prompt for confirmation
    if (this.options.platform === 'win32') {
      setTimeout(() => {
        if (this.ptyProcess) {
          this.ptyProcess.write('Y\n');
          console.log('[OpenCode CLI] Sent Y to confirm batch termination');
        }
      }, 100);
    }
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get the current task ID
   */
  getTaskId(): string | null {
    return this.currentTaskId;
  }

  /**
   * Check if the adapter is currently running a task
   */
  get running(): boolean {
    return this.ptyProcess !== null && !this.hasCompleted;
  }

  /**
   * Check if the adapter has been disposed
   */
  isAdapterDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Dispose the adapter and clean up all resources
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    console.log(`[OpenCode Adapter] Disposing adapter for task ${this.currentTaskId}`);
    this.isDisposed = true;

    // Stop the log watcher
    if (this.logWatcher) {
      this.logWatcher.stop().catch((err) => {
        console.warn('[OpenCode Adapter] Error stopping log watcher:', err);
      });
    }

    // Kill PTY process if running
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch (error) {
        console.error('[OpenCode Adapter] Error killing PTY process:', error);
      }
      this.ptyProcess = null;
    }

    // Clear state
    this.currentSessionId = null;
    this.currentTaskId = null;
    this.messages = [];
    this.hasCompleted = true;
    this.currentModelId = null;
    this.hasReceivedFirstTool = false;
    this.startTaskCalled = false;

    // Clear waiting transition timer
    if (this.waitingTransitionTimer) {
      clearTimeout(this.waitingTransitionTimer);
      this.waitingTransitionTimer = null;
    }

    // Reset stream parser
    this.streamParser.reset();

    // Remove all listeners
    this.removeAllListeners();

    console.log('[OpenCode Adapter] Adapter disposed');
  }

  /**
   * Escape a shell argument for safe execution.
   */
  private escapeShellArg(arg: string): string {
    if (this.options.platform === 'win32') {
      if (arg.includes(' ') || arg.includes('"')) {
        return `"${arg.replace(/"/g, '""')}"`;
      }
      return arg;
    } else {
      const needsEscaping = ["'", ' ', '$', '`', '\\', '"', '\n'].some(c => arg.includes(c));
      if (needsEscaping) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }
  }

  /**
   * Build a shell command string with properly escaped arguments.
   */
  private buildShellCommand(command: string, args: string[]): string {
    const escapedCommand = this.escapeShellArg(command);
    const escapedArgs = args.map(arg => this.escapeShellArg(arg));
    return [escapedCommand, ...escapedArgs].join(' ');
  }

  private setupStreamParsing(): void {
    this.streamParser.on('message', (message: OpenCodeMessage) => {
      this.handleMessage(message);
    });

    // Handle parse errors gracefully
    this.streamParser.on('error', (error: Error) => {
      console.warn('[OpenCode Adapter] Stream parse warning:', error.message);
      this.emit('debug', { type: 'parse-warning', message: error.message });
    });
  }

  private handleMessage(message: OpenCodeMessage): void {
    console.log('[OpenCode Adapter] Handling message type:', message.type);

    switch (message.type) {
      // Step start event
      case 'step_start':
        this.currentSessionId = message.part.sessionID;
        // Emit 'connecting' stage with model display name
        const modelDisplayName = this.currentModelId && this.options.getModelDisplayName
          ? this.options.getModelDisplayName(this.currentModelId)
          : 'AI';
        this.emit('progress', {
          stage: 'connecting',
          message: `Connecting to ${modelDisplayName}...`,
          modelName: modelDisplayName,
        });
        // Start timer to transition to 'waiting' stage after 500ms if no tool received
        if (this.waitingTransitionTimer) {
          clearTimeout(this.waitingTransitionTimer);
        }
        this.waitingTransitionTimer = setTimeout(() => {
          if (!this.hasReceivedFirstTool && !this.hasCompleted) {
            this.emit('progress', { stage: 'waiting', message: 'Waiting for response...' });
          }
        }, 500);
        break;

      // Text content event
      case 'text':
        if (!this.currentSessionId && message.part.sessionID) {
          this.currentSessionId = message.part.sessionID;
        }
        this.emit('message', message);

        if (message.part.text) {
          const taskMessage: TaskMessage = {
            id: this.generateMessageId(),
            type: 'assistant',
            content: message.part.text,
            timestamp: new Date().toISOString(),
          };
          this.messages.push(taskMessage);
        }
        break;

      // Tool call event
      case 'tool_call':
        this.handleToolCall(message.part.tool || 'unknown', message.part.input, message.part.sessionID);
        break;

      // Tool use event - combined tool call and result
      case 'tool_use':
        const toolUseMessage = message as import('@accomplish/shared').OpenCodeToolUseMessage;
        const toolUseName = toolUseMessage.part.tool || 'unknown';
        const toolUseInput = toolUseMessage.part.state?.input;
        const toolUseOutput = toolUseMessage.part.state?.output || '';

        this.handleToolCall(toolUseName, toolUseInput, toolUseMessage.part.sessionID);

        // For models that don't emit text messages, emit the tool description
        const toolDescription = (toolUseInput as { description?: string })?.description;
        if (toolDescription) {
          const syntheticTextMessage: OpenCodeMessage = {
            type: 'text',
            timestamp: message.timestamp,
            sessionID: message.sessionID,
            part: {
              id: this.generateMessageId(),
              sessionID: toolUseMessage.part.sessionID,
              messageID: toolUseMessage.part.messageID,
              type: 'text',
              text: toolDescription,
            },
          } as import('@accomplish/shared').OpenCodeTextMessage;
          this.emit('message', syntheticTextMessage);
        }

        // Forward to handlers for message processing
        this.emit('message', message);
        const toolUseStatus = toolUseMessage.part.state?.status;

        console.log('[OpenCode Adapter] Tool use:', toolUseName, 'status:', toolUseStatus);

        // If status is completed or error, also emit tool-result
        if (toolUseStatus === 'completed' || toolUseStatus === 'error') {
          this.emit('tool-result', toolUseOutput);
        }

        // Check if this is AskUserQuestion
        if (toolUseName === 'AskUserQuestion') {
          this.handleAskUserQuestion(toolUseInput as AskUserQuestionInput);
        }
        break;

      // Tool result event
      case 'tool_result':
        const toolOutput = message.part.output || '';
        console.log('[OpenCode Adapter] Tool result received, length:', toolOutput.length);
        this.emit('tool-result', toolOutput);
        break;

      // Step finish event
      case 'step_finish':
        if (message.part.reason === 'error') {
          if (!this.hasCompleted) {
            this.hasCompleted = true;
            this.emit('complete', {
              status: 'error',
              sessionId: this.currentSessionId || undefined,
              error: 'Task failed',
            });
          }
          break;
        }

        // Delegate to completion enforcer
        const action = this.completionEnforcer.handleStepFinish(message.part.reason);
        console.log(`[OpenCode Adapter] step_finish action: ${action}`);

        if (action === 'complete' && !this.hasCompleted) {
          this.hasCompleted = true;
          this.emit('complete', {
            status: 'success',
            sessionId: this.currentSessionId || undefined,
          });
        }
        break;

      // Error event
      case 'error':
        this.hasCompleted = true;
        this.emit('complete', {
          status: 'error',
          sessionId: this.currentSessionId || undefined,
          error: message.error,
        });
        break;

      default:
        const unknownMessage = message as unknown as { type: string };
        console.log('[OpenCode Adapter] Unknown message type:', unknownMessage.type);
    }
  }

  private handleToolCall(toolName: string, toolInput: unknown, sessionID?: string): void {
    console.log('[OpenCode Adapter] Tool call:', toolName);

    // START_TASK ENFORCEMENT: Track start_task tool calls
    if (this.isStartTaskTool(toolName)) {
      this.startTaskCalled = true;
      const startInput = toolInput as StartTaskInput;
      if (startInput?.goal && startInput?.steps) {
        this.emitPlanMessage(startInput, sessionID || this.currentSessionId || '');
        // Create todos from steps
        const todos: TodoItem[] = startInput.steps.map((step, i) => ({
          id: String(i + 1),
          content: step,
          status: i === 0 ? 'in_progress' : 'pending',
          priority: 'medium',
        }));
        if (todos.length > 0) {
          this.emit('todo:update', todos);
          this.completionEnforcer.updateTodos(todos);
          console.log('[OpenCode Adapter] Created todos from start_task steps');
        }
      }
    }

    // START_TASK ENFORCEMENT: Warn if non-exempt tool called before start_task
    if (!this.startTaskCalled && !this.isExemptTool(toolName)) {
      console.warn(`[OpenCode Adapter] Tool "${toolName}" called before start_task`);
      this.emit('debug', {
        type: 'warning',
        message: `Tool "${toolName}" called before start_task - plan may not be captured`,
      });
    }

    // Mark first tool received
    if (!this.hasReceivedFirstTool) {
      this.hasReceivedFirstTool = true;
      if (this.waitingTransitionTimer) {
        clearTimeout(this.waitingTransitionTimer);
        this.waitingTransitionTimer = null;
      }
    }

    // Notify completion enforcer that tools were used
    this.completionEnforcer.markToolsUsed();

    // COMPLETION ENFORCEMENT: Track complete_task tool calls
    if (toolName === 'complete_task' || toolName.endsWith('_complete_task')) {
      this.completionEnforcer.handleCompleteTaskDetection(toolInput);
    }

    // Detect todowrite tool calls
    if (toolName === 'todowrite' || toolName.endsWith('_todowrite')) {
      const input = toolInput as { todos?: TodoItem[] };
      if (input?.todos && Array.isArray(input.todos) && input.todos.length > 0) {
        this.emit('todo:update', input.todos);
        this.completionEnforcer.updateTodos(input.todos);
      }
    }

    this.emit('tool-use', toolName, toolInput);
    this.emit('progress', {
      stage: 'tool-use',
      message: `Using ${toolName}`,
    });

    // Check if this is AskUserQuestion
    if (toolName === 'AskUserQuestion') {
      this.handleAskUserQuestion(toolInput as AskUserQuestionInput);
    }
  }

  private handleAskUserQuestion(input: AskUserQuestionInput): void {
    const question = input.questions?.[0];
    if (!question) return;

    const permissionRequest: PermissionRequest = {
      id: this.generateRequestId(),
      taskId: this.currentTaskId || '',
      type: 'question',
      question: question.question,
      options: question.options?.map((o) => ({
        label: o.label,
        description: o.description,
      })),
      multiSelect: question.multiSelect,
      createdAt: new Date().toISOString(),
    };

    this.emit('permission-request', permissionRequest);
  }

  private handleProcessExit(code: number | null): void {
    // Clean up PTY process reference
    this.ptyProcess = null;

    // Handle interrupted tasks immediately
    if (this.wasInterrupted && code === 0 && !this.hasCompleted) {
      console.log('[OpenCode CLI] Task was interrupted by user');
      this.hasCompleted = true;
      this.emit('complete', {
        status: 'interrupted',
        sessionId: this.currentSessionId || undefined,
      });
      this.currentTaskId = null;
      return;
    }

    // Delegate to completion enforcer
    if (code === 0 && !this.hasCompleted) {
      this.completionEnforcer.handleProcessExit(code).catch((error) => {
        console.error('[OpenCode Adapter] Completion enforcer error:', error);
        this.hasCompleted = true;
        this.emit('complete', {
          status: 'error',
          sessionId: this.currentSessionId || undefined,
          error: `Failed to complete: ${error.message}`,
        });
      });
      return;
    }

    // Only emit complete/error if we haven't already
    if (!this.hasCompleted) {
      if (code !== null && code !== 0) {
        this.emit('error', new Error(`OpenCode CLI exited with code ${code}`));
      }
    }

    this.currentTaskId = null;
  }

  /**
   * Spawn a session resumption task with the given prompt.
   */
  private async spawnSessionResumption(prompt: string): Promise<void> {
    const sessionId = this.currentSessionId;
    if (!sessionId) {
      throw new Error('No session ID available for session resumption');
    }

    console.log(`[OpenCode Adapter] Starting session resumption with session ${sessionId}`);

    // Reset stream parser for new process
    this.streamParser.reset();

    // Build args for resumption
    const config: TaskConfig = {
      prompt,
      sessionId: sessionId,
      workingDirectory: this.lastWorkingDirectory,
    };

    const cliArgs = await this.options.buildCliArgs(config);

    // Get the CLI path
    const { command, args: baseArgs } = this.options.getCliCommand();
    console.log('[OpenCode Adapter] Session resumption command:', command, [...baseArgs, ...cliArgs].join(' '));

    // Build environment
    const env = await this.options.buildEnvironment();

    const allArgs = [...baseArgs, ...cliArgs];
    const safeCwd = config.workingDirectory || this.options.tempPath;

    // Start new PTY process for session resumption
    const fullCommand = this.buildShellCommand(command, allArgs);

    const shellCmd = this.getPlatformShell();
    const shellArgs = this.getShellArgs(fullCommand);

    this.ptyProcess = pty.spawn(shellCmd, shellArgs, {
      name: 'xterm-256color',
      cols: 32000,
      rows: 30,
      cwd: safeCwd,
      env: env as { [key: string]: string },
    });

    // Set up event handlers for new process
    this.ptyProcess.onData((data: string) => {
      const cleanData = data
        .replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1B\][^\x07]*\x07/g, '')
        .replace(/\x1B\][^\x1B]*\x1B\\/g, '');
      if (cleanData.trim()) {
        const truncated = cleanData.substring(0, 500) + (cleanData.length > 500 ? '...' : '');
        console.log('[OpenCode CLI stdout]:', truncated);
        this.emit('debug', { type: 'stdout', message: cleanData });

        this.streamParser.feed(cleanData);
      }
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.handleProcessExit(exitCode);
    });
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Check if a tool name is the start_task tool.
   */
  private isStartTaskTool(toolName: string): boolean {
    return toolName === 'start_task' || toolName.endsWith('_start_task');
  }

  /**
   * Check if a tool is exempt from start_task enforcement.
   */
  private isExemptTool(toolName: string): boolean {
    if (toolName === 'todowrite' || toolName.endsWith('_todowrite')) {
      return true;
    }
    if (this.isStartTaskTool(toolName)) {
      return true;
    }
    return false;
  }

  /**
   * Emit a synthetic plan message to the UI when start_task is called.
   */
  private emitPlanMessage(input: StartTaskInput, sessionId: string): void {
    const verificationSection = input.verification?.length
      ? `\n\n**Verification:**\n${input.verification.map((v, i) => `${i + 1}. ${v}`).join('\n')}`
      : '';
    const skillsSection = input.skills?.length
      ? `\n\n**Skills:** ${input.skills.join(', ')}`
      : '';
    const planText = `**Plan:**\n\n**Goal:** ${input.goal}\n\n**Steps:**\n${input.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}${verificationSection}${skillsSection}`;

    const syntheticMessage: OpenCodeMessage = {
      type: 'text',
      timestamp: Date.now(),
      sessionID: sessionId,
      part: {
        id: this.generateMessageId(),
        sessionID: sessionId,
        messageID: this.generateMessageId(),
        type: 'text',
        text: planText,
      },
    } as import('@accomplish/shared').OpenCodeTextMessage;

    this.emit('message', syntheticMessage);
    console.log('[OpenCode Adapter] Emitted synthetic plan message');
  }

  /**
   * Get platform-appropriate shell command
   */
  private getPlatformShell(): string {
    if (this.options.platform === 'win32') {
      return 'cmd.exe';
    } else if (this.options.isPackaged && this.options.platform === 'darwin') {
      return '/bin/sh';
    } else {
      const userShell = process.env.SHELL;
      if (userShell) {
        return userShell;
      }
      if (fs.existsSync('/bin/bash')) return '/bin/bash';
      if (fs.existsSync('/bin/zsh')) return '/bin/zsh';
      return '/bin/sh';
    }
  }

  /**
   * Get shell arguments for running a command
   */
  private getShellArgs(command: string): string[] {
    if (this.options.platform === 'win32') {
      return ['/s', '/c', command];
    } else {
      return ['-c', command];
    }
  }
}

interface AskUserQuestionInput {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
}

interface StartTaskInput {
  original_request: string;
  goal: string;
  steps: string[];
  verification: string[];
  skills: string[];
}

/**
 * Factory function to create a new adapter instance
 */
export function createAdapter(options: AdapterOptions, taskId?: string): OpenCodeAdapter {
  return new OpenCodeAdapter(options, taskId);
}
