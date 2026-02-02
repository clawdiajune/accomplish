// packages/core/src/storage/index.ts

/**
 * Storage module for @accomplish/core
 *
 * This module provides:
 * - SecureStorage: Encrypted key-value storage for sensitive data (API keys)
 * - Database: SQLite database with migrations for app data
 * - Repositories: Data access layer for app settings, providers, tasks, and skills
 */

// Secure storage
export {
  SecureStorage,
  createSecureStorage,
  type SecureStorageOptions,
  type ApiKeyProvider,
} from './secure-storage.js';

// Database
export {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  resetDatabaseInstance,
  resetDatabase,
  databaseExists,
  isDatabaseInitialized,
  getDatabasePath,
  type DatabaseOptions,
} from './database.js';

// Migrations
export {
  runMigrations,
  CURRENT_VERSION,
  getStoredVersion,
  setStoredVersion,
  registerMigration,
  type Migration,
} from './migrations/index.js';

// Errors
export {
  FutureSchemaError,
  MigrationError,
  CorruptDatabaseError,
} from './migrations/errors.js';

// Repositories
export * from './repositories/index.js';
