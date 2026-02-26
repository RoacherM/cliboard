import { useState, useEffect, useCallback, useRef } from 'react';
import fs from 'node:fs/promises';
import { ARCHIVE_THRESHOLD_DAYS, SESSION_LIVENESS_MS } from '../lib/constants.js';
import type { Task, Session, SessionMetadata } from '../lib/types.js';
import type { TaskDataService } from '../lib/taskDataService.js';
import type { MetadataService } from '../lib/metadataService.js';

export interface UseSessionResolverOptions {
  taskDataService: TaskDataService;
  metadataService: MetadataService;
}

export interface UseSessionResolverResult {
  sessions: Session[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSessionResolver({
  taskDataService,
  metadataService,
}: UseSessionResolverOptions): UseSessionResolverResult {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const sessionIds = await taskDataService.listSessions();
      const metadataMap = await metadataService.loadAllMetadata();

      const resolved: Session[] = [];

      for (const sessionId of sessionIds) {
        const tasks: Task[] = await taskDataService.readSessionTasks(sessionId);
        const metadata: SessionMetadata | undefined = metadataMap.get(sessionId);

        const name = metadataService.resolveSessionName(sessionId, metadata);

        const completed = tasks.filter((t) => t.status === 'completed').length;
        const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
        const pending = tasks.filter((t) => t.status === 'pending').length;
        const taskCount = tasks.length;

        // Compute modifiedAt from latest task updatedAt or createdAt
        let modifiedAt = new Date(0).toISOString();
        for (const task of tasks) {
          const taskDate = task.updatedAt ?? task.createdAt ?? '';
          if (taskDate > modifiedAt) {
            modifiedAt = taskDate;
          }
        }

        // isArchived: no in-progress tasks AND modifiedAt > 7 days ago
        const archiveThresholdMs = ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
        const isArchived =
          inProgress === 0 &&
          Date.now() - new Date(modifiedAt).getTime() > archiveThresholdMs;

        // Detect session liveness via JSONL mtime
        let isLive = false;
        if (metadata?.jsonlPath) {
          try {
            const stat = await fs.stat(metadata.jsonlPath);
            isLive = Date.now() - stat.mtimeMs < SESSION_LIVENESS_MS;
          } catch {
            isLive = false;
          }
        }

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
          isLive,
          jsonlPath: metadata?.jsonlPath ?? null,
        });
      }

      // Sort by modifiedAt descending (newest first)
      resolved.sort(
        (a, b) =>
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
      );

      if (mountedRef.current) {
        setSessions(resolved);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [taskDataService, metadataService]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSessions();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchSessions]);

  const refresh = useCallback(async () => {
    metadataService.invalidateCache();
    await fetchSessions();
  }, [metadataService, fetchSessions]);

  return { sessions, loading, refresh };
}
