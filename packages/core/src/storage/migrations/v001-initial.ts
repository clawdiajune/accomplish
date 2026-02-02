// packages/core/src/storage/migrations/v001-initial.ts

import type { Database } from 'better-sqlite3';
import type { Migration } from './index.js';

/**
 * Initial migration: Creates the base schema for the database.
 *
 * Note: Legacy data import from electron-store has been removed in the core package.
 * The desktop app should handle legacy migration before initializing the core database
 * if needed.
 */
export const migration: Migration = {
  version: 1,
  up: (db: Database) => {
    // Create schema_meta table
    db.exec(`
      CREATE TABLE schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create app_settings table
    db.exec(`
      CREATE TABLE app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        debug_mode INTEGER NOT NULL DEFAULT 0,
        onboarding_complete INTEGER NOT NULL DEFAULT 0,
        selected_model TEXT,
        ollama_config TEXT,
        litellm_config TEXT
      )
    `);

    // Create provider tables
    db.exec(`
      CREATE TABLE provider_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active_provider_id TEXT,
        debug_mode INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.exec(`
      CREATE TABLE providers (
        provider_id TEXT PRIMARY KEY,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        selected_model_id TEXT,
        credentials_type TEXT NOT NULL,
        credentials_data TEXT,
        last_connected_at TEXT,
        available_models TEXT
      )
    `);

    // Create task tables
    db.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        summary TEXT,
        status TEXT NOT NULL,
        session_id TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      )
    `);

    db.exec(`
      CREATE TABLE task_messages (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_name TEXT,
        tool_input TEXT,
        timestamp TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      )
    `);

    db.exec(`
      CREATE TABLE task_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL REFERENCES task_messages(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        label TEXT
      )
    `);

    // Create indexes
    db.exec(`CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC)`);
    db.exec(`CREATE INDEX idx_messages_task_id ON task_messages(task_id)`);

    // Insert default rows for single-row tables
    db.exec(`INSERT INTO app_settings (id) VALUES (1)`);
    db.exec(`INSERT INTO provider_meta (id) VALUES (1)`);
  },
};
