# Browser Connection Manager Design

## Problem

Browser connection logic is scattered across multiple files with duplicated health checking, retry logic, and error handling. The current startup check only verifies that port 9224 is occupied, not that the browser is actually usable. This causes "stale server" bugs where the app thinks a browser is available but it's actually dead.

## Solution

Create a centralized `@accomplish/browser-manager` package that owns the full browser lifecycle.

## Package Structure

```
packages/browser-manager/
├── src/
│   ├── index.ts              # Public exports
│   ├── manager.ts            # BrowserManager class
│   ├── states.ts             # State types and transitions
│   ├── health.ts             # Health checking logic
│   ├── launcher.ts           # Browser launch strategies
│   ├── installer.ts          # Playwright Chromium installation
│   ├── port-finder.ts        # Sequential port scanning
│   └── types.ts              # Shared types
├── test/
│   ├── mocks/
│   │   └── browser.ts        # MockBrowser for testing
│   ├── manager.test.ts
│   ├── health.test.ts
│   └── scenarios/            # Integration test scenarios
└── package.json
```

## Core API

```typescript
import { BrowserManager } from '@accomplish/browser-manager';

const manager = new BrowserManager();

// Acquire browser - manager handles everything
const browser = await manager.acquire({
  preferExisting: true,   // Reuse healthy browser if available
  headless: false,        // Visible browser window
});

// Subscribe to health changes
const unsubscribe = manager.subscribe((state) => {
  console.log(state.status);  // 'healthy', 'reconnecting', etc.
  console.log(state.port);    // Which port we ended up on
});

// Use browser via Playwright API
const page = await browser.newPage();
```

### Key Characteristics

- **No explicit release** - Manager auto-cleans up after idle period
- **Timeouts managed internally** - Manager knows context (installing vs reconnecting)
- **Consumer doesn't care about mode** - Launch, extension, or external is abstracted away

## State Machine

### State Types

```typescript
type BrowserState =
  // Starting states
  | { status: 'idle' }
  | { status: 'checking_existing'; port: number }
  | { status: 'launching'; port: number }
  | { status: 'installing_chromium'; progress?: number }
  | { status: 'connecting'; port: number }

  // Running states
  | { status: 'healthy'; port: number; mode: BrowserMode }
  | { status: 'degraded'; port: number; latency: number }
  | { status: 'reconnecting'; port: number; attempt: number; maxAttempts: number }

  // Failed states
  | { status: 'failed_install'; error: string }
  | { status: 'failed_launch'; error: string }
  | { status: 'failed_port_exhausted'; triedPorts: number[] }
  | { status: 'failed_timeout'; phase: string }
  | { status: 'failed_crashed'; error: string };

type BrowserMode = 'launch' | 'extension' | 'external';
```

### State Transitions

```
idle → checking_existing → launching → connecting → healthy
                ↓                           ↓
         (port taken)              installing_chromium
                ↓                           ↓
         checking_existing (next port)  launching

healthy → degraded → healthy  (recovered)
healthy → reconnecting → healthy  (reconnected)
healthy → reconnecting → failed_crashed  (gave up)

Any state → failed_*  (unrecoverable)
```

### Recovery Behavior

- Max 3 reconnection attempts
- Exponential backoff: 1s, 2s, 4s
- After 3 failures → `failed_crashed`

## Health Checking

The core fix for the original bug. Verifies browser is actually usable, not just port is open.

### Health Check Strategy

```typescript
interface HealthCheck {
  httpAlive: boolean;      // HTTP server responds
  cdpAlive: boolean;       // CDP endpoint responds
  browserAlive: boolean;   // Can execute simple command
  latencyMs: number;       // Response time
}

async function checkHealth(port: number): Promise<HealthCheck> {
  // 1. HTTP check - GET http://localhost:{port}/
  //    Timeout: 1s

  // 2. CDP check - GET http://localhost:{port+1}/json/version
  //    Timeout: 1s

  // 3. Browser check - Connect via CDP, run browser.version()
  //    Timeout: 2s
  //    This catches: closed windows, crashed renderer, hung browser

  // 4. Measure latency of the browser check
}
```

### Health Evaluation

| HTTP | CDP | Browser | Latency | Result |
|------|-----|---------|---------|--------|
| ✓ | ✓ | ✓ | < 500ms | `healthy` |
| ✓ | ✓ | ✓ | > 500ms | `degraded` |
| ✓ | ✓ | ✗ | — | Stale server, try next port |
| ✓ | ✗ | — | — | Stale server, try next port |
| ✗ | — | — | — | Port free, can use |

### Periodic Health Monitoring

- Check every 30s while browser is in use
- If degraded for >2 minutes, log warning
- If check fails, transition to `reconnecting`

## Browser Launch Strategies

Three modes abstracted behind common interface:

```typescript
interface LaunchStrategy {
  name: BrowserMode;
  canUse(): Promise<boolean>;
  launch(port: number, cdpPort: number, options: LaunchOptions): Promise<Browser>;
}
```

### Launch Mode (default)

1. Try system Chrome first (faster startup)
2. Fall back to Playwright Chromium (install if needed)
3. Launch with persistent profile, remote debugging port, anti-detection flags

### Extension Mode

Connect to relay server that bridges to Chrome extension. Used when user wants their existing Chrome session.

### External Mode

