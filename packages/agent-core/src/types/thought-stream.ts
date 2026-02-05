export type ThoughtCategory = 'observation' | 'reasoning' | 'decision' | 'action';

export type CheckpointStatus = 'progress' | 'complete' | 'stuck';

export interface ThoughtEvent {
  taskId: string;
  content: string;
  category: ThoughtCategory;
  agentName: string;
  timestamp: number;
}

export interface CheckpointEvent {
  taskId: string;
  status: CheckpointStatus;
  summary: string;
  nextPlanned?: string;
  blocker?: string;
  agentName: string;
  timestamp: number;
}

export interface ThoughtStreamAPI {
  registerTask(taskId: string): void;
  unregisterTask(taskId: string): void;
  isTaskActive(taskId: string): boolean;
  getActiveTaskIds(): string[];
  clearAllTasks(): void;
  validateThoughtEvent(data: unknown): ThoughtEvent | null;
  validateCheckpointEvent(data: unknown): CheckpointEvent | null;
}
