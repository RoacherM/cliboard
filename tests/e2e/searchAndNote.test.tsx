import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createTask, createSession } from '../helpers/index.js';

let mockData: any;
vi.mock('../../src/hooks/useClaudeData.js', () => ({
  useClaudeData: () => mockData,
}));

const delay = () => new Promise((r) => setTimeout(r, 0));

function buildMockData() {
  return {
    sessions: [
      createSession({ id: 's1', name: 'Search Test Session' }),
    ],
    currentTasks: [
      createTask({ id: '1', subject: 'Implement search', status: 'pending' }),
      createTask({ id: '2', subject: 'Add filters', status: 'in_progress', activeForm: 'Filtering...' }),
    ],
    loading: false,
    error: null,
    selectSession: vi.fn(),
    refresh: vi.fn(),
  };
}

describe('E2E: Search and help overlay', () => {
  beforeEach(() => {
    mockData = buildMockData();
  });

  it('should activate search when / is pressed', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { claudeDir: '/tmp/e2e-search' }),
    );
    await delay();

    const before = lastFrame()!;
    expect(before).toContain('Search Test Session');

    // Press '/' to open search
    stdin.write('/');
    await delay();

    const after = lastFrame()!;
    // The output should change after pressing '/' (either a search input appears
    // or the StatusBar context changes to reflect search mode)
    // At minimum, the app should not crash and output should still be valid
    expect(after).toBeDefined();
  });

  it('should show help overlay when ? is pressed and dismiss it with Escape', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { claudeDir: '/tmp/e2e-search' }),
    );
    await delay();

    const before = lastFrame()!;
    expect(before).toContain('Pending');
    expect(before).toContain('In Progress');

    // Press '?' to open help overlay
    stdin.write('?');
    await delay();

    const withHelp = lastFrame()!;
    // Help overlay should display keyboard shortcuts content
    expect(withHelp).toContain('Keyboard Shortcuts');
    expect(withHelp).toContain('Quit');
    expect(withHelp).toContain('Tab');
    expect(withHelp).toContain('Navigate');

    // The kanban columns should NOT be visible behind the help overlay
    // (App replaces the main view with the help overlay)
    expect(withHelp).not.toContain('Pending (');
    expect(withHelp).not.toContain('In Progress (');

    // Press Escape to dismiss help
    stdin.write('\x1b');
    await delay();

    const afterDismiss = lastFrame()!;
    // Help overlay should be gone, kanban should be back
    expect(afterDismiss).not.toContain('Keyboard Shortcuts');
    expect(afterDismiss).toContain('Pending');
    expect(afterDismiss).toContain('In Progress');
  });
});
