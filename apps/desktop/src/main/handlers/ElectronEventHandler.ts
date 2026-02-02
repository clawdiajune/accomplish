/**
 * Electron-specific implementation of TaskEventHandler.
 *
 * Bridges task events from the core OpenCode adapter to the
 * Electron renderer process via IPC.
 */

import type { BrowserWindow } from 'electron';
import type {
  TaskEventHandler,
  TaskMessage,
  TaskProgress,
  TaskResult,
} from '@accomplish/core';

/**
 * Handler for task events that forwards them to the Electron renderer via IPC.
 */
export class ElectronEventHandler implements TaskEventHandler {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Forward a task message to the renderer.
   */
  onMessage(taskId: string, message: TaskMessage): void {
    this.send('task:message', { taskId, message });
  }

  /**
   * Forward task progress updates to the renderer.
   */
  onProgress(taskId: string, progress: TaskProgress): void {
    this.send('task:progress', { taskId, progress });
  }

  /**
   * Forward tool usage notifications to the renderer.
   */
  onToolUse(taskId: string, toolName: string, toolInput: unknown): void {
    this.send('task:tool-use', { taskId, toolName, toolInput });
  }

  /**
   * Forward task completion to the renderer.
   */
  onComplete(taskId: string, result: TaskResult): void {
    this.send('task:complete', { taskId, result });
  }

  /**
   * Forward task errors to the renderer.
   */
  onError(taskId: string, error: Error): void {
    this.send('task:error', {
      taskId,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    });
  }

  /**
   * Forward task cancellation to the renderer.
   */
  onCancelled(taskId: string): void {
    this.send('task:cancelled', { taskId });
  }

  /**
   * Update the main window reference (e.g., when window is recreated).
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Send data to the renderer via IPC if the window is still valid.
   */
  private send(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
