// apps/desktop/src/main/opencode/log-watcher.ts

/**
 * Re-export OpenCodeLogWatcher from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  OpenCodeLogWatcher,
  createLogWatcher,
  type OpenCodeLogError,
  type LogWatcherEvents,
} from '@accomplish/core';
