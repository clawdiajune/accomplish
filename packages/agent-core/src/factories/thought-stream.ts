import { ThoughtStreamHandler } from '../internal/classes/ThoughtStreamHandler.js';
import type { ThoughtStreamAPI } from '../types/thought-stream.js';

export function createThoughtStreamHandler(): ThoughtStreamAPI {
  const handler = new ThoughtStreamHandler();
  return handler;
}
