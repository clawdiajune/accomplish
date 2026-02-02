// packages/core/src/storage/repositories/index.ts

// App settings
export {
  getDebugMode,
  setDebugMode,
  getOnboardingComplete,
  setOnboardingComplete,
  getSelectedModel,
  setSelectedModel,
  getOllamaConfig,
  setOllamaConfig,
  getLiteLLMConfig,
  setLiteLLMConfig,
  getAzureFoundryConfig,
  setAzureFoundryConfig,
  getLMStudioConfig,
  setLMStudioConfig,
  getOpenAiBaseUrl,
  setOpenAiBaseUrl,
  getAppSettings,
  clearAppSettings,
  type AppSettings,
} from './appSettings.js';

// Provider settings
export {
  getProviderSettings,
  setActiveProvider,
  getActiveProviderId,
  getConnectedProvider,
  setConnectedProvider,
  removeConnectedProvider,
  updateProviderModel,
  setProviderDebugMode,
  getProviderDebugMode,
  clearProviderSettings,
  getActiveProviderModel,
  hasReadyProvider,
  getConnectedProviderIds,
} from './providerSettings.js';

// Task history
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
} from './taskHistory.js';

// Skills
export {
  getAllSkills,
  getEnabledSkills,
  getSkillById,
  upsertSkill,
  setSkillEnabled,
  deleteSkill,
  clearAllSkills,
} from './skills.js';
