import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { parseSubAgents, parseActivity, parseMcpPluginName, parseMcpFunctionName, summarizeToolInput, computeConcurrencyPrefixes } from '../../../src/lib/activityService.js';
import type { ActivityEntry } from '../../../src/lib/types.js';

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

function makeSkillBlock(id: string, skill: string, args?: string) {
  return {
    type: 'tool_use',
    name: 'Skill',
    id,
    input: { skill, ...(args ? { args } : {}) },
  };
}

function makeErrorToolResult(toolUseId: string, content: string) {
  return { type: 'tool_result', tool_use_id: toolUseId, content, is_error: true };
}

describe('parseActivity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns [] for a non-existent file', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    expect(await parseActivity('/tmp/missing.jsonl')).toEqual([]);
  });

  it('parses a Skill tool_use block', async () => {
    const lines = makeAssistantRow(
      [makeSkillBlock('toolu_sk1', 'commit', '-m "fix bug"')],
      '2026-02-25T10:00:00Z',
    );
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'toolu_sk1',
      type: 'skill',
      timestamp: '2026-02-25T10:00:00Z',
      skillName: 'commit',
      skillArgs: '-m "fix bug"',
      description: 'commit',
      prompt: '-m "fix bug"',
      status: 'running',
      agentId: null,
      subagentType: null,
      isError: false,
    });
  });

  it('parses both Task and Skill blocks in the same session', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_t1', 'Explore', 'Explore codebase', 'Search files')],
        '2026-02-25T10:00:00Z',
      ),
      makeAssistantRow(
        [makeSkillBlock('toolu_s1', 'review-loop', 'review this code')],
        '2026-02-25T10:01:00Z',
      ),
      makeUserRow(
        [makeToolResult('toolu_t1', 'Found 5 files')],
        '2026-02-25T10:02:00Z',
      ),
      makeUserRow(
        [makeToolResult('toolu_s1', 'Review complete')],
        '2026-02-25T10:03:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result).toHaveLength(2);

    const task = result.find((e) => e.id === 'toolu_t1')!;
    expect(task.type).toBe('subagent');
    expect(task.subagentType).toBe('Explore');
    expect(task.status).toBe('completed');
    expect(task.resultSummary).toBe('Found 5 files');

    const skill = result.find((e) => e.id === 'toolu_s1')!;
    expect(skill.type).toBe('skill');
    expect(skill.skillName).toBe('review-loop');
    expect(skill.status).toBe('completed');
    expect(skill.resultSummary).toBe('Review complete');
  });

  it('marks Skill with is_error as error status', async () => {
    const lines = [
      makeAssistantRow(
        [makeSkillBlock('toolu_err', 'bad-skill')],
        '2026-02-25T10:00:00Z',
      ),
      makeUserRow(
        [makeErrorToolResult('toolu_err', 'Skill not found')],
        '2026-02-25T10:00:01Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('error');
    expect(result[0].isError).toBe(true);
    expect(result[0].resultSummary).toBe('Skill not found');
  });

  it('sorts mixed entries chronologically', async () => {
    const lines = [
      makeAssistantRow(
        [makeSkillBlock('toolu_late', 'commit')],
        '2026-02-25T11:00:00Z',
      ),
      makeAssistantRow(
        [makeTaskBlock('toolu_early', 'Explore', 'Early agent')],
        '2026-02-25T09:00:00Z',
      ),
      makeAssistantRow(
        [makeSkillBlock('toolu_mid', 'review-loop')],
        '2026-02-25T10:00:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result[0].id).toBe('toolu_early');
    expect(result[1].id).toBe('toolu_mid');
    expect(result[2].id).toBe('toolu_late');
  });

  it('handles Skill without args', async () => {
    const lines = makeAssistantRow(
      [makeSkillBlock('toolu_noargs', 'commit')],
      '2026-02-25T10:00:00Z',
    );
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result[0].skillArgs).toBeNull();
    expect(result[0].prompt).toBe('');
  });

  it('still parses sub-agent agentId from progress rows', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_ag', 'general-purpose', 'Run task')],
        '2026-02-25T10:00:00Z',
      ),
      makeProgressRow('toolu_ag', 'agent_xyz', '2026-02-25T10:00:01Z'),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result[0].agentId).toBe('agent_xyz');
  });

  it('parses built-in tool blocks as type tool', async () => {
    const lines = makeAssistantRow(
      [{
        type: 'tool_use',
        name: 'Read',
        id: 'toolu_read1',
        input: { file_path: '/src/index.ts' },
      }],
      '2026-02-25T10:00:00Z',
    );
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'toolu_read1',
      type: 'tool',
      toolName: 'Read',
      description: 'Read',
      prompt: '/src/index.ts',
      status: 'running',
    });
  });

  it('parses Bash tool with description summary', async () => {
    const lines = [
      makeAssistantRow(
        [{
          type: 'tool_use',
          name: 'Bash',
          id: 'toolu_bash1',
          input: { command: 'npm test', description: 'Run tests' },
        }],
        '2026-02-25T10:00:00Z',
      ),
      makeUserRow(
        [makeToolResult('toolu_bash1', 'All tests passed')],
        '2026-02-25T10:00:30Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result[0]).toMatchObject({
      type: 'tool',
      toolName: 'Bash',
      description: 'Bash',
      prompt: 'Run tests',
      status: 'completed',
      resultSummary: 'All tests passed',
    });
  });

  it('parses MCP tool blocks as type mcp', async () => {
    const lines = makeAssistantRow(
      [{
        type: 'tool_use',
        name: 'mcp__plugin_context7_context7__query-docs',
        id: 'toolu_mcp1',
        input: { libraryId: '/vercel/next.js', query: 'How to use app router' },
      }],
      '2026-02-25T10:00:00Z',
    );
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'toolu_mcp1',
      type: 'mcp',
      toolName: 'mcp__plugin_context7_context7__query-docs',
      description: 'context7',
      status: 'running',
    });
  });

  it('parses $AGENT blocks as subagent', async () => {
    const lines = makeAssistantRow(
      [{
        type: 'tool_use',
        name: '$AGENT',
        id: 'toolu_agent1',
        input: { type: 'code-reviewer', description: 'Review code', prompt: 'Check the PR' },
      }],
      '2026-02-25T10:00:00Z',
    );
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'toolu_agent1',
      type: 'subagent',
      subagentType: 'code-reviewer',
      description: 'Review code',
      prompt: 'Check the PR',
    });
  });

  it('parses mixed session with all types', async () => {
    const lines = [
      makeAssistantRow(
        [makeTaskBlock('toolu_t1', 'Explore', 'Explore code', 'Find files')],
        '2026-02-25T10:00:00Z',
      ),
      makeAssistantRow(
        [makeSkillBlock('toolu_s1', 'commit', '-m "fix"')],
        '2026-02-25T10:01:00Z',
      ),
      makeAssistantRow(
        [{
          type: 'tool_use', name: 'Read', id: 'toolu_r1',
          input: { file_path: '/src/app.ts' },
        }],
        '2026-02-25T10:02:00Z',
      ),
      makeAssistantRow(
        [{
          type: 'tool_use', name: 'mcp__plugin_claude-mem_mcp-search__search', id: 'toolu_m1',
          input: { query: 'auth patterns' },
        }],
        '2026-02-25T10:03:00Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('subagent');
    expect(result[1].type).toBe('skill');
    expect(result[2].type).toBe('tool');
    expect(result[3].type).toBe('mcp');
  });

  it('marks errored tool blocks correctly', async () => {
    const lines = [
      makeAssistantRow(
        [{
          type: 'tool_use', name: 'Bash', id: 'toolu_fail',
          input: { command: 'exit 1' },
        }],
        '2026-02-25T10:00:00Z',
      ),
      makeUserRow(
        [makeErrorToolResult('toolu_fail', 'Command failed')],
        '2026-02-25T10:00:01Z',
      ),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result[0].type).toBe('tool');
    expect(result[0].status).toBe('error');
    expect(result[0].isError).toBe(true);
  });
});

