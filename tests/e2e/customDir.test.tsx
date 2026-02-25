import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createTask, createSession } from '../helpers/index.js';

let mockData: any;
vi.mock('../../src/hooks/useClaudeData.js', () => ({
  useClaudeData: () => mockData,
}));

describe('E2E: Custom directory', () => {
  it('should render without crash when given a custom claudeDir path', () => {
    mockData = {
      sessions: [
        createSession({ id: 'custom-1', name: 'Custom Dir Session' }),
      ],
      currentTasks: [
        createTask({ id: '1', subject: 'Custom task', status: 'pending' }),
      ],
      loading: false,
      error: null,
      selectSession: vi.fn(),
      refresh: vi.fn(),
    };

    const { lastFrame } = render(
      React.createElement(App, { claudeDir: '/custom/path' }),
    );

    const output = lastFrame()!;
    // App should render successfully with the custom directory
    expect(output).toContain('CLIboard');
    expect(output).toContain('Custom Dir Session');
    expect(output).toContain('Custom task');
    expect(output).toContain('Pending');
    expect(output).toContain('In Progress');
    expect(output).toContain('Completed');
  });
});
