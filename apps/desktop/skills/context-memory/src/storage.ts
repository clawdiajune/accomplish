/**
 * Storage module for session context
 *
 * Uses file-based storage in the app data directory.
 * Each task gets its own context file.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SessionContext } from './types.js';

// Storage directory: ~/.accomplish/context-memory/
const STORAGE_DIR = path.join(os.homedir(), '.accomplish', 'context-memory');

/**
 * Ensure storage directory exists
 */
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Get the file path for a task's context
 */
function getContextPath(taskId: string): string {
  // Sanitize taskId to prevent path traversal
  const safeId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STORAGE_DIR, `${safeId}.json`);
}

/**
 * Save session context to storage
 */
export function saveContext(context: SessionContext): void {
  ensureStorageDir();
  const filePath = getContextPath(context.taskId);
  const data = JSON.stringify(context, null, 2);
  fs.writeFileSync(filePath, data, 'utf-8');
  console.error(`[context-memory] Saved context for task ${context.taskId}`);
}

/**
 * Load session context from storage
 */
export function loadContext(taskId: string): SessionContext | null {
  const filePath = getContextPath(taskId);
  if (!fs.existsSync(filePath)) {
    console.error(`[context-memory] No context found for task ${taskId}`);
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const context = JSON.parse(data) as SessionContext;
    console.error(`[context-memory] Loaded context for task ${taskId}`);
    return context;
  } catch (error) {
    console.error(`[context-memory] Failed to load context: ${error}`);
    return null;
  }
}

/**
 * Delete session context from storage
 */
export function deleteContext(taskId: string): boolean {
  const filePath = getContextPath(taskId);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    fs.unlinkSync(filePath);
    console.error(`[context-memory] Deleted context for task ${taskId}`);
    return true;
  } catch (error) {
    console.error(`[context-memory] Failed to delete context: ${error}`);
    return false;
  }
}

/**
 * List all stored task IDs
 */
export function listContexts(): string[] {
  ensureStorageDir();
  const files = fs.readdirSync(STORAGE_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}
