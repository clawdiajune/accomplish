/**
 * Electron-specific handlers for @accomplish/core integration.
 *
 * These handlers implement the core interfaces (PermissionHandler, TaskEventHandler)
 * using Electron IPC to communicate with the renderer process.
 */

export { ElectronPermissionHandler } from './ElectronPermissionHandler';
export { ElectronEventHandler } from './ElectronEventHandler';
