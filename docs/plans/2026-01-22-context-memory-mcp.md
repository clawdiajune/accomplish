# Context Memory MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an MCP server that persists session context across CLI restarts, enabling reliable continuations without cache loss.

**Architecture:** The agent periodically calls `update_session_context` to save its context. When continuation is needed, the adapter fetches the saved context via `get_session_context` and spawns a fresh CLI session with the summary as the prompt (no `--session` flag).

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, Node.js file storage

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Session 1 (OpenCode CLI)                  │
│  Agent works... calls update_session_context periodically   │
│  Agent calls complete_task(partial)                         │
│  CLI exits                                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Openwork Adapter                          │
│  1. Calls get_session_context() from MCP                    │
│  2. Spawns new CLI with summary prompt (no --session)       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Session 2 (Fresh CLI)                     │
│  Agent reads context from prompt                            │
│  Continues work                                             │
│  Updates context in MCP                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Task 1: Create MCP Server Scaffold

**Files:**
- Create: `apps/desktop/skills/context-memory/package.json`
- Create: `apps/desktop/skills/context-memory/tsconfig.json`
- Create: `apps/desktop/skills/context-memory/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@accomplish/context-memory-mcp",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create minimal MCP server**

```typescript
#!/usr/bin/env node
/**
 * context-memory MCP Server
 *
 * PURPOSE: Persists session context across CLI restarts to enable
 * reliable continuations without cache loss.
 *
 * TOOLS:
 * - update_session_context: Agent calls to save current context
 * - get_session_context: Adapter calls to retrieve context for continuation
 * - clear_session_context: Clean up after task completion
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

console.error('[context-memory] Starting MCP server...');

const server = new Server(
  { name: 'context-memory', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Placeholder handlers - will implement in next tasks
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[context-memory] MCP server running');
}

main().catch((error) => {
  console.error('[context-memory] Fatal error:', error);
  process.exit(1);
});
```

**Step 4: Install dependencies**

Run: `cd apps/desktop/skills/context-memory && pnpm install`
Expected: Dependencies installed successfully

**Step 5: Verify server starts**

Run: `cd apps/desktop/skills/context-memory && echo '{}' | npx tsx src/index.ts`
Expected: Should see `[context-memory] MCP server running` in stderr

**Step 6: Commit**

```bash
git add apps/desktop/skills/context-memory/
git commit -m "$(cat <<'EOF'
feat(mcp): add context-memory server scaffold

Creates the basic structure for a new MCP server that will persist
session context across CLI restarts.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Define Context Data Types

**Files:**
- Create: `apps/desktop/skills/context-memory/src/types.ts`

**Step 1: Create types file**

```typescript
/**
 * Types for session context storage
 */

/**
 * A single tool call record
 */
export interface ToolCallRecord {
  name: string;
  timestamp: string;
  input?: unknown;
  output?: string;
  status: 'pending' | 'completed' | 'error';
}

/**
 * Files that were modified during the session
 */
export interface FileModification {
  path: string;
  operation: 'created' | 'modified' | 'deleted' | 'read';
  timestamp: string;
}

/**
 * The full session context stored by the MCP server
 */
export interface SessionContext {
  /** Session identifier */
  sessionId: string;

  /** Task identifier (for multi-task support) */
  taskId: string;

  /** When context was last updated */
  updatedAt: string;

  /** Original user request */
  originalRequest: string;

  /** Current summary of work completed */
  summary: string;

  /** Key decisions made during the task */
  keyDecisions: string[];

  /** Files that were touched */
  filesModified: FileModification[];

  /** Current status: what the agent is working on */
  currentStatus: string;

  /** Remaining work if partial completion */
  remainingWork?: string;

  /** Recent tool calls (last N for brevity) */
  recentToolCalls: ToolCallRecord[];

  /** Any blockers encountered */
  blockers: string[];

  /** Token estimate for the full session (optional) */
  estimatedTokens?: number;
}

/**
 * Input for update_session_context tool
 */
export interface UpdateContextInput {
  original_request: string;
  summary: string;
  current_status: string;
  key_decisions?: string[];
  files_modified?: string[];
  remaining_work?: string;
  blockers?: string[];
}

/**
 * Output from get_session_context tool
 */
