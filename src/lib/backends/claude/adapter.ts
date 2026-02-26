import fs from 'node:fs/promises';
import type { BackendAdapter, BackendCapabilities, BackendId } from '../types.js';
import type { Session, Task, ActivityEntry, TaskSnapshot, SessionMetadata } from '../../types.js';
import { MetadataService, encodeProjectKey } from '../../metadataService.js';
import { TaskDataService } from '../../taskDataService.js';
import { parseActivity } from '../../activityService.js';
import { TimelineService, replayCurrentTasks } from '../../timelineService.js';
import { ARCHIVE_THRESHOLD_DAYS, SESSION_LIVENESS_MS } from '../../constants.js';

export class ClaudeBackendAdapter implements BackendAdapter {
  readonly id: BackendId = 'claude';
  readonly displayName = 'Claude Code';
  readonly capabilities: BackendCapabilities = {
    tasks: true,
    timeline: true,
    activity: true,
    liveness: true,
    gitBranch: true,
    subagents: true,
  };

  private claudeDir: string;
  private metadataService: MetadataService;
  private taskDataService: TaskDataService;
  private timelineService: TimelineService;

  /** Cached session list for resolving jsonlPath by session ID */
  private sessionCache: Session[] = [];

  constructor(claudeDir: string) {
    this.claudeDir = claudeDir;
    this.metadataService = new MetadataService(claudeDir);
    this.taskDataService = new TaskDataService(claudeDir);
    this.timelineService = new TimelineService();
  }

  async initialize(): Promise<boolean> {
    try {
      await fs.access(this.claudeDir);
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    // No resources to release
  }

  async loadSessions(options?: { projectPath?: string }): Promise<Session[]> {
    const projectKey = options?.projectPath ? encodeProjectKey(options.projectPath) : undefined;
    const metadataMap: Map<string, SessionMetadata> = await this.metadataService.loadAllMetadata(projectKey);

    const resolved: Session[] = [];

    for (const [sessionId, metadata] of metadataMap.entries()) {
      let tasks: Task[] = await this.taskDataService.readSessionTasks(sessionId);
      if (tasks.length === 0 && metadata.jsonlPath) {
        tasks = await replayCurrentTasks(metadata.jsonlPath);
      }

      const name = this.metadataService.resolveSessionName(sessionId, metadata);
      const taskCount = tasks.length;

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

      let isLive = false;
      if (metadata.jsonlPath) {
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
        backendId: 'claude',
        dataRef: metadata?.jsonlPath ?? undefined,
      });
    }

    resolved.sort(
      (a, b) =>
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
    );

    this.sessionCache = resolved;
    return resolved;
  }

  async loadSessionTasks(sessionId: string): Promise<Task[]> {
    let tasks = await this.taskDataService.readSessionTasks(sessionId);
    if (tasks.length === 0) {
      const session = this.sessionCache.find((s) => s.id === sessionId);
      if (session?.jsonlPath) {
        tasks = await replayCurrentTasks(session.jsonlPath);
      }
    }
    return tasks.map((t) => ({ ...t, sessionId }));
  }

  async loadActivity(sessionId: string): Promise<ActivityEntry[]> {
    const session = this.sessionCache.find((s) => s.id === sessionId);
    if (!session?.jsonlPath) return [];
    return parseActivity(session.jsonlPath);
  }

  async loadTimeline(sessionId: string): Promise<TaskSnapshot[]> {
    const session = this.sessionCache.find((s) => s.id === sessionId);
    if (!session?.jsonlPath) return [];
    return this.timelineService.parseSessionTimeline(session.jsonlPath);
  }

  async checkCacheState(): Promise<{ isStale: boolean }> {
    const isStale = await this.metadataService.isCacheStale();
    return { isStale };
  }

  invalidateCache(): void {
    this.metadataService.invalidateCache();
  }
}
