// apps/desktop/src/main/store/repositories/taskHistory.ts

/**
 * Re-export task history repository from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  getTasks,
  getTask,
  saveTask,
  updateTaskStatus,
  addTaskMessage,
  updateTaskSessionId,
  updateTaskSummary,
  deleteTask,
  clearHistory,
  setMaxHistoryItems,
  clearTaskHistoryStore,
  flushPendingTasks,
  getTodosForTask,
  saveTodosForTask,
  clearTodosForTask,
  type StoredTask,
} from '@accomplish/core';
