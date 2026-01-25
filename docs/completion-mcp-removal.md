# Completion MCP System Removal

This document describes the completion enforcement system that was removed in the `perf/remove-completion-mcp` branch.

## What Was the Completion System?

The completion system was a sophisticated enforcement mechanism that ensured the AI agent properly finished tasks before stopping. It required the agent to call a `complete_task` tool to signal task completion, and included verification and continuation flows.

---

## Files Deleted

### 1. `apps/desktop/skills/complete-task/` (entire directory)

**What it was:** An MCP server that provided the `complete_task` tool.

**Files:**
- `src/index.ts` - MCP server with the `complete_task` tool
- `package.json` - Dependencies
- `SKILL.md` - Documentation for the agent

**The tool accepted:**
```typescript
{
  status: 'success' | 'blocked' | 'partial',
  summary: string,
  original_request_summary: string,
  remaining_work?: string  // Required for 'partial' status
}
```

**What it did:** When the agent thought it was done, it had to call this tool. The status indicated:
- `success` - Task fully completed (triggered verification)
- `blocked` - Hit a technical blocker (login wall, CAPTCHA, etc.)
- `partial` - Partially done, needs to continue

---

### 2. `apps/desktop/src/main/opencode/completion/` (entire directory)

#### `completion-state.ts` - State Machine

**What it was:** An explicit state machine tracking the completion flow through 9 states:

```
IDLE → AWAITING_VERIFICATION → VERIFYING → VERIFICATION_CONTINUING
  ↓
COMPLETE_TASK_CALLED
  ↓
PARTIAL_CONTINUATION_PENDING → (back to IDLE to continue work)
  ↓
CONTINUATION_PENDING → MAX_RETRIES_REACHED
  ↓
DONE
```

**Why it existed:** Replaced 7+ boolean flags (`completeTaskCalled`, `isVerifying`, `verificationStarted`, etc.) with a single state variable for cleaner logic.

---

#### `completion-enforcer.ts` - Main Enforcement Logic

**What it was:** The coordinator that implemented two enforcement mechanisms:

**1. Continuation Prompts:**
- If the agent stopped WITHOUT calling `complete_task`, the system would spawn a new session with a reminder prompt
- Up to 20 retry attempts before giving up
- Prevented agents from just stopping mid-task

**2. Verification Flow:**
- If agent called `complete_task` with `status: "success"`, the system didn't trust it
- Spawned a verification session asking the agent to:
  - Take a screenshot of current browser state
  - Compare against the original request
  - Re-call `complete_task` only if verified
- Prevented false "success" claims

**Key methods:**
- `handleCompleteTaskDetection(input)` - Called when agent used the tool
- `handleStepFinish(reason)` - Decided whether to complete or schedule continuation
- `handleProcessExit(code)` - Triggered verification/continuation when CLI exited
- `updateTodos(todos)` - Tracked todo items for completion checking

---

#### `prompts.ts` - Prompt Templates

**What it was:** Templates for the continuation and verification prompts:

1. `getContinuationPrompt()` - Gentle reminder to finish work:
   > "You stopped without calling complete_task. Please continue working or call complete_task with the appropriate status."

2. `getVerificationPrompt(summary, originalRequest)` - Verification instructions:
   > "You claimed success. Take a screenshot and verify each requirement is met. Re-call complete_task only if verified."

3. `getPartialContinuationPrompt(remainingWork)` - For partial completion:
   > "You indicated partial completion. Continue with: [remaining_work]"

4. `getIncompleteTodosPrompt(incompleteTodos)` - Todo enforcement:
   > "These todos are still incomplete: [list]. Complete them before calling complete_task."

---

#### `index.ts` - Exports

Just re-exported the above modules.

---

## Files Modified

### 1. `apps/desktop/src/main/opencode/adapter.ts`

**Removed:**

| Item | What it did |
|------|-------------|
| `import { CompletionEnforcer }` | Import for the enforcer |
| `completionEnforcer` property | Instance of the enforcer |
| `createCompletionEnforcer()` method | Set up callbacks for verification/continuation |
| `completionEnforcer.reset()` | Reset state on new task |
| `complete_task` detection in `tool_call` | Tracked when agent called the tool |
| `complete_task` detection in `tool_use` | Same for combined tool events |
| `completionEnforcer.updateTodos()` | Tracked todo completion |
| `completionEnforcer.handleStepFinish()` | Delegated step_finish logic |
| `completionEnforcer.handleProcessExit()` | Delegated exit handling |
| `spawnSessionResumption()` method | Started new CLI session for verification/continuation |
| `lastWorkingDirectory` property | Stored CWD for session resumption |

**Changed:**
- `step_finish` handler: Now emits `complete` directly on stop/end_turn (was delegated to enforcer)
- `handleProcessExit`: Now emits `complete` directly on exit code 0 (was delegated to enforcer)

---

### 2. `apps/desktop/src/main/opencode/config-generator.ts`

**Removed from system prompt:**

1. **Task planning requirement** (partial):
   ```
   **STEP 4: COMPLETE ALL TODOS BEFORE FINISHING**
   - All todos must be "completed" or "cancelled" before calling complete_task
   ```

2. **Entire "TASK COMPLETION - CRITICAL" section** (~30 lines):
   - Required calling `complete_task` to finish ANY task
   - Explained when to use `success`, `blocked`, `partial`
   - Warned "NEVER just stop working without calling complete_task"
   - Forced re-reading original request via `original_request_summary`

**Removed from MCP config:**
```typescript
'complete-task': {
  type: 'local',
  command: ['npx', 'tsx', path.join(skillsPath, 'complete-task', 'src', 'index.ts')],
  enabled: true,
  timeout: 5000,
}
```

---

### 3. `apps/desktop/__tests__/unit/main/opencode/adapter.unit.test.ts`

**Removed tests:**
1. `should schedule continuation on step_finish when complete_task was not called` - Tested continuation scheduling
2. `should emit complete after max continuation attempts without complete_task` - Tested retry exhaustion

**Modified tests:**
1. `should emit complete event on step_finish with stop reason` - No longer needs `complete_task` call first
2. `should not emit duplicate complete events` - No longer simulates `complete_task` call

---

## Behavior Change Summary

| Before | After |
|--------|-------|
| Agent MUST call `complete_task` to finish | Agent stops when it decides to stop |
| System verifies "success" claims with screenshot | No verification |
| System prompts agent to continue if it stops without `complete_task` | No continuation prompts |
| Up to 20 retry attempts to get agent to call `complete_task` | Immediate completion |
| Todos must be completed before finishing | Todos shown in UI but not enforced |

---

## Why Was It Removed?

The completion enforcement system added complexity and overhead:
- Extra MCP server to maintain
- State machine complexity
- Session resumption logic
- Verification prompts consumed additional tokens
- Continuation retries could loop indefinitely in edge cases

The simpler approach trusts the agent to stop when appropriate.
