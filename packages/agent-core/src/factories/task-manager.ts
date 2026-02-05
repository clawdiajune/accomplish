import { TaskManager } from '../internal/classes/TaskManager.js';
import type {
  TaskManagerOptions,
  TaskManagerAPI,
  TaskCallbacks,
  TaskProgressEvent,
  TaskAdapterOptions,
} from '../types/task-manager.js';
import type { TaskConfig, Task } from '../common/types/task.js';

export function createTaskManager(options: TaskManagerOptions): TaskManagerAPI {
  const taskManager = new TaskManager(options);

  return {
    startTask(
      taskId: string,
      config: TaskConfig,
      callbacks: TaskCallbacks
    ): Promise<Task> {
      return taskManager.startTask(taskId, config, callbacks);
    },

    cancelTask(taskId: string): Promise<void> {
      return taskManager.cancelTask(taskId);
    },

    interruptTask(taskId: string): Promise<void> {
      return taskManager.interruptTask(taskId);
    },

    cancelQueuedTask(taskId: string): boolean {
      return taskManager.cancelQueuedTask(taskId);
    },

    sendResponse(taskId: string, response: string): Promise<void> {
      return taskManager.sendResponse(taskId, response);
    },

    getSessionId(taskId: string): string | null {
      return taskManager.getSessionId(taskId);
    },

    isTaskRunning(taskId: string): boolean {
      return taskManager.isTaskRunning(taskId);
    },

    hasActiveTask(taskId: string): boolean {
      return taskManager.hasActiveTask(taskId);
    },

    hasRunningTask(): boolean {
      return taskManager.hasRunningTask();
    },

    isTaskQueued(taskId: string): boolean {
      return taskManager.isTaskQueued(taskId);
    },

    getQueuePosition(taskId: string): number {
      return taskManager.getQueuePosition(taskId);
    },

    getQueueLength(): number {
      return taskManager.getQueueLength();
    },

    getActiveTaskIds(): string[] {
      return taskManager.getActiveTaskIds();
    },

    getActiveTaskId(): string | null {
      return taskManager.getActiveTaskId();
    },

    getActiveTaskCount(): number {
      return taskManager.getActiveTaskCount();
    },

    getIsFirstTask(): boolean {
      return taskManager.getIsFirstTask();
    },

    cancelAllTasks(): void {
      return taskManager.cancelAllTasks();
    },

    dispose(): void {
      return taskManager.dispose();
    },
  };
}

export type { TaskManagerOptions, TaskManagerAPI, TaskCallbacks, TaskProgressEvent, TaskAdapterOptions };