describe('parseMcpPluginName', () => {
  it('extracts plugin name from standard format', () => {
    expect(parseMcpPluginName('mcp__plugin_context7_context7__query-docs')).toBe('context7');
  });

  it('extracts plugin name with hyphens', () => {
    expect(parseMcpPluginName('mcp__plugin_claude-mem_mcp-search__search')).toBe('claude-mem');
  });

  it('returns full name if no match', () => {
    expect(parseMcpPluginName('something_else')).toBe('something_else');
  });
});

describe('parseMcpFunctionName', () => {
  it('extracts function name from standard format', () => {
    expect(parseMcpFunctionName('mcp__plugin_context7_context7__query-docs')).toBe('query-docs');
  });

  it('extracts function name for search', () => {
    expect(parseMcpFunctionName('mcp__plugin_claude-mem_mcp-search__search')).toBe('search');
  });
});

describe('summarizeToolInput', () => {
  it('summarizes Read input', () => {
    expect(summarizeToolInput('Read', { file_path: '/src/index.ts' })).toBe('/src/index.ts');
  });

  it('summarizes Bash with description', () => {
    expect(summarizeToolInput('Bash', { command: 'npm test', description: 'Run tests' })).toBe('Run tests');
  });

  it('summarizes Bash without description', () => {
    expect(summarizeToolInput('Bash', { command: 'npm test' })).toBe('npm test');
  });

  it('summarizes Grep input', () => {
    expect(summarizeToolInput('Grep', { pattern: 'TODO' })).toBe('TODO');
  });

  it('summarizes WebSearch input', () => {
    expect(summarizeToolInput('WebSearch', { query: 'react hooks' })).toBe('react hooks');
  });

  it('summarizes EnterPlanMode', () => {
    expect(summarizeToolInput('EnterPlanMode', {})).toBe('Enter plan mode');
  });

  it('summarizes MCP tool with first key-value', () => {
    expect(summarizeToolInput('mcp__plugin_context7_context7__query-docs', { libraryId: '/vercel/next.js', query: 'routing' })).toBe('libraryId: /vercel/next.js');
  });

  it('summarizes AskUserQuestion', () => {
    expect(summarizeToolInput('AskUserQuestion', {
      questions: [{ question: 'Which approach?', options: [] }],
    })).toBe('Which approach?');
  });

  it('truncates long Bash commands', () => {
    const longCmd = 'x'.repeat(200);
    const result = summarizeToolInput('Bash', { command: longCmd });
    expect(result.length).toBe(120);
  });
});

