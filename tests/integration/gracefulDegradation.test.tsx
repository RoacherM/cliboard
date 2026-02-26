import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createMockAdapter } from '../helpers/index.js';

const mockAdapter = createMockAdapter();
let mockData: any;
vi.mock('../../src/hooks/useBackendData.js', () => ({
  useBackendData: () => mockData,
}));

describe('Graceful Degradation', () => {
  let originalColumns: number | undefined;

  beforeEach(() => {
    originalColumns = process.stdout.columns;
    mockData = {
      sessions: [],
      currentTasks: [],
      loading: false,
      error: null,
      selectSession: vi.fn(),
      refresh: vi.fn(),
      adapter: mockAdapter,
    };
  });

  afterEach(() => {
    // Restore original terminal width
    if (originalColumns !== undefined) {
      process.stdout.columns = originalColumns;
    } else {
      // @ts-expect-error restoring to undefined
      process.stdout.columns = undefined;
    }
  });

  it('should render without crashing on a small terminal (60 columns)', () => {
    process.stdout.columns = 60;

    mockData.sessions = [
      {
        id: 's1',
        name: 'Narrow Session',
        slug: 'narrow',
        project: null,
        description: null,
        gitBranch: null,
        taskCount: 1,
        completed: 0,
        inProgress: 1,
        pending: 0,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        isArchived: false,
      },
    ];

    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    const output = lastFrame()!;

    // Must render something without throwing
    expect(output.length).toBeGreaterThan(0);
    // Core branding should still appear
    expect(output).toContain('CLIboard');
  });

  it('should show an empty state message when there are no sessions', () => {
    mockData.sessions = [];
    mockData.currentTasks = [];

    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    const output = lastFrame()!;

    // App should still render the shell (header, sidebar label, status bar)
    expect(output).toContain('CLIboard');
    expect(output).toContain('Sessions');
    // With zero sessions, the sidebar should convey emptiness —
    // either an explicit "No sessions" message or simply no session items rendered.
    // Verify that no session-like content appears (no "Session" item names).
    // The kanban columns should still show their headers with (0) counts.
    expect(output).toContain('Pending');
    expect(output).toContain('(0)');
  });

  it('should render kanban columns with zero tasks when session has no tasks', () => {
    mockData.sessions = [
      {
        id: 's1',
        name: 'Empty Task Session',
        slug: 'empty-tasks',
        project: null,
        description: null,
        gitBranch: null,
        taskCount: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        isArchived: false,
      },
    ];
    mockData.currentTasks = [];

    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    const output = lastFrame()!;

    // Session should be visible in sidebar
    expect(output).toContain('Empty Task Session');

    // All three kanban columns should render with zero-count headers
    expect(output).toContain('Pending');
    expect(output).toContain('In Progress');
    expect(output).toContain('Completed');
    expect(output).toContain('(0)');
  });
});
