// apps/desktop/src/main/opencode/completion/index.ts

/**
 * Re-export completion module from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export {
  CompletionEnforcer,
  CompletionState,
  CompletionFlowState,
  getContinuationPrompt,
  getPartialContinuationPrompt,
  getIncompleteTodosPrompt,
  type CompletionEnforcerCallbacks,
  type StepFinishAction,
  type CompleteTaskArgs,
} from '@accomplish/core';
