import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createSession, createTask, createMockAdapter } from '../helpers/index.js';

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms));
const mockAdapter = createMockAdapter();
const { mockSelectSession, mockExit } = vi.hoisted(() => ({
  mockSelectSession: vi.fn(),
  mockExit: vi.fn(),
}));

vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ink')>();
  return {
    ...actual,
    useApp: () => ({ exit: mockExit }),
  };
});

vi.mock('../../src/hooks/useBackendData.js', () => ({
  useBackendData: vi.fn(() => ({
    sessions: [
      createSession({ id: 's1', name: 'Session One' }),
      createSession({ id: 's2', name: 'Session Two' }),
    ],
    currentTasks: [
      createTask({ id: 't1', subject: 'Setup CI', status: 'pending' }),
      createTask({ id: 't2', subject: 'Write tests', status: 'in_progress' }),
      createTask({ id: 't3', subject: 'Deploy app', status: 'completed' }),
    ],
    loading: false,
    error: null,
    selectSession: mockSelectSession,
    refresh: vi.fn(),
    adapter: mockAdapter,
  })),
}));

describe('App', () => {
  beforeEach(() => {
    mockSelectSession.mockClear();
    mockExit.mockClear();
  });

  it('should render session names and kanban columns', () => {
    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter })
    );
    const output = lastFrame()!;

    // Session names from the sidebar
    expect(output).toContain('Session One');
    expect(output).toContain('Session Two');

    // Kanban column headers
    expect(output).toContain('Pending');
    expect(output).toContain('In Progress');
    expect(output).toContain('Completed');
  });

  it('should switch focus between panels when Tab is pressed', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter })
    );

    await delay();
    const before = lastFrame()!;

    stdin.write('\t');
    await delay();

    const after = lastFrame()!;

    // Focus should have moved to a different panel, changing the visual output
    expect(after).not.toEqual(before);
  });

  it('should update kanban board when a session is selected', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter })
    );

    await delay();
    const before = lastFrame()!;

    // Navigate down in the session list and select
    stdin.write('j');
    await delay();

    const after = lastFrame()!;

    // Selecting a different session should change the output
    expect(after).not.toEqual(before);
  });

  it('should show help overlay when ? is pressed', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter })
    );

    await delay();
    const before = lastFrame()!;

    stdin.write('?');
    await delay();

    const after = lastFrame()!;

    // Help overlay should appear with help-related content
    expect(after).not.toEqual(before);
    // Should contain help-related text (shortcuts, keys, etc.)
    expect(after).toMatch(/help|shortcut|key/i);
  });

  it('should not open session when Enter is pressed in command mode', async () => {
    const { stdin } = render(
      React.createElement(App, { adapter: mockAdapter })
    );

    await delay();
    const callsBefore = mockSelectSession.mock.calls.length;

    // Enter command mode, type :q!, then execute
    stdin.write('\x1B');
    await delay();
    stdin.write(':q!');
    await delay();
    stdin.write('\r');
    await delay();

    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(mockSelectSession).toHaveBeenCalledTimes(callsBefore);
  });

  it('should quit immediately on q without opening session', async () => {
    const { stdin } = render(
      React.createElement(App, { adapter: mockAdapter })
    );

    await delay();
    const callsBefore = mockSelectSession.mock.calls.length;

    stdin.write('q');
    await delay();

    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(mockSelectSession).toHaveBeenCalledTimes(callsBefore);
  });

  it('should not quit when typing :q immediately after Esc', async () => {
    const { stdin } = render(
      React.createElement(App, { adapter: mockAdapter })
    );

    await delay();

    // Simulate fast typing where state update may not have re-rendered yet.
    stdin.write('\x1B:q');
    await delay();

    expect(mockExit).toHaveBeenCalledTimes(0);
  });
});
