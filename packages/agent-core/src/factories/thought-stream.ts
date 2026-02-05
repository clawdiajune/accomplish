import { ThoughtStreamHandler } from '../internal/classes/ThoughtStreamHandler.js';
import type {
  ThoughtStreamAPI,
  ThoughtStreamOptions,
} from '../types/thought-stream.js';

export function createThoughtStreamHandler(
  options?: ThoughtStreamOptions
): ThoughtStreamAPI {
  void options;
  const handler = new ThoughtStreamHandler();
  return handler;
}
