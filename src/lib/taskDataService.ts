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

export class TaskDataService {
  private claudeDir: string;

  constructor(claudeDir: string) {
    this.claudeDir = claudeDir;
  }

  private get todosDir(): string {
    return path.join(this.claudeDir, TASKS_SUBDIR);
  }

  async listSessions(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.todosDir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }

    const sessionIds = new Set<string>();
    for (const name of entries) {
      const match = TODO_FILE_RE.exec(name);
      if (match) {
        sessionIds.add(match[1]);
      }
    }

    return [...sessionIds];
  }

  async readSessionTasks(sessionId: string): Promise<Task[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.todosDir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw err;
    }

    // Find all files for this session, pick the newest by mtime
    const sessionFiles: string[] = [];
    for (const name of entries) {
      const match = TODO_FILE_RE.exec(name);
      if (match && match[1] === sessionId) {
        sessionFiles.push(name);
      }
    }

    if (sessionFiles.length === 0) {
      return [];
    }

    // Pick the file with the latest mtime
    let newestFile = sessionFiles[0];
    let newestMtime = 0;
    for (const name of sessionFiles) {
      try {
        const stat = await fs.stat(path.join(this.todosDir, name));
        if (stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs;
          newestFile = name;
        }
      } catch {
        continue;
      }
    }

    const filePath = path.join(this.todosDir, newestFile);

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
