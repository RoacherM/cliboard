import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createMockAdapter } from '../helpers/index.js';

const mockAdapter = createMockAdapter();
let mockData: any;
vi.mock('../../src/hooks/useBackendData.js', () => ({
  useBackendData: () => mockData,
}));

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe('Error Resilience', () => {
  beforeEach(() => {
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

  it('should not crash on malformed JSON error and display the error', () => {
    mockData.error = 'Invalid JSON';

    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    const output = lastFrame()!;

    // App must still render (non-empty output)
    expect(output.length).toBeGreaterThan(0);
    // Error message should be visible to the user
    expect(output).toContain('Invalid JSON');
  });

  it('should show a friendly empty state when directory is not found', () => {
    mockData.error = 'Directory not found';
    mockData.sessions = [];

    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    const output = lastFrame()!;

    // Should render without crashing
    expect(output.length).toBeGreaterThan(0);
    // Should display a user-friendly message — either the error or an empty-state indicator
    expect(output).toMatch(/Directory not found|No sessions/i);
  });

  it('should display a loading indicator when data is loading', () => {
    mockData.loading = true;
    mockData.sessions = [];

    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );
    const output = lastFrame()!;

    // Header shows "loading..." when loading is true
    expect(output).toMatch(/loading/i);
  });

  it('should recover from error state when data becomes available', async () => {
    mockData.error = 'Temporary failure';
    mockData.sessions = [];

    const { lastFrame, rerender } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );

    const errorOutput = lastFrame()!;
    expect(errorOutput).toContain('Temporary failure');

    // Now simulate recovery: clear error and provide sessions
    mockData = {
      sessions: [
        {
          id: 's1',
          name: 'Recovered Session',
          slug: 'recovered',
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
      ],
      currentTasks: [],
      loading: false,
      error: null,
      selectSession: vi.fn(),
      refresh: vi.fn(),
      adapter: mockAdapter,
    };

    rerender(React.createElement(App, { adapter: mockAdapter }));
    await delay();

    const recoveredOutput = lastFrame()!;
    expect(recoveredOutput).toContain('Recovered Session');
    expect(recoveredOutput).not.toContain('Temporary failure');
  });
});