export interface GetContextOutput {
  has_context: boolean;
  context?: SessionContext;
  formatted_prompt?: string;
}
```

**Step 2: Commit**

```bash
git add apps/desktop/skills/context-memory/src/types.ts
git commit -m "$(cat <<'EOF'
feat(context-memory): add context data types

Defines TypeScript interfaces for session context storage including
tool call records, file modifications, and the full session context.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Implement Context Storage

**Files:**
- Create: `apps/desktop/skills/context-memory/src/storage.ts`

**Step 1: Create storage module**

```typescript
/**
 * Storage module for session context
 *
 * Uses file-based storage in the app data directory.
 * Each task gets its own context file.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SessionContext } from './types.js';

// Storage directory: ~/.accomplish/context-memory/
const STORAGE_DIR = path.join(os.homedir(), '.accomplish', 'context-memory');

/**
 * Ensure storage directory exists
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Get the file path for a task's context
 */
function getContextPath(taskId: string): string {
  // Sanitize taskId to prevent path traversal
  const safeId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STORAGE_DIR, `${safeId}.json`);
}

/**
 * Save session context to storage
 */
export function saveContext(context: SessionContext): void {
  ensureStorageDir();
  const filePath = getContextPath(context.taskId);
  const data = JSON.stringify(context, null, 2);
  fs.writeFileSync(filePath, data, 'utf-8');
  console.error(`[context-memory] Saved context for task ${context.taskId}`);
}

/**
 * Load session context from storage
 */
export function loadContext(taskId: string): SessionContext | null {
  const filePath = getContextPath(taskId);
  if (!fs.existsSync(filePath)) {
    console.error(`[context-memory] No context found for task ${taskId}`);
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const context = JSON.parse(data) as SessionContext;
    console.error(`[context-memory] Loaded context for task ${taskId}`);
    return context;
  } catch (error) {
    console.error(`[context-memory] Failed to load context: ${error}`);
    return null;
  }
}

/**
 * Delete session context from storage
 */
export function deleteContext(taskId: string): boolean {
  const filePath = getContextPath(taskId);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    fs.unlinkSync(filePath);
    console.error(`[context-memory] Deleted context for task ${taskId}`);
    return true;
  } catch (error) {
    console.error(`[context-memory] Failed to delete context: ${error}`);
    return false;
  }
}

/**
 * List all stored task IDs
 */
export function listContexts(): string[] {
  ensureStorageDir();
  const files = fs.readdirSync(STORAGE_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}
```

**Step 2: Commit**

```bash
git add apps/desktop/skills/context-memory/src/storage.ts
git commit -m "$(cat <<'EOF'
feat(context-memory): implement file-based context storage

Adds functions to save, load, delete, and list session contexts.
Stores contexts in ~/.accomplish/context-memory/ as JSON files.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Implement update_session_context Tool

**Files:**
- Modify: `apps/desktop/skills/context-memory/src/index.ts`

**Step 1: Add tool definition to ListToolsRequestSchema handler**

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'update_session_context',
      description:
        'Save your current session context. Call this periodically during long tasks and always before calling complete_task(partial). This ensures context is preserved if the session needs to restart.',
      inputSchema: {
        type: 'object',
        required: ['original_request', 'summary', 'current_status'],
        properties: {
          original_request: {
            type: 'string',
            description: 'The original user request (what they asked for)',
          },
          summary: {
            type: 'string',
            description: 'Summary of work completed so far',
          },
          current_status: {
            type: 'string',
            description: 'What you are currently working on',
          },
          key_decisions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key decisions made and why',
          },
          files_modified: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of file paths that were modified',
          },
          remaining_work: {
            type: 'string',
            description: 'What still needs to be done',
          },
          blockers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Any blockers or issues encountered',
          },
        },
      },
    },
  ],
}));
```

**Step 2: Add tool handler**

