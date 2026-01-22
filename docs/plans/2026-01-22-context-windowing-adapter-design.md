# Design: Adapter-Level Summarization (Approach B)

## Summary

Implement context summarization in the Openwork desktop adapter to replace session-based continuations with summary-based prompts. When continuation is needed, generate a fresh prompt containing a structured summary instead of replaying session history.

## Problem Statement

When the completion enforcer triggers a continuation via `spawnSessionResumption()`, it spawns a new PTY process with `--session sessionId`. This causes:

1. **Cache invalidation**: New process = new API request = `cache.read: 0`
2. **Context loss**: Agent sometimes loses track of what it was doing
3. **Unbounded growth**: Session grows indefinitely

## Proposed Solution

Replace session-based continuation with summary-based continuation:

**Before (current):**
```
spawnSessionResumption(prompt) → opencode run "prompt" --session ses_xxx
                                            ↓
                              CLI loads full session history from disk
                                            ↓
                              New API call with reconstructed conversation
                                            ↓
                              cache.read = 0 (cache invalidated)
```

**After (proposed):**
```
spawnSummaryContinuation(summary) → opencode run "summary + instructions"
                                            ↓
                                  Fresh conversation, no --session flag
                                            ↓
                                  Small prompt, fast response
                                            ↓
                                  cache.write minimal (new context)
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Openwork Desktop Adapter                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐                                        │
│  │  Event Stream   │                                        │
│  │  (from CLI)     │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐     ┌──────────────────────────────┐  │
│  │  Context        │────▶│  Summary Builder             │  │
│  │  Accumulator    │     │  (extracts key information)  │  │
│  └─────────────────┘     └──────────────────────────────┘  │
│           │                          │                      │
│           ▼                          ▼                      │
│  ┌─────────────────┐     ┌──────────────────────────────┐  │
│  │  Completion     │────▶│  Continuation Prompt         │  │
│  │  Enforcer       │     │  Generator                   │  │
│  └─────────────────┘     └──────────────────────────────┘  │
│                                      │                      │
│                                      ▼                      │
│                          ┌──────────────────────────────┐  │
│                          │  New CLI Process             │  │
│                          │  (no --session flag)         │  │
│                          └──────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Context Accumulation**: As CLI streams events, adapter builds a running context
2. **On Continuation Need**: CompletionEnforcer signals continuation is required
3. **Summary Generation**: SummaryBuilder creates a structured summary from accumulated context
4. **New Process**: Spawn CLI with summary prompt (no --session flag)

### Context Accumulator

New class to track conversation state from CLI events:

```typescript
interface AccumulatedContext {
  // From step_start
  sessionId: string;
  startedAt: string;

  // From text events
  assistantMessages: string[];

  // From tool_use/tool_call events
  toolCalls: Array<{
    name: string;
    input: unknown;
    output?: string;
    status: 'pending' | 'completed' | 'error';
  }>;

  // From complete_task detection
  completeTaskCalls: Array<{
    status: string;
    summary: string;
    originalRequest: string;
    remainingWork?: string;
  }>;

  // Derived metrics
  tokenEstimate: number;
  messageCount: number;
}

class ContextAccumulator {
  private context: AccumulatedContext;

  handleTextEvent(event: OpenCodeTextMessage): void;
  handleToolUseEvent(event: OpenCodeToolUseMessage): void;
  handleCompleteTask(args: CompleteTaskArgs): void;

  getContext(): AccumulatedContext;
  estimateTokens(): number;
  reset(): void;
}
```

### Summary Builder

Generates a prompt-friendly summary from accumulated context:

```typescript
class SummaryBuilder {
  build(context: AccumulatedContext): string {
    return `
## Session Context (Continuation)

### Original Request
${this.extractOriginalRequest(context)}

### Work Completed
${this.summarizeToolCalls(context)}

### Current Status
${this.getLatestStatus(context)}

### Remaining Work
${this.getRemainingWork(context)}

---

**IMPORTANT**: Continue from where you left off. You have all the context you need above.
When done, call complete_task with the final status.
`;
  }

  private extractOriginalRequest(context: AccumulatedContext): string {
    // Use original_request_summary from complete_task if available
    // Otherwise, try to extract from first messages
  }

  private summarizeToolCalls(context: AccumulatedContext): string {
    // Group by tool type, list key actions
    // e.g., "Files modified: src/auth.ts, src/login.tsx"
    //       "Commands run: npm install, npm test"
  }

  private getLatestStatus(context: AccumulatedContext): string {
    // From most recent complete_task call or assistant message
  }

  private getRemainingWork(context: AccumulatedContext): string {
    // From complete_task(partial) remaining_work field
  }
}
```

### Modified CompletionEnforcer Callbacks

```typescript
interface CompletionEnforcerCallbacks {
  // OLD: spawns with --session flag
  // onStartContinuation: (prompt: string) => Promise<void>;

  // NEW: spawns with summary prompt, no session
  onStartSummaryContinuation: (summary: string) => Promise<void>;

  // Keep existing
  onStartVerification: (prompt: string) => Promise<void>;
  onComplete: () => void;
  onDebug: (type: string, message: string, data?: unknown) => void;
}
```

### Modified Adapter Methods

```typescript
// In adapter.ts

