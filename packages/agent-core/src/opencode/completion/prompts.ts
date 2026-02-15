export function getContinuationPrompt(): string {
  return `REMINDER: You must call complete_task when finished.

Before proceeding, ask yourself: "Have I actually finished everything the user asked?"

- If NO, you haven't finished yet → CONTINUE WORKING on the task
- If YES, all parts are done → Call complete_task with status: "success"
- If you hit a blocker → Call complete_task with status: "blocked"
- If some parts done, some not → Call complete_task with status: "partial"

Do NOT call complete_task until you have actually completed the user's request.
Keep working if there's more to do.`;
}

export function getPartialContinuationPrompt(
  remainingWork: string,
  originalRequest: string,
  completedSummary: string
): string {
  return `You called complete_task with status="partial" but the task is not done yet.

## Original Request
"${originalRequest}"

## What You Completed
${completedSummary}

## What You Said Remains
${remainingWork}

## REQUIRED: Create a Continuation Plan

Before continuing, you MUST:

1. **Review the original request** - Re-read every requirement carefully
2. **Create a TODO list** showing what's done and what remains:

**Continuation Plan:**
✓ [Items you already completed]
□ [Next step] → verify: [how to confirm it's done]
□ [Following step] → verify: [how to confirm it's done]
...

3. **Execute the plan** - Work through each remaining step
4. **Call complete_task(success)** - Only when ALL original requirements are met

## IMPORTANT RULES

- Do NOT call complete_task with "partial" again unless you hit an actual TECHNICAL blocker
- If you hit a real blocker (login wall, CAPTCHA, rate limit, site error), use "blocked" status
- "partial" is NOT an acceptable final status - keep working until the task is complete
- Do NOT ask the user "would you like me to continue?" - just continue working

Now create your continuation plan and resume working on the remaining items.`;
}

export function getIncompleteTodosPrompt(
  incompleteTodos: string,
  attempt: number,
  maxAttempts: number
): string {
  return `IMPORTANT: Your complete_task(status="success") was INTERCEPTED by the system because your todo list still has incomplete items:

${incompleteTodos}

This is attempt ${attempt} of ${maxAttempts}. After ${maxAttempts} attempts, your completion will be accepted as-is.

This is NOT a system error. The system checks your todo list before accepting completion.

If you already completed these items, you MUST update your todo list using the todowrite tool to mark them as "completed" or "cancelled". Then call complete_task with status="success" again.

Do NOT argue with the system or claim this is a bug. Either:
1. Use todowrite to mark completed items as "completed"
2. Use todowrite to mark no-longer-needed items as "cancelled"
3. Then call complete_task with status="success"`;
}
