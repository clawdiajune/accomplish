// apps/desktop/src/main/store/migrations/errors.ts

/**
 * Re-export migration errors from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  FutureSchemaError,
  MigrationError,
  CorruptDatabaseError,
} from '@accomplish/core';
