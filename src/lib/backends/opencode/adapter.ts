import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { BackendAdapter, BackendCapabilities, BackendId } from '../types.js';
import type { Session, Task, ActivityEntry, TaskSnapshot, TaskStatus } from '../../types.js';
import { SESSION_LIVENESS_MS } from '../../constants.js';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');

const PRIORITY_MAP: Record<string, number> = { high: 3, medium: 2, low: 1 };

type Database = import('better-sqlite3').Database;

export class OpenCodeBackendAdapter implements BackendAdapter {
  readonly id: BackendId = 'opencode';
  readonly displayName = 'OpenCode';
  readonly capabilities: BackendCapabilities = {
    tasks: true,
    timeline: false,
    activity: true,
    liveness: true,
    gitBranch: false,
    subagents: true,
  };

  private dbPath: string;
  private db: Database | null = null;
  private lastDbMtimeMs = 0;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? DEFAULT_DB_PATH;
  }

  async initialize(): Promise<boolean> {
    try {
      await fs.access(this.dbPath);
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async getDb(): Promise<Database> {
    if (!this.db) {
      let BetterSqlite3: typeof import('better-sqlite3');
      try {
        BetterSqlite3 = (await import('better-sqlite3')).default as any;
      } catch {
        throw new Error(
          'better-sqlite3 is required for OpenCode backend. Install it with: npm install better-sqlite3',
        );
      }
      this.db = new (BetterSqlite3 as any)(this.dbPath, { readonly: true });
    }
    return this.db!;
  }

  async loadSessions(options?: { projectPath?: string }): Promise<Session[]> {
    const db = await this.getDb();

    // Only load sessions that have todos
    let query = `
      SELECT
        s.id, s.title, s.slug, s.directory,
        s.time_created, s.time_updated, s.time_archived,
        s.parent_id,
        p.worktree as project_worktree,
        COUNT(t.position) as todo_count,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM session s
      LEFT JOIN project p ON s.project_id = p.id
      INNER JOIN todo t ON t.session_id = s.id
    `;

    const params: any[] = [];
    if (options?.projectPath) {
      query += ' WHERE (s.directory = ? OR p.worktree = ?)';
      params.push(options.projectPath, options.projectPath);
    }

    // Exclude sub-sessions (child sessions spawned by a parent)
    if (params.length > 0) {
      query += ' AND s.parent_id IS NULL';
    } else {
      query += ' WHERE s.parent_id IS NULL';
    }

    query += ' GROUP BY s.id ORDER BY s.time_updated DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const now = Date.now();

    return rows.map((row) => {
      const modifiedAt = new Date(row.time_updated).toISOString();
      const isLive = now - row.time_updated < SESSION_LIVENESS_MS;
      const isArchived = row.time_archived != null;
      const projectPath = row.directory || row.project_worktree || null;

      return {
        id: row.id,
        name: row.title || row.slug || row.id.substring(0, 12),
        slug: row.slug || null,
        project: projectPath,
        description: null,
        gitBranch: null,
        taskCount: row.todo_count,
        completed: row.completed ?? 0,
        inProgress: row.in_progress ?? 0,
        pending: row.pending ?? 0,
        createdAt: new Date(row.time_created).toISOString(),
        modifiedAt,
        isArchived,
        isLive,
        jsonlPath: null,
        backendId: 'opencode' as const,
        dataRef: row.id,
      };
    });
  }

  async loadSessionTasks(sessionId: string): Promise<Task[]> {
    const db = await this.getDb();

    const rows = db
      .prepare(
        `SELECT content, status, priority, position, time_created, time_updated
         FROM todo WHERE session_id = ? ORDER BY position ASC`,
      )
      .all(sessionId) as any[];

    return rows.map((row, i) => ({
      id: String(i + 1),
      subject: row.content,
      description: '',
      activeForm: '',
      status: row.status as TaskStatus,
      blocks: [],
      blockedBy: [],
      sessionId,
      createdAt: new Date(row.time_created).toISOString(),
      updatedAt: new Date(row.time_updated).toISOString(),
      priority: PRIORITY_MAP[row.priority] ?? 0,
      position: row.position,
    }));
  }

  async loadActivity(sessionId: string): Promise<ActivityEntry[]> {
    const db = await this.getDb();

    const rows = db
      .prepare(
        `SELECT id, data, time_created, time_updated
         FROM part WHERE session_id = ? ORDER BY time_created ASC`,
      )
      .all(sessionId) as any[];

    const entries: ActivityEntry[] = [];

    for (const row of rows) {
      let data: any;
      try {
        data = JSON.parse(row.data);
      } catch {
        continue;
      }

      const partType = data.type;
      if (partType !== 'tool' && partType !== 'subtask') continue;

      const timestamp = new Date(row.time_created).toISOString();
      const state = data.state ?? {};
      const stateTime = state.time ?? {};
      const completedAt = stateTime.end
        ? new Date(stateTime.end).toISOString()
        : null;

      const stateStatus = state.status ?? 'completed';
      const isError = stateStatus === 'error';
      const status: ActivityEntry['status'] = isError
        ? 'error'
        : completedAt
          ? 'completed'
          : 'running';

      if (partType === 'subtask') {
        entries.push({
          id: row.id,
          type: 'subagent',
          timestamp,
          agentId: null,
          subagentType: data.agent ?? 'unknown',
          description: data.description ?? data.command ?? '',
          prompt: truncate(data.prompt ?? '', 200),
          skillName: null,
          skillArgs: null,
          toolName: null,
          status,
          isError,
          completedAt,
          resultSummary: null,
        });
        continue;
      }

      // type === 'tool'
      const toolName = data.tool ?? '';
      const input = state.input ?? {};
      const title = state.title ?? '';
      const activityType = classifyOpenCodeTool(toolName);

      entries.push({
        id: row.id,
        type: activityType,
        timestamp,
        agentId: null,
        subagentType: null,
        description: activityType === 'mcp'
          ? extractMcpName(toolName)
          : activityType === 'skill'
            ? (input.name ?? toolName)
            : (title || toolName),
        prompt: summarizeOpenCodeInput(toolName, input, title),
        skillName: activityType === 'skill' ? (input.name ?? toolName) : null,
        skillArgs: activityType === 'skill' ? (input.args ?? null) : null,
        toolName,
        status,
        isError,
        completedAt,
        resultSummary: truncate(state.output ?? state.metadata?.output ?? '', 200),
      });
    }

    return entries;
  }

  async loadTimeline(_sessionId: string): Promise<TaskSnapshot[]> {
    // Timeline not supported for OpenCode
    return [];
  }

  async checkCacheState(): Promise<{ isStale: boolean }> {
    try {
      const stat = await fs.stat(this.dbPath);
      const isStale = stat.mtimeMs > this.lastDbMtimeMs;
      if (isStale) {
        this.lastDbMtimeMs = stat.mtimeMs;
      }
      return { isStale };
    } catch {
      return { isStale: true };
    }
  }

  invalidateCache(): void {
    // Close and reopen DB to see latest writes
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.lastDbMtimeMs = 0;
  }
}

/** Classify an OpenCode tool name into our activity type taxonomy */
function classifyOpenCodeTool(tool: string): ActivityEntry['type'] {
  if (tool === 'skill') return 'skill';
  // MCP tools typically have underscores separating provider from function
  if (tool.includes('_') && !isBuiltinTool(tool)) return 'mcp';
  return 'tool';
}

const BUILTIN_TOOLS = new Set([
  'read', 'write', 'edit', 'bash', 'glob', 'grep',
  'webfetch', 'websearch', 'question',
  'todowrite', 'todoread',
  'lsp_diagnostics', 'lsp_hover', 'lsp_servers',
]);

function isBuiltinTool(tool: string): boolean {
  return BUILTIN_TOOLS.has(tool.toLowerCase());
}

/** Extract a human-readable name from an MCP-style tool name */
function extractMcpName(tool: string): string {
  // Patterns like "grep_app_searchGitHub" → "grep_app"
  // or "a-share-mcp_get_stock_info" → "a-share-mcp"
  const parts = tool.split('_');
  if (parts.length >= 2) {
    return parts.slice(0, -1).join('_');
  }
  return tool;
}

/** Summarize tool input into a single readable line */
function summarizeOpenCodeInput(tool: string, input: Record<string, any>, title: string): string {
  if (title) return title;

  const lower = tool.toLowerCase();
  if (lower === 'read') return input.filePath ?? input.file_path ?? '';
  if (lower === 'write') return input.filePath ?? input.file_path ?? '';
  if (lower === 'edit') return input.filePath ?? input.file_path ?? '';
  if (lower === 'bash') return input.description ?? truncate(input.command ?? '', 120);
  if (lower === 'glob') return input.pattern ?? '';
  if (lower === 'grep') return input.pattern ?? '';

  const keys = Object.keys(input);
  if (keys.length === 0) return '';
  const key = keys[0];
  const val = input[key];
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  return truncate(`${key}: ${str}`, 120);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