function makeCommandRow(name: string, args: string | null, timestamp: string) {
  let content = `<command-message>${name}</command-message>\n<command-name>/${name}</command-name>`;
  if (args !== null) {
    content += `\n<command-args>${args}</command-args>`;
  }
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content },
    timestamp,
  });
}

describe('parseActivity — slash commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('parses a command-message string into a command entry', async () => {
    const lines = makeCommandRow('review-loop:review-loop', '性能 bug UI布局 等全面检查', '2026-02-25T14:13:55Z');
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'command',
      description: 'review-loop',
      prompt: '性能 bug UI布局 等全面检查',
      status: 'completed',
      completedAt: '2026-02-25T14:13:55Z',
      timestamp: '2026-02-25T14:13:55Z',
      isError: false,
    });
  });

  it('extracts display name from plugin:command format', async () => {
    const lines = makeCommandRow('commit-commands:commit', '-m "fix"', '2026-02-25T10:00:00Z');
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result[0].description).toBe('commit');
  });

  it('uses full name when no colon present', async () => {
    const lines = makeCommandRow('exit', null, '2026-02-25T10:00:00Z');
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result[0].description).toBe('exit');
    expect(result[0].prompt).toBe('');
  });

  it('sorts commands with tool_use entries by timestamp', async () => {
    const lines = [
      makeAssistantRow(
        [{ type: 'tool_use', name: 'Read', id: 'toolu_r1', input: { file_path: '/src/app.ts' } }],
        '2026-02-25T10:00:00Z',
      ),
      makeCommandRow('review-loop:review-loop', 'check', '2026-02-25T09:00:00Z'),
    ].join('\n');

    vi.mocked(fs.readFile).mockResolvedValue(lines);
    const result = await parseActivity('/tmp/test.jsonl');

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('command'); // 09:00 comes first
    expect(result[1].type).toBe('tool');    // 10:00 comes second
  });

  it('ignores string user messages without command tags', async () => {
    const lines = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Just a regular message' },
      timestamp: '2026-02-25T10:00:00Z',
    });
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result).toHaveLength(0);
  });

  it('handles command without command-args tag', async () => {
    const content = '<command-message>exit</command-message>\n<command-name>/exit</command-name>';
    const lines = JSON.stringify({
      type: 'user',
      message: { role: 'user', content },
      timestamp: '2026-02-25T10:00:00Z',
    });
    vi.mocked(fs.readFile).mockResolvedValue(lines);

    const result = await parseActivity('/tmp/test.jsonl');
    expect(result).toHaveLength(1);
    expect(result[0].prompt).toBe('');
  });
});

