// packages/core/src/storage/secure-storage.ts

import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type { ApiKeyProvider } from '@accomplish/shared';

/**
 * Options for secure storage initialization
 */
export interface SecureStorageOptions {
  /** Directory path for storing the encrypted data file */
  storagePath: string;
  /** Application identifier used in key derivation (e.g., 'ai.accomplish.desktop') */
  appId: string;
  /** Storage file name (default: 'secure-storage.json') */
  fileName?: string;
}

/**
 * Schema for the secure storage file
 */
interface SecureStorageSchema {
  /** Encrypted values stored as base64 strings (format: iv:authTag:ciphertext) */
  values: Record<string, string>;
  /** Salt for key derivation (generated once per installation) */
  salt?: string;
}

// Re-export ApiKeyProvider for consumers importing from this module
export type { ApiKeyProvider };

/**
 * Secure storage class using AES-256-GCM encryption.
 *
 * This implementation derives an encryption key from machine-specific values
 * (platform, user home directory, username, app ID) to avoid OS keychain
 * prompts while still providing reasonable security for API keys.
 *
 * Security considerations:
 * - Keys are encrypted at rest using AES-256-GCM
 * - Encryption key is derived from machine-specific data (not stored)
 * - Less secure than OS Keychain (key derivation could be reverse-engineered)
 * - Suitable for API keys that can be rotated if compromised
 */
export class SecureStorage {
  private storagePath: string;
  private appId: string;
  private filePath: string;
  private derivedKey: Buffer | null = null;
  private data: SecureStorageSchema | null = null;

  constructor(options: SecureStorageOptions) {
    this.storagePath = options.storagePath;
    this.appId = options.appId;
    this.filePath = path.join(
      this.storagePath,
      options.fileName || 'secure-storage.json'
    );
  }

  /**
   * Load storage data from disk
   */
  private loadData(): SecureStorageSchema {
    if (this.data) {
      return this.data;
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(content) as SecureStorageSchema;
      } else {
        this.data = { values: {} };
      }
    } catch {
      // If file is corrupted, start fresh
      this.data = { values: {} };
    }

    return this.data;
  }

  /**
   * Save storage data to disk
   */
  private saveData(): void {
    if (!this.data) return;

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  /**
   * Get or create a salt for key derivation.
   * The salt is stored in the config file and generated once per installation.
   */
  private getSalt(): Buffer {
    const data = this.loadData();

    if (!data.salt) {
      // Generate a new random salt
      const salt = crypto.randomBytes(32);
      data.salt = salt.toString('base64');
      this.saveData();
    }

    return Buffer.from(data.salt, 'base64');
  }

  /**
   * Derive an encryption key from machine-specific data.
   * This is deterministic for the same machine/installation.
   *
   * Note: We avoid hostname as it can be changed by users (renaming laptop).
   */
  private getDerivedKey(): Buffer {
    if (this.derivedKey) {
      return this.derivedKey;
    }

    // Combine machine-specific values to create a unique identifier
    const machineData = [
      os.platform(),
      os.homedir(),
      os.userInfo().username,
      this.appId,
    ].join(':');

    const salt = this.getSalt();

    // Use PBKDF2 to derive a 256-bit key
    this.derivedKey = crypto.pbkdf2Sync(
      machineData,
      salt,
      100000, // iterations
      32, // key length (256 bits)
      'sha256'
    );

    return this.derivedKey;
  }

  /**
   * Encrypt a string using AES-256-GCM.
   * Returns format: iv:authTag:ciphertext (all base64)
   */
  private encryptValue(value: string): string {
    const key = this.getDerivedKey();
    const iv = crypto.randomBytes(12); // GCM recommended IV size

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt a value encrypted with encryptValue.
   */
  private decryptValue(encryptedData: string): string | null {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        // Invalid format
        return null;
      }

      const [ivBase64, authTagBase64, ciphertext] = parts;
      const key = this.getDerivedKey();
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      // Decryption failed (wrong key, corrupted data, etc.)
      // Don't log error details to avoid leaking sensitive context
      return null;
    }
  }

  /**
   * Store an API key securely
   */
  storeApiKey(provider: string, apiKey: string): void {
    const data = this.loadData();
    const encrypted = this.encryptValue(apiKey);
    data.values[`apiKey:${provider}`] = encrypted;
    this.saveData();
  }

  /**
   * Retrieve an API key
   */
  getApiKey(provider: string): string | null {
    const data = this.loadData();
    const encrypted = data.values[`apiKey:${provider}`];
    if (!encrypted) {
      return null;
    }
    return this.decryptValue(encrypted);
  }

  /**
   * Delete an API key
   */
  deleteApiKey(provider: string): boolean {
    const data = this.loadData();
    const key = `apiKey:${provider}`;
    if (!(key in data.values)) {
      return false;
    }
    delete data.values[key];
    this.saveData();
    return true;
  }

  /**
   * Get all API keys for all providers
   */
  async getAllApiKeys(): Promise<Record<ApiKeyProvider, string | null>> {
    const providers: ApiKeyProvider[] = [
      'anthropic',
      'openai',
      'openrouter',
      'google',
      'xai',
      'deepseek',
      'moonshot',
      'zai',
      'custom',
      'bedrock',
      'litellm',
      'minimax',
    ];

    const result: Record<string, string | null> = {};
    for (const provider of providers) {
      result[provider] = this.getApiKey(provider);
    }

    return result as Record<ApiKeyProvider, string | null>;
  }

  /**
   * Store Bedrock credentials (JSON stringified)
   */
  storeBedrockCredentials(credentials: string): void {
    this.storeApiKey('bedrock', credentials);
  }

  /**
   * Get Bedrock credentials (returns parsed object or null)
   */
  getBedrockCredentials(): Record<string, string> | null {
    const stored = this.getApiKey('bedrock');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  /**
   * Check if any API key is stored
   */
  async hasAnyApiKey(): Promise<boolean> {
    const keys = await this.getAllApiKeys();
    return Object.values(keys).some((k) => k !== null);
  }

  /**
   * List all stored credentials for this service
   * Returns key names with their (decrypted) values
   */
  listStoredCredentials(): Array<{ account: string; password: string }> {
    const data = this.loadData();
    const credentials: Array<{ account: string; password: string }> = [];

    for (const key of Object.keys(data.values)) {
      const decrypted = this.decryptValue(data.values[key]);
      if (decrypted) {
        credentials.push({
          account: key,
          password: decrypted,
        });
      }
    }

    return credentials;
  }

  /**
   * Clear all secure storage
   */
  clearSecureStorage(): void {
    this.data = { values: {} };
    this.derivedKey = null;
    this.saveData();
  }

  /**
   * Store a generic value securely
   */
  set(key: string, value: string): void {
    const data = this.loadData();
    data.values[key] = this.encryptValue(value);
    this.saveData();
  }

  /**
   * Retrieve a generic value
   */
  get(key: string): string | null {
    const data = this.loadData();
    const encrypted = data.values[key];
    if (!encrypted) {
      return null;
    }
    return this.decryptValue(encrypted);
  }

  /**
   * Delete a generic value
   */
  delete(key: string): boolean {
    const data = this.loadData();
    if (!(key in data.values)) {
      return false;
    }
    delete data.values[key];
    this.saveData();
    return true;
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    const data = this.loadData();
    return key in data.values;
  }
}

/**
 * Factory function to create a SecureStorage instance
 */
export function createSecureStorage(options: SecureStorageOptions): SecureStorage {
  return new SecureStorage(options);
}
