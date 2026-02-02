// apps/desktop/src/main/store/migrations/index.ts

/**
 * Re-export migrations module from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  runMigrations,
  CURRENT_VERSION,
  getStoredVersion,
  setStoredVersion,
  registerMigration,
  FutureSchemaError,
  MigrationError,
  CorruptDatabaseError,
  type Migration,
} from '@accomplish/core';
