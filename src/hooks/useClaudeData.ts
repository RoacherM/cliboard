import { useMemo } from 'react';
import { ClaudeBackendAdapter } from '../lib/backends/claude/adapter.js';
import { useBackendData } from './useBackendData.js';
import type { UseBackendDataOptions } from './useBackendData.js';
import type { Session, Task } from '../lib/types.js';

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
  const adapter = useMemo(() => new ClaudeBackendAdapter(claudeDir), [claudeDir]);
  const result = useBackendData(adapter, options as UseBackendDataOptions);
  // Return without the adapter field to preserve the original API
  const { adapter: _adapter, ...rest } = result;
  return rest;
}
