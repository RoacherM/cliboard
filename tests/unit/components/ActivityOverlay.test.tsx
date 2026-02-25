import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ActivityOverlay } from '../../../src/components/ActivityOverlay.js';
import type { SubAgentEntry } from '../../../src/lib/types.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

function makeEntry(overrides?: Partial<SubAgentEntry>): SubAgentEntry {
  return {
    spawnId: 'toolu_test',
    agentId: null,
    timestamp: '2026-02-25T10:00:00Z',
    subagentType: 'Explore',
    description: 'Explore codebase',
    prompt: 'Search for relevant files',
    status: 'completed',
    completedAt: '2026-02-25T10:01:00Z',
    resultSummary: 'Found 5 relevant files',
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
    expect(output).toContain('No sub-agents spawned');
  });

  it('renders list of sub-agents with correct status icons', () => {
    const entries = [
      makeEntry({ spawnId: 'a', status: 'completed', description: 'Done task' }),
      makeEntry({ spawnId: 'b', status: 'running', description: 'Active task', completedAt: null, resultSummary: null }),
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

  it('shows summary counts in header', () => {
    const entries = [
      makeEntry({ spawnId: 'a', status: 'completed' }),
      makeEntry({ spawnId: 'b', status: 'running', completedAt: null }),
      makeEntry({ spawnId: 'c', status: 'completed' }),
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
    expect(output).toContain('1 running');
    expect(output).toContain('2 completed');
  });

  it('j/k navigation changes selection', async () => {
    const entries = [
      makeEntry({ spawnId: 'a', description: 'First agent' }),
      makeEntry({ spawnId: 'b', description: 'Second agent', prompt: 'Second prompt text' }),
    ];
    const { stdin, lastFrame } = render(
      React.createElement(ActivityOverlay, {
        entries,
        sessionName: 'Test',
        onClose: vi.fn(),
      }),
    );

    // Initial: first item selected, detail shows first agent
    let output = lastFrame()!;
    expect(output).toContain('First agent');

    await delay();
    stdin.write('j');
    await delay();

    output = lastFrame()!;
    // Detail panel should show second agent info
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

  it('shows detail panel with agent info', () => {
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
});
