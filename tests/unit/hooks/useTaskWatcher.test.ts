import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { MockWatcher } from '../../helpers/index.js';

let mockWatcher: MockWatcher;
vi.mock('chokidar', () => ({
  watch: () => {
    mockWatcher = new MockWatcher();
    return mockWatcher;
  },
}));

import { useTaskWatcher } from '../../../src/hooks/useTaskWatcher.js';

// Fake UUIDs for test filenames
const SESSION_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SESSION_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SESSION_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const SESSION_X = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const AGENT_1 = 'a0000001-0000-0000-0000-000000000001';

function todoPath(sessionId: string, agentId: string = AGENT_1): string {
  return `/tmp/.claude/todos/${sessionId}-agent-${agentId}.json`;
}

/**
 * Wrapper component that renders useTaskWatcher and exposes its result
 * via a ref so tests can inspect state after render.
 */
function TestComponent({
  resultRef,
  claudeDir,
  debounceMs,
  enabled,
}: {
  resultRef: React.MutableRefObject<ReturnType<typeof useTaskWatcher> | null>;
  claudeDir: string;
  debounceMs?: number;
  enabled?: boolean;
}) {
  const result = useTaskWatcher({ claudeDir, debounceMs, enabled });
  resultRef.current = result;
  return React.createElement(
    Text,
    null,
    `sessions:${result.changedSessions.size}`,
  );
}

function renderHook(
  options: { claudeDir?: string; debounceMs?: number; enabled?: boolean } = {},
) {
  const resultRef = { current: null } as {
    current: ReturnType<typeof useTaskWatcher> | null;
  };
  const instance = render(
    React.createElement(TestComponent, {
      resultRef,
      claudeDir: options.claudeDir ?? '/tmp/.claude',
      debounceMs: options.debounceMs,
      enabled: options.enabled,
    }),
  );
  return { resultRef, ...instance };
}

describe('useTaskWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return an empty Set as initial state', () => {
    const { resultRef } = renderHook();

    expect(resultRef.current).not.toBeNull();
    expect(resultRef.current!.changedSessions).toBeInstanceOf(Set);
    expect(resultRef.current!.changedSessions.size).toBe(0);
  });

  it('should track session from file add event after debounce', async () => {
    const { resultRef } = renderHook();

    mockWatcher.simulateFileAdd(todoPath(SESSION_A));
    await vi.advanceTimersByTimeAsync(200);

    expect(resultRef.current!.changedSessions.has(SESSION_A)).toBe(true);
  });

  it('should track session from file change event after debounce', async () => {
    const { resultRef } = renderHook();

    mockWatcher.simulateFileChange(todoPath(SESSION_X));
    await vi.advanceTimersByTimeAsync(200);

    expect(resultRef.current!.changedSessions.has(SESSION_X)).toBe(true);
  });

  it('should batch multiple rapid events within debounce window', async () => {
    const { resultRef } = renderHook();

    mockWatcher.simulateFileAdd(todoPath(SESSION_A));
    mockWatcher.simulateFileChange(todoPath(SESSION_B));
    mockWatcher.simulateFileAdd(todoPath(SESSION_C));

    // Before debounce fires, nothing should be updated yet
    expect(resultRef.current!.changedSessions.size).toBe(0);

    await vi.advanceTimersByTimeAsync(200);

    // All three sessions should appear in a single batched update
    expect(resultRef.current!.changedSessions.size).toBe(3);
    expect(resultRef.current!.changedSessions.has(SESSION_A)).toBe(true);
    expect(resultRef.current!.changedSessions.has(SESSION_B)).toBe(true);
    expect(resultRef.current!.changedSessions.has(SESSION_C)).toBe(true);
  });

  it('should ignore files not matching the todos naming pattern', async () => {
    const { resultRef } = renderHook();

    mockWatcher.simulateFileAdd('/tmp/.claude/todos/stray-file.txt');
    await vi.advanceTimersByTimeAsync(200);

    expect(resultRef.current!.changedSessions.size).toBe(0);
  });

  it('should close the watcher on unmount', () => {
    const { unmount } = renderHook();

    expect(mockWatcher.closed).toBe(false);

    unmount();

    expect(mockWatcher.closed).toBe(true);
  });
});
