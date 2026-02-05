import type { Task, TaskConfig, TaskStatus, TaskResult } from '../common/types/task';
import type { PermissionRequest } from '../common/types/permission';
import type { TodoItem } from '../common/types/todo';
import type { OpenCodeMessage } from '../common/types/opencode';

export interface TaskProgressEvent {
  stage: string;
  message?: string;
  isFirstTask?: boolean;
  modelName?: string;
}

export interface TaskCallbacks {
  onMessage: (message: OpenCodeMessage) => void;
  onProgress: (progress: TaskProgressEvent) => void;
  onPermissionRequest: (request: PermissionRequest) => void;
  onComplete: (result: TaskResult) => void;
  onError: (error: Error) => void;
  onStatusChange?: (status: TaskStatus) => void;
  onDebug?: (log: { type: string; message: string; data?: unknown }) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  onAuthError?: (error: { providerId: string; message: string }) => void;
}

export interface TaskAdapterOptions {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  tempPath: string;
  getCliCommand: () => { command: string; args: string[] };
  buildEnvironment: (taskId: string) => Promise<NodeJS.ProcessEnv>;
  buildCliArgs: (config: TaskConfig, taskId: string) => Promise<string[]>;
  onBeforeStart?: () => Promise<void>;
  getModelDisplayName?: (modelId: string) => string;
}

export interface TaskManagerOptions {
  adapterOptions: TaskAdapterOptions;
  defaultWorkingDirectory: string;
  maxConcurrentTasks?: number;
  isCliAvailable: () => Promise<boolean>;
  onBeforeTaskStart?: (callbacks: TaskCallbacks, isFirstTask: boolean) => Promise<void>;
}

export interface TaskManagerAPI {
  startTask(taskId: string, config: TaskConfig, callbacks: TaskCallbacks): Promise<Task>;
  cancelTask(taskId: string): Promise<void>;
  interruptTask(taskId: string): Promise<void>;
  cancelQueuedTask(taskId: string): boolean;
  sendResponse(taskId: string, response: string): Promise<void>;
  getSessionId(taskId: string): string | null;
  isTaskRunning(taskId: string): boolean;
  hasActiveTask(taskId: string): boolean;
  hasRunningTask(): boolean;
  isTaskQueued(taskId: string): boolean;
  getQueuePosition(taskId: string): number;
  getQueueLength(): number;
  getActiveTaskIds(): string[];
  getActiveTaskId(): string | null;
  getActiveTaskCount(): number;
  getIsFirstTask(): boolean;
  cancelAllTasks(): void;
  dispose(): void;
}
