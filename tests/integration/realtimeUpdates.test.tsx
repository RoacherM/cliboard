import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createSession, createTask } from '../helpers/index.js';

let mockData: any;

vi.mock('../../src/hooks/useClaudeData.js', () => ({
  useClaudeData: () => mockData,
}));

const baseSessions = () => [
  createSession({ id: 's1', name: 'Alpha Session' }),
  createSession({ id: 's2', name: 'Beta Session' }),
];

const baseTasks = () => [
  createTask({ id: '1', subject: 'Setup CI', status: 'pending', activeForm: '' }),
  createTask({ id: '2', subject: 'Write tests', status: 'in_progress', activeForm: 'Starting...' }),
  createTask({ id: '3', subject: 'Deploy app', status: 'completed', activeForm: '' }),
];

function buildMockData(overrides?: { sessions?: any[]; currentTasks?: any[] }) {
  return {
    sessions: overrides?.sessions ?? baseSessions(),
    currentTasks: overrides?.currentTasks ?? baseTasks(),
    loading: false,
    error: null,
    selectSession: vi.fn(),
    refresh: vi.fn(),
  };
}

describe('Real-time updates', () => {
  beforeEach(() => {
    mockData = buildMockData();
  });

  it('should reflect task status change from pending to in_progress on rerender', () => {
    const { lastFrame, rerender } = render(
      React.createElement(App, { claudeDir: '/tmp/fake' }),
    );

    const initial = lastFrame()!;
    // "Setup CI" starts in Pending column
    expect(initial).toContain('Setup CI');

    // Move task 1 from pending to in_progress
    const updatedTasks = baseTasks().map((t) =>
      t.id === '1' ? { ...t, status: 'in_progress' as const } : t,
    );
    mockData = buildMockData({ currentTasks: updatedTasks });

    rerender(React.createElement(App, { claudeDir: '/tmp/fake' }));

    const updated = lastFrame()!;
    // Task should still be visible but now in the In Progress column
    expect(updated).toContain('Setup CI');
    // The In Progress column count should have increased from 1 to 2
    expect(updated).toContain('In Progress (2)');
  });

  it('should display updated activeForm text on rerender', () => {
    const { lastFrame, rerender } = render(
      React.createElement(App, { claudeDir: '/tmp/fake' }),
    );

    const initial = lastFrame()!;
    expect(initial).toContain('Starting...');

    // Update the activeForm of the in_progress task
    const updatedTasks = baseTasks().map((t) =>
      t.id === '2' ? { ...t, activeForm: 'Processing data' } : t,
    );
    mockData = buildMockData({ currentTasks: updatedTasks });

    rerender(React.createElement(App, { claudeDir: '/tmp/fake' }));

    const updated = lastFrame()!;
    expect(updated).not.toContain('Starting...');
    expect(updated).toContain('Processing data');
  });

  it('should show a newly added task after rerender', () => {
    // Start with only 1 task
    const singleTask = [createTask({ id: '1', subject: 'Initial task', status: 'pending' })];
    mockData = buildMockData({ currentTasks: singleTask });

    const { lastFrame, rerender } = render(
      React.createElement(App, { claudeDir: '/tmp/fake' }),
    );

    const initial = lastFrame()!;
    expect(initial).toContain('Initial task');
    expect(initial).not.toContain('Brand new task');

    // Add a second task
    const twoTasks = [
      ...singleTask,
      createTask({ id: '2', subject: 'Brand new task', status: 'pending' }),
    ];
    mockData = buildMockData({ currentTasks: twoTasks });

    rerender(React.createElement(App, { claudeDir: '/tmp/fake' }));

    const updated = lastFrame()!;
    expect(updated).toContain('Initial task');
    expect(updated).toContain('Brand new task');
  });

  it('should remove a session from the sidebar after rerender', () => {
    const { lastFrame, rerender } = render(
      React.createElement(App, { claudeDir: '/tmp/fake' }),
    );

    const initial = lastFrame()!;
    expect(initial).toContain('Alpha Session');
    expect(initial).toContain('Beta Session');

    // Remove Beta Session
    const onlyAlpha = [createSession({ id: 's1', name: 'Alpha Session' })];
    mockData = buildMockData({ sessions: onlyAlpha });

    rerender(React.createElement(App, { claudeDir: '/tmp/fake' }));

    const updated = lastFrame()!;
    expect(updated).toContain('Alpha Session');
    expect(updated).not.toContain('Beta Session');
  });

  it('should show blocked indicator when blockedBy is added on rerender', () => {
    const { lastFrame, rerender } = render(
      React.createElement(App, { claudeDir: '/tmp/fake' }),
    );

    const initial = lastFrame()!;
    // Task 1 (Setup CI) has no blockedBy, so no blocked indicator
    // The ⊘ should not appear next to Setup CI
    expect(initial).toContain('Setup CI');

    // Add a blockedBy dependency to task 1
    const updatedTasks = baseTasks().map((t) =>
      t.id === '1' ? { ...t, blockedBy: ['2'] } : t,
    );
    mockData = buildMockData({ currentTasks: updatedTasks });

    rerender(React.createElement(App, { claudeDir: '/tmp/fake' }));

    const updated = lastFrame()!;
    expect(updated).toContain('⊘');
  });
});
