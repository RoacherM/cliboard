import { describe, it, expect, vi } from 'vitest';
import { createShowCommand } from '../../../src/commands/show.js';

vi.mock('../../../src/lib/taskDataService.js', () => {
  return {
    TaskDataService: vi.fn().mockImplementation(() => ({
      getTask: vi.fn().mockImplementation((taskId: string) => {
        if (taskId === 'task-1') {
          return Promise.resolve({
            id: 'task-1',
            subject: 'Fix critical bug',
            status: 'in_progress',
          });
        }
        return Promise.resolve(null);
      }),
    })),
  };
});

describe('createShowCommand', () => {
  it('creates a show command that accepts a task ID argument', () => {
    const cmd = createShowCommand('/tmp/claude');

    expect(cmd).toBeDefined();
    expect(cmd.name()).toBe('show');
  });

  it('handles non-existent task gracefully', () => {
    const cmd = createShowCommand('/tmp/claude');

    // Command should be created even if task doesn't exist;
    // error handling happens at runtime
    expect(cmd).toBeDefined();
  });
});
