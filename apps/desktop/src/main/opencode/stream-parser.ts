// apps/desktop/src/main/opencode/stream-parser.ts

/**
 * Re-export StreamParser from @accomplish/core.
 *
 * The core package provides the implementation; this module ensures
 * backward compatibility for existing desktop imports.
 */

export { StreamParser, type StreamParserEvents } from '@accomplish/core';
