import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../src/App.js';
import { createMockAdapter } from '../helpers/index.js';

const mockAdapter = createMockAdapter();
let mockData: any;
vi.mock('../../src/hooks/useBackendData.js', () => ({
  useBackendData: () => mockData,
}));

describe('E2E: Missing directory error', () => {
  it('should display an error message when useClaudeData returns an error', () => {
    mockData = {
      sessions: [],
      currentTasks: [],
      loading: false,
      error: 'Directory not found',
      selectSession: vi.fn(),
      refresh: vi.fn(),
      adapter: mockAdapter,
    };

    const { lastFrame } = render(
      React.createElement(App, { adapter: mockAdapter }),
    );

    const output = lastFrame()!;
    // The error message should be displayed
    expect(output).toContain('Directory not found');
    // The app header should still render
    expect(output).toContain('CLIboard');
  });
});
