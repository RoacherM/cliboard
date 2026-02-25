import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TimelineOverlay } from '../../../src/components/TimelineOverlay.js';
import type { TaskSnapshot } from '../../../src/lib/types.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

function makeSnapshot(overrides?: Partial<TaskSnapshot>): TaskSnapshot {
  return {
    timestamp: '2026-02-25T10:00:00Z',
    todos: [
      { content: 'Fix bug', status: 'completed' },
      { content: 'Add test', status: 'pending' },
    ],
    summary: { total: 2, completed: 1, inProgress: 0, pending: 1, progressPct: 50 },
    ...overrides,
  };
}

describe('TimelineOverlay', () => {
  it('should render snapshot timestamps', () => {
    const snapshots = [
      makeSnapshot({ timestamp: '2026-02-25T10:00:00Z' }),
      makeSnapshot({ timestamp: '2026-02-25T11:00:00Z' }),
    ];
    const { lastFrame } = render(
      React.createElement(TimelineOverlay, {
        snapshots,
        sessionName: 'Test session',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;

    expect(output).toContain('2026-02-25 10:00');
    expect(output).toContain('2026-02-25 11:00');
  });

  it('should show tasks for the selected snapshot', () => {
    const snapshots = [
      makeSnapshot({
        todos: [
          { content: 'Task Alpha', status: 'completed' },
          { content: 'Task Beta', status: 'pending' },
        ],
      }),
    ];
    const { lastFrame } = render(
      React.createElement(TimelineOverlay, {
        snapshots,
        sessionName: 'Test session',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;

    expect(output).toContain('Task Alpha');
    expect(output).toContain('Task Beta');
  });

  it('should move selection down on j press', async () => {
    const snapshots = [
      makeSnapshot({ timestamp: '2026-02-25T10:00:00Z' }),
      makeSnapshot({
        timestamp: '2026-02-25T11:00:00Z',
        todos: [{ content: 'Second snapshot task', status: 'in_progress' }],
        summary: { total: 1, completed: 0, inProgress: 1, pending: 0, progressPct: 0 },
      }),
    ];
    const { stdin, lastFrame } = render(
      React.createElement(TimelineOverlay, {
        snapshots,
        sessionName: 'Test session',
        onClose: vi.fn(),
      }),
    );

    await delay();
    stdin.write('j');
    await delay();

    const output = lastFrame()!;
    expect(output).toContain('Second snapshot task');
  });

  it('should call onClose on Escape', async () => {
    const onClose = vi.fn();
    const snapshots = [makeSnapshot()];
    const { stdin } = render(
      React.createElement(TimelineOverlay, {
        snapshots,
        sessionName: 'Test session',
        onClose,
      }),
    );

    await delay();
    stdin.write('\u001B');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose on q press', async () => {
    const onClose = vi.fn();
    const snapshots = [makeSnapshot()];
    const { stdin } = render(
      React.createElement(TimelineOverlay, {
        snapshots,
        sessionName: 'Test session',
        onClose,
      }),
    );

    await delay();
    stdin.write('q');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });

  it('should show empty state when no snapshots', () => {
    const { lastFrame } = render(
      React.createElement(TimelineOverlay, {
        snapshots: [],
        sessionName: 'Test session',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;

    expect(output).toContain('No timeline data');
  });

  it('should show session name in header', () => {
    const snapshots = [makeSnapshot()];
    const { lastFrame } = render(
      React.createElement(TimelineOverlay, {
        snapshots,
        sessionName: 'My cool project',
        onClose: vi.fn(),
      }),
    );
    const output = lastFrame()!;

    expect(output).toContain('My cool project');
  });
});
