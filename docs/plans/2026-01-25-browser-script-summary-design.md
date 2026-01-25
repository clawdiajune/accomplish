# Browser Script Summary UI Design

## Problem

When `browser_script` tool runs, users only see "dev-browser-mcp_browser_script" with a wrench icon. There's no visibility into what actions the script will perform.

## Solution

Display human-readable action chips showing the planned browser actions. Truncate to first 3 actions with "+N more" that expands on click.

## UI Design

```
┌─────────────────────────────────────────────────────────┐
│ 🌐 Browser Script                              ◌ (spin) │
├─────────────────────────────────────────────────────────┤
│ [→ Navigate to zillow.com] → [✎ Fill "Hot Springs"] → [+4 more] │
└─────────────────────────────────────────────────────────┘
```

### Action Labels

| Action | Icon | Label Format |
|--------|------|--------------|
| `goto` | `Globe` | "Navigate to {hostname}" |
| `findAndFill` | `TextCursor` | "Fill "{text}"" |
| `findAndClick` | `MousePointer2` | "Click {selector}" |
| `clickByRef` | `MousePointer2` | "Click {ref}" |
| `fillByRef` | `TextCursor` | "Fill {ref}" |
| `keyboard` | `Keyboard` | "Press {key}" |
| `snapshot` | `Camera` | "Capture page" |
| `screenshot` | `Image` | "Screenshot" |
| `waitForSelector` | `Clock` | "Wait for element" |
| `waitForLoad` | `Clock` | "Wait for page" |
| `waitForNavigation` | `Clock` | "Wait for navigation" |
| `evaluate` | `Code` | "Run script" |

### Behavior

- Shows first 3 actions inline
- "+N more" chip expands to show all actions
- Expanded state shows "Show less" to collapse
- Chip text truncated at ~25 chars with ellipsis

## Technical Design

### Files

| File | Change |
|------|--------|
| `apps/desktop/src/renderer/components/BrowserScriptCard.tsx` | New component |
| `apps/desktop/src/renderer/pages/Execution.tsx` | Import and render when tool is browser_script |

### Component Props

```typescript
interface BrowserScriptCardProps {
  actions: BrowserAction[];
  isRunning?: boolean;
}

interface BrowserAction {
  action: string;
  url?: string;
  selector?: string;
  ref?: string;
  text?: string;
  key?: string;
}
```

### Styling

Uses existing design tokens:
- Chip: `bg-muted text-muted-foreground border border-border rounded-md`
- "+N more" chip: `bg-primary/10 text-primary cursor-pointer hover:bg-primary/20`
- Icons: lucide-react, 12px size
- Card: `bg-muted border border-border rounded-2xl`

### React Best Practices Applied

- `memo()` wrapper for performance
- Early return if not browser_script
- Direct icon imports (no barrel files)
- Ternary for conditional chip states
