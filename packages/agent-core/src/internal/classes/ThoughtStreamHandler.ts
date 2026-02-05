import type { ThoughtEvent, CheckpointEvent } from '../../common/types/thought-stream.js';

export class ThoughtStreamHandler {
  private activeTaskIds = new Set<string>();

  registerTask(taskId: string): void {
    this.activeTaskIds.add(taskId);
  }

  unregisterTask(taskId: string): void {
    this.activeTaskIds.delete(taskId);
  }

  isTaskActive(taskId: string): boolean {
    return this.activeTaskIds.has(taskId);
  }

  getActiveTaskIds(): string[] {
    return Array.from(this.activeTaskIds);
  }

  clearAllTasks(): void {
    this.activeTaskIds.clear();
  }

  validateThoughtEvent(data: unknown): ThoughtEvent | null {
    return this.validateEvent<ThoughtEvent>(data, this.isValidThoughtData.bind(this));
  }

  validateCheckpointEvent(data: unknown): CheckpointEvent | null {
    return this.validateEvent<CheckpointEvent>(data, this.isValidCheckpointData.bind(this));
  }

  private validateEvent<T extends { taskId: string }>(
    data: unknown,
    isValid: (data: unknown) => data is T
  ): T | null {
    if (!isValid(data)) {
      return null;
    }

    if (!this.isTaskActive(data.taskId)) {
      return null;
    }

    return data;
  }

  private isValidThoughtData(data: unknown): data is ThoughtEvent {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    return (
      typeof obj.taskId === 'string' &&
      typeof obj.content === 'string' &&
      typeof obj.category === 'string' &&
      ['observation', 'reasoning', 'decision', 'action'].includes(obj.category) &&
      typeof obj.agentName === 'string' &&
      typeof obj.timestamp === 'number'
    );
  }

  private isValidCheckpointData(data: unknown): data is CheckpointEvent {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    return (
      typeof obj.taskId === 'string' &&
      typeof obj.status === 'string' &&
      ['progress', 'complete', 'stuck'].includes(obj.status) &&
      typeof obj.summary === 'string' &&
      typeof obj.agentName === 'string' &&
      typeof obj.timestamp === 'number' &&
      (obj.nextPlanned === undefined || typeof obj.nextPlanned === 'string') &&
      (obj.blocker === undefined || typeof obj.blocker === 'string')
    );
  }
}
