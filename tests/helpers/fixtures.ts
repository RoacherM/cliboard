import type { Task, Session, SessionMetadata } from '../../src/lib/types.js';

export function createTask(overrides?: Partial<Task>): Task {
  return {
    id: '1',
    subject: 'Test task',
    description: 'Test description',
    activeForm: 'Testing',
    status: 'pending',
    blocks: [],
    blockedBy: [],
    ...overrides,
  };
}

export function createSession(overrides?: Partial<Session>): Session {
  return {
    id: 'session-1',
    name: 'Default session',
    slug: 'default-session',
    project: null,
    description: null,
    gitBranch: null,
    taskCount: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    isArchived: false,
    jsonlPath: null,
    ...overrides,
  };
}

export function createSessionMetadata(overrides?: Partial<SessionMetadata>): SessionMetadata {
  return {
    customTitle: null,
    slug: null,
    project: null,
    projectDir: '',
    jsonlPath: '/tmp/test.jsonl',
    description: null,
    gitBranch: null,
    created: new Date().toISOString(),
    summary: null,
    ...overrides,
  };
}
