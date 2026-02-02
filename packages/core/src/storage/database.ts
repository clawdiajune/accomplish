// packages/core/src/storage/database.ts

import Database from 'better-sqlite3';
import fs from 'fs';
import { runMigrations, getStoredVersion, CURRENT_VERSION } from './migrations/index.js';
import { FutureSchemaError } from './migrations/errors.js';

/**
 * Options for database initialization
 */
export interface DatabaseOptions {
  /** Full path to the database file */
  databasePath: string;
  /** Whether to run migrations on initialization (default: true) */
  runMigrations?: boolean;
}

let _db: Database.Database | null = null;
let _currentPath: string | null = null;

/**
 * Get or create the database connection.
 * The database must be initialized with initializeDatabase() before use.
 *
 * @throws Error if database has not been initialized
 */
export function getDatabase(): Database.Database {
  if (!_db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.'
    );
  }
  return _db;
}

/**
 * Initialize the database connection.
 * Creates the database file if it doesn't exist and optionally runs migrations.
 *
 * @param options Database configuration options
 * @throws FutureSchemaError if the database is from a newer app version
 */
export function initializeDatabase(options: DatabaseOptions): Database.Database {
  const { databasePath, runMigrations: shouldRunMigrations = true } = options;

  // If already initialized with same path, return existing connection
  if (_db && _currentPath === databasePath) {
    return _db;
  }

  // Close existing connection if switching databases
  if (_db) {
    closeDatabase();
  }

  console.log('[DB] Opening database at:', databasePath);

  _db = new Database(databasePath);
  _currentPath = databasePath;

  // Enable WAL mode for better concurrent performance
  _db.pragma('journal_mode = WAL');

  // Enable foreign key enforcement
  _db.pragma('foreign_keys = ON');

  // Check schema version before running migrations
  if (shouldRunMigrations) {
    const storedVersion = getStoredVersion(_db);
    if (storedVersion > CURRENT_VERSION) {
      const error = new FutureSchemaError(storedVersion, CURRENT_VERSION);
      closeDatabase();
      throw error;
    }

    runMigrations(_db);
    console.log('[DB] Database initialized and migrations complete');
  }

  return _db;
}

/**
 * Close the database connection.
 * Call this on app shutdown.
 */
export function closeDatabase(): void {
  if (_db) {
    console.log('[DB] Closing database connection');
    _db.close();
    _db = null;
    _currentPath = null;
  }
}

/**
 * Reset the database instance.
 * Used for testing or when reinitializing with different options.
 */
export function resetDatabaseInstance(): void {
  closeDatabase();
}

/**
 * Check if the database has been initialized.
 */
export function isDatabaseInitialized(): boolean {
  return _db !== null;
}

/**
 * Get the current database path, if initialized.
 */
export function getDatabasePath(): string | null {
  return _currentPath;
}

/**
 * Reset the database by backing up and removing the current file.
 * Used for recovery from corruption.
 *
 * @param databasePath Path to the database file
 */
export function resetDatabase(databasePath: string): void {
  closeDatabase();

  if (fs.existsSync(databasePath)) {
    const backupPath = `${databasePath}.corrupt.${Date.now()}`;
    console.log('[DB] Backing up corrupt database to:', backupPath);
    fs.renameSync(databasePath, backupPath);
  }

  // Also remove WAL and SHM files if they exist
  const walPath = `${databasePath}-wal`;
  const shmPath = `${databasePath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

/**
 * Check if a database file exists at the given path.
 */
export function databaseExists(databasePath: string): boolean {
  return fs.existsSync(databasePath);
}
