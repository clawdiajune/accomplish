export interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration: number;
  timestamp: number;
}

export interface TranscriptionError {
  code: string;
  message: string;
}

export interface SpeechServiceStorage {
  getApiKey(provider: string): string | null;
}

export interface SpeechServiceOptions {
  storage: SpeechServiceStorage;
}

export interface SpeechServiceAPI {
  getElevenLabsApiKey(): string | null;
  isElevenLabsConfigured(): boolean;
  validateElevenLabsApiKey(apiKey?: string): Promise<{
    valid: boolean;
    error?: string;
  }>;
  transcribeAudio(
    audioData: Buffer,
    mimeType?: string
  ): Promise<
    | { success: true; result: TranscriptionResult }
    | { success: false; error: TranscriptionError }
  >;
}
