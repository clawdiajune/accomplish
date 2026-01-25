# Options Dialog: Always-Visible Custom Text Input

**Date:** 2026-01-25
**Status:** Implemented

## Problem

The options dialog required users to click an "Other" option to access free text input. This added an extra step and made the custom input less discoverable.

## Solution

Add an always-visible text input below the predefined options with mutually exclusive behavior:
- Typing in the text field clears any selected options
- Selecting an option clears the text field
- User provides either options OR custom text, not both

## UI Design

```
┌─────────────────────────────────────┐
│  Which database should we use?      │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ PostgreSQL  │ │  MongoDB    │   │
│  └─────────────┘ └─────────────┘   │
│  ┌─────────────┐                    │
│  │   SQLite    │                    │
│  └─────────────┘                    │
│                                     │
│  ──────── or type your own ──────── │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Enter a different option... │   │
│  └─────────────────────────────┘   │
│                                     │
│              [ Submit ]             │
└─────────────────────────────────────┘
```

## Implementation

**File:** `apps/desktop/src/renderer/pages/Execution.tsx`

### Changes Made

1. **Removed `showCustomInput` state** - No longer needed since input is always visible

2. **Updated option click handler** - Clears `customResponse` when selecting an option

3. **Updated text input onChange** - Clears `selectedOptions` when typing

4. **Added visual divider** - "or type your own" text with horizontal lines

5. **Filtered out "Other" option** - Replaced by the always-visible text input

6. **Updated submit button logic** - Enabled when either options selected OR text entered

7. **Added `aria-label`** - For accessibility

### Response Logic

```typescript
// Mutually exclusive: text OR options, not both
selectedOptions: customResponse.trim() ? [] : selectedOptions,
customText: customResponse.trim() || undefined,
```

## Validation

- **React Best Practices:** Functional setState, no unnecessary re-renders
- **Frontend Design:** Consistent with existing design system, accessible
- **TypeScript:** Passes typecheck
- **Lint:** Passes

## Files Changed

- `apps/desktop/src/renderer/pages/Execution.tsx`
