import fs from 'node:fs/promises';
import type { Task, TaskSnapshot } from './types.js';

type TodoItem = { content: string; status: string; activeForm?: string };

interface RawSnapshot {
  timestamp: string | null;
  todos: TodoItem[];
}

/**
 * Parse jsonl rows into an array of assistant tool_use blocks with timestamps.
 * Shared by both timeline and task-replay logic.
 */
function parseJsonlRows(content: string): Array<{ row: any; block: any; timestamp: string | null }> {
  const results: Array<{ row: any; block: any; timestamp: string | null }> = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let row: any;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (
      row.type === 'assistant' &&
      row.message?.content &&
      Array.isArray(row.message.content)
    ) {
      for (const block of row.message.content) {
        if (block?.type === 'tool_use') {
          results.push({ row, block, timestamp: row.timestamp ?? null });
        }
      }
    }

    // Also capture toolUseResult.newTodos (legacy format)
    if (
      row.toolUseResult &&
      Array.isArray(row.toolUseResult.newTodos) &&
      row.toolUseResult.newTodos.length > 0
    ) {
      results.push({
        row,
        block: { name: '__toolUseResult__', input: { todos: row.toolUseResult.newTodos } },
        timestamp: row.timestamp ?? null,
      });
    }
  }

  return results;
}

/**
 * Replay TaskCreate/TaskUpdate events from parsed tool_use blocks.
 * Returns a snapshot after each mutation.
 */
function replayTaskEvents(
  entries: Array<{ block: any; timestamp: string | null }>,
): RawSnapshot[] {
  const taskMap = new Map<string, TodoItem>();
  let nextId = 1;
  const snapshots: RawSnapshot[] = [];

  for (const { block, timestamp } of entries) {
    const name: string = block.name;
    const input = block.input ?? {};

    if (name === 'TaskCreate') {
      const id = String(nextId++);
      taskMap.set(id, {
        content: input.subject ?? '',
        status: 'pending',
        ...(input.activeForm ? { activeForm: input.activeForm } : {}),
      });
      snapshots.push({ timestamp, todos: [...taskMap.values()] });
    } else if (name === 'TaskUpdate' && input.taskId) {
      const existing = taskMap.get(input.taskId);
      if (existing) {
        if (input.status) existing.status = input.status;
        if (input.subject) existing.content = input.subject;
        if (input.activeForm) existing.activeForm = input.activeForm;
        snapshots.push({ timestamp, todos: [...taskMap.values()] });
      }
    }
  }

  return snapshots;
}

export class TimelineService {
  private cache = new Map<string, { mtimeMs: number; data: TaskSnapshot[] }>();

  async parseSessionTimeline(jsonlPath: string): Promise<TaskSnapshot[]> {
    // Mtime-based cache: skip re-parse if file hasn't changed
    try {
      const stat = await fs.stat(jsonlPath);
      const cached = this.cache.get(jsonlPath);
      if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;
    } catch {
      return [];
    }

    let content: string;
    try {
      content = await fs.readFile(jsonlPath, 'utf-8');
    } catch {
      return [];
    }

    const entries = parseJsonlRows(content);
    const raw: RawSnapshot[] = [];

    // Collect TodoWrite / toolUseResult snapshots (legacy full-snapshot format)
    for (const { block, timestamp } of entries) {
      if (
        (block.name === 'TodoWrite' || block.name === '__toolUseResult__') &&
        Array.isArray(block.input?.todos)
      ) {
        raw.push({
          timestamp,
          todos: block.input.todos.map(normalizeTodo),
        });
      }
    }

    // Collect TaskCreate/TaskUpdate snapshots (incremental format)
    const taskSnapshots = replayTaskEvents(entries);
    raw.push(...taskSnapshots);

    // Sort by timestamp so mixed sources appear in chronological order
    raw.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return -1;
      if (!b.timestamp) return 1;
      return a.timestamp.localeCompare(b.timestamp);
    });

    // Deduplicate consecutive identical snapshots
    const deduped = dedupe(raw);

    const snapshots = deduped.map((entry) => ({
      timestamp: entry.timestamp,
      todos: entry.todos,
      summary: computeSummary(entry.todos),
    }));

    // Cache result keyed by mtime
    try {
      const stat = await fs.stat(jsonlPath);
      this.cache.set(jsonlPath, { mtimeMs: stat.mtimeMs, data: snapshots });
    } catch { /* skip cache */ }

    return snapshots;
  }
}

