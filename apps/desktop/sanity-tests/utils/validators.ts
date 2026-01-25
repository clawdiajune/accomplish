// apps/desktop/sanity-tests/utils/validators.ts
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export const SANITY_OUTPUT_DIR = path.join(homedir(), 'openwork-sanity-output');

/**
 * Ensure the sanity output directory exists and is empty.
 */
export function setupOutputDirectory(): void {
  if (fs.existsSync(SANITY_OUTPUT_DIR)) {
    fs.rmSync(SANITY_OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(SANITY_OUTPUT_DIR, { recursive: true });
}

/**
 * Check if a file exists in the output directory.
 */
export function fileExists(filename: string): boolean {
  return fs.existsSync(path.join(SANITY_OUTPUT_DIR, filename));
}

/**
 * Get file size in bytes.
 */
export function getFileSize(filename: string): number {
  const filepath = path.join(SANITY_OUTPUT_DIR, filename);
  if (!fs.existsSync(filepath)) return 0;
  return fs.statSync(filepath).size;
}

/**
 * Read file content as string.
 */
export function readFileContent(filename: string): string {
  return fs.readFileSync(path.join(SANITY_OUTPUT_DIR, filename), 'utf-8');
}

/**
 * Check if file contains a pattern (regex or string).
 */
export function fileContains(filename: string, pattern: string | RegExp): boolean {
  const content = readFileContent(filename);
  if (typeof pattern === 'string') {
    return content.includes(pattern);
  }
  return pattern.test(content);
}

/**
 * Count lines in a file (for CSV validation).
 */
export function countLines(filename: string): number {
  const content = readFileContent(filename);
  return content.split('\n').filter(line => line.trim().length > 0).length;
}

/**
 * Create a seed file for testing file read operations.
 */
export function seedInputFile(): void {
  const content = `This is a sample text file for sanity testing.
It contains multiple lines of text.
The agent should be able to read this file.
Count the words and lines accurately.
This file has exactly five lines of content.`;

  fs.writeFileSync(path.join(SANITY_OUTPUT_DIR, 'input.txt'), content);
}

/**
 * Get full path to a file in the output directory.
 */
export function getOutputPath(filename: string): string {
  return path.join(SANITY_OUTPUT_DIR, filename);
}
