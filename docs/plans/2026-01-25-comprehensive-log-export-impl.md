# Comprehensive Log Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture all application logs from startup in a persistent file; add "Export Logs" button in Settings.

**Architecture:** Central LogCollector service intercepts console + component events at startup. Writes to daily rotating log file. Export copies file via native save dialog.

**Tech Stack:** Node.js fs, Electron dialog API, existing IPC patterns.

---

## Task 1: Create Redaction Utility

**Files:**
- Create: `apps/desktop/src/main/logging/redact.ts`

**Step 1: Write the redaction function**

```typescript
/**
 * Redact sensitive data from log strings
 * Handles API keys, tokens, and other secrets
 */

// Patterns for sensitive data
const REDACTION_PATTERNS = [
  // API keys - various formats
  /sk-[a-zA-Z0-9]{20,}/g,  // OpenAI/Anthropic style
  /xai-[a-zA-Z0-9]{20,}/g,  // xAI
  /AIza[a-zA-Z0-9_-]{35}/g,  // Google API keys
  /AKIA[A-Z0-9]{16}/g,  // AWS Access Key ID

  // Generic patterns
  /(?:api[_-]?key|apikey|secret|token|password|credential)['":\s]*[=:]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,

  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9._-]+/gi,

  // Base64 encoded secrets (at least 32 chars, likely secrets)
  /(?:secret|password|key)['":\s]*[=:]\s*['"]?([A-Za-z0-9+/=]{32,})['"]?/gi,
];

export function redact(text: string): string {
  let result = text;

  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Keep first 4 chars for identification, redact rest
      const prefix = match.slice(0, 4);
      return `${prefix}[REDACTED]`;
    });
  }

  return result;
}
```

**Step 2: Verify file exists**

Run: `ls -la apps/desktop/src/main/logging/`
Expected: `redact.ts` exists

**Step 3: Commit**

```bash
git add apps/desktop/src/main/logging/redact.ts
git commit -m "feat(logging): add sensitive data redaction utility"
```

---

## Task 2: Create Log File Writer

**Files:**
- Create: `apps/desktop/src/main/logging/log-file-writer.ts`

**Step 1: Write the log file writer**

```typescript
/**
 * Log file writer with daily rotation and buffered writes
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { redact } from './redact';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const RETENTION_DAYS = 7;
const BUFFER_FLUSH_INTERVAL_MS = 5000;
const BUFFER_MAX_ENTRIES = 100;

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogSource = 'main' | 'mcp' | 'browser' | 'opencode' | 'env' | 'ipc';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
}

class LogFileWriter {
  private logDir: string;
  private currentDate: string = '';
  private currentFilePath: string = '';
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private fileSizeExceeded: boolean = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.logDir = path.join(userDataPath, 'logs');
  }

  /**
   * Initialize the log writer - creates log directory and cleans old files
   */
  initialize(): void {
    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Clean up old log files
    this.cleanupOldLogs();

    // Set up the current log file
    this.updateCurrentFile();

    // Start the flush timer
    this.flushTimer = setInterval(() => this.flush(), BUFFER_FLUSH_INTERVAL_MS);
  }

  /**
   * Write a log entry
   */
  write(level: LogLevel, source: LogSource, message: string): void {
    if (this.fileSizeExceeded) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message: redact(message),
    };

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= BUFFER_MAX_ENTRIES) {
      this.flush();
    }
  }

  /**
   * Flush buffered entries to disk
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    // Check if date changed (need new file)
    this.updateCurrentFile();

    // Check file size
    if (this.checkFileSize()) {
      this.fileSizeExceeded = true;
      console.error('[LogFileWriter] Max file size exceeded, stopping writes');
      return;
    }

    // Format entries
    const lines = this.buffer.map((entry) =>
      `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}`
    );

    // Append to file
    try {
      fs.appendFileSync(this.currentFilePath, lines.join('\n') + '\n');
    } catch (error) {
      console.error('[LogFileWriter] Failed to write logs:', error);
    }

    this.buffer = [];
  }

  /**
   * Get the current log file path for export
   */
  getCurrentLogPath(): string {
    this.updateCurrentFile();
    return this.currentFilePath;
  }

  /**
   * Get the log directory path
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Shutdown the writer - flush and stop timer
   */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  private updateCurrentFile(): void {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (today !== this.currentDate) {
      // Flush any buffered entries to old file first
      if (this.currentDate && this.buffer.length > 0) {
        this.flush();
      }
      this.currentDate = today;
      this.currentFilePath = path.join(this.logDir, `app-${today}.log`);
      this.fileSizeExceeded = false;
    }
  }

  private checkFileSize(): boolean {
    try {
      if (!fs.existsSync(this.currentFilePath)) return false;
      const stats = fs.statSync(this.currentFilePath);
      return stats.size >= MAX_FILE_SIZE_BYTES;
    } catch {
      return false;
    }
  }

  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      for (const file of files) {
        if (!file.startsWith('app-') || !file.endsWith('.log')) continue;

        // Extract date from filename (app-YYYY-MM-DD.log)
        const dateMatch = file.match(/app-(\d{4}-\d{2}-\d{2})\.log/);
        if (!dateMatch) continue;

        const fileDate = new Date(dateMatch[1]);
        if (fileDate < cutoffDate) {
          const filePath = path.join(this.logDir, file);
          fs.unlinkSync(filePath);
          console.log(`[LogFileWriter] Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('[LogFileWriter] Failed to cleanup old logs:', error);
    }
  }
}

