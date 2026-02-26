import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ActivityOverlay } from '../../../src/components/ActivityOverlay.js';
import type { ActivityEntry } from '../../../src/lib/types.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

function makeEntry(overrides?: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'toolu_test',
    type: 'subagent',
    agentId: null,
    timestamp: '2026-02-25T10:00:00Z',
    subagentType: 'Explore',
    description: 'Explore codebase',
    prompt: 'Search for relevant files',
    skillName: null,
    skillArgs: null,
    toolName: null,
    status: 'completed',
    isError: false,
    completedAt: '2026-02-25T10:01:00Z',
    resultSummary: 'Found 5 relevant files',
    ...overrides,
  };
}

function makeSkillEntry(overrides?: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'toolu_skill',
    type: 'skill',
    agentId: null,
    timestamp: '2026-02-25T10:00:00Z',
    subagentType: null,
    description: 'commit',
    prompt: '-m "fix bug"',
    skillName: 'commit',
    skillArgs: '-m "fix bug"',
    toolName: null,
    status: 'completed',
    isError: false,
    completedAt: '2026-02-25T10:00:05Z',
    resultSummary: 'Committed successfully',
    ...overrides,
  };
}

function makeToolEntry(overrides?: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'toolu_tool',
    type: 'tool',
    agentId: null,
    timestamp: '2026-02-25T10:00:00Z',
    subagentType: null,
    description: 'Read',
    prompt: '/src/index.ts',
    skillName: null,
    skillArgs: null,
    toolName: 'Read',
    status: 'completed',
    isError: false,
    completedAt: '2026-02-25T10:00:01Z',
    resultSummary: 'File contents...',
    ...overrides,
  };
}

function makeMcpEntry(overrides?: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'toolu_mcp',
    type: 'mcp',
    agentId: null,
    timestamp: '2026-02-25T10:00:00Z',
    subagentType: null,
    description: 'context7',
    prompt: 'libraryId: /vercel/next.js',
    skillName: null,
    skillArgs: null,
    toolName: 'mcp__plugin_context7_context7__query-docs',
    status: 'completed',
    isError: false,
    completedAt: '2026-02-25T10:00:02Z',
    resultSummary: 'Documentation found',
    ...overrides,
  };
}

function makeCommandEntry(overrides?: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'cmd_2026-02-25T10:00:00Z',
    type: 'command',
    agentId: null,
    timestamp: '2026-02-25T10:00:00Z',
    subagentType: null,
    description: 'review-loop',
    prompt: '性能 bug UI布局',
    skillName: null,
    skillArgs: null,
    toolName: null,
    status: 'completed',
    isError: false,
    completedAt: '2026-02-25T10:00:00Z',
    resultSummary: null,
    ...overrides,
  };
}

function makeHookEntry(overrides?: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'hook_2026-02-25T14:09:06Z_0',
    type: 'hook',
    agentId: null,
    timestamp: '2026-02-25T14:09:06Z',
    subagentType: null,
    description: 'Stop',
    prompt: 'Review loop: checking phase...',
    skillName: null,
    skillArgs: null,
    toolName: null,
    status: 'completed',
    isError: false,
    completedAt: '2026-02-25T14:09:06Z',
    resultSummary: null,
    ...overrides,
  };
}

