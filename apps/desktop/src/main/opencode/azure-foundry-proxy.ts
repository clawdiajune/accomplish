// apps/desktop/src/main/opencode/azure-foundry-proxy.ts

/**
 * Re-export Azure Foundry proxy from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  ensureAzureFoundryProxy,
  stopAzureFoundryProxy,
  isAzureFoundryProxyRunning,
  transformAzureFoundryRequestBody as transformRequestBody,
  type AzureFoundryProxyInfo,
} from '@accomplish/core';
