import { describe, it, expect, vi } from 'vitest';
import { CompositeBackendAdapter } from '../../../../../src/lib/backends/composite/adapter.js';
import { createMockAdapter } from '../../../../helpers/mockAdapter.js';
import { createSession, createTask } from '../../../../helpers/fixtures.js';
import type { BackendId } from '../../../../../src/lib/backends/types.js';

describe('CompositeBackendAdapter', () => {
  describe('constructor', () => {
    it('throws on empty adapter list', () => {
      expect(() => new CompositeBackendAdapter([])).toThrow(
        'at least one adapter',
      );
    });

    it('uses first adapter id as primary', () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ id: 'claude' as BackendId }),
        createMockAdapter({ id: 'opencode' as BackendId }),
      ]);
      expect(composite.id).toBe('claude');
    });

    it('joins display names', () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ displayName: 'Claude Code' }),
        createMockAdapter({ displayName: 'OpenCode' }),
      ]);
      expect(composite.displayName).toBe('Claude Code + OpenCode');
    });

    it('unions capabilities', () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({
          capabilities: {
            tasks: true,
            timeline: true,
            activity: true,
            liveness: true,
            gitBranch: true,
            subagents: true,
          },
        }),
        createMockAdapter({
          capabilities: {
            tasks: true,
            timeline: false,
            activity: true,
            liveness: false,
            gitBranch: false,
            subagents: false,
          },
        }),
      ]);
      expect(composite.capabilities).toEqual({
        tasks: true,
        timeline: true,
        activity: true,
        liveness: true,
        gitBranch: true,
        subagents: true,
      });
    });
  });

  describe('initialize', () => {
    it('returns true if any adapter succeeds', async () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ initialize: async () => false }),
        createMockAdapter({ initialize: async () => true }),
      ]);
      expect(await composite.initialize()).toBe(true);
    });

    it('returns false if all adapters fail', async () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ initialize: async () => false }),
        createMockAdapter({ initialize: async () => false }),
      ]);
      expect(await composite.initialize()).toBe(false);
    });

    it('survives a throwing adapter', async () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({
          initialize: async () => {
            throw new Error('boom');
          },
        }),
        createMockAdapter({ initialize: async () => true }),
      ]);
      expect(await composite.initialize()).toBe(true);
    });
  });

  describe('loadSessions', () => {
    it('merges sessions from all adapters sorted by modifiedAt desc', async () => {
      const s1 = createSession({
        id: 'claude-1',
        modifiedAt: '2026-02-26T10:00:00Z',
        backendId: 'claude',
      });
      const s2 = createSession({
        id: 'oc-1',
        modifiedAt: '2026-02-26T11:00:00Z',
        backendId: 'opencode',
      });
      const s3 = createSession({
        id: 'claude-2',
        modifiedAt: '2026-02-26T09:00:00Z',
        backendId: 'claude',
      });

      const composite = new CompositeBackendAdapter([
        createMockAdapter({ loadSessions: async () => [s1, s3] }),
        createMockAdapter({ loadSessions: async () => [s2] }),
      ]);

      const sessions = await composite.loadSessions();
      expect(sessions.map((s) => s.id)).toEqual(['oc-1', 'claude-1', 'claude-2']);
    });

    it('survives one adapter failing', async () => {
      const s1 = createSession({ id: 'ok-session', backendId: 'claude' });
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ loadSessions: async () => [s1] }),
        createMockAdapter({
          loadSessions: async () => {
            throw new Error('db locked');
          },
        }),
      ]);

      const sessions = await composite.loadSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe('ok-session');
    });

    it('passes projectPath to all adapters', async () => {
      const load1 = vi.fn(async () => []);
      const load2 = vi.fn(async () => []);

      const composite = new CompositeBackendAdapter([
        createMockAdapter({ loadSessions: load1 }),
        createMockAdapter({ loadSessions: load2 }),
      ]);

      await composite.loadSessions({ projectPath: '/my/project' });
      expect(load1).toHaveBeenCalledWith({ projectPath: '/my/project' });
      expect(load2).toHaveBeenCalledWith({ projectPath: '/my/project' });
    });
  });

  describe('session routing', () => {
    it('routes loadSessionTasks to the correct adapter', async () => {
      const task = createTask({ id: 'task-1' });
      const claudeAdapter = createMockAdapter({
        loadSessions: async () => [
          createSession({ id: 'c-1', backendId: 'claude' }),
        ],
        loadSessionTasks: async () => [task],
      });
      const ocAdapter = createMockAdapter({
        loadSessions: async () => [
          createSession({ id: 'o-1', backendId: 'opencode' }),
        ],
        loadSessionTasks: async () => [],
      });

      const composite = new CompositeBackendAdapter([claudeAdapter, ocAdapter]);
      await composite.loadSessions();

      const tasks = await composite.loadSessionTasks('c-1');
      expect(tasks).toEqual([task]);

      const ocTasks = await composite.loadSessionTasks('o-1');
      expect(ocTasks).toEqual([]);
    });

    it('routes loadActivity to the correct adapter', async () => {
      const activity = [{ id: 'act-1' }] as any;
      const composite = new CompositeBackendAdapter([
        createMockAdapter({
          loadSessions: async () => [createSession({ id: 's-1' })],
          loadActivity: async () => activity,
        }),
      ]);
      await composite.loadSessions();

      expect(await composite.loadActivity('s-1')).toEqual(activity);
    });

    it('routes loadTimeline to the correct adapter', async () => {
      const timeline = [{ timestamp: '2026-01-01' }] as any;
      const composite = new CompositeBackendAdapter([
        createMockAdapter({
          loadSessions: async () => [createSession({ id: 's-1' })],
          loadTimeline: async () => timeline,
        }),
      ]);
      await composite.loadSessions();

      expect(await composite.loadTimeline('s-1')).toEqual(timeline);
    });

    it('returns empty for unknown session id', async () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ loadSessions: async () => [] }),
      ]);
      await composite.loadSessions();

      expect(await composite.loadSessionTasks('unknown')).toEqual([]);
      expect(await composite.loadActivity('unknown')).toEqual([]);
      expect(await composite.loadTimeline('unknown')).toEqual([]);
    });

    it('falls back to trying all adapters for tasks when session not in route map', async () => {
      const task = createTask({ id: 'fallback-task' });
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ loadSessionTasks: async () => [] }),
        createMockAdapter({ loadSessionTasks: async () => [task] }),
      ]);

      // Don't call loadSessions — route map is empty
      const tasks = await composite.loadSessionTasks('unmapped');
      expect(tasks).toEqual([task]);
    });
  });

  describe('checkCacheState', () => {
    it('returns stale if any adapter is stale', async () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ checkCacheState: async () => ({ isStale: false }) }),
        createMockAdapter({ checkCacheState: async () => ({ isStale: true }) }),
      ]);
      expect(await composite.checkCacheState()).toEqual({ isStale: true });
    });

    it('returns not stale if all fresh', async () => {
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ checkCacheState: async () => ({ isStale: false }) }),
        createMockAdapter({ checkCacheState: async () => ({ isStale: false }) }),
      ]);
      expect(await composite.checkCacheState()).toEqual({ isStale: false });
    });
  });

  describe('invalidateCache and dispose', () => {
    it('calls invalidateCache on all adapters', () => {
      const inv1 = vi.fn();
      const inv2 = vi.fn();
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ invalidateCache: inv1 }),
        createMockAdapter({ invalidateCache: inv2 }),
      ]);
      composite.invalidateCache();
      expect(inv1).toHaveBeenCalled();
      expect(inv2).toHaveBeenCalled();
    });

    it('calls dispose on all adapters', async () => {
      const disp1 = vi.fn(async () => {});
      const disp2 = vi.fn(async () => {});
      const composite = new CompositeBackendAdapter([
        createMockAdapter({ dispose: disp1 }),
        createMockAdapter({ dispose: disp2 }),
      ]);
      await composite.dispose();
      expect(disp1).toHaveBeenCalled();
      expect(disp2).toHaveBeenCalled();
    });
  });
});