private contextAccumulator: ContextAccumulator;
private summaryBuilder: SummaryBuilder;

private createCompletionEnforcer(): CompletionEnforcer {
  const callbacks: CompletionEnforcerCallbacks = {
    onStartSummaryContinuation: async (basePrompt: string) => {
      const context = this.contextAccumulator.getContext();
      const summary = this.summaryBuilder.build(context);
      const fullPrompt = `${summary}\n\n${basePrompt}`;

      // Spawn WITHOUT --session flag
      await this.spawnFreshContinuation(fullPrompt);
    },
    // ... other callbacks
  };
}

// New method: spawn without session
private async spawnFreshContinuation(prompt: string): Promise<void> {
  // Similar to spawnSessionResumption but WITHOUT --session flag
  const config: TaskConfig = {
    prompt,
    // NO sessionId - fresh conversation
    workingDirectory: this.lastWorkingDirectory,
  };

  // ... spawn process
}
```

### Implementation Plan

#### Phase 1: Context Accumulator
1. Create `ContextAccumulator` class
2. Wire into `handleMessage()` to capture events
3. Add token estimation (character-based initially)
4. Add unit tests

#### Phase 2: Summary Builder
1. Create `SummaryBuilder` class
2. Implement summary templates
3. Handle edge cases (no tools, partial data)
4. Add unit tests

#### Phase 3: Integration
1. Modify `CompletionEnforcer` callbacks
2. Add `spawnFreshContinuation()` method
3. Update continuation flow to use summary
4. Integration tests

#### Phase 4: Polish
1. Improve summary quality based on testing
2. Add debug logging for summaries
3. Handle error cases gracefully
4. E2E tests

### Key Files to Modify

```
apps/desktop/src/main/opencode/
├── adapter.ts                    # Add accumulator, modify spawn
├── context-accumulator.ts        # NEW: Context tracking
├── summary-builder.ts            # NEW: Summary generation
└── completion/
    ├── completion-enforcer.ts    # Update callbacks
    └── prompts.ts                # Update/add prompt templates
```

### Example Continuation Prompt

**Input context (accumulated):**
```json
{
  "sessionId": "ses_xxx",
  "toolCalls": [
    {"name": "Read", "input": {"path": "src/auth.ts"}, "status": "completed"},
    {"name": "Edit", "input": {"path": "src/auth.ts"}, "status": "completed"},
    {"name": "Bash", "input": {"command": "npm test"}, "status": "error"}
  ],
  "completeTaskCalls": [{
    "status": "partial",
    "summary": "Implemented auth module but tests failing",
    "originalRequest": "Add user authentication",
    "remainingWork": "Fix failing tests"
  }]
}
```

**Generated summary prompt:**
```markdown
## Session Context (Continuation)

### Original Request
Add user authentication

### Work Completed
- Read file: `src/auth.ts`
- Edited file: `src/auth.ts`
- Ran command: `npm test` (failed)

### Current Status
Implemented auth module but tests failing

### Remaining Work
Fix failing tests

---

**IMPORTANT**: Continue from where you left off. The test failures need to be addressed.
When all work is complete, call complete_task with status "success".
If blocked, call complete_task with status "blocked" and explain the issue.
```

### Trade-offs

### Pros
- No CLI changes required
- Full control in Openwork codebase
- Simpler than CLI-level solution
- Faster to implement
- Fresh context = no unbounded growth

### Cons
- Summary quality limited to what adapter can extract
- Loses fine-grained conversation history
- Agent may ask clarifying questions about "previous" context
- Adapter doesn't see full message text (only events)

### Mitigations

1. **Limited event data**: Include assistant text messages in accumulator
2. **Quality concerns**: Iterate on summary templates based on agent behavior
3. **Missing context**: Prompt explicitly tells agent all needed context is provided

## Testing Strategy

1. **Unit tests**: ContextAccumulator, SummaryBuilder
2. **Integration tests**: Full continuation flow with mocked CLI
3. **E2E tests**: Real tasks that trigger continuation

### Test Scenarios
- Simple task completes normally (no summary needed)
- Task needs continuation (summary generated)
- Multiple continuations (summary updates)
- Task with many tool calls (summary condenses)
- Task with partial completion (remaining work extracted)

## Migration Path

1. Add feature flag: `OPENWORK_SUMMARY_CONTINUATION=1`
2. A/B test with users
3. Monitor for "context loss" complaints
4. Default enable after validation

## Comparison with Approach A

| Aspect | Approach A (CLI) | Approach B (Adapter) |
|--------|------------------|----------------------|
| Implementation location | OpenCode CLI | Openwork adapter |
| Time to implement | ~2-3 weeks | ~1 week |
| Summary quality | High (full messages) | Medium (events only) |
| Reusability | All CLI consumers | Openwork only |
| Maintenance | CLI team | Openwork team |
| Complexity | Higher | Lower |

## Success Metrics

1. Zero "I don't have context" incidents
2. Continuation prompts < 10K tokens
3. Task completion rate maintained or improved
4. No regressions in task quality

## Open Questions

1. How much assistant text to include in summary?
2. Should tool outputs be summarized or omitted?
3. How to handle multi-file edit sequences?
4. Should user be notified when continuation happens?
