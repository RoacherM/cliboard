import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { createTask, createSessionMetadata } from '../../helpers/index.js';
import type { Task, SessionMetadata } from '../../../src/lib/types.js';
import { useClaudeData } from '../../../src/hooks/useClaudeData.js';

// ---------------------------------------------------------------------------
// Mock service layer
// ---------------------------------------------------------------------------

const mockMetadataMap = new Map<string, SessionMetadata>([
  ['session-1', createSessionMetadata({ projectDir: '-Users-dev-projectA', jsonlPath: '/tmp/s1.jsonl' })],
  ['session-2', createSessionMetadata({ projectDir: '-Users-dev-projectB', jsonlPath: '/tmp/s2.jsonl' })],
]);

const mockTasksBySession: Record<string, Task[]> = {
  'session-1': [
    createTask({ id: 't1', status: 'in_progress', sessionId: 'session-1' }),
    createTask({ id: 't2', status: 'pending', sessionId: 'session-1' }),
  ],
  'session-2': [
    createTask({ id: 't3', status: 'completed', sessionId: 'session-2' }),
  ],
};

let shouldThrow = false;

vi.mock('../../../src/lib/TaskDataService.js', () => ({
  TaskDataService: vi.fn().mockImplementation(() => ({
    readSessionTasks: vi.fn().mockImplementation((sessionId: string) => {
      if (shouldThrow) throw new Error('Disk read failed');
      return Promise.resolve(mockTasksBySession[sessionId] ?? []);
    }),
  })),
}));

vi.mock('../../../src/lib/timelineService.js', () => ({
  replayCurrentTasks: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/lib/MetadataService.js', () => ({
  encodeProjectKey: vi.fn().mockImplementation((cwd: string) => cwd.replace(/\//g, '-')),
  MetadataService: vi.fn().mockImplementation(() => ({
    loadAllMetadata: vi.fn().mockImplementation(() => {
      if (shouldThrow) throw new Error('Metadata read failed');
      return Promise.resolve(new Map(mockMetadataMap));
    }),
    resolveSessionName: vi
      .fn()
      .mockImplementation((sessionId: string) => sessionId.substring(0, 8) + '...'),
    invalidateCache: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Wrapper component
// ---------------------------------------------------------------------------

function TestComponent({
  resultRef,
  claudeDir,
  projectPath,
}: {
  resultRef: React.MutableRefObject<ReturnType<typeof useClaudeData> | null>;
  claudeDir: string;
  projectPath?: string;
}) {
  const result = useClaudeData(claudeDir, { projectPath });
  resultRef.current = result;
  return React.createElement(
    Text,
    null,
    `sessions:${result.sessions.length} loading:${result.loading} error:${result.error ?? 'none'}`,
  );
}

function renderHook(claudeDir = '/tmp/.claude', projectPath?: string) {
  const resultRef = { current: null } as {
    current: ReturnType<typeof useClaudeData> | null;
  };
  const instance = render(
    React.createElement(TestComponent, {
      resultRef,
      claudeDir,
      projectPath,
    }),
  );
  return { resultRef, ...instance };
}

// ---------------------------------------------------------------------------
// Helper: wait for async effects to settle
// ---------------------------------------------------------------------------
async function waitForUpdate(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useClaudeData', () => {
  beforeEach(() => {
    shouldThrow = false;
    vi.clearAllMocks();
  });

  it('should populate sessions and transition loading from true to false', async () => {
    const { resultRef } = renderHook();

    // Initially loading should be true
    expect(resultRef.current).not.toBeNull();
    expect(resultRef.current!.loading).toBe(true);

    await waitForUpdate();

    // After async resolution, loading should be false and sessions populated
    expect(resultRef.current!.loading).toBe(false);
    expect(resultRef.current!.sessions.length).toBeGreaterThan(0);
    expect(resultRef.current!.error).toBeNull();
  });

  it('should update currentTasks when selectSession is called', async () => {
    const { resultRef } = renderHook();

    await waitForUpdate();

    // Before selecting a session, currentTasks should be empty
    expect(resultRef.current!.currentTasks).toHaveLength(0);

    // Select session-1
    resultRef.current!.selectSession('session-1');

    await waitForUpdate();

    // currentTasks should now reflect session-1's tasks
    expect(resultRef.current!.currentTasks.length).toBeGreaterThan(0);
    expect(
      resultRef.current!.currentTasks.every(
        (t) => t.sessionId === 'session-1',
      ),
    ).toBe(true);
  });

  it('should populate error string when a service throws', async () => {
    shouldThrow = true;

    const { resultRef } = renderHook();

    await waitForUpdate();

    expect(resultRef.current!.error).not.toBeNull();
    expect(typeof resultRef.current!.error).toBe('string');
    expect(resultRef.current!.error!.length).toBeGreaterThan(0);
    expect(resultRef.current!.loading).toBe(false);
  });

  it('should filter sessions by projectPath when provided', async () => {
    const { resultRef } = renderHook('/tmp/.claude', '/Users/dev/projectA');

    await waitForUpdate();

    expect(resultRef.current!.loading).toBe(false);
    expect(resultRef.current!.sessions).toHaveLength(1);
    expect(resultRef.current!.sessions[0].id).toBe('session-1');
  });

  it('should return all sessions when no projectPath is provided', async () => {
    const { resultRef } = renderHook();

    await waitForUpdate();

    expect(resultRef.current!.loading).toBe(false);
    expect(resultRef.current!.sessions).toHaveLength(2);
  });
});