Connect to user-provided browser instance running with `--remote-debugging-port`.

## Port Finding

### Sequential Scan

```typescript
const PORT_RANGE_START = 9224;
const PORT_RANGE_END = 9240;  // 8 possible pairs

async function findAvailablePorts(): Promise<{ http: number; cdp: number }> {
  for (let http = PORT_RANGE_START; http <= PORT_RANGE_END; http += 2) {
    const cdp = http + 1;

    // Check both ports are free OR have a healthy existing browser
    const httpStatus = await checkPort(http);
    const cdpStatus = await checkPort(cdp);

    if (httpStatus === 'free' && cdpStatus === 'free') {
      return { http, cdp };  // Fresh ports
    }

    if (httpStatus === 'ours_healthy') {
      return { http, cdp };  // Reuse existing
    }

    // Port taken by something else or stale → try next pair
  }

  throw new PortExhaustedError([9224, 9226, ..., 9240]);
}
```

### Key Behavior

- Never kill stale processes, just switch ports
- HTTP port and CDP port are always adjacent pairs (9224/9225, 9226/9227, etc.)
- Throws `failed_port_exhausted` if all 8 pairs are taken

## Chromium Installation

```typescript
class ChromiumInstaller {
  async install(onProgress: (pct: number) => void): Promise<string> {
    // 1. Detect available package manager (bun > pnpm > npm)
    // 2. Run: {pm} exec playwright install chromium
    // 3. Parse output for progress updates
    // 4. Return path to installed browser
  }

  async isInstalled(): Promise<boolean>;
  getExecutablePath(): string | null;
}
```

Progress updates flow through subscription for UI display.

## Testing

### MockBrowser Interface

```typescript
import { MockBrowser } from '@accomplish/browser-manager/test';

const mock = new MockBrowser();
const manager = new BrowserManager({ browser: mock });

// Behavior-based: simulate realistic scenarios
mock.simulateSlowStart(3000);
mock.simulateCrashAfter(5000);
mock.simulateIntermittentDisconnect(0.1);
mock.simulateHighLatency(800);
mock.requireInstallation();

// State-based: direct control for edge cases
mock.setState('disconnected');
mock.setHealthCheck({ httpAlive: true, cdpAlive: false, browserAlive: false });
mock.setPortOccupied(9224, 'external');
```

### Test Scenarios

| Scenario | What it tests |
|----------|---------------|
| Happy path | Browser launches, connects, stays healthy |
| Stale server | Port occupied but browser dead → detect and switch ports |
| Slow launch | Browser takes time → proper state transitions |
| Crash mid-use | Browser dies → reconnect with backoff |
| Install required | No Chrome → Playwright download flow |
| Port conflict | External app on port → find next available |
| Flaky connection | Intermittent disconnects → backoff logic |

## Integration

### Changes to dev-browser Skill

Skill becomes thin HTTP API wrapper:

```typescript
// dev-browser/src/index.ts
import { BrowserManager } from '@accomplish/browser-manager';

const manager = new BrowserManager();

export async function serve(options: ServeOptions) {
  const browser = await manager.acquire({
    headless: options.headless,
    preferExisting: true,
  });

  const app = express();

  app.get('/', (req, res) => {
    const state = manager.getState();
    res.json({
      wsEndpoint: state.wsEndpoint,
      mode: state.mode,
      port: state.port,
    });
  });

  app.get('/health', (req, res) => {
    const state = manager.getState();
    res.json({ healthy: state.status === 'healthy' });
  });

  // ... rest of HTTP endpoints unchanged
}
```

### Changes to Main Process

```typescript
// main/browser/index.ts (new file)
import { BrowserManager } from '@accomplish/browser-manager';

export const browserManager = new BrowserManager();

browserManager.subscribe((state) => {
  mainWindow?.webContents.send('browser:health', state);
});
```

### Changes to Preload/Renderer

```typescript
// preload
onBrowserHealth: (callback) => {
  ipcRenderer.on('browser:health', (_, state) => callback(state));
}

// renderer
window.accomplish.onBrowserHealth((state) => {
  setBrowserStatus(state);
});
```

## Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Port range | 9224-9240 | 8 HTTP/CDP pairs |
| Health check interval | 30s | While browser in use |
| Reconnect attempts | 3 | Before giving up |
| Reconnect backoff | 1s, 2s, 4s | Exponential |
| Degraded threshold | 500ms | Latency above this = degraded |
| Profile directory | Platform-specific | Manager owns entirely |

### Profile Directories

- macOS: `~/Library/Application Support/Accomplish/dev-browser/profiles`
- Windows: `%APPDATA%/Accomplish/dev-browser/profiles`
- Linux: `~/.accomplish/dev-browser/profiles`

## Summary

| Aspect | Decision |
|--------|----------|
| Package | `packages/browser-manager/` |
| Scope | Full lifecycle |
| Browser modes | Launch, Extension, External (abstracted) |
| API | `manager.acquire()` with options |
| Release | Automatic after idle |
| Timeouts | Manager decides internally |
| Health states | 14 states |
| Recovery | 3 retries, exponential backoff |
| Port handling | Sequential scan, never kill |
| Health check | HTTP + CDP + browser command |
| Subscription | `manager.subscribe()` |
| Profile dir | Manager owns |
| Logging | Internal |
| Testing | Behavior + state mocks |
