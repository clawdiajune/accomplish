// apps/desktop/src/main/opencode/azure-token-manager.ts

/**
 * Re-export Azure token manager from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  getAzureEntraToken,
  clearAzureTokenCache,
  hasValidAzureToken,
  getAzureTokenExpiry,
} from '@accomplish/core';
