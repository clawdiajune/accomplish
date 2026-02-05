import { type LogLevel, type LogSource } from '../common/types/logging.js';
import { detectLogSource } from '../common/utils/log-source-detector.js';
import type { LogWriterAPI } from '../types/log-writer.js';

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

export class LogCollector {
  private initialized = false;

  constructor(private writer: LogWriterAPI) {}

  initialize(): void {
    if (this.initialized) return;

    this.writer.initialize();

    const consoleOverrides: Array<[keyof typeof originalConsole, LogLevel]> = [
      ['log', 'INFO'],
      ['warn', 'WARN'],
      ['error', 'ERROR'],
      ['debug', 'DEBUG'],
    ];

    for (const [method, level] of consoleOverrides) {
      console[method] = (...args: unknown[]) => {
        try {
          originalConsole[method](...args);
        } catch {}
        this.captureConsole(level, args);
      };
    }

    this.initialized = true;

    this.log('INFO', 'main', 'LogCollector initialized');
  }

  log(level: LogLevel, source: LogSource, message: string, data?: unknown): void {
    let fullMessage = message;
    if (data !== undefined) {
      try {
        fullMessage += ' ' + JSON.stringify(data);
      } catch {
        fullMessage += ' [unserializable data]';
      }
    }

    this.writer.write(level, source, fullMessage);
  }

  logMcp(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'mcp', message, data);
  }

  logBrowser(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'browser', message, data);
  }

  logOpenCode(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'opencode', message, data);
  }

  logEnv(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'env', message, data);
  }

  logIpc(level: LogLevel, message: string, data?: unknown): void {
    this.log(level, 'ipc', message, data);
  }

  getCurrentLogPath(): string {
    return this.writer.getCurrentLogPath();
  }

  getLogDir(): string {
    return this.writer.getLogDir();
  }

  flush(): void {
    this.writer.flush();
  }

  shutdown(): void {
    if (!this.initialized) return;

    this.log('INFO', 'main', 'LogCollector shutting down');

    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;

    this.writer.shutdown();
    this.initialized = false;
  }

  private captureConsole(level: LogLevel, args: unknown[]): void {
    const message = args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');

    const source = detectLogSource(message);
    this.writer.write(level, source, message);
  }
}
