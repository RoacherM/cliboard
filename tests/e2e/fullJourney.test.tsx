import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createTask, createSession, createMockAdapter } from '../helpers/index.js';

const mockAdapter = createMockAdapter();
let mockData: any;
vi.mock('../../src/hooks/useBackendData.js', () => ({
  useBackendData: () => mockData,
}));

const delay = () => new Promise((r) => setTimeout(r, 0));

function buildMockData(overrides?: { sessions?: any[]; currentTasks?: any[] }) {
  return {
    sessions: overrides?.sessions ?? [
      createSession({ id: 's1', name: 'API Refactor' }),
      createSession({ id: 's2', name: 'UI Redesign' }),
    ],
    currentTasks: overrides?.currentTasks ?? [
      createTask({ id: '1', subject: 'Setup DB', status: 'pending' }),
      createTask({ id: '2', subject: 'Build API', status: 'in_progress', activeForm: 'Running migrations' }),
      createTask({ id: '3', subject: 'Write tests', status: 'completed' }),
    ],
    loading: false,
    error: null,
    selectSession: vi.fn(),
    refresh: vi.fn(),
    adapter: mockAdapter,
  };
}

describe('E2E: Full journey', () => {
  beforeEach(() => {
    mockData = buildMockData();
  });

  it('should browse sessions and tasks, navigate down, and select a session', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    await delay();

    const initial = lastFrame()!;

    // Both sessions should be visible in the sidebar
    expect(initial).toContain('API Refactor');
    expect(initial).toContain('UI Redesign');

    // Kanban columns should be rendered with task counts
    expect(initial).toContain('Pending');
    expect(initial).toContain('In Progress');
    expect(initial).toContain('Completed');

    // Tasks should be visible
    expect(initial).toContain('Setup DB');
    expect(initial).toContain('Build API');
    expect(initial).toContain('Write tests');

    // Press 'j' to navigate down in the session list
    stdin.write('j');
    await delay();

    const afterNav = lastFrame()!;
    // The output should change due to selection highlight moving
    expect(afterNav).not.toEqual(initial);

    // Press Enter to select/open the session
    stdin.write('\r');
    await delay();

    const afterSelect = lastFrame()!;
    // selectSession should have been called with the second session's id
    expect(mockData.selectSession).toHaveBeenCalledWith('s2');
    // Focus should move to kanban panel after opening
    expect(afterSelect).not.toEqual(afterNav);
  });

  it('should navigate kanban columns after switching focus', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    await delay();

    const initial = lastFrame()!;

    // Press Tab to switch focus from sidebar to kanban
    stdin.write('\t');
    await delay();

    const afterTab = lastFrame()!;
    // Focus should now be on kanban - NavigableKanban renders with focus indicators
    expect(afterTab).not.toEqual(initial);

    // Focus indicator (›) should appear now that NavigableKanban is active
    expect(afterTab).toContain('\u203a');

    // Press 'l' to move focus to the next column (In Progress)
    stdin.write('l');
    await delay();

    const afterL = lastFrame()!;
    // Focus indicator should have moved to the In Progress column
    expect(afterL).not.toEqual(afterTab);
  });

  it('should navigate kanban rows vertically after switching focus', async () => {
    // Set up multiple tasks in the same column for vertical navigation
    mockData = buildMockData({
      currentTasks: [
        createTask({ id: '1', subject: 'Task A', status: 'pending' }),
        createTask({ id: '2', subject: 'Task B', status: 'pending' }),
        createTask({ id: '3', subject: 'Task C', status: 'pending' }),
      ],
    });

    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    await delay();

    // Tab to kanban
    stdin.write('\t');
    await delay();

    const afterTab = lastFrame()!;
    expect(afterTab).toContain('\u203a');

    // Press j to move down
    stdin.write('j');
    await delay();

    const afterJ = lastFrame()!;
    expect(afterJ).not.toEqual(afterTab);

    // Press k to move back up
    stdin.write('k');
    await delay();

    const afterK = lastFrame()!;
    expect(afterK).toEqual(afterTab);
  });

  it('should isolate input between sidebar and kanban panels', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    await delay();

    // Start in sidebar. Press j to move selection down.
    stdin.write('j');
    await delay();
    const sidebarMoved = lastFrame()!;

    // Tab to kanban
    stdin.write('\t');
    await delay();

    // Press j in kanban — should NOT move the sidebar selection
    const beforeKanbanJ = lastFrame()!;
    stdin.write('j');
    await delay();

    // selectSession should NOT have been called again (sidebar is inactive)
    // It was called once when we pressed j in the sidebar
    expect(mockData.selectSession).toHaveBeenCalledTimes(1);
  });

  it('should not crash when q is pressed', async () => {
    const { stdin, lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    await delay();

    // Verify app is rendered
    const before = lastFrame()!;
    expect(before).toContain('CLIboard');

    // Press 'q' - should not throw
    stdin.write('q');
    await delay();

    // App should still produce a frame (or at least not crash)
    const after = lastFrame();
    expect(after).toBeDefined();
  });
});
