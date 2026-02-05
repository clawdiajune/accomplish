export {
  createTaskManager,
  createStorage,
  createPermissionHandler,
  createThoughtStreamHandler,
  createLogWriter,
  createSkillsManager,
  createSpeechService,
} from './factories/index.js';

export type {
  TaskManagerAPI,
  TaskManagerOptions as TaskManagerFactoryOptions,
  TaskAdapterOptions,
  TaskCallbacks as TaskManagerCallbacks,
  TaskProgressEvent as TaskManagerProgressEvent,
  TaskManagerOptions,
  TaskCallbacks,
  TaskProgressEvent,
  StorageAPI,
  StorageOptions,
  StoredTask,
  AppSettings,
  PermissionHandlerAPI,
  PermissionHandlerOptions,
  FilePermissionRequestData as PermissionFileRequestData,
  QuestionRequestData as PermissionQuestionRequestData,
  QuestionResponseData as PermissionQuestionResponseData,
  PermissionValidationResult,
  ThoughtStreamAPI,
  ThoughtEvent as ThoughtStreamEvent,
  CheckpointEvent as ThoughtStreamCheckpointEvent,
  ThoughtCategory,
  CheckpointStatus,
  LogWriterAPI,
  LogWriterOptions,
  LogEntry as LogWriterEntry,
  SkillsManagerAPI,
  SkillsManagerOptions,
  SkillsManagerDatabase,
  SpeechServiceAPI,
  SpeechServiceOptions,
  TranscriptionResult as SpeechTranscriptionResult,
  TranscriptionError as SpeechTranscriptionError,
  TranscriptionResult,
  TranscriptionError,
} from './types/index.js';

export type {
  PlatformConfig,
  PermissionHandler,
  TaskEventHandler,
  StorageConfig,
  CliResolverConfig,
  ResolvedCliPaths,
  BundledNodePaths,
} from './types.js';

export { OpenCodeCliNotFoundError } from './opencode/adapter.js';

export { createLogWatcher } from './opencode/log-watcher.js';

export type {
  AdapterOptions,
  OpenCodeAdapterEvents,
} from './opencode/adapter.js';

export type { OpenCodeLogError } from './opencode/log-watcher.js';

export { resolveCliPath, isCliAvailable } from './opencode/cli-resolver.js';

export {
  generateConfig,
  buildCliArgs,
  ACCOMPLISH_AGENT_NAME,
} from './opencode/config-generator.js';

export { buildOpenCodeEnvironment } from './opencode/environment.js';

export type { EnvironmentConfig } from './opencode/environment.js';

export { buildProviderConfigs, syncApiKeysToOpenCodeAuth } from './opencode/config-builder.js';

export { getOpenCodeAuthPath, getOpenAiOauthStatus } from './opencode/auth.js';

export {
  toTaskMessage,
  queueMessage,
  flushAndCleanupBatcher,
} from './opencode/message-processor.js';

export type { CompletionEnforcerCallbacks } from './opencode/completion/index.js';

export {
  stopAzureFoundryProxy,
  stopMoonshotProxy,
  getAzureEntraToken,
} from './opencode/proxies/index.js';

export {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  resetDatabase,
  databaseExists,
  isDatabaseInitialized,
} from './storage/database.js';

export { FutureSchemaError } from './storage/migrations/errors.js';

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
  getTodosForTask,
  saveTodosForTask,
  clearTodosForTask,
  flushPendingTasks,
} from './storage/repositories/taskHistory.js';

export {
  getDebugMode,
  setDebugMode,
  getAppSettings,
  getOnboardingComplete,
  setOnboardingComplete,
  getSelectedModel,
  setSelectedModel,
  getOpenAiBaseUrl,
  setOpenAiBaseUrl,
  getOllamaConfig,
  setOllamaConfig,
  getAzureFoundryConfig,
  setAzureFoundryConfig,
  getLiteLLMConfig,
  setLiteLLMConfig,
  getLMStudioConfig,
  setLMStudioConfig,
} from './storage/repositories/appSettings.js';

export {
  getProviderSettings,
  clearProviderSettings,
  setActiveProvider,
  getConnectedProvider,
  setConnectedProvider,
  removeConnectedProvider,
  updateProviderModel,
  setProviderDebugMode,
  getProviderDebugMode,
  hasReadyProvider,
  getActiveProviderModel,
} from './storage/repositories/providerSettings.js';

export { validateApiKey } from './providers/validation.js';

export {
  validateBedrockCredentials,
  fetchBedrockModels,
} from './providers/bedrock.js';

export {
  validateAzureFoundry,
  testAzureFoundryConnection,
} from './providers/azure-foundry.js';

export { fetchOpenRouterModels } from './providers/openrouter.js';

export { testLiteLLMConnection, fetchLiteLLMModels } from './providers/litellm.js';

export { testOllamaConnection } from './providers/ollama.js';

export { testOllamaModelToolSupport } from './providers/tool-support-testing.js';

export {
  testLMStudioConnection,
  fetchLMStudioModels,
  validateLMStudioConfig,
} from './providers/lmstudio.js';

export {
  getBundledNodePaths,
  isBundledNodeAvailable,
  getNodePath,
  getNpmPath,
  getNpxPath,
  logBundledNodeInfo,
} from './utils/bundled-node.js';