```typescript
import { saveContext, loadContext } from './storage.js';
import type { SessionContext, UpdateContextInput } from './types.js';

// Get task ID from environment (set by adapter)
const TASK_ID = process.env.ACCOMPLISH_TASK_ID || 'default';
const SESSION_ID = process.env.ACCOMPLISH_SESSION_ID || `session_${Date.now()}`;

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  if (toolName === 'update_session_context') {
    const input = request.params.arguments as UpdateContextInput;

    // Load existing context or create new one
    let context = loadContext(TASK_ID);
    const now = new Date().toISOString();

    if (!context) {
      context = {
        sessionId: SESSION_ID,
        taskId: TASK_ID,
        updatedAt: now,
        originalRequest: input.original_request,
        summary: input.summary,
        keyDecisions: input.key_decisions || [],
        filesModified: [],
        currentStatus: input.current_status,
        remainingWork: input.remaining_work,
        recentToolCalls: [],
        blockers: input.blockers || [],
      };
    } else {
      // Update existing context
      context.updatedAt = now;
      context.summary = input.summary;
      context.currentStatus = input.current_status;
      if (input.key_decisions) {
        // Append new decisions, avoid duplicates
        const newDecisions = input.key_decisions.filter(
          (d) => !context!.keyDecisions.includes(d)
        );
        context.keyDecisions.push(...newDecisions);
      }
      if (input.remaining_work !== undefined) {
        context.remainingWork = input.remaining_work;
      }
      if (input.blockers) {
        context.blockers = input.blockers;
      }
    }

    // Update files modified
    if (input.files_modified) {
      for (const filePath of input.files_modified) {
        const existing = context.filesModified.find((f) => f.path === filePath);
        if (!existing) {
          context.filesModified.push({
            path: filePath,
            operation: 'modified',
            timestamp: now,
          });
        }
      }
    }

    saveContext(context);

    return {
      content: [
        {
          type: 'text',
          text: `Context saved successfully. Last updated: ${context.updatedAt}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
});
```

**Step 3: Commit**

```bash
git add apps/desktop/skills/context-memory/src/index.ts
git commit -m "$(cat <<'EOF'
feat(context-memory): implement update_session_context tool

Agent can now save its context by calling this tool. Context is
persisted to disk and survives session restarts.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Implement get_session_context Tool

**Files:**
- Modify: `apps/desktop/skills/context-memory/src/index.ts`

**Step 1: Add tool definition**

Add to the tools array in ListToolsRequestSchema handler:

```typescript
{
  name: 'get_session_context',
  description:
    'Retrieve saved session context. Used by the system to restore context when continuing a session.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Task ID to get context for (defaults to current task)',
      },
      format: {
        type: 'string',
        enum: ['raw', 'prompt'],
        description: 'Output format: raw JSON or formatted prompt',
      },
    },
  },
},
```

**Step 2: Add formatter function**

```typescript
/**
 * Format context as a continuation prompt
 */
function formatContextAsPrompt(context: SessionContext): string {
  const sections: string[] = [];

  sections.push('## Session Context (Continuation)');
  sections.push('');
  sections.push('### Original Request');
  sections.push(context.originalRequest);
  sections.push('');

  sections.push('### Work Completed');
  sections.push(context.summary);
  sections.push('');

  if (context.keyDecisions.length > 0) {
    sections.push('### Key Decisions');
    for (const decision of context.keyDecisions) {
      sections.push(`- ${decision}`);
    }
    sections.push('');
  }

  if (context.filesModified.length > 0) {
    sections.push('### Files Touched');
    for (const file of context.filesModified) {
      sections.push(`- ${file.path} (${file.operation})`);
    }
    sections.push('');
  }

  sections.push('### Current Status');
  sections.push(context.currentStatus);
  sections.push('');

  if (context.remainingWork) {
    sections.push('### Remaining Work');
    sections.push(context.remainingWork);
    sections.push('');
  }

  if (context.blockers.length > 0) {
    sections.push('### Blockers');
    for (const blocker of context.blockers) {
      sections.push(`- ${blocker}`);
    }
    sections.push('');
  }

  sections.push('---');
  sections.push('');
  sections.push('**IMPORTANT**: Continue from where you left off. All context you need is above.');
  sections.push('When done, call complete_task with the final status.');
  sections.push('Remember to call update_session_context periodically to save your progress.');

  return sections.join('\n');
}
```

**Step 3: Add tool handler**

Add to the CallToolRequestSchema handler:

```typescript
if (toolName === 'get_session_context') {
  const args = request.params.arguments as {
    task_id?: string;
    format?: 'raw' | 'prompt';
  };

  const taskId = args.task_id || TASK_ID;
  const format = args.format || 'prompt';
  const context = loadContext(taskId);

  if (!context) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ has_context: false }),
        },
      ],
    };
  }

  if (format === 'raw') {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ has_context: true, context }),
        },
      ],
    };
  }

  // Format as prompt
  const formattedPrompt = formatContextAsPrompt(context);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          has_context: true,
          formatted_prompt: formattedPrompt,
        }),
      },
    ],
  };
}
```

