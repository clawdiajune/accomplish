// apps/desktop/src/main/opencode/moonshot-proxy.ts

/**
 * Re-export Moonshot proxy from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  ensureMoonshotProxy,
  stopMoonshotProxy,
  isMoonshotProxyRunning,
  transformMoonshotRequestBody,
  type MoonshotProxyInfo,
} from '@accomplish/core';
