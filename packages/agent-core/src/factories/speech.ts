import { SpeechService } from '../internal/classes/SpeechService.js';
import type {
  SpeechServiceAPI,
  SpeechServiceOptions,
} from '../types/speech.js';

export function createSpeechService(options: SpeechServiceOptions): SpeechServiceAPI {
  const service = new SpeechService(options.storage);
  return service;
}