// Singleton instance
let instance: LogFileWriter | null = null;

export function getLogFileWriter(): LogFileWriter {
  if (!instance) {
    instance = new LogFileWriter();
  }
  return instance;
}

export function initializeLogFileWriter(): void {
  getLogFileWriter().initialize();
}

export function shutdownLogFileWriter(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
```

**Step 2: Verify file exists**

Run: `ls -la apps/desktop/src/main/logging/`
Expected: `log-file-writer.ts` and `redact.ts` exist

**Step 3: Commit**

```bash
git add apps/desktop/src/main/logging/log-file-writer.ts
git commit -m "feat(logging): add log file writer with rotation and buffering"
```

---

## Task 3: Create Log Collector Service

**Files:**
- Create: `apps/desktop/src/main/logging/log-collector.ts`

**Step 1: Write the log collector**

```typescript
/**
 * LogCollector - Central logging service that captures all application logs
 *
 * Intercepts console.log/warn/error and provides methods for components
 * to log structured events.
 */

import { getLogFileWriter, initializeLogFileWriter, shutdownLogFileWriter, type LogLevel, type LogSource } from './log-file-writer';

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

class LogCollector {
  private initialized = false;

  /**
   * Initialize the log collector - must be called early in app startup
   */
  initialize(): void {
    if (this.initialized) return;

    // Initialize the file writer first
    initializeLogFileWriter();

    // Override console methods to capture all logs
    console.log = (...args: unknown[]) => {
      originalConsole.log(...args);
      this.captureConsole('INFO', args);
    };

    console.warn = (...args: unknown[]) => {
      originalConsole.warn(...args);
      this.captureConsole('WARN', args);
    };

    console.error = (...args: unknown[]) => {
      originalConsole.error(...args);
      this.captureConsole('ERROR', args);
    };

    console.debug = (...args: unknown[]) => {
      originalConsole.debug(...args);
      this.captureConsole('DEBUG', args);
    };

    this.initialized = true;

    // Log startup
    this.log('INFO', 'main', 'LogCollector initialized');
  }

  /**
   * Log a message with structured metadata
   */
  log(level: LogLevel, source: LogSource, message: string, data?: unknown): void {
    const writer = getLogFileWriter();

    let fullMessage = message;
    if (data !== undefined) {
      try {
        fullMessage += ' ' + JSON.stringify(data);
      } catch {
        fullMessage += ' [unserializable data]';
      }
    }

    writer.write(level, source, fullMessage);
  }

  /**
   * Log MCP server events
   */
  logMcp(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'mcp', message, data);
  }

  /**
   * Log browser/Playwright events
   */
  logBrowser(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'browser', message, data);
  }

  /**
   * Log OpenCode CLI events
   */
  logOpenCode(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'opencode', message, data);
  }

  /**
   * Log environment/startup events
   */
  logEnv(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'env', message, data);
  }

  /**
   * Log IPC events
   */
  logIpc(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'ipc', message, data);
  }

  /**
   * Get the path to the current log file (for export)
   */
  getCurrentLogPath(): string {
    return getLogFileWriter().getCurrentLogPath();
  }

  /**
   * Get the log directory
   */
  getLogDir(): string {
    return getLogFileWriter().getLogDir();
  }

  /**
   * Flush all pending logs to disk
   */
  flush(): void {
    getLogFileWriter().flush();
  }

  /**
   * Shutdown the collector
   */
  shutdown(): void {
    if (!this.initialized) return;

    this.log('INFO', 'main', 'LogCollector shutting down');

    // Restore original console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;

    shutdownLogFileWriter();
    this.initialized = false;
  }

  /**
   * Capture console output and route to file writer
   */
  private captureConsole(level: LogLevel, args: unknown[]): void {
    // Detect source from message prefix like [Main], [TaskManager], etc.
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');

    // Detect source from common prefixes
    let source: LogSource = 'main';
    if (message.startsWith('[TaskManager]') || message.startsWith('[OpenCode')) {
      source = 'opencode';
    } else if (message.startsWith('[DevBrowser') || message.startsWith('[Playwright')) {
      source = 'browser';
    } else if (message.startsWith('[MCP]') || message.includes('MCP server')) {
      source = 'mcp';
    } else if (message.startsWith('[IPC]')) {
      source = 'ipc';
    }

    getLogFileWriter().write(level, source, message);
  }
}

