// apps/desktop/src/main/store/repositories/providerSettings.ts

/**
 * Re-export provider settings repository from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

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
} from '@accomplish/core';
