import type { BackendAdapter, BackendCapabilities, BackendId } from '../../src/lib/backends/types.js';

/** Create a mock BackendAdapter for tests that render App directly */
export function createMockAdapter(overrides?: Partial<BackendAdapter>): BackendAdapter {
  return {
    id: 'claude' as BackendId,
    displayName: 'Claude Code',
    capabilities: {
      tasks: true,
      timeline: true,
      activity: true,
      liveness: true,
      gitBranch: true,
      subagents: true,
    },
    initialize: async () => true,
    dispose: async () => {},
    loadSessions: async () => [],
    loadSessionTasks: async () => [],
    loadActivity: async () => [],
    loadTimeline: async () => [],
    checkCacheState: async () => ({ isStale: false }),
    invalidateCache: () => {},
    ...overrides,
  };
}