function makeActivityEntry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'toolu_default',
    type: 'tool',
    timestamp: null,
    agentId: null,
    subagentType: null,
    description: 'Test',
    prompt: '',
    skillName: null,
    skillArgs: null,
    toolName: 'Read',
    status: 'completed',
    isError: false,
    completedAt: null,
    resultSummary: null,
    ...overrides,
  };
}

describe('computeConcurrencyPrefixes', () => {
  it('returns empty array for empty input', () => {
    expect(computeConcurrencyPrefixes([])).toEqual([]);
  });

  it('returns solo for a single entry', () => {
    const entries = [makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z' })];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['solo']);
  });

  it('returns solo for sequential entries with no overlap', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:05Z' }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:05Z' }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['solo', 'solo']);
  });

  it('groups same-timestamp entries as first/last', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:05Z' }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:03Z' }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['first', 'last']);
  });

  it('groups three concurrent entries as first/middle/last', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:05Z' }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:03Z' }),
      makeActivityEntry({ id: 'c', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:04Z' }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['first', 'middle', 'last']);
  });

  it('groups entries with overlapping time ranges', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:10Z' }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:00:05Z', completedAt: '2026-02-25T10:00:15Z' }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['first', 'last']);
  });

  it('treats running entries (null completedAt) as overlapping everything after', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: null }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:05:00Z', completedAt: '2026-02-25T10:05:05Z' }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['first', 'last']);
  });

  it('groups chain overlaps (A↔B, B↔C but not A↔C) as one group', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:05Z' }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:00:03Z', completedAt: '2026-02-25T10:00:10Z' }),
      makeActivityEntry({ id: 'c', timestamp: '2026-02-25T10:00:08Z', completedAt: '2026-02-25T10:00:12Z' }),
    ];
    // A overlaps B (A ends at :05, B starts at :03), B overlaps C (B ends at :10, C starts at :08)
    // A does NOT overlap C (A ends at :05, C starts at :08) — but B bridges them
    expect(computeConcurrencyPrefixes(entries)).toEqual(['first', 'middle', 'last']);
  });

  it('treats exact boundary (A ends = B starts) as sequential', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:05Z' }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:00:05Z', completedAt: '2026-02-25T10:00:10Z' }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['solo', 'solo']);
  });

  it('handles mixed sequential and concurrent spans', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:01Z' }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:10Z' }),
      makeActivityEntry({ id: 'c', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:05Z' }),
      makeActivityEntry({ id: 'd', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:03Z' }),
      makeActivityEntry({ id: 'e', timestamp: '2026-02-25T10:02:00Z', completedAt: '2026-02-25T10:02:01Z' }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['solo', 'first', 'middle', 'last', 'solo']);
  });

  it('returns solo for entries with null timestamps', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: null }),
      makeActivityEntry({ id: 'b', timestamp: null }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['solo', 'solo']);
  });

  it('groups two running entries with different timestamps', () => {
    const entries = [
      makeActivityEntry({ id: 'a', timestamp: '2026-02-25T10:00:00Z', completedAt: null }),
      makeActivityEntry({ id: 'b', timestamp: '2026-02-25T10:05:00Z', completedAt: null }),
    ];
    expect(computeConcurrencyPrefixes(entries)).toEqual(['first', 'last']);
  });

  it('handles large concurrent group correctly', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeActivityEntry({
        id: `e${i}`,
        timestamp: '2026-02-25T10:00:00Z',
        completedAt: '2026-02-25T10:00:05Z',
      }),
    );
    expect(computeConcurrencyPrefixes(entries)).toEqual([
      'first', 'middle', 'middle', 'middle', 'last',
    ]);
  });
});
