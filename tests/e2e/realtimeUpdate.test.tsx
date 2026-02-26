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

const baseSessions = () => [
  createSession({ id: 's1', name: 'Live Session' }),
];

const baseTasks = () => [
  createTask({ id: '1', subject: 'Init proj', status: 'pending' }),
  createTask({ id: '2', subject: 'Cfg lint', status: 'in_progress', activeForm: 'Linting...' }),
];

function buildMockData(overrides?: { sessions?: any[]; currentTasks?: any[] }) {
  return {
    sessions: overrides?.sessions ?? baseSessions(),
    currentTasks: overrides?.currentTasks ?? baseTasks(),
    loading: false,
    error: null,
    selectSession: vi.fn(),
    refresh: vi.fn(),
    adapter: mockAdapter,
  };
}

describe('E2E: Real-time updates', () => {
  beforeEach(() => {
    mockData = buildMockData();
  });

  it('should display a newly added task after mock data updates and rerender', () => {
    const { lastFrame, rerender } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );

    const initial = lastFrame()!;
    expect(initial).toContain('Init proj');
    expect(initial).toContain('Cfg lint');
    expect(initial).not.toContain('Deploy');

    // Simulate a live update: a new task appears
    const updatedTasks = [
      ...baseTasks(),
      createTask({ id: '3', subject: 'Deploy', status: 'pending' }),
    ];
    mockData = buildMockData({ currentTasks: updatedTasks });

    rerender(React.createElement(App, { adapter: mockAdapter }));

    const updated = lastFrame()!;
    // All tasks should now be visible including the new one
    expect(updated).toContain('Init proj');
    expect(updated).toContain('Cfg lint');
    expect(updated).toContain('Deploy');

    // Pending column count should increase from 1 to 2
    expect(updated).toContain('Pending (2)');
  });

  it('should move a task between columns when its status changes', () => {
    const { lastFrame, rerender } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );

    const initial = lastFrame()!;
    // Initially: 1 pending, 1 in_progress, 0 completed
    expect(initial).toContain('Pending (1)');
    expect(initial).toContain('In Progress (1)');
    expect(initial).toContain('Completed (0)');

    // Change task #1 from pending to completed
    const updatedTasks = baseTasks().map((t) =>
      t.id === '1' ? { ...t, status: 'completed' as const } : t,
    );
    mockData = buildMockData({ currentTasks: updatedTasks });

    rerender(React.createElement(App, { adapter: mockAdapter }));

    const updated = lastFrame()!;
    // Now: 0 pending, 1 in_progress, 1 completed
    expect(updated).toContain('Pending (0)');
    expect(updated).toContain('In Progress (1)');
    expect(updated).toContain('Completed (1)');

    // Task should still be visible, just in a different column
    expect(updated).toContain('Init proj');
  });
});
