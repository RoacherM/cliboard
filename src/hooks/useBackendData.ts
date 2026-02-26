import { useState, useEffect, useCallback, useRef } from 'react';
import { AUTO_REFRESH_MS } from '../lib/constants.js';
import type { BackendAdapter } from '../lib/backends/types.js';
import type { Task, Session } from '../lib/types.js';

export interface UseBackendDataOptions {
  projectPath?: string;
}

export interface UseBackendDataResult {
  sessions: Session[];
  currentTasks: Task[];
  loading: boolean;
  error: string | null;
  selectSession: (sessionId: string) => void;
  refresh: () => Promise<void>;
  adapter: BackendAdapter;
}

export function useBackendData(
  adapter: BackendAdapter,
  options?: UseBackendDataOptions,
): UseBackendDataResult {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const selectRequestRef = useRef(0);

  const fetchSessions = useCallback(async () => {
    try {
      const resolved = await adapter.loadSessions({ projectPath: options?.projectPath });

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
  }, [adapter, options?.projectPath]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSessions();

    const interval = setInterval(async () => {
      const { isStale } = await adapter.checkCacheState();
      if (isStale) {
        adapter.invalidateCache();
        fetchSessions();
      }
    }, AUTO_REFRESH_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchSessions, adapter]);

  const selectSession = useCallback(
    (sessionId: string) => {
      const requestId = ++selectRequestRef.current;
      const loadTasks = async () => {
        try {
          const tasks = await adapter.loadSessionTasks(sessionId);
          if (mountedRef.current && selectRequestRef.current === requestId) {
            setCurrentTasks(tasks);
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
    [adapter],
  );

  const refresh = useCallback(async () => {
    try {
      adapter.invalidateCache();
      setError(null);
      await fetchSessions();
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    }
  }, [adapter, fetchSessions]);

  return {
    sessions,
    currentTasks,
    loading,
    error,
    selectSession,
    refresh,
    adapter,
  };
}
