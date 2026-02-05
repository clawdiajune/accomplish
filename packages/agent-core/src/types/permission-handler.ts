import type { PermissionRequest, FileOperation } from '../common/types/permission';

export interface FilePermissionRequestData {
  operation?: FileOperation;
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

export interface PermissionValidationResult {
  valid: boolean;
  error?: string;
}

export interface PermissionHandlerOptions {
  defaultTimeoutMs?: number;
}

export interface PermissionHandlerAPI {
  createPermissionRequest(timeoutMs?: number): {
    requestId: string;
    promise: Promise<boolean>;
  };
  createQuestionRequest(timeoutMs?: number): {
    requestId: string;
    promise: Promise<QuestionResponseData>;
  };
  resolvePermissionRequest(requestId: string, allowed: boolean): boolean;
  resolveQuestionRequest(requestId: string, response: QuestionResponseData): boolean;
  validateFilePermissionRequest(data: unknown): PermissionValidationResult;
  validateQuestionRequest(data: unknown): PermissionValidationResult;
  buildFilePermissionRequest(
    requestId: string,
    taskId: string,
    data: FilePermissionRequestData
  ): PermissionRequest;
  buildQuestionRequest(
    requestId: string,
    taskId: string,
    data: QuestionRequestData
  ): PermissionRequest;
  hasPendingPermissions(): boolean;
  hasPendingQuestions(): boolean;
  getPendingPermissionCount(): number;
  getPendingQuestionCount(): number;
  clearAll(): void;
}