/**
 * Replay all TaskCreate/TaskUpdate events from a jsonl file to get current task state.
 * Falls back to empty array on any error.
 */
export async function replayCurrentTasks(jsonlPath: string): Promise<Task[]> {
  let content: string;
  try {
    content = await fs.readFile(jsonlPath, 'utf-8');
  } catch {
    return [];
  }

  const entries = parseJsonlRows(content);
  const taskMap = new Map<string, Task>();
  let nextId = 1;

  for (const { block, timestamp } of entries) {
    const name: string = block.name;
    const input = block.input ?? {};

    if (name === 'TodoWrite' && Array.isArray(input.todos)) {
      // Legacy format: full replacement
      taskMap.clear();
      for (let i = 0; i < input.todos.length; i++) {
        const todo = input.todos[i];
        taskMap.set(String(i + 1), {
          id: String(i + 1),
          subject: typeof todo.content === 'string' ? todo.content : '',
          description: '',
          activeForm: typeof todo.activeForm === 'string' ? todo.activeForm : '',
          status: todo.status ?? 'pending',
          blocks: [],
          blockedBy: [],
          updatedAt: timestamp ?? undefined,
        });
      }
      nextId = input.todos.length + 1;
    } else if (name === '__toolUseResult__' && Array.isArray(input.todos)) {
      // Legacy toolUseResult format
      taskMap.clear();
      for (let i = 0; i < input.todos.length; i++) {
        const todo = input.todos[i];
        taskMap.set(String(i + 1), {
          id: String(i + 1),
          subject: typeof todo.content === 'string' ? todo.content : '',
          description: '',
          activeForm: typeof todo.activeForm === 'string' ? todo.activeForm : '',
          status: todo.status ?? 'pending',
          blocks: [],
          blockedBy: [],
          updatedAt: timestamp ?? undefined,
        });
      }
      nextId = input.todos.length + 1;
    } else if (name === 'TaskCreate') {
      const id = String(nextId++);
      taskMap.set(id, {
        id,
        subject: input.subject ?? '',
        description: input.description ?? '',
        activeForm: input.activeForm ?? '',
        status: 'pending',
        blocks: [],
        blockedBy: [],
        updatedAt: timestamp ?? undefined,
      });
    } else if (name === 'TaskUpdate' && input.taskId) {
      const existing = taskMap.get(input.taskId);
      if (existing) {
        if (input.status) existing.status = input.status;
        if (input.subject) existing.subject = input.subject;
        if (input.description) existing.description = input.description;
        if (input.activeForm) existing.activeForm = input.activeForm;
        existing.updatedAt = timestamp ?? existing.updatedAt;
        if (input.status === 'deleted') {
          taskMap.delete(input.taskId);
        }
      }
    }
  }

  return [...taskMap.values()];
}

function normalizeTodo(todo: any): TodoItem {
  return {
    content: typeof todo.content === 'string' ? todo.content : '',
    status: typeof todo.status === 'string' ? todo.status : '',
    ...(typeof todo.activeForm === 'string'
      ? { activeForm: todo.activeForm }
      : {}),
  };
}

function todosFingerprint(todos: TodoItem[]): string {
  return JSON.stringify(
    todos.map((t) => ({
      content: t.content,
      status: t.status,
      activeForm: t.activeForm,
    })),
  );
}

function dedupe(entries: RawSnapshot[]) {
  const result: RawSnapshot[] = [];
  let prevFp: string | null = null;
  for (const entry of entries) {
    const fp = todosFingerprint(entry.todos);
    if (fp === prevFp) continue;
    prevFp = fp;
    result.push(entry);
  }
  return result;
}

function computeSummary(todos: Array<{ content: string; status: string }>) {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  for (const t of todos) {
    if (t.status === 'completed') completed++;
    else if (t.status === 'in_progress') inProgress++;
    else pending++;
  }
  const total = todos.length;
  return {
    total,
    completed,
    inProgress,
    pending,
    progressPct: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
