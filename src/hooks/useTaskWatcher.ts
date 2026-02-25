import { useState, useLayoutEffect, useRef, useCallback } from 'react';
import { watch } from 'chokidar';
import path from 'node:path';
import { TASKS_SUBDIR, WATCHER_DEBOUNCE_MS } from '../lib/constants.js';

// Matches: {uuid}-agent-{uuid}.json
const TODO_FILE_RE = /^([0-9a-f-]{36})-agent-[0-9a-f-]{36}\.json$/;

export interface UseTaskWatcherOptions {
  claudeDir: string;
  debounceMs?: number;
  enabled?: boolean;
}

export interface UseTaskWatcherResult {
  changedSessions: Set<string>;
  clearChanges: () => void;
}

export function useTaskWatcher(options: UseTaskWatcherOptions): UseTaskWatcherResult {
  const [changedSessions, setChangedSessions] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearChanges = useCallback(() => {
    setChangedSessions(new Set());
  }, []);

  useLayoutEffect(() => {
    if (options.enabled === false) return;

    const todosDir = path.join(options.claudeDir, TASKS_SUBDIR);
    const watcher = watch(todosDir, { depth: 0, ignoreInitial: true });

    const handleEvent = (filePath: string): void => {
      const fileName = path.basename(filePath);
      const match = TODO_FILE_RE.exec(fileName);
      if (match) {
        const sessionId = match[1];
        pendingRef.current.add(sessionId);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setChangedSessions(new Set(pendingRef.current));
          pendingRef.current.clear();
        }, options.debounceMs ?? WATCHER_DEBOUNCE_MS);
      }
    };

    watcher.on('add', handleEvent);
    watcher.on('change', handleEvent);
    watcher.on('unlink', handleEvent);

    return () => {
      watcher.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [options.claudeDir, options.debounceMs, options.enabled]);

  return { changedSessions, clearChanges };
}
