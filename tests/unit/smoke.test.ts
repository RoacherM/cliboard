import { describe, it, expect } from 'vitest';
import { createTask, createSession } from '../helpers/index.js';

describe('Test infrastructure', () => {
  it('creates a task fixture', () => {
    const task = createTask({ subject: 'My task' });
    expect(task.subject).toBe('My task');
    expect(task.status).toBe('pending');
  });

  it('creates a session fixture', () => {
    const session = createSession({ name: 'Test session' });
    expect(session.name).toBe('Test session');
    expect(session.taskCount).toBeGreaterThanOrEqual(0);
  });
});
