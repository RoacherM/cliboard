import type { Session, Task, ActivityEntry, TaskSnapshot } from '../types.js';

export type BackendId = 'claude' | 'opencode';

export interface BackendCapabilities {
  tasks: boolean;
  timeline: boolean;
  activity: boolean;
  liveness: boolean;
  gitBranch: boolean;
  subagents: boolean;
}

export interface BackendAdapter {
  readonly id: BackendId;
  readonly displayName: string;
  readonly capabilities: BackendCapabilities;

  initialize(): Promise<boolean>;
  dispose(): Promise<void>;

  loadSessions(options?: { projectPath?: string }): Promise<Session[]>;
  loadSessionTasks(sessionId: string): Promise<Task[]>;
  loadActivity(sessionId: string): Promise<ActivityEntry[]>;
  loadTimeline(sessionId: string): Promise<TaskSnapshot[]>;

  checkCacheState(): Promise<{ isStale: boolean }>;
  invalidateCache(): void;
}
