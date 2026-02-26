import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { TimelineService } from '../../../src/lib/timelineService.js';

vi.mock('node:fs/promises');

// Unique mtime per call so cache never hits between tests
let statCallCount = 0;
function mockStat() {
  return { mtimeMs: ++statCallCount };
}

describe('TimelineService', () => {
  let service: TimelineService;

  beforeEach(() => {
    vi.resetAllMocks();
    statCallCount = 0;
    vi.mocked(fs.stat).mockImplementation(async () => mockStat() as any);
    service = new TimelineService();
  });

  // 1. Empty file → returns []
  it('returns [] for an empty file', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('');
    const result = await service.parseSessionTimeline('/tmp/empty.jsonl');
    expect(result).toEqual([]);
  });

  // 2. No TodoWrite entries → returns []
  it('returns [] when file contains no TodoWrite entries', async () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'hello' },
        timestamp: '2026-01-01T00:00:00Z',
      }),
      JSON.stringify({
        type: 'system',
        message: { role: 'system', content: 'init' },
        timestamp: '2026-01-01T00:00:01Z',
      }),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await service.parseSessionTimeline('/tmp/no-todo.jsonl');
    expect(result).toEqual([]);
  });

  // 3. Single TodoWrite tool_use → returns 1 snapshot with correct summary
  it('parses a single TodoWrite tool_use into 1 snapshot with correct summary', async () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'TodoWrite',
            input: {
              todos: [
                { content: 'Fix bug', status: 'completed' },
                { content: 'Add test', status: 'pending' },
              ],
            },
          },
        ],
      },
      timestamp: '2026-02-25T10:00:00Z',
    });

    vi.mocked(fs.readFile).mockResolvedValue(line);
    const result = await service.parseSessionTimeline('/tmp/single.jsonl');

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe('2026-02-25T10:00:00Z');
    expect(result[0].todos).toEqual([
      { content: 'Fix bug', status: 'completed' },
      { content: 'Add test', status: 'pending' },
    ]);
    expect(result[0].summary).toEqual({
      total: 2,
      completed: 1,
      inProgress: 0,
      pending: 1,
      progressPct: 50,
    });
  });

  // 4. Multiple snapshots → returns correct count
  it('returns correct count for multiple TodoWrite entries', async () => {
    const makeLine = (todos: Array<{ content: string; status: string }>, ts: string) =>
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'TodoWrite', input: { todos } },
          ],
        },
        timestamp: ts,
      });

    const lines = [
      makeLine([{ content: 'A', status: 'pending' }], '2026-01-01T01:00:00Z'),
      makeLine([{ content: 'A', status: 'completed' }, { content: 'B', status: 'pending' }], '2026-01-01T02:00:00Z'),
      makeLine([{ content: 'A', status: 'completed' }, { content: 'B', status: 'completed' }], '2026-01-01T03:00:00Z'),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await service.parseSessionTimeline('/tmp/multi.jsonl');

    expect(result).toHaveLength(3);
    expect(result[0].summary.progressPct).toBe(0);
    expect(result[1].summary.progressPct).toBe(50);
    expect(result[2].summary.progressPct).toBe(100);
  });

  // 5. Deduplicates consecutive identical snapshots
  it('deduplicates consecutive identical snapshots', async () => {
    const sameTodos = [
      { content: 'Task X', status: 'in_progress' },
      { content: 'Task Y', status: 'pending' },
    ];

    const makeLine = (ts: string) =>
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'TodoWrite', input: { todos: sameTodos } },
          ],
        },
        timestamp: ts,
      });

    const lines = [
      makeLine('2026-01-01T01:00:00Z'),
      makeLine('2026-01-01T02:00:00Z'),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await service.parseSessionTimeline('/tmp/dedup.jsonl');

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe('2026-01-01T01:00:00Z');
  });

  // 6. toolUseResult.newTodos extraction
  it('extracts todos from toolUseResult.newTodos', async () => {
    const line = JSON.stringify({
      toolUseResult: {
        newTodos: [{ content: 'Task A', status: 'in_progress' }],
      },
      timestamp: '2026-02-25T11:00:00Z',
    });

    vi.mocked(fs.readFile).mockResolvedValue(line);
    const result = await service.parseSessionTimeline('/tmp/tool-result.jsonl');

    expect(result).toHaveLength(1);
    expect(result[0].summary).toEqual({
      total: 1,
      completed: 0,
      inProgress: 1,
      pending: 0,
      progressPct: 0,
    });
  });

  // 7. Non-existent file → returns [] (no throw)
  it('returns [] for a non-existent file (ENOENT)', async () => {
    const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    vi.mocked(fs.stat).mockRejectedValue(err);

    const result = await service.parseSessionTimeline('/tmp/missing.jsonl');
    expect(result).toEqual([]);
  });

  // 8. Malformed JSON lines → skips them, returns valid ones
  it('skips malformed JSON lines and returns valid ones', async () => {
    const validLine = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            name: 'TodoWrite',
            input: { todos: [{ content: 'OK', status: 'pending' }] },
          },
        ],
      },
      timestamp: '2026-01-01T00:00:00Z',
    });

    const lines = `not json\n${validLine}`;

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await service.parseSessionTimeline('/tmp/malformed.jsonl');

    expect(result).toHaveLength(1);
    expect(result[0].todos).toEqual([{ content: 'OK', status: 'pending' }]);
  });

  // 9. TaskCreate/TaskUpdate snapshots should preserve historical state
  it('keeps full TaskCreate/TaskUpdate timeline without mutating past snapshots', async () => {
    const makeLine = (block: any, ts: string) =>
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [block],
        },
        timestamp: ts,
      });

    const lines = [
      makeLine(
        { type: 'tool_use', name: 'TaskCreate', input: { subject: 'Task A' } },
        '2026-02-26T10:00:00Z',
      ),
      makeLine(
        { type: 'tool_use', name: 'TaskCreate', input: { subject: 'Task B' } },
        '2026-02-26T10:01:00Z',
      ),
      makeLine(
        { type: 'tool_use', name: 'TaskUpdate', input: { taskId: '1', status: 'in_progress' } },
        '2026-02-26T10:02:00Z',
      ),
      makeLine(
        { type: 'tool_use', name: 'TaskUpdate', input: { taskId: '1', status: 'completed' } },
        '2026-02-26T10:03:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await service.parseSessionTimeline('/tmp/task-events.jsonl');

    expect(result).toHaveLength(4);
    expect(result[0].todos).toEqual([{ content: 'Task A', status: 'pending' }]);
    expect(result[1].todos).toEqual([
      { content: 'Task A', status: 'pending' },
      { content: 'Task B', status: 'pending' },
    ]);
    expect(result[2].todos).toEqual([
      { content: 'Task A', status: 'in_progress' },
      { content: 'Task B', status: 'pending' },
    ]);
    expect(result[3].todos).toEqual([
      { content: 'Task A', status: 'completed' },
      { content: 'Task B', status: 'pending' },
    ]);
  });

  // 10. Task events can also be emitted in progress rows (agent_progress)
  it('parses TaskCreate/TaskUpdate events from progress row payloads', async () => {
    const line = JSON.stringify({
      type: 'progress',
      timestamp: '2026-02-26T11:00:00Z',
      data: {
        message: {
          message: {
            content: [
              { type: 'tool_use', name: 'TaskCreate', input: { subject: 'Ship fix' } },
              { type: 'tool_use', name: 'TaskUpdate', input: { taskId: '1', status: 'completed' } },
            ],
          },
        },
      },
    });

    vi.mocked(fs.readFile).mockResolvedValue(line);
    const result = await service.parseSessionTimeline('/tmp/progress-task-events.jsonl');

    expect(result).toHaveLength(2);
    expect(result[0].todos).toEqual([{ content: 'Ship fix', status: 'pending' }]);
    expect(result[1].todos).toEqual([{ content: 'Ship fix', status: 'completed' }]);
  });
});
