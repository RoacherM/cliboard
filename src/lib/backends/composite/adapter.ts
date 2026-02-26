import type { Session, Task, ActivityEntry, TaskSnapshot } from '../../types.js';
import type { BackendAdapter, BackendCapabilities, BackendId } from '../types.js';

/**
 * Wraps multiple BackendAdapters into a single adapter that merges sessions
 * from all backends, routes detail queries to the correct backend, and
 * degrades gracefully when one backend fails.
 */
export class CompositeBackendAdapter implements BackendAdapter {
  readonly id: BackendId;
  readonly displayName: string;
  readonly capabilities: BackendCapabilities;

  private adapters: BackendAdapter[];
  private sessionRouteMap = new Map<string, BackendAdapter>();

  constructor(adapters: BackendAdapter[]) {
    if (adapters.length === 0) {
      throw new Error('CompositeBackendAdapter requires at least one adapter');
    }

    this.adapters = adapters;
    this.id = adapters[0]!.id;
    this.displayName = adapters.map((a) => a.displayName).join(' + ');
    this.capabilities = {
      tasks: adapters.some((a) => a.capabilities.tasks),
      timeline: adapters.some((a) => a.capabilities.timeline),
      activity: adapters.some((a) => a.capabilities.activity),
      liveness: adapters.some((a) => a.capabilities.liveness),
      gitBranch: adapters.some((a) => a.capabilities.gitBranch),
      subagents: adapters.some((a) => a.capabilities.subagents),
    };
  }

  async initialize(): Promise<boolean> {
    const results = await Promise.allSettled(
      this.adapters.map((a) => a.initialize()),
    );
    return results.some(
      (r) => r.status === 'fulfilled' && r.value === true,
    );
  }

  async loadSessions(options?: { projectPath?: string }): Promise<Session[]> {
    const results = await Promise.allSettled(
      this.adapters.map((a) => a.loadSessions(options)),
    );

    const merged: Session[] = [];
    this.sessionRouteMap.clear();

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === 'fulfilled') {
        for (const session of result.value) {
          merged.push(session);
          this.sessionRouteMap.set(session.id, this.adapters[i]!);
        }
      }
    }

    merged.sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
    );

    return merged;
  }

  async loadSessionTasks(sessionId: string): Promise<Task[]> {
    const adapter = this.sessionRouteMap.get(sessionId);
    if (adapter) return adapter.loadSessionTasks(sessionId);

    // Fallback: try all adapters
    for (const a of this.adapters) {
      const tasks = await a.loadSessionTasks(sessionId);
      if (tasks.length > 0) return tasks;
    }
    return [];
  }

  async loadActivity(sessionId: string): Promise<ActivityEntry[]> {
    const adapter = this.sessionRouteMap.get(sessionId);
    if (adapter) return adapter.loadActivity(sessionId);
    return [];
  }

  async loadTimeline(sessionId: string): Promise<TaskSnapshot[]> {
    const adapter = this.sessionRouteMap.get(sessionId);
    if (adapter) return adapter.loadTimeline(sessionId);
    return [];
  }

  async checkCacheState(): Promise<{ isStale: boolean }> {
    const results = await Promise.allSettled(
      this.adapters.map((a) => a.checkCacheState()),
    );
    const isStale = results.some(
      (r) => r.status === 'fulfilled' && r.value.isStale,
    );
    return { isStale };
  }

  invalidateCache(): void {
    for (const a of this.adapters) {
      a.invalidateCache();
    }
  }

  async dispose(): Promise<void> {
    await Promise.allSettled(this.adapters.map((a) => a.dispose()));
  }
}
