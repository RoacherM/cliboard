import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { parseSubAgents } from '../../../src/lib/activityService.js';

vi.mock('node:fs/promises');

function makeAssistantRow(blocks: any[], timestamp: string) {
  return JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: blocks },
    timestamp,
  });
}

function makeTaskBlock(id: string, subagentType: string, description: string, prompt = 'do something') {
  return {
    type: 'tool_use',
    name: 'Task',
    id,
    input: { subagent_type: subagentType, description, prompt },
  };
}

function makeUserRow(blocks: any[], timestamp: string) {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: blocks },
    timestamp,
  });
}

function makeToolResult(toolUseId: string, content: string) {
  return { type: 'tool_result', tool_use_id: toolUseId, content };
}

function makeProgressRow(parentToolUseID: string | null, agentId: string, timestamp: string) {
  return JSON.stringify({
    type: 'progress',
    data: { type: 'agent_progress', parentToolUseID, agentId },
    timestamp,
  });
}

describe('parseSubAgents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns [] for a non-existent file', async () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(err);
    expect(await parseSubAgents('/tmp/missing.jsonl')).toEqual([]);
  });

  it('returns [] for an empty file', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('');
    expect(await parseSubAgents('/tmp/empty.jsonl')).toEqual([]);
  });

  it('parses a Task tool_use block into a running SubAgentEntry', async () => {
    const lines = makeAssistantRow(
      [makeTaskBlock('toolu_abc', 'Explore', 'Explore codebase', 'Search for files')],
      '2026-02-25T10:00:00Z',
    );
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseSubAgents('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      spawnId: 'toolu_abc',
      subagentType: 'Explore',
      description: 'Explore codebase',
      prompt: 'Search for files',
      status: 'running',
      timestamp: '2026-02-25T10:00:00Z',
      completedAt: null,
      resultSummary: null,
      agentId: null,
    });
  });

  it('matches tool_result to mark agent as completed', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_1', 'Plan', 'Plan implementation', 'Create a plan')],
        '2026-02-25T10:00:00Z',
      ),
      makeUserRow(
        [makeToolResult('toolu_1', 'Plan completed successfully')],
        '2026-02-25T10:05:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('completed');
    expect(result[0].completedAt).toBe('2026-02-25T10:05:00Z');
    expect(result[0].resultSummary).toBe('Plan completed successfully');
  });

  it('matches agent_progress to populate agentId', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_2', 'general-purpose', 'Run migrations')],
        '2026-02-25T10:00:00Z',
      ),
      makeProgressRow('toolu_2', 'agent_abc123', '2026-02-25T10:00:01Z'),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');

    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('agent_abc123');
  });

  it('handles concurrent spawns with independent lifecycles', async () => {
    const lines = [
      // Two spawns close together
      makeAssistantRow(
        [
          makeTaskBlock('toolu_a', 'Explore', 'Explore A'),
          makeTaskBlock('toolu_b', 'Plan', 'Plan B'),
        ],
        '2026-02-25T10:00:00Z',
      ),
      // Only first completes
      makeUserRow(
        [makeToolResult('toolu_a', 'A done')],
        '2026-02-25T10:02:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');

    expect(result).toHaveLength(2);
    const agentA = result.find((e) => e.spawnId === 'toolu_a')!;
    const agentB = result.find((e) => e.spawnId === 'toolu_b')!;

    expect(agentA.status).toBe('completed');
    expect(agentA.resultSummary).toBe('A done');
    expect(agentB.status).toBe('running');
    expect(agentB.resultSummary).toBeNull();
  });

  it('sorts entries by spawn timestamp', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_late', 'Plan', 'Late')],
        '2026-02-25T11:00:00Z',
      ),
      makeAssistantRow(
        [makeTaskBlock('toolu_early', 'Explore', 'Early')],
        '2026-02-25T09:00:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');

    expect(result[0].spawnId).toBe('toolu_early');
    expect(result[1].spawnId).toBe('toolu_late');
  });

  it('skips malformed JSON lines', async () => {
    const lines = [
      'not valid json',
      makeAssistantRow(
        [makeTaskBlock('toolu_ok', 'Explore', 'Valid')],
        '2026-02-25T10:00:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Valid');
  });

  it('handles tool_result with array content', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_arr', 'Explore', 'Array result')],
        '2026-02-25T10:00:00Z',
      ),
      makeUserRow(
        [{ type: 'tool_result', tool_use_id: 'toolu_arr', content: [{ type: 'text', text: 'Result from array' }] }],
        '2026-02-25T10:01:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');

    expect(result[0].resultSummary).toBe('Result from array');
  });

  it('truncates resultSummary to 200 chars', async () => {
    const longContent = 'x'.repeat(300);
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_long', 'Explore', 'Long result')],
        '2026-02-25T10:00:00Z',
      ),
      makeUserRow(
        [makeToolResult('toolu_long', longContent)],
        '2026-02-25T10:01:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');

    expect(result[0].resultSummary!.length).toBe(200);
  });

  it('ignores agent_progress with null parentToolUseID', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_x', 'Explore', 'Test')],
        '2026-02-25T10:00:00Z',
      ),
      makeProgressRow(null, 'agent_orphan', '2026-02-25T10:00:01Z'),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseSubAgents('/tmp/test.jsonl');

    expect(result[0].agentId).toBeNull();
  });
});
