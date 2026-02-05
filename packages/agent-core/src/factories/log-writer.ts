import { LogFileWriter } from '../internal/classes/LogFileWriter.js';
import { LogCollector } from '../internal/classes/LogCollector.js';
import type {
  LogWriterAPI,
  LogWriterOptions,
  LogLevel,
  LogSource,
} from '../types/log-writer.js';

export function createLogWriter(options: LogWriterOptions): LogWriterAPI {
  const fileWriter = new LogFileWriter(options.logDir);
  const collector = new LogCollector(fileWriter);

  return {
    initialize(): void {
      collector.initialize();
    },

    write(level: LogLevel, source: LogSource, message: string): void {
      fileWriter.write(level, source, message);
    },

    log(level: LogLevel, source: LogSource, message: string, data?: unknown): void {
      collector.log(level, source, message, data);
    },

    logMcp(level: LogLevel, message: string, data?: unknown): void {
      collector.logMcp(level, message, data);
    },

    logBrowser(level: LogLevel, message: string, data?: unknown): void {
      collector.logBrowser(level, message, data);
    },

    logOpenCode(level: LogLevel, message: string, data?: unknown): void {
      collector.logOpenCode(level, message, data);
    },

    logEnv(level: LogLevel, message: string, data?: unknown): void {
      collector.logEnv(level, message, data);
    },

    logIpc(level: LogLevel, message: string, data?: unknown): void {
      collector.logIpc(level, message, data);
    },

    flush(): void {
      collector.flush();
    },

    getCurrentLogPath(): string {
      return collector.getCurrentLogPath();
    },

    getLogDir(): string {
      return collector.getLogDir();
    },

    shutdown(): void {
      collector.shutdown();
    },
  };
}
