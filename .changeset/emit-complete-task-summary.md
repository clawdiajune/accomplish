---
"@accomplish_ai/agent-core": patch
---

Emit complete_task summary as a synthetic assistant message so the UI displays the task result. The summary is emitted after the tool_use message to ensure correct ordering. Only emits when the completion state is DONE and the summary is non-empty after trimming.