describe('ActivityOverlay', () => {
  it('renders empty state when no entries', () => {
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries: [],
        sessionName: 'Test session',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('No activity recorded');
  });

  it('renders list of sub-agents with correct status icons', () => {
    const entries = [
      makeEntry({ id: 'a', status: 'completed', description: 'Done task' }),
      makeEntry({ id: 'b', status: 'running', description: 'Active task', completedAt: null, resultSummary: null }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test session',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('✓');
    expect(output).toContain('⟳');
    expect(output).toContain('Done task');
    expect(output).toContain('Active task');
  });

  it('shows unified summary counts in header', () => {
    const entries = [
      makeEntry({ id: 'a', status: 'completed' }),
      makeEntry({ id: 'b', status: 'running', completedAt: null }),
      makeSkillEntry({ id: 'c', status: 'completed' }),
      makeToolEntry({ id: 'd', status: 'completed' }),
      makeMcpEntry({ id: 'e', status: 'completed' }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('5 total');
    expect(output).toContain('2 agents');
    expect(output).toContain('1 skills');
    expect(output).toContain('1 tools');
    expect(output).toContain('1 mcp');
    expect(output).toContain('1 running');
  });

  it('j/k navigation changes selection', async () => {
    const entries = [
      makeEntry({ id: 'a', description: 'First agent' }),
      makeEntry({ id: 'b', description: 'Second agent', prompt: 'Second prompt text' }),
    ];
    const { stdin, lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );

    let output = lastFrame()!;
    expect(output).toContain('First agent');

    await delay();
    stdin.write('j');
    await delay();

    output = lastFrame()!;
    expect(output).toContain('Second prompt text');
  });

  it('Escape calls onClose', async () => {
    const onClose = vi.fn();
    const entries = [makeEntry()];
    const { stdin } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose,
      }),
    );

    await delay();
    stdin.write('\u001B');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });

  it('q calls onClose', async () => {
    const onClose = vi.fn();
    const entries = [makeEntry()];
    const { stdin } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose,
      }),
    );

    await delay();
    stdin.write('q');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });

  it('shows sub-agent detail panel with agent info', () => {
    const entries = [
      makeEntry({
        subagentType: 'general-purpose',
        description: 'Run DB migrations',
        agentId: 'af947c2deadbeef',
        timestamp: '2026-02-25T12:32:15Z',
        completedAt: '2026-02-25T12:33:00Z',
        prompt: 'Execute the migration scripts',
        resultSummary: 'Migrations applied successfully',
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;

    expect(output).toContain('general-purpose');
    expect(output).toContain('Completed');
    expect(output).toContain('af947c2');
    expect(output).toContain('Execute the migration scripts');
    expect(output).toContain('Migrations applied successfully');
  });

  it('shows running status in detail panel', () => {
    const entries = [
      makeEntry({
        status: 'running',
        completedAt: null,
        resultSummary: null,
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('Running');
  });

  it('shows session name in empty state', () => {
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries: [],
        sessionName: 'My Project',
        onClose: vi.fn(),
      }),
    );
    expect(lastFrame()!).toContain('My Project');
  });

  // New tests for mixed activity entries

  it('renders skill entries with [Skill] badge', () => {
    const entries = [makeSkillEntry({ id: 'sk1', description: 'commit' })];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[Skill]');
    expect(output).toContain('commit');
  });

  it('shows skill detail panel with skill-specific fields', () => {
    const entries = [
      makeSkillEntry({
        skillName: 'review-loop',
        skillArgs: '--strict',
        description: 'review-loop',
        timestamp: '2026-02-25T14:00:00Z',
        completedAt: '2026-02-25T14:00:30Z',
        resultSummary: 'Review passed',
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('review-loop');
    expect(output).toContain('--strict');
    expect(output).toContain('Completed');
    expect(output).toContain('Review passed');
  });

  it('renders error status for failed skill', () => {
    const entries = [
      makeSkillEntry({
        id: 'err1',
        status: 'error',
        isError: true,
        resultSummary: 'Skill not found',
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('✗');
    expect(output).toContain('Error');
    expect(output).toContain('Skill not found');
  });

  it('renders mixed sub-agent and skill entries', () => {
    const entries = [
      makeEntry({ id: 'a1', description: 'Explore codebase', subagentType: 'Explore' }),
      makeSkillEntry({ id: 's1', description: 'commit' }),
      makeEntry({ id: 'a2', description: 'Plan feature', subagentType: 'Plan' }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Mixed',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[Explore]');
    expect(output).toContain('[Skill]');
    expect(output).toContain('[Plan]');
    expect(output).toContain('2 agents');
    expect(output).toContain('1 skills');
  });

  it('renders tool entries with [ToolName] badge', () => {
    const entries = [
      makeToolEntry({ id: 't1', toolName: 'Read', description: 'Read' }),
      makeToolEntry({ id: 't2', toolName: 'Bash', description: 'Bash', prompt: 'Run tests' }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[Read]');
    expect(output).toContain('2 tools');
  });

  it('renders mcp entries with [pluginName] badge', () => {
    const entries = [makeMcpEntry({ id: 'm1', description: 'context7' })];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[query-docs]');
    expect(output).toContain('1 mcp');
  });

  it('shows tool detail panel with tool-specific fields', () => {
    const entries = [
      makeToolEntry({
        toolName: 'Bash',
        description: 'Bash',
        prompt: 'npm test',
        timestamp: '2026-02-25T14:00:00Z',
        completedAt: '2026-02-25T14:00:30Z',
        resultSummary: 'All tests passed',
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('Bash');
    expect(output).toContain('Completed');
    expect(output).toContain('npm test');
    expect(output).toContain('All tests passed');
  });

  it('shows mcp detail panel with plugin and function', () => {
    const entries = [
      makeMcpEntry({
        description: 'context7',
        toolName: 'mcp__plugin_context7_context7__query-docs',
        prompt: 'libraryId: /vercel/next.js',
        resultSummary: 'Docs retrieved',
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('context7');
    expect(output).toContain('query-docs');
    expect(output).toContain('Completed');
    expect(output).toContain('Docs retrieved');
  });

  it('renders all four types in a mixed session', () => {
    const entries = [
      makeEntry({ id: 'a1', subagentType: 'Explore' }),
      makeSkillEntry({ id: 's1' }),
      makeToolEntry({ id: 't1', toolName: 'Grep' }),
      makeMcpEntry({ id: 'm1', description: 'claude-mem', toolName: 'mcp__plugin_claude-mem_mcp-search__search' }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Full',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[Explore]');
    expect(output).toContain('[Skill]');
    expect(output).toContain('[Grep]');
    expect(output).toContain('[search]');
    expect(output).toContain('4 total');
  });

  it('shows graph markers for concurrent entries', () => {
    const entries = [
      makeToolEntry({ id: 't1', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:01Z', toolName: 'Read', description: 'Read' }),
      makeToolEntry({ id: 't2', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:10Z', toolName: 'Explore', description: 'Explore' }),
      makeToolEntry({ id: 't3', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:05Z', toolName: 'Bash', description: 'Bash' }),
      makeToolEntry({ id: 't4', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:03Z', toolName: 'Grep', description: 'Grep' }),
      makeToolEntry({ id: 't5', timestamp: '2026-02-25T10:02:00Z', completedAt: '2026-02-25T10:02:01Z', toolName: 'Read', description: 'Read' }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Graph',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    // The concurrent group (t2, t3, t4) should have ┬, ├, └
    expect(output).toContain('┬');
    expect(output).toContain('├');
    expect(output).toContain('└');
  });

  it('does not show graph markers for sequential entries', () => {
    const entries = [
      makeToolEntry({ id: 't1', timestamp: '2026-02-25T10:00:00Z', completedAt: '2026-02-25T10:00:01Z' }),
      makeToolEntry({ id: 't2', timestamp: '2026-02-25T10:01:00Z', completedAt: '2026-02-25T10:01:01Z' }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Sequential',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).not.toContain('┬');
    expect(output).not.toContain('├');
    expect(output).not.toContain('└');
  });

  it('renders hook entry with [Hook:Stop] badge', () => {
    const entries = [makeHookEntry({ id: 'h1', description: 'Stop' })];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[Hook:Stop]');
    expect(output).toContain('1 hooks');
  });

  it('renders hook entry with [Hook:Start] badge for SessionStart', () => {
    const entries = [makeHookEntry({ id: 'h2', description: 'SessionStart:clear' })];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[Hook:Start]');
  });

  it('renders hook error entry with [Hook:Error] badge', () => {
    const entries = [makeHookEntry({ id: 'h3', description: 'Hook Error', prompt: 'Hook failed: exit 1' })];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[Hook:Error]');
  });

  it('shows hook detail panel with event and command', () => {
    const entries = [
      makeHookEntry({
        description: 'Stop',
        prompt: 'Review loop: checking phase...',
        timestamp: '2026-02-25T14:09:06Z',
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('Stop');
    expect(output).toContain('Completed');
    expect(output).toContain('Review loop: checking phase...');
  });

  it('counts hooks in header alongside other types', () => {
    const entries = [
      makeEntry({ id: 'a1' }),
      makeHookEntry({ id: 'h1' }),
      makeHookEntry({ id: 'h2', description: 'SessionStart:clear', timestamp: '2026-02-25T10:01:00Z' }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('3 total');
    expect(output).toContain('1 agents');
    expect(output).toContain('2 hooks');
  });

  it('renders command entry with [/command-name] badge', () => {
    const entries = [makeCommandEntry({ id: 'c1', description: 'review-loop' })];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('[/review-loop]');
    expect(output).toContain('1 cmds');
  });

  it('shows command detail panel with command-specific fields', () => {
    const entries = [
      makeCommandEntry({
        description: 'review-loop',
        prompt: '性能 bug UI布局',
        timestamp: '2026-02-25T14:13:55Z',
      }),
    ];
    const { lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;
    expect(output).toContain('/review-loop');
    expect(output).toContain('Completed');
    expect(output).toContain('性能 bug UI布局');
  });
});
