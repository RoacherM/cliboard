import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { createTask, createSessionMetadata } from '../../helpers/index.js';
import type { Task, Session, SessionMetadata } from '../../../src/lib/types.js';
import type { TaskDataService } from '../../../src/lib/TaskDataService.js';
import type { MetadataService } from '../../../src/lib/MetadataService.js';
import { useSessionResolver } from '../../../src/hooks/useSessionResolver.js';

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

function createMockTaskDataService(
  sessions: string[] = [],
  tasksBySession: Record<string, Task[]> = {},
): TaskDataService {
  return {
    listSessions: vi.fn().mockResolvedValue(sessions),
    readSessionTasks: vi
      .fn()
      .mockImplementation((sessionId: string) =>
        Promise.resolve(tasksBySession[sessionId] ?? []),
      ),
    readAllTasks: vi.fn().mockResolvedValue(
      Object.values(tasksBySession).flat(),
    ),
  } as unknown as TaskDataService;
}

function createMockMetadataService(
  metadataMap: Map<string, SessionMetadata> = new Map(),
): MetadataService {
  return {
    loadAllMetadata: vi.fn().mockResolvedValue(metadataMap),
    resolveSessionName: vi
      .fn()
      .mockImplementation((sessionId: string, metadata?: SessionMetadata) => {
        if (metadata?.customTitle) return metadata.customTitle;
        if (metadata?.slug) return metadata.slug;
        return sessionId.substring(0, 8) + '...';
      }),
    invalidateCache: vi.fn(),
  } as unknown as MetadataService;
}

// ---------------------------------------------------------------------------
// Wrapper component
// ---------------------------------------------------------------------------

function TestComponent({
  resultRef,
  taskDataService,
  metadataService,
}: {
  resultRef: React.MutableRefObject<ReturnType<typeof useSessionResolver> | null>;
  taskDataService: TaskDataService;
  metadataService: MetadataService;
}) {
  const result = useSessionResolver({ taskDataService, metadataService });
  resultRef.current = result;
  return React.createElement(
    Text,
    null,
    `sessions:${result.sessions.length} loading:${result.loading}`,
  );
}

function renderHook(options: {
  taskDataService: TaskDataService;
  metadataService: MetadataService;
}) {
  const resultRef = { current: null } as {
    current: ReturnType<typeof useSessionResolver> | null;
  };
  const instance = render(
    React.createElement(TestComponent, {
      resultRef,
      taskDataService: options.taskDataService,
      metadataService: options.metadataService,
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

describe('useSessionResolver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should merge task data with metadata to produce sessions with name and task counts', async () => {
    const metadataMap = new Map<string, SessionMetadata>([
      [
        'session-1',
        createSessionMetadata({
          customTitle: 'My Feature',
          slug: 'my-feature',
          project: '/home/user/project',
        }),
      ],
    ]);

    const tasksBySession: Record<string, Task[]> = {
      'session-1': [
        createTask({ id: 't1', status: 'completed' }),
        createTask({ id: 't2', status: 'in_progress' }),
        createTask({ id: 't3', status: 'pending' }),
      ],
    };

    const taskDataService = createMockTaskDataService(['session-1'], tasksBySession);
    const metadataService = createMockMetadataService(metadataMap);

    const { resultRef } = renderHook({ taskDataService, metadataService });

    await waitForUpdate();

    expect(resultRef.current).not.toBeNull();
    const sessions = resultRef.current!.sessions;
    expect(sessions).toHaveLength(1);

    const session = sessions[0]!;
    expect(session.name).toBe('My Feature');
    expect(session.taskCount).toBe(3);
    expect(session.completed).toBe(1);
    expect(session.inProgress).toBe(1);
    expect(session.pending).toBe(1);
  });

  it('should sort sessions by modifiedAt descending (newest first)', async () => {
    const olderDate = '2026-01-01T00:00:00.000Z';
    const newerDate = '2026-02-20T00:00:00.000Z';

    const tasksBySession: Record<string, Task[]> = {
      'session-old': [
        createTask({ id: 't1', status: 'pending', updatedAt: olderDate }),
      ],
      'session-new': [
        createTask({ id: 't2', status: 'pending', updatedAt: newerDate }),
      ],
    };

    const metadataMap = new Map<string, SessionMetadata>([
      ['session-old', createSessionMetadata({ customTitle: 'Old Session' })],
      ['session-new', createSessionMetadata({ customTitle: 'New Session' })],
    ]);

    const taskDataService = createMockTaskDataService(
      ['session-old', 'session-new'],
      tasksBySession,
    );
    const metadataService = createMockMetadataService(metadataMap);

    const { resultRef } = renderHook({ taskDataService, metadataService });

    await waitForUpdate();

    const sessions = resultRef.current!.sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.id).toBe('session-new');
    expect(sessions[1]!.id).toBe('session-old');
  });

  it('should compute isArchived as true when inProgress is 0 and modifiedAt is older than 7 days', async () => {
    const eightDaysAgo = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const tasksBySession: Record<string, Task[]> = {
      'session-archived': [
        createTask({
          id: 't1',
          status: 'completed',
          updatedAt: eightDaysAgo,
        }),
      ],
      'session-active': [
        createTask({
          id: 't2',
          status: 'in_progress',
          updatedAt: new Date().toISOString(),
        }),
      ],
    };

    const metadataMap = new Map<string, SessionMetadata>([
      ['session-archived', createSessionMetadata({ customTitle: 'Archived' })],
      ['session-active', createSessionMetadata({ customTitle: 'Active' })],
    ]);

    const taskDataService = createMockTaskDataService(
      ['session-archived', 'session-active'],
      tasksBySession,
    );
    const metadataService = createMockMetadataService(metadataMap);

    const { resultRef } = renderHook({ taskDataService, metadataService });

    await waitForUpdate();

    const sessions = resultRef.current!.sessions;
    const archived = sessions.find((s) => s.id === 'session-archived');
    const active = sessions.find((s) => s.id === 'session-active');

    expect(archived).toBeDefined();
    expect(archived!.isArchived).toBe(true);

    expect(active).toBeDefined();
    expect(active!.isArchived).toBe(false);
  });

  it('should invalidate metadata cache when refresh is called', async () => {
    const taskDataService = createMockTaskDataService([], {});
    const metadataService = createMockMetadataService(new Map());

    const { resultRef } = renderHook({ taskDataService, metadataService });

    await waitForUpdate();

    expect(resultRef.current).not.toBeNull();

    await resultRef.current!.refresh();

    expect(metadataService.invalidateCache).toHaveBeenCalled();
  });
});
