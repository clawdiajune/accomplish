# Design: CLI-Level Context Windowing (Approach A)

## Summary

Implement context windowing directly in the OpenCode CLI to automatically summarize older conversation history when approaching token limits. This ensures reliable context preservation during long-running tasks while preventing token limit crashes.

## Problem Statement

When the completion enforcer triggers a continuation (after `complete_task(partial)` or when agent stops without calling `complete_task`), the adapter spawns a new PTY process. Even with `--session` flag, this causes:

1. **Cache invalidation**: Anthropic's prompt cache is keyed on request prefix. New process = new request = `cache.read: 0`
2. **Unbounded growth**: Session history grows indefinitely, eventually hitting model token limits
3. **Context loss**: Sometimes agent loses context entirely, asking "what were we doing?"

## Proposed Solution

Add native context windowing to OpenCode CLI that:

1. Monitors conversation token count
2. When exceeding threshold (e.g., 80K tokens), automatically summarizes older messages
3. Preserves recent messages verbatim for accuracy
4. Uses the same model to generate summaries for quality

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenCode CLI                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌──────────────────┐                   │
│  │   Session   │────▶│  Context Window  │                   │
│  │   Manager   │     │     Manager      │                   │
│  └─────────────┘     └──────────────────┘                   │
│                              │                               │
│                              ▼                               │
│                      ┌──────────────────┐                   │
│                      │  Token Counter   │                   │
│                      └──────────────────┘                   │
│                              │                               │
│              ┌───────────────┴───────────────┐              │
│              ▼                               ▼              │
│     ┌─────────────────┐           ┌─────────────────┐      │
│     │ Below Threshold │           │ Above Threshold │      │
│     │  (keep full)    │           │  (summarize)    │      │
│     └─────────────────┘           └─────────────────┘      │
│                                          │                  │
│                                          ▼                  │
│                                  ┌──────────────────┐      │
│                                  │    Summarizer    │      │
│                                  │  (same model)    │      │
│                                  └──────────────────┘      │
│                                          │                  │
│                                          ▼                  │
│                              ┌────────────────────────┐    │
│                              │  Compressed Context    │    │
│                              │  [Summary] + [Recent]  │    │
│                              └────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuration

Add new CLI flags and config options:

```typescript
interface ContextWindowConfig {
  // Enable context windowing (default: true)
  enabled: boolean;

  // Token threshold to trigger summarization (default: 80000)
  tokenThreshold: number;

  // Number of recent messages to always keep verbatim (default: 10)
  recentMessageCount: number;

  // Target token count after summarization (default: 30000)
  targetTokenCount: number;

  // Model to use for summarization (default: same as conversation)
  summaryModel?: string;
}
```

CLI flags:
```bash
opencode run "prompt" --context-window-threshold 80000 --context-window-target 30000
```

### Summarization Strategy

The summarizer should create a structured summary that preserves:

1. **Original task**: What was the user's request?
2. **Key decisions**: What approaches were chosen and why?
3. **Actions taken**: What files were modified, commands run, etc.?
4. **Current state**: Where are we in the task?
5. **Blockers/Issues**: What problems were encountered?

Example summary format:

```markdown
## Context Summary (auto-generated)

### Original Task
User requested implementation of user authentication with OAuth2.

### Key Decisions
- Using Auth0 as the OAuth provider
- JWT tokens for session management
- Refresh token rotation enabled

### Actions Completed
1. Created `src/auth/` directory structure
2. Implemented `AuthProvider` component
3. Added login/logout endpoints in `api/auth.ts`
4. Updated `middleware.ts` with JWT validation

### Current State
Working on: Token refresh logic in `useAuth` hook
Files in progress: `src/hooks/useAuth.ts`

### Open Issues
- Need to handle token expiry edge case
- User asked about rate limiting (deferred)
```

### Implementation Plan

#### Phase 1: Token Counting
1. Add token counting utility using tiktoken or similar
2. Track cumulative tokens in session manager
3. Log token counts in debug output

#### Phase 2: Summarization
1. Create `ContextSummarizer` class
2. Implement prompt template for summaries
3. Call summarizer when threshold exceeded
4. Store summary as special message type

#### Phase 3: Window Management
1. Implement sliding window logic
2. Replace old messages with summary
3. Ensure recent messages preserved
4. Handle edge cases (mid-tool-call, etc.)

#### Phase 4: Persistence
1. Store summaries in session file
2. Load summary on session resume
3. Handle summary versioning

### Key Files to Modify

```
packages/opencode/src/
├── session/
│   ├── manager.ts          # Add windowing logic
│   └── context-window.ts   # New: Window management
├── summarizer/
│   └── index.ts            # New: Summarization service
└── config/
    └── schema.ts           # Add config options
```

### API Changes

Session format with summary:

```typescript
interface Session {
  id: string;
  messages: Message[];

  // New fields for context windowing
  contextSummary?: {
    content: string;
    generatedAt: string;
    summarizedMessageCount: number;
    originalTokenCount: number;
  };
}
```

### Cache Implications

With context windowing:
- First request after summary: cache miss on summary portion
- Subsequent requests: cache hit on summary + recent prefix
- Net effect: Smaller cache misses, consistent cache hits

### Error Handling

1. **Summarization failure**: Fall back to truncation (keep recent only)
2. **Token counting error**: Use character-based estimation
3. **Threshold misconfiguration**: Validate and warn

### Testing Strategy

1. Unit tests for token counting
2. Unit tests for summarizer
3. Integration tests for window transitions
4. E2E tests for long-running sessions

### Migration Path

1. Feature flag: `--experimental-context-window`
2. Gradual rollout with telemetry
3. Default enable after validation

## Trade-offs

### Pros
- Single source of truth for context management
- Works for all CLI consumers
- Summary created by same model = high quality
- Smaller, more cacheable contexts
- Prevents token limit crashes

### Cons
- Requires OpenCode CLI changes
- Additional API calls for summarization
- Potential information loss in summaries
- Complexity in window boundary handling

## Alternatives Considered

1. **Adapter-level summarization**: Simpler but adapter lacks full message content
2. **Agent self-summarization**: High quality but requires agent cooperation
3. **Truncation without summary**: Loses important context

## Success Metrics

1. Zero "I don't have context" incidents after continuation
2. Sessions can run indefinitely without token limit errors
3. Cache hit rate improves (smaller, consistent prefixes)
4. Cost per continuation drops significantly

## Timeline Estimate

- Phase 1 (Token Counting): 2-3 days
- Phase 2 (Summarization): 3-5 days
- Phase 3 (Window Management): 3-5 days
- Phase 4 (Persistence): 2-3 days
- Testing & Polish: 3-5 days

Total: ~2-3 weeks for full implementation

## Open Questions

1. Should summary be visible to user in UI?
2. How to handle tool results in summaries (may be large)?
3. Should user be able to "expand" summary back to full history?
4. What's the right threshold for different models (Claude vs GPT)?