export type { BundledNodePathsExtended } from './utils/bundled-node.js';

export { getExtendedNodePath, findCommandInPath } from './utils/system-path.js';

export { sanitizeString } from './utils/sanitize.js';

export { validateHttpUrl } from './utils/url.js';

export { validateTaskConfig } from './utils/task-validation.js';

export { safeParseJson } from './utils/json.js';

export type { SafeParseResult } from './utils/json.js';

export { redact } from './utils/redact.js';

export { mapResultToStatus } from './utils/task-status.js';

export { ensureDevBrowserServer } from './browser/server.js';

export type { BrowserServerConfig } from './browser/server.js';

export { generateTaskSummary } from './services/summarizer.js';

export type { GetApiKeyFn } from './services/summarizer.js';

export type {
  TaskStatus,
  TaskConfig,
  Task,
  TaskAttachment,
  TaskMessage,
  TaskResult,
  TaskProgress,
  TaskUpdateEvent,
} from './common/types/task.js';
export { STARTUP_STAGES } from './common/types/task.js';

export type {
  FileOperation,
  PermissionRequest,
  PermissionOption,
  PermissionResponse,
} from './common/types/permission.js';
export {
  FILE_OPERATIONS,
  FILE_PERMISSION_REQUEST_PREFIX,
  QUESTION_REQUEST_PREFIX,
} from './common/types/permission.js';

export type {
  ProviderType,
  ApiKeyProvider,
  ProviderConfig,
  ModelConfig,
  SelectedModel,
  OllamaConfig,
  AzureFoundryConfig,
  LiteLLMModel,
  LiteLLMConfig,
  LMStudioConfig,
} from './common/types/provider.js';
export {
  DEFAULT_PROVIDERS,
  DEFAULT_MODEL,
  ALLOWED_API_KEY_PROVIDERS,
  STANDARD_VALIDATION_PROVIDERS,
  ZAI_ENDPOINTS,
} from './common/types/provider.js';

export type {
  ProviderId,
  ProviderCategory,
  ProviderMeta,
  ConnectionStatus,
  ApiKeyCredentials,
  BedrockProviderCredentials,
  OllamaCredentials,
  OpenRouterCredentials,
  LiteLLMCredentials,
  ZaiRegion,
  ZaiCredentials,
  LMStudioCredentials,
  AzureFoundryCredentials,
  OAuthCredentials,
  ProviderCredentials,
  ToolSupportStatus,
  ConnectedProvider,
  ProviderSettings,
} from './common/types/providerSettings.js';
export {
  PROVIDER_META,
  DEFAULT_MODELS,
  PROVIDER_ID_TO_OPENCODE,
  isProviderReady,
  hasAnyReadyProvider,
  getActiveProvider,
  getDefaultModelForProvider,
} from './common/types/providerSettings.js';

export type {
  ApiKeyConfig,
  BedrockCredentials,
  BedrockAccessKeyCredentials,
  BedrockProfileCredentials,
  BedrockApiKeyCredentials,
} from './common/types/auth.js';

export type {
  OpenCodeMessage,
  OpenCodeMessageBase,
  OpenCodeToolUseMessage,
  OpenCodeStepStartMessage,
  OpenCodeTextMessage,
  OpenCodeToolCallMessage,
  OpenCodeToolResultMessage,
  OpenCodeStepFinishMessage,
  OpenCodeErrorMessage,
} from './common/types/opencode.js';

export type { SkillSource, Skill, SkillFrontmatter } from './common/types/skills.js';

export type { TodoItem } from './common/types/todo.js';
export type { LogLevel, LogSource, LogEntry } from './common/types/logging.js';
export type { ThoughtEvent, CheckpointEvent } from './common/types/thought-stream.js';

export {
  DEV_BROWSER_PORT,
  DEV_BROWSER_CDP_PORT,
  THOUGHT_STREAM_PORT,
  PERMISSION_API_PORT,
  QUESTION_API_PORT,
  PERMISSION_REQUEST_TIMEOUT_MS,
  LOG_MAX_FILE_SIZE_BYTES,
  LOG_RETENTION_DAYS,
  LOG_BUFFER_FLUSH_INTERVAL_MS,
  LOG_BUFFER_MAX_ENTRIES,
} from './common/constants.js';

export {
  MODEL_DISPLAY_NAMES,
  PROVIDER_PREFIXES,
  getModelDisplayName,
} from './common/constants/model-display.js';

export {
  createTaskId,
  createMessageId,
  createFilePermissionRequestId,
  createQuestionRequestId,
  isFilePermissionRequest,
  isQuestionRequest,
} from './common/utils/id.js';

export { stripAnsi, quoteForShell, getPlatformShell, getShellArgs } from './utils/shell.js';
export { isPortInUse, waitForPortRelease } from './utils/network.js';
export { isWaitingForUser } from './common/utils/waiting-detection.js';
export { detectLogSource, LOG_SOURCE_PATTERNS } from './common/utils/log-source-detector.js';

export {
  taskConfigSchema,
  permissionResponseSchema,
  resumeSessionSchema,
  validate,
} from './common/schemas/validation.js';