// Singleton instance
let instance: LogCollector | null = null;

export function getLogCollector(): LogCollector {
  if (!instance) {
    instance = new LogCollector();
  }
  return instance;
}

export function initializeLogCollector(): void {
  getLogCollector().initialize();
}

export function shutdownLogCollector(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
```

**Step 2: Create index file for logging module**

Create `apps/desktop/src/main/logging/index.ts`:

```typescript
export { redact } from './redact';
export {
  getLogFileWriter,
  initializeLogFileWriter,
  shutdownLogFileWriter,
  type LogLevel,
  type LogSource,
} from './log-file-writer';
export {
  getLogCollector,
  initializeLogCollector,
  shutdownLogCollector,
} from './log-collector';
```

**Step 3: Verify files exist**

Run: `ls -la apps/desktop/src/main/logging/`
Expected: All 4 files exist (redact.ts, log-file-writer.ts, log-collector.ts, index.ts)

**Step 4: Commit**

```bash
git add apps/desktop/src/main/logging/
git commit -m "feat(logging): add LogCollector service with console interception"
```

---

## Task 4: Initialize LogCollector at App Startup

**Files:**
- Modify: `apps/desktop/src/main/index.ts`

**Step 1: Add import at top of file (after other imports)**

After line 12 (`import { stopAzureFoundryProxy } from './opencode/azure-foundry-proxy';`), add:

```typescript
import { initializeLogCollector, shutdownLogCollector, getLogCollector } from './logging';
```

**Step 2: Initialize LogCollector early - first thing after gotTheLock check**

After line 138 (`} else {`), add initialization before the `app.on('second-instance'` line:

```typescript
  // Initialize logging FIRST - before anything else
  initializeLogCollector();
  getLogCollector().logEnv('INFO', 'App starting', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
  });

```

**Step 3: Add shutdown in before-quit handler**

In the `app.on('before-quit'` handler (around line 213), add before `flushPendingTasks()`:

```typescript
  // Flush and shutdown logging
  shutdownLogCollector();
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/desktop/src/main/index.ts
git commit -m "feat(logging): initialize LogCollector at app startup"
```

---

## Task 5: Add IPC Handler for Log Export

**Files:**
- Modify: `apps/desktop/src/main/ipc/handlers.ts`

**Step 1: Add imports at top of file**

After existing imports, add:

```typescript
import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { getLogCollector } from '../logging';
```

Note: `dialog` may already be imported from 'electron' - just add it to the existing import if not.

**Step 2: Add export handler at the end of registerIPCHandlers function**

Before the closing `}` of `registerIPCHandlers()`, add:

```typescript
  // Logs: Export application logs
  handle('logs:export', async (event: IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');

    // Flush pending logs before export
    const collector = getLogCollector();
    collector.flush();

    const logPath = collector.getCurrentLogPath();
    const logDir = collector.getLogDir();

    // Generate default filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultFilename = `openwork-logs-${timestamp}.txt`;

    // Show save dialog
    const result = await dialog.showSaveDialog(window, {
      title: 'Export Application Logs',
      defaultPath: defaultFilename,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Log Files', extensions: ['log'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, reason: 'cancelled' };
    }

    try {
      // Check if current log file exists
      if (fs.existsSync(logPath)) {
        // Copy the log file to the selected location
        fs.copyFileSync(logPath, result.filePath);
      } else {
        // No logs yet - create empty file with header
        const header = `Openwork Application Logs\nExported: ${new Date().toISOString()}\nLog Directory: ${logDir}\n\nNo logs recorded yet.\n`;
        fs.writeFileSync(result.filePath, header);
      }

      return { success: true, path: result.filePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/desktop/src/main/ipc/handlers.ts
git commit -m "feat(logging): add IPC handler for log export"
```

---

## Task 6: Expose Export Method in Preload

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`

**Step 1: Add exportLogs method to accomplishAPI object**

After the `logEvent` method (around line 238), add:

```typescript
  // Export application logs
  exportLogs: (): Promise<{ success: boolean; path?: string; error?: string; reason?: string }> =>
    ipcRenderer.invoke('logs:export'),
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/desktop/src/preload/index.ts
git commit -m "feat(logging): expose exportLogs in preload API"
```

---

## Task 7: Add Export Button to Settings UI

**Files:**
- Modify: `apps/desktop/src/renderer/components/layout/SettingsDialog.tsx`

**Step 1: Add state for export status**

After the `debugMode` state declaration (around line 46), add:

```typescript
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
```

**Step 2: Add export handler function**

After the `handleDebugToggle` callback (around line 163), add:

```typescript
  // Handle log export
  const handleExportLogs = useCallback(async () => {
    setExportStatus('exporting');
    try {
      const result = await accomplish.exportLogs();
      if (result.success) {
        setExportStatus('success');
        // Reset to idle after 2 seconds
        setTimeout(() => setExportStatus('idle'), 2000);
      } else if (result.reason === 'cancelled') {
        setExportStatus('idle');
      } else {
        console.error('Failed to export logs:', result.error);
        setExportStatus('error');
        setTimeout(() => setExportStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Export logs error:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  }, [accomplish]);
```

**Step 3: Add Export button next to debug toggle**

Find the Debug Mode section (around line 317-349). Replace the entire section with:

```typescript
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Debug Mode</div>
                      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                        Show detailed backend logs in the task view.
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      {/* Export Logs Button */}
                      <button
                        onClick={handleExportLogs}
                        disabled={exportStatus === 'exporting'}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          exportStatus === 'success'
                            ? 'bg-green-500/20 text-green-500'
                            : exportStatus === 'error'
                            ? 'bg-destructive/20 text-destructive'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {exportStatus === 'exporting' ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Exporting...
                          </span>
                        ) : exportStatus === 'success' ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Exported
                          </span>
                        ) : exportStatus === 'error' ? (
                          'Export Failed'
                        ) : (
                          'Export Logs'
                        )}
                      </button>
                      {/* Debug Toggle */}
                      <button
                        data-testid="settings-debug-toggle"
                        onClick={handleDebugToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-accomplish ${debugMode ? 'bg-primary' : 'bg-muted'
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-accomplish ${debugMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                  {debugMode && (
                    <div className="mt-4 rounded-xl bg-warning/10 p-3.5">
                      <p className="text-sm text-warning">
                        Debug mode is enabled. Backend logs will appear in the task view
                        when running tasks.
                      </p>
                    </div>
                  )}
                </div>
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/components/layout/SettingsDialog.tsx
git commit -m "feat(logging): add Export Logs button to Settings dialog"
```

---

## Task 8: Add Typed Method to accomplish.ts Wrapper

**Files:**
- Modify: `apps/desktop/src/renderer/lib/accomplish.ts`

**Step 1: Find the AccomplishAPI type or interface**

Search for where the renderer wraps the preload API. Add the exportLogs method if it's not automatically typed.

**Step 2: Run typecheck to verify everything compiles**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit (if changes were needed)**

```bash
git add apps/desktop/src/renderer/lib/accomplish.ts
git commit -m "feat(logging): add exportLogs type to renderer API wrapper"
```

---

## Task 9: Test the Implementation

**Step 1: Run the app in dev mode**

Run: `pnpm dev`

**Step 2: Manual test checklist**

1. Open Settings dialog
2. Verify "Export Logs" button appears next to Debug Mode toggle
3. Click "Export Logs" button
4. Verify save dialog appears
5. Save the file
6. Open the file and verify it contains log entries
7. Verify API keys are redacted (if any were logged)

**Step 3: Verify log file location**

Check that logs are being written to the correct location:
- macOS: `~/Library/Application Support/Openwork/logs/app-YYYY-MM-DD.log`
- Windows: `%APPDATA%/Openwork/logs/app-YYYY-MM-DD.log`
- Linux: `~/.config/Openwork/logs/app-YYYY-MM-DD.log`

**Step 4: Final typecheck**

Run: `pnpm typecheck`
Expected: No errors

---

## Task 10: Final Commit

**Step 1: Verify all changes are committed**

Run: `git status`
Expected: Clean working directory

**Step 2: Run build to ensure everything compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Summary of files changed**

New files:
- `apps/desktop/src/main/logging/redact.ts`
- `apps/desktop/src/main/logging/log-file-writer.ts`
- `apps/desktop/src/main/logging/log-collector.ts`
- `apps/desktop/src/main/logging/index.ts`

Modified files:
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/ipc/handlers.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/components/layout/SettingsDialog.tsx`
