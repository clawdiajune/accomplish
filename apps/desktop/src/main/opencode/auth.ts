// apps/desktop/src/main/opencode/auth.ts

/**
 * Re-export OpenCode auth utilities from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  getOpenCodeDataHome,
  getOpenCodeAuthJsonPath,
  getOpenAiOauthStatus,
  getOpenCodeAuthPath,
  writeOpenCodeAuth,
} from '@accomplish/core';
