/**
 * Secure storage for API keys using @accomplish/core's SecureStorage.
 *
 * This module provides a thin wrapper around core's SecureStorage class,
 * configured with Electron's app paths and the application identifier.
 */

import { app } from 'electron';
import { SecureStorage, createSecureStorage } from '@accomplish/core/storage';
import type { ApiKeyProvider } from '@accomplish/shared';

// Re-export ApiKeyProvider for consumers importing from this module
export type { ApiKeyProvider };

// Use different file names for dev vs production to avoid conflicts
const getFileName = () => (app.isPackaged ? 'secure-storage.json' : 'secure-storage-dev.json');

// Lazy initialization to ensure app is ready
let _storage: SecureStorage | null = null;

function getStorage(): SecureStorage {
  if (!_storage) {
    _storage = createSecureStorage({
      storagePath: app.getPath('userData'),
      appId: 'ai.accomplish.desktop',
      fileName: getFileName(),
    });
  }
  return _storage;
}

/**
 * Store an API key securely
 */
export function storeApiKey(provider: string, apiKey: string): void {
  getStorage().storeApiKey(provider, apiKey);
}

/**
 * Retrieve an API key
 */
export function getApiKey(provider: string): string | null {
  return getStorage().getApiKey(provider);
}

/**
 * Delete an API key
 */
export function deleteApiKey(provider: string): boolean {
  return getStorage().deleteApiKey(provider);
}

/**
 * Get all API keys for all providers
 */
export async function getAllApiKeys(): Promise<Record<ApiKeyProvider, string | null>> {
  return getStorage().getAllApiKeys();
}

/**
 * Store Bedrock credentials (JSON stringified)
 */
export function storeBedrockCredentials(credentials: string): void {
  getStorage().storeBedrockCredentials(credentials);
}

/**
 * Get Bedrock credentials (returns parsed object or null)
 */
export function getBedrockCredentials(): Record<string, string> | null {
  return getStorage().getBedrockCredentials();
}

/**
 * Check if any API key is stored
 */
export async function hasAnyApiKey(): Promise<boolean> {
  return getStorage().hasAnyApiKey();
}

/**
 * List all stored credentials for this service
 * Returns key names with their (decrypted) values
 */
export function listStoredCredentials(): Array<{ account: string; password: string }> {
  return getStorage().listStoredCredentials();
}

/**
 * Clear all secure storage (used during fresh install cleanup)
 */
export function clearSecureStorage(): void {
  getStorage().clearSecureStorage();
  _storage = null; // Reset instance so it gets re-initialized on next access
}
