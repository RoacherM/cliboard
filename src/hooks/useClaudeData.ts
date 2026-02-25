import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TaskDataService } from '../lib/taskDataService.js';
import { MetadataService, encodeProjectKey } from '../lib/metadataService.js';
import { replayCurrentTasks } from '../lib/timelineService.js';
import { ARCHIVE_THRESHOLD_DAYS, AUTO_REFRESH_MS } from '../lib/constants.js';
import type { Task, Session, SessionMetadata } from '../lib/types.js';

export interface UseClaudeDataOptions {
  projectPath?: string;
}

export interface UseClaudeDataResult {
  sessions: Session[];
  currentTasks: Task[];
  loading: boolean;
  error: string | null;
  selectSession: (sessionId: string) => void;
  refresh: () => Promise<void>;
}

export function useClaudeData(claudeDir: string, options?: UseClaudeDataOptions): UseClaudeDataResult {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const selectRequestRef = useRef(0);

  const taskDataService = useMemo(() => new TaskDataService(claudeDir), [claudeDir]);
  const metadataService = useMemo(() => new MetadataService(claudeDir), [claudeDir]);

  const projectKey = useMemo(
    () => (options?.projectPath ? encodeProjectKey(options.projectPath) : undefined),
    [options?.projectPath],
  );

  const fetchSessions = useCallback(async () => {
    try {
      const metadataMap: Map<string, SessionMetadata> = await metadataService.loadAllMetadata();

      // Source session IDs from metadata (projects/ directory), not todos/
      let sessionEntries = [...metadataMap.entries()];
      if (projectKey) {
        sessionEntries = sessionEntries.filter(([, meta]) => meta.projectDir === projectKey);
      }

      const resolved: Session[] = [];

      for (const [sessionId, metadata] of sessionEntries) {
        let tasks: Task[] = await taskDataService.readSessionTasks(sessionId);
        // Fall back to replaying TaskCreate/TaskUpdate from jsonl when todos are empty
        if (tasks.length === 0 && metadata.jsonlPath) {
          tasks = await replayCurrentTasks(metadata.jsonlPath);
        }

        const name = metadataService.resolveSessionName(sessionId, metadata);

        const taskCount = tasks.length;

        // Skip sessions with no tasks — they're idle chats with no task history
        if (taskCount === 0) continue;

        const completed = tasks.filter((t) => t.status === 'completed').length;
        const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
        const pending = tasks.filter((t) => t.status === 'pending').length;

        let modifiedAt = new Date(0).toISOString();
        for (const task of tasks) {
          const taskDate = task.updatedAt ?? task.createdAt ?? '';
          if (taskDate > modifiedAt) {
            modifiedAt = taskDate;
          }
        }

        const archiveThresholdMs = ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
        const isArchived =
          inProgress === 0 &&
          Date.now() - new Date(modifiedAt).getTime() > archiveThresholdMs;

        resolved.push({
          id: sessionId,
          name,
          slug: metadata?.slug ?? null,
          project: metadata?.project ?? null,
          description: metadata?.description ?? null,
          gitBranch: metadata?.gitBranch ?? null,
          taskCount,
          completed,
          inProgress,
          pending,
          createdAt: metadata?.created ?? null,
          modifiedAt,
          isArchived,
          jsonlPath: metadata?.jsonlPath ?? null,
        });
      }

      resolved.sort(
        (a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
      );

      if (mountedRef.current) {
        setSessions(resolved);
        setError(null);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [taskDataService, metadataService, projectKey]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSessions();

    // Auto-refresh every few seconds to pick up live changes
    const interval = setInterval(() => {
      metadataService.invalidateCache();
      fetchSessions();
    }, AUTO_REFRESH_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchSessions, metadataService]);

  const selectSession = useCallback(
    (sessionId: string) => {
      const requestId = ++selectRequestRef.current;
      const loadTasks = async () => {
        try {
          let tasks = await taskDataService.readSessionTasks(sessionId);
          // Fall back to replaying from jsonl
          if (tasks.length === 0) {
            const session = sessions.find((s) => s.id === sessionId);
            if (session?.jsonlPath) {
              tasks = await replayCurrentTasks(session.jsonlPath);
            }
          }
          // Only update if this is still the latest request (prevents race condition)
          if (mountedRef.current && selectRequestRef.current === requestId) {
            const tasksWithSession = tasks.map((t) => ({
              ...t,
              sessionId,
            }));
            setCurrentTasks(tasksWithSession);
          }
        } catch (err: unknown) {
          if (mountedRef.current && selectRequestRef.current === requestId) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
          }
        }
      };
      loadTasks();
    },
    [taskDataService, sessions],
  );

  const refresh = useCallback(async () => {
    try {
      metadataService.invalidateCache();
      setError(null);
      await fetchSessions();
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    }
  }, [metadataService, fetchSessions]);

  return {
    sessions,
    currentTasks,
    loading,
    error,
    selectSession,
    refresh,
  };
}
