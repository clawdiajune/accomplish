/**
 * Electron-specific implementation of PermissionHandler.
 *
 * Bridges permission requests from the core OpenCode adapter to the
 * Electron renderer process via IPC.
 */

import type { BrowserWindow } from 'electron';
import type { PermissionHandler, PermissionRequest, PermissionResponse } from '@accomplish/core';

/**
 * Stored request info for creating deny responses
 */
interface PendingRequest {
  requestId: string;
  taskId: string;
  resolve: (response: PermissionResponse) => void;
}

/**
 * Handler for permission requests that forwards them to the Electron renderer
 * and waits for the user's response via IPC.
 */
export class ElectronPermissionHandler implements PermissionHandler {
  private mainWindow: BrowserWindow;
  private pendingRequests = new Map<string, PendingRequest>();

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Request permission from the user by forwarding to the renderer.
   * The actual resolution is handled by resolvePermission() when
   * the user responds via IPC.
   */
  async requestPermission(request: PermissionRequest): Promise<PermissionResponse> {
    return new Promise((resolve) => {
      // Generate a unique ID for this request if not provided
      const requestId = request.id || `perm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const requestWithId = { ...request, id: requestId };

      // Store the resolver and request info for later
      this.pendingRequests.set(requestId, {
        requestId,
        taskId: request.taskId,
        resolve,
      });

      // Send to renderer
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('permission:request', requestWithId);
      } else {
        // Window destroyed, deny by default
        this.pendingRequests.delete(requestId);
        resolve({
          requestId,
          taskId: request.taskId,
          decision: 'deny',
        });
      }
    });
  }

  /**
   * Resolve a pending permission request.
   * Called when the user responds via IPC.
   *
   * @returns true if the request was found and resolved, false otherwise
   */
  resolvePermission(requestId: string, response: PermissionResponse): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      this.pendingRequests.delete(requestId);
      pending.resolve(response);
      return true;
    }
    return false;
  }

  /**
   * Check if there's a pending permission request with the given ID.
   */
  hasPendingRequest(requestId: string): boolean {
    return this.pendingRequests.has(requestId);
  }

  /**
   * Cancel all pending permission requests (e.g., on window close).
   */
  cancelAllPending(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      pending.resolve({
        requestId: pending.requestId,
        taskId: pending.taskId,
        decision: 'deny',
      });
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Update the main window reference (e.g., when window is recreated).
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }
}
