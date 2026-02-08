---
name: validate-feature
description: Launch the Electron app in dev mode and interactively navigate the UI to validate a feature works. Use when asked to test, validate, or verify a feature in the running app.
---

# Validate Feature

You have access to Playwright MCP tools (`browser_snapshot`, `browser_click`, `browser_type`, etc.) that control the Electron app's UI via Chrome DevTools Protocol on port 19229.

## Step 1: Ensure the app is running

Check if the dev server is already up:

```bash
curl -s http://127.0.0.1:19229/json/version
```

If that fails, start the dev server in the background:

```bash
cd apps/desktop && ELECTRON_CDP_PORT=19229 pnpm dev &
```

Then poll until CDP is ready (retry every 2s, up to 60s):

```bash
for i in $(seq 1 30); do curl -s http://127.0.0.1:19229/json/version && break; sleep 2; done
```

Wait an additional 5 seconds after CDP is ready for React to hydrate.

## Step 1b: Handle stale CDP connections

If `browser_snapshot` times out with `browserType.connectOverCDP: Timeout`, the MCP server has a stale connection to a previous Electron instance. Fix it:

1. Kill the existing Electron app:
   ```bash
   pkill -f "Electron.*Accomplish" 2>/dev/null || true
   pkill -f "accomplish.*electron" 2>/dev/null || true
   lsof -ti:19229 | xargs kill -9 2>/dev/null || true
   ```
2. Wait for the single-instance lock to release:
   ```bash
   sleep 3
   ```
3. Restart the dev server and poll for CDP (repeat Step 1).
4. After CDP is ready, wait 5 seconds for React hydration, then retry `browser_snapshot`.

This happens when the app was restarted outside of this session — the MCP server's WebSocket connects to the old debug URL but Playwright initialization hangs.

## Step 2: Interact with the app

Use the Playwright MCP tools to navigate and validate the feature:

1. **`browser_snapshot`** — Get the current accessibility tree. This is your "eyes." Call it frequently to see the current state.
2. **`browser_click`** — Click elements by their accessibility ref from the snapshot.
3. **`browser_type`** — Type text into focused input fields.
4. **`browser_press_key`** — Press keys (Enter, Tab, Escape, etc.).
5. **`browser_hover`** — Hover over elements to trigger tooltips/menus.
6. **`browser_wait_for`** — Wait for elements to appear/disappear.

### Interaction loop

Repeat this cycle until validation is complete:

1. Take a snapshot to see current state
2. Decide what action to take
3. Perform the action
4. Take another snapshot to verify the result
5. Reason about whether the feature works

## Step 3: Report results

After validation, report:

- **Pass/Fail** — Does the feature work as expected?
- **What you observed** — Key UI states, transitions, content
- **Issues found** — Any bugs, broken states, or unexpected behavior
- **Steps taken** — Brief summary of navigation path

## Important notes

- Do NOT kill the dev server when done — the user may want it running.
- If the app shows an onboarding/auth screen, the feature being tested may require setup first. Ask the user.
- The app enforces single-instance. If you can't connect, there may be another Electron instance running. Kill it: `pkill -f "Electron.*Accomplish"`
- If `browser_snapshot` returns nothing useful, the MCP server may not be connected. Re-check CDP availability.
