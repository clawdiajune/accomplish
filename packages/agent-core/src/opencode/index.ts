export {
  resolveCliPath,
  isCliAvailable,
  getCliVersion,
} from './cli-resolver.js';

export {
  generateConfig,
  getOpenCodeConfigPath,
  ACCOMPLISH_AGENT_NAME,
  buildCliArgs,
} from './config-generator.js';
export type {
  ConfigGeneratorOptions,
  ProviderConfig,
  ProviderModelConfig,
  GeneratedConfig,
  BuildCliArgsOptions,
} from './config-generator.js';

export {
  getOpenCodeDataHome,
  getOpenCodeAuthJsonPath,
  getOpenAiOauthStatus,
  getOpenCodeAuthPath,
  writeOpenCodeAuth,
} from './auth.js';

export {
  CompletionEnforcer,
  CompletionState,
  CompletionFlowState,
  getContinuationPrompt,
  getPartialContinuationPrompt,
} from './completion/index.js';
export type {
  CompletionEnforcerCallbacks,
  StepFinishAction,
  CompleteTaskArgs,
} from './completion/index.js';

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

export {
  MESSAGE_BATCH_DELAY_MS,
  extractScreenshots,
  sanitizeToolOutput,
  sanitizeAssistantTextForDisplay,
  getToolDisplayName,
  toTaskMessage,
  createMessageBatcher,
  queueMessage,
  flushAndCleanupBatcher,
} from './message-processor.js';
export type {
  MessageAttachment,
  MessageBatcher,
} from './message-processor.js';

export { buildOpenCodeEnvironment } from './environment.js';
export type { EnvironmentConfig, ApiKeys } from './environment.js';

export {
  buildProviderConfigs,
  syncApiKeysToOpenCodeAuth,
} from './config-builder.js';
export type {
  ConfigPaths,
  ProviderConfigResult,
  BuildProviderConfigsOptions,
} from './config-builder.js';