**Step 4: Commit**

```bash
git add apps/desktop/skills/context-memory/src/index.ts
git commit -m "$(cat <<'EOF'
feat(context-memory): implement get_session_context tool

Allows retrieving saved context either as raw JSON or formatted
as a continuation prompt.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Implement clear_session_context Tool

**Files:**
- Modify: `apps/desktop/skills/context-memory/src/index.ts`

**Step 1: Add tool definition**

Add to the tools array:

```typescript
{
  name: 'clear_session_context',
  description:
    'Clear saved session context. Called automatically when a task completes successfully.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Task ID to clear context for (defaults to current task)',
      },
    },
  },
},
```

**Step 2: Add tool handler**

```typescript
if (toolName === 'clear_session_context') {
  const args = request.params.arguments as { task_id?: string };
  const taskId = args.task_id || TASK_ID;
  const deleted = deleteContext(taskId);

  return {
    content: [
      {
        type: 'text',
        text: deleted
          ? `Context cleared for task ${taskId}`
          : `No context found for task ${taskId}`,
      },
    ],
  };
}
```

**Step 3: Commit**

```bash
git add apps/desktop/skills/context-memory/src/index.ts
git commit -m "$(cat <<'EOF'
feat(context-memory): implement clear_session_context tool

Allows cleaning up stored context when a task completes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Register MCP Server in Config Generator

**Files:**
- Modify: `apps/desktop/src/main/opencode/config-generator.ts`

**Step 1: Add context-memory MCP to the mcp config object**

Find the `mcp` object in the config (around line 611) and add:

```typescript
'context-memory': {
  type: 'local',
  command: ['npx', 'tsx', path.join(skillsPath, 'context-memory', 'src', 'index.ts')],
  enabled: true,
  environment: {
    ACCOMPLISH_TASK_ID: process.env.ACCOMPLISH_TASK_ID || '',
    ACCOMPLISH_SESSION_ID: '', // Will be set by adapter
  },
  timeout: 5000,
},
```

**Step 2: Commit**

```bash
git add apps/desktop/src/main/opencode/config-generator.ts
git commit -m "$(cat <<'EOF'
feat(config): register context-memory MCP server

Adds the context-memory MCP server to the OpenCode configuration
so it's available to agents.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update Agent System Prompt

**Files:**
- Modify: `apps/desktop/src/main/opencode/config-generator.ts`

**Step 1: Add context-memory instructions to system prompt**

Find the `ACCOMPLISH_SYSTEM_PROMPT_TEMPLATE` and add after the task completion section:

```typescript
<behavior name="context-persistence">
**CONTEXT PERSISTENCE - FOR LONG TASKS**

For tasks that may take many steps or could be interrupted, periodically save your context:

1. **When to save context:**
   - After completing a significant piece of work
   - Before calling complete_task(partial)
   - Every 5-10 tool calls during long tasks
   - When you've made an important decision

2. **How to save context:**
   Call \`update_session_context\` with:
   - original_request: What the user asked for
   - summary: What you've done so far
   - current_status: What you're working on now
   - key_decisions: Important choices you made (optional)
   - files_modified: Files you touched (optional)
   - remaining_work: What's left to do (optional)

3. **Why this matters:**
   If your session needs to restart (API limits, errors, continuation),
   the saved context lets you pick up exactly where you left off.

**Example:**
\`\`\`
update_session_context({
  original_request: "Add user authentication to the app",
  summary: "Created auth module, added login form component",
  current_status: "Implementing logout functionality",
  key_decisions: ["Using JWT tokens", "Auth0 for OAuth"],
  files_modified: ["src/auth/index.ts", "src/components/LoginForm.tsx"],
  remaining_work: "Add logout button, test authentication flow"
})
\`\`\`
</behavior>
```

**Step 2: Commit**

```bash
git add apps/desktop/src/main/opencode/config-generator.ts
git commit -m "$(cat <<'EOF'
feat(agent): add context persistence instructions to system prompt

Teaches the agent to periodically save its context using the
update_session_context tool for reliable continuations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Modify Adapter for Summary-Based Continuation

**Files:**
- Modify: `apps/desktop/src/main/opencode/adapter.ts`

**Step 1: Add method to fetch context from MCP**

Add near the spawnSessionResumption method:

```typescript
/**
 * Fetch context from the context-memory MCP server.
 * This is called before spawning a continuation to get the saved context.
 */
