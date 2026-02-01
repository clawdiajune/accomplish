# Add Skills Section to start_task MCP Tool

## Problem

Skills matching currently happens as a suggestion in the system prompt, which is unreliable. Agents may skip reading skill files or forget to apply them. We want skill selection enforced via the `start_task` schema, just like `goal`, `steps`, and `verification`.

## Solution

Add a required `skills` field to `start_task`. The agent sees available skills in the system prompt, then must specify which are relevant when calling `start_task`. The adapter loads skill content and injects it into the response.

## Design

### 1. Schema Changes (`mcp-tools/start-task/src/index.ts`)

Add `skills` to the required fields and properties:

```typescript
{
  name: 'start_task',
  inputSchema: {
    type: 'object',
    required: ['original_request', 'goal', 'steps', 'verification', 'skills'],
    properties: {
      // ... existing fields ...
      skills: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skill names or commands from the available-skills list that are relevant to this task. Use empty array [] if no skills apply.'
      }
    }
  }
}
```

### 2. System Prompt Changes (`src/main/opencode/config-generator.ts`)

**Update task-planning behavior section:**

```
start_task requires:
- original_request: Echo the user's request exactly as stated
- goal: What you aim to accomplish
- steps: Array of planned actions to achieve the goal
- verification: Array of how you will verify the task is complete
- skills: Array of relevant skill names from <available-skills> (or empty [] if none apply)
```

**Update available-skills section:**

```
After reviewing your task, include any relevant skills in your start_task call.
If a skill matches, you MUST read its SKILL.md file before executing that part of the task.
```

### 3. Adapter Changes (`src/main/opencode/adapter.ts`)

When intercepting `start_task`:

1. Extract the `skills` array from the tool call arguments
2. Load skill content for each skill using `skillsManager.getContent(skillId)`
3. Include skill names in the synthetic chat message shown to user
4. Return skill content in the response to the agent:

```
Plan registered. Proceed with execution.

<skill name="browser-automation">
[content of SKILL.md]
</skill>

<skill name="file-sorter">
[content of SKILL.md]
</skill>
```

## Flow

1. Agent sees available skills in system prompt `<available-skills>` section
2. Agent calls `start_task` with `skills: ["browser-automation", "file-sorter"]`
3. Adapter intercepts, displays plan to user (including skill names)
4. Adapter loads skill content for each named skill
5. Adapter returns response with skill content embedded
6. Agent has skill instructions in context, proceeds with execution

## Files to Modify

1. `mcp-tools/start-task/src/index.ts` - Add skills field to schema
2. `src/main/opencode/config-generator.ts` - Update system prompt sections
3. `src/main/opencode/adapter.ts` - Load and inject skill content

## Trade-offs

- **Pro**: Skill selection is enforced by schema (can't skip)
- **Pro**: Skill content is guaranteed in context (no extra tool calls)
- **Con**: Larger response if many/large skills selected (acceptable for typical skill sizes)
