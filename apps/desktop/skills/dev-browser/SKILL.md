---
name: dev-browser
description: Browser automation via MCP tools. ALWAYS use these tools for ANY web task - navigating sites, clicking, typing, filling forms, taking screenshots, or extracting data. This is the ONLY way to control the browser.
---

# Dev Browser - MANDATORY RULES

## RULE 1: AFTER EVERY CLICK → CHECK TABS

```
browser_tabs(action="list")                    ← Note: X tabs
browser_click(...)
browser_tabs(action="list")                    ← Compare to X
```

If tab count increased:
```
browser_tabs(action="switch", index=NEW_INDEX)
browser_wait(condition="timeout", timeout=3000) ← MUST wait!
browser_screenshot()                            ← Now verify
```

**NEVER click twice without checking tabs between clicks.**

## RULE 2: VERIFICATION = SEEING IN SCREENSHOT

You ONLY know an action worked if you SEE the result in a screenshot.

```
browser_keyboard(text="Hello")
browser_screenshot()
"I see 'Hello' in the document body" ← THIS is verification
```

**NEVER say "✓ typed text" without a screenshot showing it.**

## RULE 3: AFTER TAB SWITCH → WAIT, NEVER NAVIGATE

```
browser_tabs(action="switch", index=1)
browser_wait(condition="timeout", timeout=2000)
browser_screenshot()
```

**CRITICAL:** If screenshot still shows old page after tab switch:
- The tab switch is slow, NOT failed
- Solution: `browser_wait(timeout=3000)` then screenshot again
- **NEVER call browser_navigate** - it will navigate the WRONG tab and create duplicates!

**FORBIDDEN after clicking a link that opens a new tab:**
```
browser_navigate(...)  ← FORBIDDEN! Creates duplicate tabs!
```

**Why:** After tab switch, browser_navigate affects the OLD tab, not the new one. This creates two identical tabs.

## RULE 4: CANVAS APPS (Google Docs/Sheets/Figma)

Use `browser_keyboard(text="...")` not `browser_type`. Click coordinates to focus first.

```
browser_click(x=640, y=400)     ← Focus editor area
browser_keyboard(text="Hello")
browser_screenshot()            ← Verify text appeared
```

## RULE 5: TASK COMPLETION

Before saying "complete":
1. Take screenshot
2. For EACH requirement, state: "I see [X] in the screenshot" or "I do NOT see [X]"
3. If anything missing → fix it, don't claim done

## TOOLS

- `browser_navigate(url)` - Go to URL
- `browser_snapshot()` - Get element refs
- `browser_click(ref?, x?, y?)` - Click
- `browser_type(ref, text)` - Type in input field
- `browser_keyboard(text?, key?)` - Real keyboard (for canvas apps)
- `browser_screenshot()` - Capture current state
- `browser_tabs(action, index?)` - List/switch/close tabs (action: "list", "switch", "close")
- `browser_wait(condition, timeout?)` - Wait (condition: "load", "timeout")
- `browser_evaluate(script)` - Run JavaScript

## LOGIN PAGES

Ask user to log in manually, wait for confirmation, then continue.

## RETRY LIMIT

After 3 failed attempts at same action → try different approach or report blocker.