private async fetchSavedContext(): Promise<string | null> {
  // The context is stored in ~/.accomplish/context-memory/{taskId}.json
  // We read it directly since MCP server may not be running
  const contextPath = path.join(
    app.getPath('home'),
    '.accomplish',
    'context-memory',
    `${this.currentTaskId || 'default'}.json`
  );

  try {
    if (!fs.existsSync(contextPath)) {
      console.log('[OpenCode Adapter] No saved context found');
      return null;
    }

    const data = fs.readFileSync(contextPath, 'utf-8');
    const context = JSON.parse(data);

    // Format as continuation prompt
    const sections: string[] = [];
    sections.push('## Session Context (Continuation)\n');
    sections.push('### Original Request');
    sections.push(context.originalRequest + '\n');
    sections.push('### Work Completed');
    sections.push(context.summary + '\n');

    if (context.keyDecisions?.length > 0) {
      sections.push('### Key Decisions');
      for (const decision of context.keyDecisions) {
        sections.push(`- ${decision}`);
      }
      sections.push('');
    }

    if (context.filesModified?.length > 0) {
      sections.push('### Files Touched');
      for (const file of context.filesModified) {
        sections.push(`- ${file.path} (${file.operation})`);
      }
      sections.push('');
    }

    sections.push('### Current Status');
    sections.push(context.currentStatus + '\n');

    if (context.remainingWork) {
      sections.push('### Remaining Work');
      sections.push(context.remainingWork + '\n');
    }

    sections.push('---\n');
    sections.push('**IMPORTANT**: Continue from where you left off. All context you need is above.');
    sections.push('When done, call complete_task with the final status.');

    return sections.join('\n');
  } catch (error) {
    console.error('[OpenCode Adapter] Failed to fetch saved context:', error);
    return null;
  }
}
```

**Step 2: Modify spawnSessionResumption to use saved context**

Replace the existing spawnSessionResumption with:

```typescript
/**
 * Spawn a continuation task.
 *
 * NEW APPROACH: Use saved context instead of --session flag.
 * This avoids cache invalidation and provides reliable context.
 */
