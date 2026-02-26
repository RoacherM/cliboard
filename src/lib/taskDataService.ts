import fs from 'node:fs/promises';
import path from 'node:path';
import { TASKS_SUBDIR } from './constants.js';
import type { Task } from './types.js';

// Matches: {uuid}-agent-{uuid}.json
const TODO_FILE_RE = /^([0-9a-f-]{36})-agent-[0-9a-f-]{36}\.json$/;

interface TodoEntry {
  content: string;
  status: string;
  activeForm?: string;
}

interface SessionFileInfo {
  fileName: string;
  mtimeMs: number;
}

export class TaskDataService {
  private claudeDir: string;

  constructor(claudeDir: string) {
    this.claudeDir = claudeDir;
  }

  private get todosDir(): string {
    return path.join(this.claudeDir, TASKS_SUBDIR);
  }

  private async getLatestSessionFiles(): Promise<Map<string, SessionFileInfo>> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.todosDir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return new Map();
      }
      throw err;
    }

    const matched = entries
      .map((fileName) => {
        const match = TODO_FILE_RE.exec(fileName);
        if (!match) {
          return null;
        }

        return { fileName, sessionId: match[1] };
      })
      .filter((entry): entry is { fileName: string; sessionId: string } => Boolean(entry));

    const fileStats = await Promise.all(
      matched.map(async (entry) => {
        try {
          const stat = await fs.stat(path.join(this.todosDir, entry.fileName));
          return { ...entry, mtimeMs: stat.mtimeMs };
        } catch {
          return null;
        }
      }),
    );

    const latestBySession = new Map<string, SessionFileInfo>();
    for (const statEntry of fileStats) {
      if (!statEntry) continue;

      const existing = latestBySession.get(statEntry.sessionId);
      if (!existing || statEntry.mtimeMs > existing.mtimeMs) {
        latestBySession.set(statEntry.sessionId, {
          fileName: statEntry.fileName,
          mtimeMs: statEntry.mtimeMs,
        });
      }
    }

    return latestBySession;
  }

  private async readTasksFromFile(filePath: string): Promise<Task[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        return [];
      }

      const stat = await fs.stat(filePath);
      const mtime = stat.mtime.toISOString();

      const tasks: Task[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const entry = parsed[i] as TodoEntry;
        if (!entry.content || !entry.status) {
          continue;
        }

        tasks.push({
          id: String(i + 1),
          subject: entry.content,
          description: '',
          activeForm: entry.activeForm ?? '',
          status: entry.status as Task['status'],
          blocks: [],
          blockedBy: [],
          createdAt: mtime,
          updatedAt: mtime,
        });
      }

      return tasks;
    } catch {
      return [];
    }
  }

  async listSessions(): Promise<string[]> {
    const latestBySession = await this.getLatestSessionFiles();
    return [...latestBySession.keys()];
  }

  async readSessionTasks(sessionId: string): Promise<Task[]> {
    const latestBySession = await this.getLatestSessionFiles();
    const fileInfo = latestBySession.get(sessionId);
    if (!fileInfo) {
      return [];
    }

    return this.readTasksFromFile(path.join(this.todosDir, fileInfo.fileName));
  }

  async readSessionsTasks(sessionIds: string[]): Promise<Map<string, Task[]>> {
    const latestBySession = await this.getLatestSessionFiles();
    const uniqueSessionIds = [...new Set(sessionIds)];

    const taskEntries = await Promise.all(
      uniqueSessionIds.map(async (sessionId) => {
        const fileInfo = latestBySession.get(sessionId);
        if (!fileInfo) {
          return [sessionId, []] as const;
        }

        const tasks = await this.readTasksFromFile(path.join(this.todosDir, fileInfo.fileName));
        return [sessionId, tasks] as const;
      }),
    );

    return new Map(taskEntries);
  }

  async readAllTasks(): Promise<Task[]> {
    const sessionIds = await this.listSessions();
    const allTasks: Task[] = [];

    for (const sessionId of sessionIds) {
      const tasks = await this.readSessionTasks(sessionId);
      for (const task of tasks) {
        task.sessionId = sessionId;
      }
      allTasks.push(...tasks);
    }

    return allTasks;
  }

  async addNote(_sessionId: string, _taskId: string, _note: string): Promise<void> {
    throw new Error('addNote is not supported for todos format (read-only)');
  }

  async deleteTask(_sessionId: string, _taskId: string): Promise<void> {
    throw new Error('deleteTask is not supported for todos format (read-only)');
  }
}
