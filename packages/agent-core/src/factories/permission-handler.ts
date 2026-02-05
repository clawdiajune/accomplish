import { PermissionRequestHandler } from '../internal/classes/PermissionRequestHandler.js';
import type {
  PermissionHandlerAPI,
  PermissionHandlerOptions,
} from '../types/permission-handler.js';

export function createPermissionHandler(
  options?: PermissionHandlerOptions
): PermissionHandlerAPI {
  const handler = new PermissionRequestHandler(options?.defaultTimeoutMs);
  return handler;
}
