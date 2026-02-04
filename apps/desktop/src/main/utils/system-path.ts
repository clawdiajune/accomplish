/**
 * Re-export system PATH utilities from core.
 *
 * Core's version has better cross-platform support (Windows path delimiters).
 */
export { getExtendedNodePath, findCommandInPath } from '@accomplish/core';