private async spawnSessionResumption(prompt: string): Promise<void> {
  console.log('[OpenCode Adapter] Starting summary-based continuation');

  // Try to get saved context
  const savedContext = await this.fetchSavedContext();

  let fullPrompt: string;
  if (savedContext) {
    // Combine saved context with continuation prompt
    fullPrompt = `${savedContext}\n\n${prompt}`;
    console.log('[OpenCode Adapter] Using saved context for continuation');
  } else {
    // No saved context - just use the prompt
    fullPrompt = prompt;
    console.log('[OpenCode Adapter] No saved context, using prompt only');
  }

  // Reset stream parser for new process
  this.streamParser.reset();

  // Build args WITHOUT --session flag (fresh conversation)
  const config: TaskConfig = {
    prompt: fullPrompt,
    // NO sessionId - this is intentional!
    workingDirectory: this.lastWorkingDirectory,
  };

  const cliArgs = await this.buildCliArgs(config);

  // Get the bundled CLI path
  const { command, args: baseArgs } = getOpenCodeCliPath();
  console.log('[OpenCode Adapter] Summary continuation command:', command);

  // Build environment
  const env = await this.buildEnvironment();

  const allArgs = [...baseArgs, ...cliArgs];
  const safeCwd = config.workingDirectory || app.getPath('temp');

  // Start new PTY process
  const fullCommand = this.buildShellCommand(command, allArgs);
  const shellCmd = this.getPlatformShell();
  const shellArgs = this.getShellArgs(fullCommand);

  this.ptyProcess = pty.spawn(shellCmd, shellArgs, {
    name: 'xterm-256color',
    cols: 200,
    rows: 30,
    cwd: safeCwd,
    env: env as { [key: string]: string },
  });

  // Set up event handlers
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
```

**Step 3: Add fs import at the top**

```typescript
import fs from 'fs';
```

**Step 4: Commit**

```bash
git add apps/desktop/src/main/opencode/adapter.ts
git commit -m "$(cat <<'EOF'
feat(adapter): implement summary-based continuation

Instead of using --session flag (which loses cache), continuations
now use saved context from the context-memory MCP server.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add Unit Tests

**Files:**
- Create: `apps/desktop/skills/context-memory/src/storage.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveContext, loadContext, deleteContext, listContexts } from './storage.js';
import type { SessionContext } from './types.js';

// Use a test-specific directory
const TEST_STORAGE_DIR = path.join(os.tmpdir(), 'context-memory-test');

describe('storage', () => {
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true });
    }
  });

  it('should save and load context', () => {
    const context: SessionContext = {
      sessionId: 'test-session',
      taskId: 'test-task',
      updatedAt: new Date().toISOString(),
      originalRequest: 'Test request',
      summary: 'Test summary',
      keyDecisions: ['Decision 1'],
      filesModified: [],
      currentStatus: 'Testing',
      recentToolCalls: [],
      blockers: [],
    };

    saveContext(context);
    const loaded = loadContext('test-task');

    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe('test-session');
    expect(loaded?.originalRequest).toBe('Test request');
  });

  it('should return null for non-existent context', () => {
    const loaded = loadContext('non-existent');
    expect(loaded).toBeNull();
  });

  it('should delete context', () => {
    const context: SessionContext = {
      sessionId: 'test-session',
      taskId: 'delete-test',
      updatedAt: new Date().toISOString(),
      originalRequest: 'Test',
      summary: 'Test',
      keyDecisions: [],
      filesModified: [],
      currentStatus: 'Test',
      recentToolCalls: [],
      blockers: [],
    };

    saveContext(context);
    expect(loadContext('delete-test')).not.toBeNull();

    const deleted = deleteContext('delete-test');
    expect(deleted).toBe(true);
    expect(loadContext('delete-test')).toBeNull();
  });

  it('should list all contexts', () => {
    const context1: SessionContext = {
      sessionId: 's1',
      taskId: 'task-1',
      updatedAt: new Date().toISOString(),
      originalRequest: 'Test 1',
      summary: 'Test 1',
      keyDecisions: [],
      filesModified: [],
      currentStatus: 'Test',
      recentToolCalls: [],
      blockers: [],
    };

    const context2: SessionContext = {
      sessionId: 's2',
      taskId: 'task-2',
      updatedAt: new Date().toISOString(),
      originalRequest: 'Test 2',
      summary: 'Test 2',
      keyDecisions: [],
      filesModified: [],
      currentStatus: 'Test',
      recentToolCalls: [],
      blockers: [],
    };

    saveContext(context1);
    saveContext(context2);

    const list = listContexts();
    expect(list).toContain('task-1');
    expect(list).toContain('task-2');
  });
});
```

**Step 2: Run tests**

Run: `cd apps/desktop/skills/context-memory && pnpm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add apps/desktop/skills/context-memory/src/storage.test.ts
git commit -m "$(cat <<'EOF'
test(context-memory): add unit tests for storage module

Tests save, load, delete, and list operations for context storage.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Integration Test

**Files:**
- Manual testing

**Step 1: Build the project**

Run: `cd /Users/danielscharfstein/Documents/accomplish/github-repos/openwork.fix-prompt-size-limit && pnpm build`
Expected: Build succeeds

**Step 2: Run in dev mode**

Run: `pnpm dev`
Expected: App starts without errors

**Step 3: Test context persistence manually**

1. Start a task that will require continuation (e.g., a long browser automation task)
2. Verify agent calls `update_session_context`
3. Interrupt the task or wait for partial completion
4. Verify continuation uses saved context instead of `--session` flag
5. Check `~/.accomplish/context-memory/` for stored context files

**Step 4: Commit final changes if any**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: integration testing and cleanup

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements an MCP-based context memory system that:

1. **Stores context reliably**: Agent saves context via `update_session_context`
2. **Survives restarts**: Context persists in `~/.accomplish/context-memory/`
3. **Enables clean continuations**: Adapter uses saved context instead of `--session` flag
4. **Avoids cache loss**: Fresh CLI sessions don't invalidate Anthropic's cache
5. **Prevents unbounded growth**: Each continuation starts fresh with summarized context

The agent is instructed to call `update_session_context` periodically, ensuring that even if a session needs to restart, the context is preserved.
