import {
  FILE_OPERATIONS,
  PERMISSION_REQUEST_TIMEOUT_MS,
  createFilePermissionRequestId,
  createQuestionRequestId,
} from '../../common/index.js';
import type { FileOperation, PermissionRequest, PermissionOption } from '../../common/types/permission.js';

export interface PendingRequest<T> {
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

export interface PermissionValidationResult {
  valid: boolean;
  error?: string;
}

export interface FilePermissionRequestData {
  operation?: string;
  filePath?: string;
  filePaths?: string[];
  targetPath?: string;
  contentPreview?: string;
}

export interface QuestionRequestData {
  question?: string;
  header?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

export interface QuestionResponseData {
  selectedOptions?: string[];
  customText?: string;
  denied?: boolean;
}

export class PermissionRequestHandler {
  private pendingPermissions = new Map<string, PendingRequest<boolean>>();
  private pendingQuestions = new Map<string, PendingRequest<QuestionResponseData>>();
  private defaultTimeoutMs: number;

  constructor(timeoutMs: number = PERMISSION_REQUEST_TIMEOUT_MS) {
    this.defaultTimeoutMs = timeoutMs;
  }

  createPermissionRequest(timeoutMs?: number): { requestId: string; promise: Promise<boolean> } {
    const requestId = createFilePermissionRequestId();
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    const promise = new Promise<boolean>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingPermissions.delete(requestId);
        reject(new Error('Permission request timed out'));
      }, timeout);

      this.pendingPermissions.set(requestId, { resolve, reject, timeoutId });
    });

    return { requestId, promise };
  }

  createQuestionRequest(timeoutMs?: number): { requestId: string; promise: Promise<QuestionResponseData> } {
    const requestId = createQuestionRequestId();
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    const promise = new Promise<QuestionResponseData>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingQuestions.delete(requestId);
        reject(new Error('Question request timed out'));
      }, timeout);

      this.pendingQuestions.set(requestId, { resolve, reject, timeoutId });
    });

    return { requestId, promise };
  }

  resolvePermissionRequest(requestId: string, allowed: boolean): boolean {
    const pending = this.pendingPermissions.get(requestId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeoutId);
    pending.resolve(allowed);
    this.pendingPermissions.delete(requestId);
    return true;
  }

  resolveQuestionRequest(requestId: string, response: QuestionResponseData): boolean {
    const pending = this.pendingQuestions.get(requestId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeoutId);
    pending.resolve(response);
    this.pendingQuestions.delete(requestId);
    return true;
  }

  validateFilePermissionRequest(data: unknown): PermissionValidationResult {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid request data' };
    }

    const requestData = data as FilePermissionRequestData;

    if (!requestData.operation) {
      return { valid: false, error: 'operation is required' };
    }

    if (!requestData.filePath && (!requestData.filePaths || requestData.filePaths.length === 0)) {
      return { valid: false, error: 'operation and either filePath or filePaths are required' };
    }

    if (!FILE_OPERATIONS.includes(requestData.operation as FileOperation)) {
      return {
        valid: false,
        error: `Invalid operation. Must be one of: ${FILE_OPERATIONS.join(', ')}`,
      };
    }

    return { valid: true };
  }

  validateQuestionRequest(data: unknown): PermissionValidationResult {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid request data' };
    }

    const requestData = data as QuestionRequestData;

    if (!requestData.question) {
      return { valid: false, error: 'question is required' };
    }

    return { valid: true };
  }

  buildFilePermissionRequest(
    requestId: string,
    taskId: string,
    data: FilePermissionRequestData
  ): PermissionRequest {
    return {
      id: requestId,
      taskId,
      type: 'file',
      fileOperation: data.operation as FileOperation,
      filePath: data.filePath,
      filePaths: data.filePaths,
      targetPath: data.targetPath,
      contentPreview: data.contentPreview?.substring(0, 500),
      createdAt: new Date().toISOString(),
    };
  }

  buildQuestionRequest(
    requestId: string,
    taskId: string,
    data: QuestionRequestData
  ): PermissionRequest {
    return {
      id: requestId,
      taskId,
      type: 'question',
      question: data.question,
      header: data.header,
      options: data.options as PermissionOption[],
      multiSelect: data.multiSelect,
      createdAt: new Date().toISOString(),
    };
  }

  hasPendingPermissions(): boolean {
    return this.pendingPermissions.size > 0;
  }

  hasPendingQuestions(): boolean {
    return this.pendingQuestions.size > 0;
  }

  getPendingPermissionCount(): number {
    return this.pendingPermissions.size;
  }

  getPendingQuestionCount(): number {
    return this.pendingQuestions.size;
  }

  clearAll(): void {
    for (const [, pending] of this.pendingPermissions) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Request cancelled'));
    }
    this.pendingPermissions.clear();

    for (const [, pending] of this.pendingQuestions) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Request cancelled'));
    }
    this.pendingQuestions.clear();
  }
}
