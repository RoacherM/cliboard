import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createSession, createTask } from '../helpers/index.js';

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms));

vi.mock('../../src/hooks/useClaudeData.js', () => ({
  useClaudeData: vi.fn(() => ({
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
    selectSession: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe('App', () => {
  it('should render session names and kanban columns', () => {
    const { lastFrame } = render(
      React.createElement(App, { claudeDir: '/tmp/fake-claude' })
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
      React.createElement(App, { claudeDir: '/tmp/fake-claude' })
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
      React.createElement(App, { claudeDir: '/tmp/fake-claude' })
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
      React.createElement(App, { claudeDir: '/tmp/fake-claude' })
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
});
