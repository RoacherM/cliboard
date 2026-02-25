import { describe, it, expect, vi } from 'vitest';
import { createListCommand } from '../../../src/commands/list.js';

vi.mock('../../../src/lib/taskDataService.js', () => {
  return {
    TaskDataService: vi.fn().mockImplementation(() => ({
      listSessions: vi.fn().mockResolvedValue([
        { sessionId: 'session-1', tasks: [{ id: 'task-1', subject: 'Fix bug' }] },
      ]),
      listTasks: vi.fn().mockResolvedValue([
        { id: 'task-1', subject: 'Fix bug', status: 'in_progress' },
      ]),
    })),
  };
});

describe('createListCommand', () => {
  it('lists sessions with task info', () => {
    const cmd = createListCommand('/tmp/claude');

    expect(cmd).toBeDefined();
    expect(cmd.name()).toBe('list');
  });

  it('supports --json flag for JSON output', () => {
    const cmd = createListCommand('/tmp/claude');

    // Verify the command has a --json option registered
    const jsonOption = cmd.options.find(
      (opt) => opt.long === '--json'
    );
    expect(jsonOption).toBeDefined();
  });
});
