/**
 * OpenCode Layer - Interface to the OpenCode CLI
 *
 * This module provides a platform-agnostic interface to the OpenCode CLI.
 * Key abstraction: it accepts injected handlers (PermissionHandler, TaskEventHandler)
 * instead of using Electron IPC directly.
 */

// Main adapter
export {
  OpenCodeAdapter,
  createAdapter,
  OpenCodeCliNotFoundError,
} from './adapter.js';
export type {
  AdapterOptions,
  OpenCodeAdapterEvents,
} from './adapter.js';

// Task manager
export {
  TaskManager,
  createTaskManager,
} from './task-manager.js';
export type {
  TaskManagerOptions,
  TaskCallbacks,
  TaskProgressEvent,
} from './task-manager.js';

// CLI resolver
export {
  resolveCliPath,
  isCliAvailable,
  getCliVersion,
} from './cli-resolver.js';

// Config generator
export {
  generateConfig,
  getOpenCodeConfigPath,
  ACCOMPLISH_AGENT_NAME,
} from './config-generator.js';
export type {
  ConfigGeneratorOptions,
  ProviderConfig,
  ProviderModelConfig,
  GeneratedConfig,
} from './config-generator.js';

// Stream parser
export { StreamParser } from './stream-parser.js';
export type { StreamParserEvents } from './stream-parser.js';

// Log watcher
export {
  OpenCodeLogWatcher,
  createLogWatcher,
} from './log-watcher.js';
export type {
  OpenCodeLogError,
  LogWatcherEvents,
} from './log-watcher.js';

// Auth utilities
export {
  getOpenCodeDataHome,
  getOpenCodeAuthJsonPath,
  getOpenAiOauthStatus,
  getOpenCodeAuthPath,
  writeOpenCodeAuth,
} from './auth.js';

// Completion enforcement
export {
  CompletionEnforcer,
  CompletionState,
  CompletionFlowState,
  getContinuationPrompt,
  getPartialContinuationPrompt,
  getIncompleteTodosPrompt,
} from './completion/index.js';
export type {
  CompletionEnforcerCallbacks,
  StepFinishAction,
  CompleteTaskArgs,
} from './completion/index.js';

// Proxy servers
export {
  ensureAzureFoundryProxy,
  stopAzureFoundryProxy,
  isAzureFoundryProxyRunning,
  transformAzureFoundryRequestBody,
  ensureMoonshotProxy,
  stopMoonshotProxy,
  isMoonshotProxyRunning,
  transformMoonshotRequestBody,
  getAzureEntraToken,
  clearAzureTokenCache,
  hasValidAzureToken,
  getAzureTokenExpiry,
} from './proxies/index.js';
export type {
  AzureFoundryProxyInfo,
  MoonshotProxyInfo,
} from './proxies/index.js';
