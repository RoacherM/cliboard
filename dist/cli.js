#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/constants.ts
import os from "node:os";
import path from "node:path";
var DEFAULT_CLAUDE_DIR, TASKS_SUBDIR, PROJECTS_SUBDIR, METADATA_CACHE_TTL, ARCHIVE_THRESHOLD_DAYS, JSONL_READ_LIMIT, AUTO_REFRESH_MS, SESSION_LIVENESS_MS;
var init_constants = __esm({
  "src/lib/constants.ts"() {
    "use strict";
    DEFAULT_CLAUDE_DIR = path.join(os.homedir(), ".claude");
    TASKS_SUBDIR = "todos";
    PROJECTS_SUBDIR = "projects";
    METADATA_CACHE_TTL = 3e4;
    ARCHIVE_THRESHOLD_DAYS = 7;
    JSONL_READ_LIMIT = 65536;
    AUTO_REFRESH_MS = 2e3;
    SESSION_LIVENESS_MS = 5 * 6e4;
  }
});

// src/lib/backends/opencode/adapter.ts
var adapter_exports = {};
__export(adapter_exports, {
  OpenCodeBackendAdapter: () => OpenCodeBackendAdapter
});
import fs6 from "node:fs/promises";
import os2 from "node:os";
import path4 from "node:path";
function classifyOpenCodeTool(tool) {
  if (tool === "skill")
    return "skill";
  if (tool.includes("_") && !isBuiltinTool(tool))
    return "mcp";
  return "tool";
}
function isBuiltinTool(tool) {
  return BUILTIN_TOOLS.has(tool.toLowerCase());
}
function extractMcpName(tool) {
  const parts = tool.split("_");
  if (parts.length >= 2) {
    return parts.slice(0, -1).join("_");
  }
  return tool;
}
function summarizeOpenCodeInput(tool, input, title) {
  if (title)
    return title;
  const lower = tool.toLowerCase();
  if (lower === "read")
    return input.filePath ?? input.file_path ?? "";
  if (lower === "write")
    return input.filePath ?? input.file_path ?? "";
  if (lower === "edit")
    return input.filePath ?? input.file_path ?? "";
  if (lower === "bash")
    return input.description ?? truncate(input.command ?? "", 120);
  if (lower === "glob")
    return input.pattern ?? "";
  if (lower === "grep")
    return input.pattern ?? "";
  const keys = Object.keys(input);
  if (keys.length === 0)
    return "";
  const key = keys[0];
  const val = input[key];
  const str = typeof val === "string" ? val : JSON.stringify(val);
  return truncate(`${key}: ${str}`, 120);
}
function truncate(s, max) {
  if (s.length <= max)
    return s;
  return s.slice(0, max - 1) + "\u2026";
}
var DEFAULT_DB_PATH, PRIORITY_MAP, OpenCodeBackendAdapter, BUILTIN_TOOLS;
var init_adapter = __esm({
  "src/lib/backends/opencode/adapter.ts"() {
    "use strict";
    init_constants();
    DEFAULT_DB_PATH = path4.join(os2.homedir(), ".local", "share", "opencode", "opencode.db");
    PRIORITY_MAP = { high: 3, medium: 2, low: 1 };
    OpenCodeBackendAdapter = class {
      id = "opencode";
      displayName = "OpenCode";
      capabilities = {
        tasks: true,
        timeline: false,
        activity: true,
        liveness: true,
        gitBranch: false,
        subagents: true
      };
      dbPath;
      db = null;
      lastDbMtimeMs = 0;
      constructor(dbPath) {
        this.dbPath = dbPath ?? DEFAULT_DB_PATH;
      }
      async initialize() {
        try {
          await fs6.access(this.dbPath);
          return true;
        } catch {
          return false;
        }
      }
      async dispose() {
        if (this.db) {
          this.db.close();
          this.db = null;
        }
      }
      async getDb() {
        if (!this.db) {
          let BetterSqlite3;
          try {
            BetterSqlite3 = (await import("better-sqlite3")).default;
          } catch {
            throw new Error(
              "better-sqlite3 is required for OpenCode backend. Install it with: npm install better-sqlite3"
            );
          }
          this.db = new BetterSqlite3(this.dbPath, { readonly: true });
        }
        return this.db;
      }
      async loadSessions(options) {
        const db = await this.getDb();
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
        const params = [];
        if (options?.projectPath) {
          query += " WHERE (s.directory = ? OR p.worktree = ?)";
          params.push(options.projectPath, options.projectPath);
        }
        if (params.length > 0) {
          query += " AND s.parent_id IS NULL";
        } else {
          query += " WHERE s.parent_id IS NULL";
        }
        query += " GROUP BY s.id ORDER BY s.time_updated DESC";
        const rows = db.prepare(query).all(...params);
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
            backendId: "opencode",
            dataRef: row.id
          };
        });
      }
      async loadSessionTasks(sessionId) {
        const db = await this.getDb();
        const rows = db.prepare(
          `SELECT content, status, priority, position, time_created, time_updated
         FROM todo WHERE session_id = ? ORDER BY position ASC`
        ).all(sessionId);
        return rows.map((row, i) => ({
          id: String(i + 1),
          subject: row.content,
          description: "",
          activeForm: "",
          status: row.status,
          blocks: [],
          blockedBy: [],
          sessionId,
          createdAt: new Date(row.time_created).toISOString(),
          updatedAt: new Date(row.time_updated).toISOString(),
          priority: PRIORITY_MAP[row.priority] ?? 0,
          position: row.position
        }));
      }
      async loadActivity(sessionId) {
        const db = await this.getDb();
        const rows = db.prepare(
          `SELECT id, data, time_created, time_updated
         FROM part WHERE session_id = ? ORDER BY time_created ASC`
        ).all(sessionId);
        const entries = [];
        for (const row of rows) {
          let data;
          try {
            data = JSON.parse(row.data);
          } catch {
            continue;
          }
          const partType = data.type;
          if (partType !== "tool" && partType !== "subtask")
            continue;
          const timestamp = new Date(row.time_created).toISOString();
          const state = data.state ?? {};
          const stateTime = state.time ?? {};
          const completedAt = stateTime.end ? new Date(stateTime.end).toISOString() : null;
          const stateStatus = state.status ?? "completed";
          const isError = stateStatus === "error";
          const status = isError ? "error" : completedAt ? "completed" : "running";
          if (partType === "subtask") {
            entries.push({
              id: row.id,
              type: "subagent",
              timestamp,
              agentId: null,
              subagentType: data.agent ?? "unknown",
              description: data.description ?? data.command ?? "",
              prompt: truncate(data.prompt ?? "", 200),
              skillName: null,
              skillArgs: null,
              toolName: null,
              status,
              isError,
              completedAt,
              resultSummary: null
            });
            continue;
          }
          const toolName = data.tool ?? "";
          const input = state.input ?? {};
          const title = state.title ?? "";
          const activityType = classifyOpenCodeTool(toolName);
          entries.push({
            id: row.id,
            type: activityType,
            timestamp,
            agentId: null,
            subagentType: null,
            description: activityType === "mcp" ? extractMcpName(toolName) : activityType === "skill" ? input.name ?? toolName : title || toolName,
            prompt: summarizeOpenCodeInput(toolName, input, title),
            skillName: activityType === "skill" ? input.name ?? toolName : null,
            skillArgs: activityType === "skill" ? input.args ?? null : null,
            toolName,
            status,
            isError,
            completedAt,
            resultSummary: truncate(state.output ?? state.metadata?.output ?? "", 200)
          });
        }
        return entries;
      }
      async loadTimeline(_sessionId) {
        return [];
      }
      async checkCacheState() {
        try {
          const stat = await fs6.stat(this.dbPath);
          const isStale = stat.mtimeMs > this.lastDbMtimeMs;
          if (isStale) {
            this.lastDbMtimeMs = stat.mtimeMs;
          }
          return { isStale };
        } catch {
          return { isStale: true };
        }
      }
      invalidateCache() {
        if (this.db) {
          this.db.close();
          this.db = null;
        }
        this.lastDbMtimeMs = 0;
      }
    };
    BUILTIN_TOOLS = /* @__PURE__ */ new Set([
      "read",
      "write",
      "edit",
      "bash",
      "glob",
      "grep",
      "webfetch",
      "websearch",
      "question",
      "todowrite",
      "todoread",
      "lsp_diagnostics",
      "lsp_hover",
      "lsp_servers"
    ]);
  }
});

// src/cli.tsx
import { Command as Command4 } from "commander";
import os4 from "node:os";
import path8 from "node:path";
import React7 from "react";
import { render } from "ink";

// src/commands/list.tsx
import { Command } from "commander";

// src/lib/backends/detect.ts
import fs7 from "node:fs/promises";
import os3 from "node:os";
import path5 from "node:path";

// src/lib/backends/claude/adapter.ts
import fs5 from "node:fs/promises";

// src/lib/metadataService.ts
init_constants();
import fs from "node:fs/promises";
import path2 from "node:path";
var METADATA_CACHE_TTL2 = METADATA_CACHE_TTL;
var JSONL_READ_LIMIT2 = JSONL_READ_LIMIT;
function encodeProjectKey(cwd) {
  return cwd.replace(/\//g, "-");
}
var MetadataService = class {
  claudeDir;
  cache = /* @__PURE__ */ new Map();
  lastProjectsDirMtime = 0;
  constructor(claudeDir) {
    this.claudeDir = claudeDir;
  }
  async loadAllMetadata(projectKey) {
    const cacheKey = projectKey ?? "__all__";
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL2) {
      return cached.data;
    }
    const result = /* @__PURE__ */ new Map();
    const projectsDir = path2.join(this.claudeDir, PROJECTS_SUBDIR);
    let projectDirEntries;
    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true });
      projectDirEntries = entries.filter((e) => e.isDirectory()).map((e) => ({ fullPath: path2.join(projectsDir, e.name), dirName: e.name }));
    } catch {
      projectDirEntries = [];
    }
    for (const { fullPath: projectDir, dirName: projectDirName } of projectDirEntries) {
      if (projectKey && projectDirName !== projectKey)
        continue;
      const indexEntries = await this.loadSessionsIndex(projectDir);
      const indexMap = /* @__PURE__ */ new Map();
      for (const entry of indexEntries) {
        indexMap.set(entry.id, entry);
      }
      let files;
      try {
        const dirEntries = await fs.readdir(projectDir);
        files = dirEntries.filter((f) => f.endsWith(".jsonl"));
      } catch {
        files = [];
      }
      for (const file of files) {
        const sessionId = path2.basename(file, ".jsonl");
        const jsonlPath = path2.join(projectDir, file);
        const jsonlInfo = await this.readSessionInfoFromJsonl(jsonlPath);
        const indexEntry = indexMap.get(sessionId);
        const metadata = {
          customTitle: jsonlInfo.customTitle ?? null,
          slug: jsonlInfo.slug ?? indexEntry?.slug ?? null,
          project: jsonlInfo.project ?? indexEntry?.project ?? null,
          projectDir: projectDirName,
          jsonlPath,
          description: indexEntry?.description ?? null,
          gitBranch: jsonlInfo.gitBranch ?? indexEntry?.gitBranch ?? null,
          created: indexEntry?.created ?? null,
          summary: indexEntry?.summary ?? null
        };
        result.set(sessionId, metadata);
      }
    }
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    try {
      const stat = await fs.stat(path2.join(this.claudeDir, PROJECTS_SUBDIR));
      this.lastProjectsDirMtime = stat.mtimeMs;
    } catch {
    }
    return result;
  }
  resolveSessionName(sessionId, metadata) {
    if (metadata?.customTitle) {
      return metadata.customTitle;
    }
    if (metadata?.slug) {
      return metadata.slug;
    }
    return sessionId.substring(0, 8) + "...";
  }
  async readSessionInfoFromJsonl(jsonlPath) {
    const result = {};
    let content;
    try {
      const fileHandle = await fs.open(jsonlPath, "r");
      try {
        const buffer = Buffer.alloc(JSONL_READ_LIMIT2);
        const { bytesRead } = await fileHandle.read(buffer, 0, JSONL_READ_LIMIT2, 0);
        content = buffer.toString("utf-8", 0, bytesRead);
      } finally {
        await fileHandle.close();
      }
    } catch {
      return result;
    }
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed)
        continue;
      let entry;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (entry.type === "custom-title" && entry.customTitle) {
        result.customTitle = entry.customTitle;
      }
      if (entry.slug) {
        result.slug = entry.slug;
      }
      if (entry.cwd) {
        result.project = entry.cwd;
      }
      if (entry.gitBranch) {
        result.gitBranch = entry.gitBranch;
      }
    }
    return result;
  }
  async loadSessionsIndex(projectDir) {
    const indexPath = path2.join(projectDir, "sessions-index.json");
    try {
      const raw = await fs.readFile(indexPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.sessions)) {
        return [];
      }
      return parsed.sessions;
    } catch {
      return [];
    }
  }
  async isCacheStale() {
    if (this.cache.size === 0)
      return true;
    for (const entry of this.cache.values()) {
      if (Date.now() - entry.timestamp >= METADATA_CACHE_TTL2)
        return true;
    }
    try {
      const projectsDir = path2.join(this.claudeDir, PROJECTS_SUBDIR);
      const stat = await fs.stat(projectsDir);
      return stat.mtimeMs > this.lastProjectsDirMtime;
    } catch {
      return true;
    }
  }
  invalidateCache() {
    this.cache.clear();
  }
};

// src/lib/taskDataService.ts
init_constants();
import fs2 from "node:fs/promises";
import path3 from "node:path";
var TODO_FILE_RE = /^([0-9a-f-]{36})-agent-[0-9a-f-]{36}\.json$/;
var TaskDataService = class _TaskDataService {
  claudeDir;
  dirCache = null;
  static DIR_CACHE_TTL = 5e3;
  constructor(claudeDir) {
    this.claudeDir = claudeDir;
  }
  get todosDir() {
    return path3.join(this.claudeDir, TASKS_SUBDIR);
  }
  async getDirEntries() {
    if (this.dirCache && Date.now() - this.dirCache.timestamp < _TaskDataService.DIR_CACHE_TTL) {
      return this.dirCache.entries;
    }
    const entries = await fs2.readdir(this.todosDir);
    this.dirCache = { entries, timestamp: Date.now() };
    return entries;
  }
  async listSessions() {
    let entries;
    try {
      entries = await this.getDirEntries();
    } catch (err) {
      if (err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
    const sessionIds = /* @__PURE__ */ new Set();
    for (const name of entries) {
      const match = TODO_FILE_RE.exec(name);
      if (match) {
        sessionIds.add(match[1]);
      }
    }
    return [...sessionIds];
  }
  async readSessionTasks(sessionId) {
    let entries;
    try {
      entries = await this.getDirEntries();
    } catch (err) {
      if (err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
    const sessionFiles = [];
    for (const name of entries) {
      const match = TODO_FILE_RE.exec(name);
      if (match && match[1] === sessionId) {
        sessionFiles.push(name);
      }
    }
    if (sessionFiles.length === 0) {
      return [];
    }
    let newestFile = sessionFiles[0];
    let newestMtime = 0;
    for (const name of sessionFiles) {
      try {
        const stat = await fs2.stat(path3.join(this.todosDir, name));
        if (stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs;
          newestFile = name;
        }
      } catch {
        continue;
      }
    }
    const filePath = path3.join(this.todosDir, newestFile);
    try {
      const content = await fs2.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        return [];
      }
      const mtime = new Date(newestMtime).toISOString();
      const tasks = [];
      for (let i = 0; i < parsed.length; i++) {
        const entry = parsed[i];
        if (!entry.content || !entry.status) {
          continue;
        }
        tasks.push({
          id: String(i + 1),
          subject: entry.content,
          description: "",
          activeForm: entry.activeForm ?? "",
          status: entry.status,
          blocks: [],
          blockedBy: [],
          createdAt: mtime,
          updatedAt: mtime
        });
      }
      return tasks;
    } catch {
      return [];
    }
  }
  async readAllTasks() {
    const sessionIds = await this.listSessions();
    const allTasks = [];
    for (const sessionId of sessionIds) {
      const tasks = await this.readSessionTasks(sessionId);
      for (const task of tasks) {
        task.sessionId = sessionId;
      }
      allTasks.push(...tasks);
    }
    return allTasks;
  }
  async addNote(_sessionId, _taskId, _note) {
    throw new Error("addNote is not supported for todos format (read-only)");
  }
  async deleteTask(_sessionId, _taskId) {
    throw new Error("deleteTask is not supported for todos format (read-only)");
  }
};

// src/lib/activityService.ts
import fs3 from "node:fs/promises";
function extractResultText(content) {
  if (typeof content === "string")
    return content;
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string")
        return item;
      if (typeof item?.text === "string")
        return item.text;
      return "";
    }).join("\n");
  }
  return "";
}
var activityCache = /* @__PURE__ */ new Map();
async function parseActivity(jsonlPath) {
  try {
    const stat = await fs3.stat(jsonlPath);
    const cached = activityCache.get(jsonlPath);
    if (cached && cached.mtimeMs === stat.mtimeMs)
      return cached.data;
  } catch {
    return [];
  }
  let content;
  try {
    content = await fs3.readFile(jsonlPath, "utf-8");
  } catch {
    return [];
  }
  const spawns = [];
  const results = /* @__PURE__ */ new Map();
  const agentIds = /* @__PURE__ */ new Map();
  const hookDedup = /* @__PURE__ */ new Set();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed)
      continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (row.type === "assistant" && row.message?.content && Array.isArray(row.message.content)) {
      for (const block of row.message.content) {
        if (block?.type !== "tool_use" || !block.id)
          continue;
        const input = block.input ?? {};
        if (block.name === "Task" || block.name === "$AGENT") {
          spawns.push({
            id: block.id,
            type: "subagent",
            timestamp: row.timestamp ?? null,
            subagentType: input.subagent_type ?? input.type ?? "unknown",
            description: input.description ?? "",
            prompt: input.prompt ?? "",
            skillName: null,
            skillArgs: null,
            toolName: null
          });
        } else if (block.name === "Skill") {
          spawns.push({
            id: block.id,
            type: "skill",
            timestamp: row.timestamp ?? null,
            subagentType: null,
            description: input.skill ?? "unknown",
            prompt: input.args ?? "",
            skillName: input.skill ?? null,
            skillArgs: input.args ?? null,
            toolName: null
          });
        } else if (block.name.startsWith("mcp__")) {
          spawns.push({
            id: block.id,
            type: "mcp",
            timestamp: row.timestamp ?? null,
            subagentType: null,
            description: parseMcpPluginName(block.name),
            prompt: summarizeToolInput(block.name, input),
            skillName: null,
            skillArgs: null,
            toolName: block.name
          });
        } else {
          spawns.push({
            id: block.id,
            type: "tool",
            timestamp: row.timestamp ?? null,
            subagentType: null,
            description: block.name,
            prompt: summarizeToolInput(block.name, input),
            skillName: null,
            skillArgs: null,
            toolName: block.name
          });
        }
      }
    }
    if (row.type === "user" && row.message?.content && Array.isArray(row.message.content)) {
      for (const block of row.message.content) {
        if (block?.type === "tool_result" && block.tool_use_id) {
          const text = extractResultText(block.content);
          results.set(block.tool_use_id, {
            timestamp: row.timestamp ?? null,
            content: text,
            isError: block.is_error === true
          });
        }
      }
    }
    if (row.type === "user" && typeof row.message?.content === "string") {
      const content2 = row.message.content;
      const nameMatch = content2.match(/<command-name>\/?(.+?)<\/command-name>/);
      if (nameMatch) {
        const argsMatch = content2.match(/<command-args>([\s\S]*?)<\/command-args>/);
        const rawName = nameMatch[1];
        const displayName = rawName.includes(":") ? rawName.split(":").pop() : rawName;
        spawns.push({
          id: `cmd_${row.timestamp ?? String(Date.now())}`,
          type: "command",
          timestamp: row.timestamp ?? null,
          subagentType: null,
          description: displayName,
          prompt: argsMatch?.[1]?.trim() ?? "",
          skillName: null,
          skillArgs: null,
          toolName: null
        });
      }
    }
    if (row.type === "progress") {
      const data = row.data ?? {};
      if (data.type === "agent_progress" && data.parentToolUseID && data.agentId) {
        agentIds.set(data.parentToolUseID, data.agentId);
      }
      if (data.type === "hook_progress") {
        const event = data.hookEvent ?? "";
        const hasMessage = !!data.statusMessage;
        if (event === "Stop" || event === "SessionStart" || hasMessage) {
          const ts = row.timestamp ?? "";
          const dedupKey = `${data.hookName ?? event}_${ts.slice(0, 19)}`;
          if (!hookDedup.has(dedupKey)) {
            hookDedup.add(dedupKey);
            spawns.push({
              id: `hook_${ts || String(Date.now())}_${spawns.length}`,
              type: "hook",
              timestamp: row.timestamp ?? null,
              subagentType: null,
              description: data.hookName ?? event,
              prompt: data.statusMessage ?? data.command ?? "",
              skillName: null,
              skillArgs: null,
              toolName: null
            });
          }
        }
      }
    }
    if (row.type === "system" && row.subtype === "stop_hook_summary") {
      const errors = row.hookErrors ?? [];
      if (errors.length > 0 || row.preventedContinuation) {
        spawns.push({
          id: `hook_summary_${row.timestamp ?? String(Date.now())}`,
          type: "hook",
          timestamp: row.timestamp ?? null,
          subagentType: null,
          description: "Hook Error",
          prompt: errors.join("; ") || "Hook prevented continuation",
          skillName: null,
          skillArgs: null,
          toolName: null
        });
      }
    }
  }
  const entries = spawns.map((spawn) => {
    const result = results.get(spawn.id);
    const agentId = agentIds.get(spawn.id) ?? null;
    const isError = result?.isError ?? false;
    if (spawn.type === "command" || spawn.type === "hook") {
      return {
        id: spawn.id,
        type: spawn.type,
        timestamp: spawn.timestamp,
        agentId: null,
        subagentType: null,
        description: spawn.description,
        prompt: spawn.prompt,
        skillName: null,
        skillArgs: null,
        toolName: null,
        status: "completed",
        isError: false,
        completedAt: spawn.timestamp,
        resultSummary: null
      };
    }
    let status;
    if (!result) {
      status = "running";
    } else if (isError) {
      status = "error";
    } else {
      status = "completed";
    }
    return {
      id: spawn.id,
      type: spawn.type,
      timestamp: spawn.timestamp,
      agentId,
      subagentType: spawn.subagentType,
      description: spawn.description,
      prompt: spawn.prompt,
      skillName: spawn.skillName,
      skillArgs: spawn.skillArgs,
      toolName: spawn.toolName,
      status,
      isError,
      completedAt: result?.timestamp ?? null,
      resultSummary: result ? result.content.slice(0, 200) : null
    };
  });
  entries.sort((a, b) => {
    if (!a.timestamp)
      return -1;
    if (!b.timestamp)
      return 1;
    return a.timestamp.localeCompare(b.timestamp);
  });
  try {
    const stat = await fs3.stat(jsonlPath);
    activityCache.set(jsonlPath, { mtimeMs: stat.mtimeMs, data: entries });
  } catch {
  }
  return entries;
}
function parseMcpPluginName(name) {
  const match = name.match(/^mcp__plugin_([^_]+)/);
  return match ? match[1] : name;
}
function parseMcpFunctionName(name) {
  const match = name.match(/__([^_]+)$/);
  return match ? match[1] : name;
}
function summarizeToolInput(toolName, input) {
  const baseName = toolName.startsWith("mcp__") ? parseMcpFunctionName(toolName) : toolName;
  switch (baseName) {
    case "Read":
      return input.file_path ?? "";
    case "Write":
      return input.file_path ?? "";
    case "Edit":
      return input.file_path ?? "";
    case "Bash":
      return input.description ?? truncateStr(input.command ?? "", 120);
    case "Glob":
      return input.pattern ?? "";
    case "Grep":
      return input.pattern ?? "";
    case "WebFetch":
      return input.url ?? "";
    case "WebSearch":
      return input.query ?? "";
    case "EnterPlanMode":
      return "Enter plan mode";
    case "ExitPlanMode":
      return "Exit plan mode";
    case "AskUserQuestion": {
      const questions = input.questions;
      if (Array.isArray(questions) && questions.length > 0) {
        return questions[0].question ?? "";
      }
      return "";
    }
    case "TaskCreate":
    case "TaskUpdate":
    case "TaskGet":
      return input.subject ?? input.taskId ?? "";
    case "TaskList":
      return "List tasks";
    case "NotebookEdit":
      return input.notebook_path ?? "";
    case "EnterWorktree":
      return input.name ?? "Create worktree";
    default: {
      const keys = Object.keys(input);
      if (keys.length === 0)
        return "";
      const key = keys[0];
      const val = input[key];
      const str = typeof val === "string" ? val : JSON.stringify(val);
      return truncateStr(`${key}: ${str}`, 120);
    }
  }
}
function truncateStr(s, max) {
  if (s.length <= max)
    return s;
  return s.slice(0, max - 1) + "\u2026";
}
function parseTime(entry) {
  const raw = entry.timestamp;
  if (!raw)
    return { start: NaN, end: NaN, raw: null };
  const start = new Date(raw).getTime();
  const end = entry.completedAt ? new Date(entry.completedAt).getTime() : Infinity;
  return { start, end, raw };
}
function isOverlapping(a, b) {
  if (!a.raw || !b.raw)
    return false;
  if (a.raw === b.raw)
    return true;
  if (Number.isNaN(a.start) || Number.isNaN(b.start))
    return false;
  return a.start < b.end && b.start < a.end;
}
function computeConcurrencyPrefixes(entries) {
  if (entries.length === 0)
    return [];
  const times = entries.map(parseTime);
  const prefixes = new Array(entries.length).fill("solo");
  let groupStart = 0;
  for (let i = 1; i < entries.length; i++) {
    let overlaps = false;
    for (let j = groupStart; j < i; j++) {
      if (isOverlapping(times[j], times[i])) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      finalizeGroup(prefixes, groupStart, i - 1);
      groupStart = i;
    }
  }
  finalizeGroup(prefixes, groupStart, entries.length - 1);
  return prefixes;
}
function finalizeGroup(prefixes, start, end) {
  if (start === end) {
    prefixes[start] = "solo";
    return;
  }
  prefixes[start] = "first";
  for (let i = start + 1; i < end; i++) {
    prefixes[i] = "middle";
  }
  prefixes[end] = "last";
}

// src/lib/timelineService.ts
import fs4 from "node:fs/promises";
function parseJsonlRows(content) {
  const results = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed)
      continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (row.type === "assistant" && row.message?.content && Array.isArray(row.message.content)) {
      for (const block of row.message.content) {
        if (block?.type === "tool_use") {
          results.push({ row, block, timestamp: row.timestamp ?? null });
        }
      }
    }
    if (row.toolUseResult && Array.isArray(row.toolUseResult.newTodos) && row.toolUseResult.newTodos.length > 0) {
      results.push({
        row,
        block: { name: "__toolUseResult__", input: { todos: row.toolUseResult.newTodos } },
        timestamp: row.timestamp ?? null
      });
    }
  }
  return results;
}
function replayTaskEvents(entries) {
  const taskMap = /* @__PURE__ */ new Map();
  let nextId = 1;
  const snapshots = [];
  for (const { block, timestamp } of entries) {
    const name = block.name;
    const input = block.input ?? {};
    if (name === "TaskCreate") {
      const id = String(nextId++);
      taskMap.set(id, {
        content: input.subject ?? "",
        status: "pending",
        ...input.activeForm ? { activeForm: input.activeForm } : {}
      });
      snapshots.push({ timestamp, todos: [...taskMap.values()] });
    } else if (name === "TaskUpdate" && input.taskId) {
      const existing = taskMap.get(input.taskId);
      if (existing) {
        if (input.status)
          existing.status = input.status;
        if (input.subject)
          existing.content = input.subject;
        if (input.activeForm)
          existing.activeForm = input.activeForm;
        snapshots.push({ timestamp, todos: [...taskMap.values()] });
      }
    }
  }
  return snapshots;
}
var TimelineService = class {
  cache = /* @__PURE__ */ new Map();
  async parseSessionTimeline(jsonlPath) {
    try {
      const stat = await fs4.stat(jsonlPath);
      const cached = this.cache.get(jsonlPath);
      if (cached && cached.mtimeMs === stat.mtimeMs)
        return cached.data;
    } catch {
      return [];
    }
    let content;
    try {
      content = await fs4.readFile(jsonlPath, "utf-8");
    } catch {
      return [];
    }
    const entries = parseJsonlRows(content);
    const raw = [];
    for (const { block, timestamp } of entries) {
      if ((block.name === "TodoWrite" || block.name === "__toolUseResult__") && Array.isArray(block.input?.todos)) {
        raw.push({
          timestamp,
          todos: block.input.todos.map(normalizeTodo)
        });
      }
    }
    const taskSnapshots = replayTaskEvents(entries);
    raw.push(...taskSnapshots);
    raw.sort((a, b) => {
      if (!a.timestamp && !b.timestamp)
        return 0;
      if (!a.timestamp)
        return -1;
      if (!b.timestamp)
        return 1;
      return a.timestamp.localeCompare(b.timestamp);
    });
    const deduped = dedupe(raw);
    const snapshots = deduped.map((entry) => ({
      timestamp: entry.timestamp,
      todos: entry.todos,
      summary: computeSummary(entry.todos)
    }));
    try {
      const stat = await fs4.stat(jsonlPath);
      this.cache.set(jsonlPath, { mtimeMs: stat.mtimeMs, data: snapshots });
    } catch {
    }
    return snapshots;
  }
};
async function replayCurrentTasks(jsonlPath) {
  let content;
  try {
    content = await fs4.readFile(jsonlPath, "utf-8");
  } catch {
    return [];
  }
  const entries = parseJsonlRows(content);
  const taskMap = /* @__PURE__ */ new Map();
  let nextId = 1;
  for (const { block, timestamp } of entries) {
    const name = block.name;
    const input = block.input ?? {};
    if (name === "TodoWrite" && Array.isArray(input.todos)) {
      taskMap.clear();
      for (let i = 0; i < input.todos.length; i++) {
        const todo = input.todos[i];
        taskMap.set(String(i + 1), {
          id: String(i + 1),
          subject: typeof todo.content === "string" ? todo.content : "",
          description: "",
          activeForm: typeof todo.activeForm === "string" ? todo.activeForm : "",
          status: todo.status ?? "pending",
          blocks: [],
          blockedBy: [],
          updatedAt: timestamp ?? void 0
        });
      }
      nextId = input.todos.length + 1;
    } else if (name === "__toolUseResult__" && Array.isArray(input.todos)) {
      taskMap.clear();
      for (let i = 0; i < input.todos.length; i++) {
        const todo = input.todos[i];
        taskMap.set(String(i + 1), {
          id: String(i + 1),
          subject: typeof todo.content === "string" ? todo.content : "",
          description: "",
          activeForm: typeof todo.activeForm === "string" ? todo.activeForm : "",
          status: todo.status ?? "pending",
          blocks: [],
          blockedBy: [],
          updatedAt: timestamp ?? void 0
        });
      }
      nextId = input.todos.length + 1;
    } else if (name === "TaskCreate") {
      const id = String(nextId++);
      taskMap.set(id, {
        id,
        subject: input.subject ?? "",
        description: input.description ?? "",
        activeForm: input.activeForm ?? "",
        status: "pending",
        blocks: [],
        blockedBy: [],
        updatedAt: timestamp ?? void 0
      });
    } else if (name === "TaskUpdate" && input.taskId) {
      const existing = taskMap.get(input.taskId);
      if (existing) {
        if (input.status)
          existing.status = input.status;
        if (input.subject)
          existing.subject = input.subject;
        if (input.description)
          existing.description = input.description;
        if (input.activeForm)
          existing.activeForm = input.activeForm;
        existing.updatedAt = timestamp ?? existing.updatedAt;
        if (input.status === "deleted") {
          taskMap.delete(input.taskId);
        }
      }
    }
  }
  return [...taskMap.values()];
}
function normalizeTodo(todo) {
  return {
    content: typeof todo.content === "string" ? todo.content : "",
    status: typeof todo.status === "string" ? todo.status : "",
    ...typeof todo.activeForm === "string" ? { activeForm: todo.activeForm } : {}
  };
}
function todosFingerprint(todos) {
  return JSON.stringify(
    todos.map((t) => ({
      content: t.content,
      status: t.status,
      activeForm: t.activeForm
    }))
  );
}
function dedupe(entries) {
  const result = [];
  let prevFp = null;
  for (const entry of entries) {
    const fp = todosFingerprint(entry.todos);
    if (fp === prevFp)
      continue;
    prevFp = fp;
    result.push(entry);
  }
  return result;
}
function computeSummary(todos) {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  for (const t of todos) {
    if (t.status === "completed")
      completed++;
    else if (t.status === "in_progress")
      inProgress++;
    else
      pending++;
  }
  const total = todos.length;
  return {
    total,
    completed,
    inProgress,
    pending,
    progressPct: total > 0 ? Math.round(completed / total * 100) : 0
  };
}

// src/lib/backends/claude/adapter.ts
init_constants();
var ClaudeBackendAdapter = class {
  id = "claude";
  displayName = "Claude Code";
  capabilities = {
    tasks: true,
    timeline: true,
    activity: true,
    liveness: true,
    gitBranch: true,
    subagents: true
  };
  claudeDir;
  metadataService;
  taskDataService;
  timelineService;
  /** Cached session list for resolving jsonlPath by session ID */
  sessionCache = [];
  constructor(claudeDir) {
    this.claudeDir = claudeDir;
    this.metadataService = new MetadataService(claudeDir);
    this.taskDataService = new TaskDataService(claudeDir);
    this.timelineService = new TimelineService();
  }
  async initialize() {
    try {
      await fs5.access(this.claudeDir);
      return true;
    } catch {
      return false;
    }
  }
  async dispose() {
  }
  async loadSessions(options) {
    const projectKey = options?.projectPath ? encodeProjectKey(options.projectPath) : void 0;
    const metadataMap = await this.metadataService.loadAllMetadata(projectKey);
    const resolved = [];
    for (const [sessionId, metadata] of metadataMap.entries()) {
      let tasks = await this.taskDataService.readSessionTasks(sessionId);
      if (tasks.length === 0 && metadata.jsonlPath) {
        tasks = await replayCurrentTasks(metadata.jsonlPath);
      }
      const name = this.metadataService.resolveSessionName(sessionId, metadata);
      const taskCount = tasks.length;
      let isLive = false;
      if (metadata.jsonlPath) {
        try {
          const stat = await fs5.stat(metadata.jsonlPath);
          isLive = Date.now() - stat.mtimeMs < SESSION_LIVENESS_MS;
        } catch {
          isLive = false;
        }
      }
      if (taskCount === 0 && !isLive)
        continue;
      const completed = tasks.filter((t) => t.status === "completed").length;
      const inProgress = tasks.filter((t) => t.status === "in_progress").length;
      const pending = tasks.filter((t) => t.status === "pending").length;
      let modifiedAt = "";
      for (const task of tasks) {
        const taskDate = task.updatedAt ?? task.createdAt ?? "";
        if (taskDate > modifiedAt) {
          modifiedAt = taskDate;
        }
      }
      if (!modifiedAt && metadata.jsonlPath) {
        try {
          const stat = await fs5.stat(metadata.jsonlPath);
          modifiedAt = new Date(stat.mtimeMs).toISOString();
        } catch {
        }
      }
      if (!modifiedAt) {
        modifiedAt = metadata.created ?? (/* @__PURE__ */ new Date(0)).toISOString();
      }
      const archiveThresholdMs = ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1e3;
      const isArchived = inProgress === 0 && Date.now() - new Date(modifiedAt).getTime() > archiveThresholdMs;
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
        backendId: "claude",
        dataRef: metadata?.jsonlPath ?? void 0
      });
    }
    resolved.sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
    this.sessionCache = resolved;
    return resolved;
  }
  async loadSessionTasks(sessionId) {
    let tasks = await this.taskDataService.readSessionTasks(sessionId);
    if (tasks.length === 0) {
      const session = this.sessionCache.find((s) => s.id === sessionId);
      if (session?.jsonlPath) {
        tasks = await replayCurrentTasks(session.jsonlPath);
      }
    }
    return tasks.map((t) => ({ ...t, sessionId }));
  }
  async loadActivity(sessionId) {
    const session = this.sessionCache.find((s) => s.id === sessionId);
    if (!session?.jsonlPath)
      return [];
    return parseActivity(session.jsonlPath);
  }
  async loadTimeline(sessionId) {
    const session = this.sessionCache.find((s) => s.id === sessionId);
    if (!session?.jsonlPath)
      return [];
    return this.timelineService.parseSessionTimeline(session.jsonlPath);
  }
  async checkCacheState() {
    const isStale = await this.metadataService.isCacheStale();
    return { isStale };
  }
  invalidateCache() {
    this.metadataService.invalidateCache();
  }
};

// src/lib/backends/composite/adapter.ts
var CompositeBackendAdapter = class {
  id;
  displayName;
  capabilities;
  adapters;
  sessionRouteMap = /* @__PURE__ */ new Map();
  constructor(adapters) {
    if (adapters.length === 0) {
      throw new Error("CompositeBackendAdapter requires at least one adapter");
    }
    this.adapters = adapters;
    this.id = adapters[0].id;
    this.displayName = adapters.map((a) => a.displayName).join(" + ");
    this.capabilities = {
      tasks: adapters.some((a) => a.capabilities.tasks),
      timeline: adapters.some((a) => a.capabilities.timeline),
      activity: adapters.some((a) => a.capabilities.activity),
      liveness: adapters.some((a) => a.capabilities.liveness),
      gitBranch: adapters.some((a) => a.capabilities.gitBranch),
      subagents: adapters.some((a) => a.capabilities.subagents)
    };
  }
  async initialize() {
    const results = await Promise.allSettled(
      this.adapters.map((a) => a.initialize())
    );
    return results.some(
      (r) => r.status === "fulfilled" && r.value === true
    );
  }
  async loadSessions(options) {
    const results = await Promise.allSettled(
      this.adapters.map((a) => a.loadSessions(options))
    );
    const merged = [];
    this.sessionRouteMap.clear();
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        for (const session of result.value) {
          merged.push(session);
          this.sessionRouteMap.set(session.id, this.adapters[i]);
        }
      }
    }
    merged.sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
    return merged;
  }
  async loadSessionTasks(sessionId) {
    const adapter = this.sessionRouteMap.get(sessionId);
    if (adapter)
      return adapter.loadSessionTasks(sessionId);
    for (const a of this.adapters) {
      const tasks = await a.loadSessionTasks(sessionId);
      if (tasks.length > 0)
        return tasks;
    }
    return [];
  }
  async loadActivity(sessionId) {
    const adapter = this.sessionRouteMap.get(sessionId);
    if (adapter)
      return adapter.loadActivity(sessionId);
    return [];
  }
  async loadTimeline(sessionId) {
    const adapter = this.sessionRouteMap.get(sessionId);
    if (adapter)
      return adapter.loadTimeline(sessionId);
    return [];
  }
  async checkCacheState() {
    const results = await Promise.allSettled(
      this.adapters.map((a) => a.checkCacheState())
    );
    const isStale = results.some(
      (r) => r.status === "fulfilled" && r.value.isStale
    );
    return { isStale };
  }
  invalidateCache() {
    for (const a of this.adapters) {
      a.invalidateCache();
    }
  }
  async dispose() {
    await Promise.allSettled(this.adapters.map((a) => a.dispose()));
  }
};

// src/lib/backends/detect.ts
var OPENCODE_DB_PATH = path5.join(os3.homedir(), ".local", "share", "opencode", "opencode.db");
var CLAUDE_DIR_PATH = path5.join(os3.homedir(), ".claude");
async function pathExists(p) {
  try {
    await fs7.access(p);
    return true;
  } catch {
    return false;
  }
}
async function detectAvailableBackends() {
  const available = [];
  if (await pathExists(CLAUDE_DIR_PATH)) {
    available.push("claude");
  }
  if (await pathExists(OPENCODE_DB_PATH)) {
    available.push("opencode");
  }
  return available;
}
async function createSingleAdapter(id, claudeDir) {
  if (id === "claude") {
    return new ClaudeBackendAdapter(claudeDir);
  }
  const { OpenCodeBackendAdapter: OpenCodeBackendAdapter2 } = await Promise.resolve().then(() => (init_adapter(), adapter_exports));
  return new OpenCodeBackendAdapter2();
}
async function createAdapter(backend, claudeDir) {
  if (backend === "auto") {
    const available = await detectAvailableBackends();
    if (available.length > 1) {
      const adapters = await Promise.all(
        available.map((id) => createSingleAdapter(id, claudeDir))
      );
      return new CompositeBackendAdapter(adapters);
    }
    if (available.length === 1) {
      return createSingleAdapter(available[0], claudeDir);
    }
    return new ClaudeBackendAdapter(claudeDir);
  }
  if (backend === "claude" || backend === "opencode") {
    return createSingleAdapter(backend, claudeDir);
  }
  throw new Error(`Unknown backend: ${backend}. Valid options: claude, opencode, auto`);
}

// src/commands/list.tsx
function createListCommand(claudeDir) {
  const cmd = new Command("list");
  cmd.description("List sessions and tasks").option("--json", "Output as JSON").option("--backend <backend>", "Backend: claude, opencode, auto (default: auto)");
  cmd.action(async () => {
    const opts = cmd.opts();
    const backend = cmd.parent?.opts()?.backend ?? opts.backend ?? "auto";
    const dir = cmd.parent?.opts()?.dir ?? claudeDir;
    const adapter = await createAdapter(backend, dir);
    try {
      const sessions = await adapter.loadSessions();
      const allTasks = [];
      for (const session of sessions) {
        const tasks = await adapter.loadSessionTasks(session.id);
        for (const task of tasks) {
          task.sessionId = session.id;
          task.sessionName = session.name ?? void 0;
        }
        allTasks.push(...tasks);
      }
      if (opts.json) {
        console.log(JSON.stringify(allTasks, null, 2));
      } else {
        for (const task of allTasks) {
          console.log(`${task.id}	${task.status}	${task.subject}`);
        }
      }
    } finally {
      await adapter.dispose();
    }
  });
  return cmd;
}

// src/commands/show.tsx
import { Command as Command2 } from "commander";
function createShowCommand(claudeDir) {
  const cmd = new Command2("show");
  cmd.description("Show details for a specific task").argument("<id>", "Task ID to show").option("--session <sessionId>", "Scope to a specific session").option("--backend <backend>", "Backend: claude, opencode, auto (default: auto)");
  cmd.action(async (id) => {
    const opts = cmd.opts();
    const backend = cmd.parent?.opts()?.backend ?? opts.backend ?? "auto";
    const dir = cmd.parent?.opts()?.dir ?? claudeDir;
    const adapter = await createAdapter(backend, dir);
    try {
      if (opts.session) {
        const tasks = await adapter.loadSessionTasks(opts.session);
        const task = tasks.find((t) => t.id === id);
        if (!task) {
          console.error(`Task not found: ${id} in session ${opts.session}`);
          process.exitCode = 1;
          return;
        }
        task.sessionId = opts.session;
        console.log(JSON.stringify(task, null, 2));
      } else {
        const sessions = await adapter.loadSessions();
        const matches = [];
        for (const session of sessions) {
          const tasks = await adapter.loadSessionTasks(session.id);
          for (const task of tasks) {
            if (task.id === id) {
              task.sessionId = session.id;
              task.sessionName = session.name ?? void 0;
              matches.push(task);
            }
          }
        }
        if (matches.length === 0) {
          console.error(`Task not found: ${id}`);
          process.exitCode = 1;
          return;
        }
        if (matches.length > 1) {
          console.error(
            `Multiple tasks with id ${id} found across ${matches.length} sessions. Use --session <sessionId> to disambiguate.`
          );
          for (const m of matches) {
            console.error(`  session: ${m.sessionId}  subject: ${m.subject}`);
          }
          process.exitCode = 1;
          return;
        }
        console.log(JSON.stringify(matches[0], null, 2));
      }
    } finally {
      await adapter.dispose();
    }
  });
  return cmd;
}

// src/commands/watch.ts
init_constants();
import { Command as Command3 } from "commander";
function createWatchCommand(claudeDir) {
  const cmd = new Command3("watch");
  cmd.description("Watch tasks directory for changes (Claude Code only)");
  cmd.action(async () => {
    const backend = cmd.parent?.opts()?.backend ?? "auto";
    if (backend === "opencode") {
      console.error("Watch mode is not supported for OpenCode backend. Use the TUI instead.");
      process.exitCode = 1;
      return;
    }
    const { default: chokidar } = await import("chokidar");
    const path9 = await import("node:path");
    const dir = cmd.parent?.opts()?.dir ?? claudeDir;
    const tasksDir = path9.join(dir, TASKS_SUBDIR);
    console.log(`Watching ${tasksDir} for changes...`);
    const watcher = chokidar.watch(tasksDir, {
      persistent: true,
      ignoreInitial: true
    });
    watcher.on("change", (filePath) => {
      console.log(`Changed: ${filePath}`);
    });
    watcher.on("add", (filePath) => {
      console.log(`Added: ${filePath}`);
    });
    watcher.on("unlink", (filePath) => {
      console.log(`Removed: ${filePath}`);
    });
  });
  return cmd;
}

// src/App.tsx
import { useState as useState6, useCallback as useCallback3, useMemo as useMemo3, useEffect as useEffect3, useRef as useRef5 } from "react";
import path7 from "node:path";
import { Box as Box11, Text as Text10, useInput as useInput6, useApp, useStdout as useStdout2 } from "ink";

// src/hooks/useBackendData.ts
init_constants();
import { useState, useEffect, useCallback, useRef } from "react";
function useBackendData(adapter, options) {
  const [sessions, setSessions] = useState([]);
  const [currentTasks, setCurrentTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const selectRequestRef = useRef(0);
  const fetchSessions = useCallback(async () => {
    try {
      const resolved = await adapter.loadSessions({ projectPath: options?.projectPath });
      if (mountedRef.current) {
        setSessions(resolved);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [adapter, options?.projectPath]);
  useEffect(() => {
    mountedRef.current = true;
    fetchSessions();
    const interval = setInterval(async () => {
      const { isStale } = await adapter.checkCacheState();
      if (isStale) {
        adapter.invalidateCache();
        fetchSessions();
      }
    }, AUTO_REFRESH_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchSessions, adapter]);
  const selectSession = useCallback(
    (sessionId) => {
      const requestId = ++selectRequestRef.current;
      const loadTasks = async () => {
        try {
          const tasks = await adapter.loadSessionTasks(sessionId);
          if (mountedRef.current && selectRequestRef.current === requestId) {
            setCurrentTasks(tasks);
          }
        } catch (err) {
          if (mountedRef.current && selectRequestRef.current === requestId) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
          }
        }
      };
      loadTasks();
    },
    [adapter]
  );
  const refresh = useCallback(async () => {
    try {
      adapter.invalidateCache();
      setError(null);
      await fetchSessions();
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    }
  }, [adapter, fetchSessions]);
  return {
    sessions,
    currentTasks,
    loading,
    error,
    selectSession,
    refresh,
    adapter
  };
}

// src/components/Sidebar.tsx
import { Box as Box4, Text as Text4 } from "ink";

// src/components/FilterBar.tsx
import { Box, Text } from "ink";
import { jsx } from "react/jsx-runtime";
function FilterBar({ filters, activeFilter }) {
  return /* @__PURE__ */ jsx(Box, { children: filters.map((filter) => /* @__PURE__ */ jsx(Box, { marginRight: 1, children: /* @__PURE__ */ jsx(Text, { bold: filter === activeFilter, children: filter === activeFilter ? `[${filter}]` : filter }) }, filter)) });
}

// src/components/SessionList.tsx
import { useRef as useRef2 } from "react";
import { Box as Box3, Text as Text3 } from "ink";
import { useInput } from "ink";

// src/components/SessionItem.tsx
import { useState as useState2, useEffect as useEffect2 } from "react";
import path6 from "node:path";
import { Box as Box2, Text as Text2 } from "ink";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function truncate2(str, max) {
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}
var PULSE_INTERVAL = 500;
var PULSE_FRAMES = [
  { bold: true, dim: false },
  { bold: false, dim: false },
  { bold: false, dim: true },
  { bold: false, dim: false }
];
function PulsingBadge({ char, color }) {
  const [, setTick] = useState2(0);
  useEffect2(() => {
    const timer = setInterval(() => setTick((t) => t + 1), PULSE_INTERVAL);
    return () => clearInterval(timer);
  }, []);
  const frame = Math.floor(Date.now() / PULSE_INTERVAL) % PULSE_FRAMES.length;
  const { bold, dim } = PULSE_FRAMES[frame];
  return /* @__PURE__ */ jsx2(Text2, { color, bold, dimColor: dim, children: char });
}
function SessionItem({ session, isSelected, maxWidth = 26 }) {
  const prefix = isSelected ? "\u203A " : "  ";
  const counts = `${session.completed}/${session.taskCount}`;
  const badge = session.backendId ? session.isArchived ? "\u2715" : session.backendId === "claude" ? "C" : "O" : session.isArchived ? "\u2715" : null;
  const badgeColor = session.backendId === "claude" ? "cyan" : session.backendId === "opencode" ? "magenta" : void 0;
  const badgePulses = !!session.backendId && session.isLive && !session.isArchived;
  const badgeWidth = badge ? 2 : 0;
  const countsStr = ` ${counts}`;
  const nameMax = maxWidth - prefix.length - countsStr.length - badgeWidth;
  const name = truncate2(session.name ?? session.id, Math.max(nameMax, 6));
  const subtitle = session.project ? path6.basename(session.project) : session.gitBranch ?? null;
  return /* @__PURE__ */ jsxs(Box2, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs(Box2, { children: [
      /* @__PURE__ */ jsxs(Text2, { color: isSelected ? "cyan" : void 0, children: [
        prefix,
        name
      ] }),
      badge && (badgePulses ? /* @__PURE__ */ jsxs(Text2, { children: [
        " ",
        /* @__PURE__ */ jsx2(PulsingBadge, { char: badge, color: badgeColor })
      ] }) : /* @__PURE__ */ jsxs(Text2, { color: badgeColor, dimColor: session.isArchived, children: [
        " ",
        badge
      ] })),
      /* @__PURE__ */ jsx2(Text2, { dimColor: true, children: countsStr })
    ] }),
    subtitle && /* @__PURE__ */ jsx2(Box2, { children: /* @__PURE__ */ jsxs(Text2, { dimColor: true, children: [
      "  ",
      truncate2(subtitle, maxWidth - 2)
    ] }) })
  ] });
}

// src/components/SessionList.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function SessionList({
  sessions,
  selectedIndex,
  onSelect,
  onOpen,
  isActive = true,
  visibleHeight = 20
}) {
  const scrollOffsetRef = useRef2(0);
  if (sessions.length <= visibleHeight) {
    scrollOffsetRef.current = 0;
  } else {
    if (selectedIndex < scrollOffsetRef.current) {
      scrollOffsetRef.current = selectedIndex;
    } else if (selectedIndex >= scrollOffsetRef.current + visibleHeight) {
      scrollOffsetRef.current = selectedIndex - visibleHeight + 1;
    }
  }
  useInput((input, key) => {
    if (sessions.length === 0)
      return;
    if (input === "j" || key.downArrow) {
      const next = selectedIndex + 1 >= sessions.length ? 0 : selectedIndex + 1;
      onSelect(next);
    } else if (input === "k" || key.upArrow) {
      const prev = selectedIndex - 1 < 0 ? sessions.length - 1 : selectedIndex - 1;
      onSelect(prev);
    } else if (input === "g") {
      onSelect(0);
    } else if (input === "G") {
      onSelect(sessions.length - 1);
    } else if (input === "d" && key.ctrl) {
      const halfPage = Math.floor(visibleHeight / 2);
      const next = Math.min(selectedIndex + halfPage, sessions.length - 1);
      onSelect(next);
    } else if (input === "u" && key.ctrl) {
      const halfPage = Math.floor(visibleHeight / 2);
      const next = Math.max(selectedIndex - halfPage, 0);
      onSelect(next);
    } else if (key.return) {
      if (sessions[selectedIndex]) {
        onOpen(sessions[selectedIndex].id);
      }
    }
  }, { isActive });
  const scrollOffset = scrollOffsetRef.current;
  const needsWindowing = sessions.length > visibleHeight;
  const clampedOffset = needsWindowing ? Math.min(scrollOffset, sessions.length - visibleHeight) : 0;
  const visibleSessions = needsWindowing ? sessions.slice(clampedOffset, clampedOffset + visibleHeight) : sessions;
  const aboveCount = clampedOffset;
  const belowCount = needsWindowing ? sessions.length - (clampedOffset + visibleHeight) : 0;
  return /* @__PURE__ */ jsxs2(Box3, { flexDirection: "column", children: [
    aboveCount > 0 && /* @__PURE__ */ jsxs2(Text3, { dimColor: true, children: [
      "  \u25B2 ",
      aboveCount,
      " more"
    ] }),
    visibleSessions.map((session, i) => /* @__PURE__ */ jsx3(
      SessionItem,
      {
        session,
        isSelected: clampedOffset + i === selectedIndex
      },
      session.id
    )),
    belowCount > 0 && /* @__PURE__ */ jsxs2(Text3, { dimColor: true, children: [
      "  \u25BC ",
      belowCount,
      " more"
    ] })
  ] });
}

// src/components/Sidebar.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var FILTERS = ["All", "Active", "Archived"];
function Sidebar({
  sessions,
  selectedIndex,
  onSelect,
  onOpen,
  filter,
  onFilterChange,
  isActive,
  visibleHeight
}) {
  return /* @__PURE__ */ jsxs3(Box4, { flexDirection: "column", children: [
    /* @__PURE__ */ jsx4(Text4, { bold: true, children: "Sessions" }),
    /* @__PURE__ */ jsx4(
      FilterBar,
      {
        filters: FILTERS,
        activeFilter: filter === "all" ? "All" : filter === "active" ? "Active" : "Archived",
        onFilterChange
      }
    ),
    /* @__PURE__ */ jsx4(
      SessionList,
      {
        sessions,
        selectedIndex,
        onSelect,
        onOpen,
        isActive,
        visibleHeight
      }
    )
  ] });
}

// src/components/NavigableKanban.tsx
import React3, { useState as useState3, useCallback as useCallback2, useMemo } from "react";
import { useInput as useInput2 } from "ink";

// src/components/KanbanBoard.tsx
import { Box as Box7 } from "ink";

// src/components/KanbanColumn.tsx
import { Box as Box6, Text as Text6 } from "ink";

// src/components/TaskCard.tsx
import { Box as Box5, Text as Text5 } from "ink";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var MAX_SUBJECT_LENGTH = 50;
var STATUS_ICON = {
  pending: "\u25CB",
  in_progress: "\u25C9",
  completed: "\u2713"
};
function TaskCard({ task, isFocused }) {
  const truncatedSubject = task.subject.length > MAX_SUBJECT_LENGTH ? task.subject.slice(0, MAX_SUBJECT_LENGTH) + "\u2026" : task.subject;
  const showActiveForm = task.status === "in_progress" && task.activeForm;
  const isBlocked = task.blockedBy.length > 0;
  const blocksOthers = task.blocks.length > 0;
  const icon = STATUS_ICON[task.status] ?? "\u25CB";
  return /* @__PURE__ */ jsxs4(Box5, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs4(Box5, { children: [
      isFocused ? /* @__PURE__ */ jsx5(Text5, { color: "cyan", bold: true, children: "\u203A " }) : /* @__PURE__ */ jsx5(Text5, { children: "  " }),
      /* @__PURE__ */ jsxs4(Text5, { dimColor: true, children: [
        icon,
        " "
      ] }),
      /* @__PURE__ */ jsx5(Text5, { color: isFocused ? "cyan" : void 0, dimColor: task.status === "completed", children: truncatedSubject }),
      /* @__PURE__ */ jsxs4(Text5, { dimColor: true, children: [
        " #",
        task.id
      ] }),
      isBlocked && /* @__PURE__ */ jsx5(Text5, { color: "red", children: " \u2298" }),
      blocksOthers && /* @__PURE__ */ jsx5(Text5, { color: "yellow", children: " \u2192" })
    ] }),
    showActiveForm && /* @__PURE__ */ jsx5(Box5, { marginLeft: 4, children: /* @__PURE__ */ jsxs4(Text5, { color: "blue", dimColor: true, children: [
      "\u27F3 ",
      task.activeForm
    ] }) })
  ] });
}

// src/components/KanbanColumn.tsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var STATUS_COLORS = {
  Pending: "yellow",
  "In Progress": "blue",
  Completed: "green"
};
function KanbanColumn({ title, tasks, focusedIndex }) {
  const sorted = [...tasks].sort((a, b) => Number(a.id) - Number(b.id));
  const color = STATUS_COLORS[title] ?? "white";
  return /* @__PURE__ */ jsxs5(Box6, { flexDirection: "column", flexGrow: 1, marginRight: 1, children: [
    /* @__PURE__ */ jsxs5(Box6, { children: [
      /* @__PURE__ */ jsx6(Text6, { bold: true, color, children: title }),
      /* @__PURE__ */ jsxs5(Text6, { dimColor: true, children: [
        " (",
        tasks.length,
        ")"
      ] })
    ] }),
    /* @__PURE__ */ jsx6(Box6, { children: /* @__PURE__ */ jsx6(Text6, { color, children: "\u2500".repeat(20) }) }),
    sorted.length === 0 ? /* @__PURE__ */ jsx6(Box6, { marginTop: 1, children: /* @__PURE__ */ jsx6(Text6, { dimColor: true, italic: true, children: "  (empty)" }) }) : sorted.map((task, index) => /* @__PURE__ */ jsx6(TaskCard, { task, isFocused: index === focusedIndex }, task.id))
  ] });
}

// src/components/KanbanBoard.tsx
import { jsx as jsx7 } from "react/jsx-runtime";
var COLUMNS = [
  { title: "Pending", status: "pending" },
  { title: "In Progress", status: "in_progress" },
  { title: "Completed", status: "completed" }
];
function KanbanBoard({ tasks, focusedColumn, focusedRow }) {
  return /* @__PURE__ */ jsx7(Box7, { flexDirection: "row", children: COLUMNS.map((col, index) => {
    const filtered = tasks.filter((t) => t.status === col.status);
    const focusedIndex = focusedColumn === index ? focusedRow : void 0;
    return /* @__PURE__ */ jsx7(
      KanbanColumn,
      {
        title: col.title,
        tasks: filtered,
        focusedIndex
      },
      col.status
    );
  }) });
}

// src/components/NavigableKanban.tsx
var COLUMN_STATUSES = ["pending", "in_progress", "completed"];
var NUM_COLUMNS = COLUMN_STATUSES.length;
function NavigableKanban({ tasks, isActive = true, onOpenDetail }) {
  const [focusedColumn, setFocusedColumn] = useState3(0);
  const [focusedRow, setFocusedRow] = useState3(0);
  const [columnMemory, setColumnMemory] = useState3({ 0: 0, 1: 0, 2: 0 });
  const columnTasks = useMemo(() => {
    return COLUMN_STATUSES.map(
      (status) => [...tasks.filter((t) => t.status === status)].sort((a, b) => Number(a.id) - Number(b.id))
    );
  }, [tasks]);
  const getColumnLength = useCallback2((col) => columnTasks[col].length, [columnTasks]);
  useInput2((input, key) => {
    if (input === "j" || key.downArrow) {
      const maxRow = getColumnLength(focusedColumn) - 1;
      if (focusedRow < maxRow) {
        const newRow = focusedRow + 1;
        setFocusedRow(newRow);
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: newRow }));
      }
    } else if (input === "k" || key.upArrow) {
      if (focusedRow > 0) {
        const newRow = focusedRow - 1;
        setFocusedRow(newRow);
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: newRow }));
      }
    } else if (input === "l" || key.rightArrow) {
      if (focusedColumn < NUM_COLUMNS - 1) {
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: focusedRow }));
        const newCol = focusedColumn + 1;
        const restoredRow = columnMemory[newCol] ?? 0;
        const maxRow = Math.max(0, getColumnLength(newCol) - 1);
        const clampedRow = Math.min(restoredRow, maxRow);
        setFocusedColumn(newCol);
        setFocusedRow(clampedRow);
      }
    } else if (input === "h" || key.leftArrow) {
      if (focusedColumn > 0) {
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: focusedRow }));
        const newCol = focusedColumn - 1;
        const restoredRow = columnMemory[newCol] ?? 0;
        const maxRow = Math.max(0, getColumnLength(newCol) - 1);
        const clampedRow = Math.min(restoredRow, maxRow);
        setFocusedColumn(newCol);
        setFocusedRow(clampedRow);
      }
    } else if (key.return) {
      const tasksInColumn = columnTasks[focusedColumn];
      if (tasksInColumn[focusedRow] && onOpenDetail) {
        onOpenDetail(tasksInColumn[focusedRow]);
      }
    }
  }, { isActive });
  return React3.createElement(KanbanBoard, {
    tasks,
    focusedColumn: isActive ? focusedColumn : void 0,
    focusedRow: isActive ? focusedRow : void 0
  });
}

// src/components/HelpOverlay.tsx
import { Box as Box8, Text as Text7, useInput as useInput3 } from "ink";
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
var sections = [
  {
    title: "Global",
    shortcuts: [
      { keys: "q", description: "Quit" },
      { keys: "?", description: "Help" },
      { keys: "Tab", description: "Switch panel" },
      { keys: "Ctrl+C", description: "Quit" }
    ]
  },
  {
    title: "Session List",
    shortcuts: [
      { keys: "j/k or \u2191/\u2193", description: "Navigate" },
      { keys: "g/G", description: "First/Last" },
      { keys: "Enter", description: "Select" },
      { keys: "f", description: "Cycle filter (All/Active/Archived)" },
      { keys: "t", description: "Timeline" },
      { keys: "a", description: "Activity" }
    ]
  },
  {
    title: "Kanban",
    shortcuts: [
      { keys: "h/l or \u2190/\u2192", description: "Columns" },
      { keys: "j/k or \u2191/\u2193", description: "Rows" },
      { keys: "Enter", description: "Open detail" }
    ]
  },
  {
    title: "Timeline",
    shortcuts: [
      { keys: "j/k or \u2191/\u2193", description: "Navigate snapshots" },
      { keys: "q/Esc", description: "Close" }
    ]
  },
  {
    title: "Task Detail",
    shortcuts: [
      { keys: "q/Esc", description: "Close" },
      { keys: "Backspace", description: "Back" }
    ]
  }
];
function HelpOverlay({ onClose }) {
  useInput3((input, key) => {
    if (key.escape || input === "q") {
      onClose();
    }
  });
  return /* @__PURE__ */ jsxs6(Box8, { flexDirection: "column", padding: 1, children: [
    /* @__PURE__ */ jsx8(Text7, { bold: true, children: "Keyboard Shortcuts" }),
    /* @__PURE__ */ jsx8(Text7, { children: " " }),
    sections.map((section) => /* @__PURE__ */ jsxs6(Box8, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsx8(Text7, { bold: true, underline: true, children: section.title }),
      section.shortcuts.map((shortcut) => /* @__PURE__ */ jsxs6(Text7, { children: [
        "  ",
        shortcut.keys,
        "  ",
        shortcut.description
      ] }, shortcut.keys))
    ] }, section.title))
  ] });
}

// src/components/TimelineOverlay.tsx
import { useState as useState4, useRef as useRef3 } from "react";
import { Box as Box9, Text as Text8, useInput as useInput4 } from "ink";
import { jsx as jsx9, jsxs as jsxs7 } from "react/jsx-runtime";
var STATUS_ICON2 = {
  completed: "\u2713",
  in_progress: "\u27F3",
  pending: "\u25CB"
};
var STATUS_COLOR = {
  completed: "green",
  in_progress: "yellow",
  pending: "gray"
};
function formatTimestamp(iso) {
  if (!iso)
    return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()))
    return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}
function progressBar(pct, width = 12) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 100 * width);
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}]`;
}
var VISIBLE_SNAPSHOTS = 16;
function TimelineOverlay({
  snapshots,
  sessionName,
  onClose
}) {
  const [selectedIndex, setSelectedIndex] = useState4(0);
  const scrollOffsetRef = useRef3(0);
  if (snapshots.length <= VISIBLE_SNAPSHOTS) {
    scrollOffsetRef.current = 0;
  } else {
    if (selectedIndex < scrollOffsetRef.current) {
      scrollOffsetRef.current = selectedIndex;
    } else if (selectedIndex >= scrollOffsetRef.current + VISIBLE_SNAPSHOTS) {
      scrollOffsetRef.current = selectedIndex - VISIBLE_SNAPSHOTS + 1;
    }
  }
  useInput4((input, key) => {
    if (key.escape || input === "q") {
      onClose();
      return;
    }
    if (snapshots.length === 0)
      return;
    if (input === "j" || key.downArrow) {
      setSelectedIndex((prev) => prev + 1 >= snapshots.length ? 0 : prev + 1);
    } else if (input === "k" || key.upArrow) {
      setSelectedIndex((prev) => prev - 1 < 0 ? snapshots.length - 1 : prev - 1);
    } else if (input === "g") {
      setSelectedIndex(0);
    } else if (input === "G") {
      setSelectedIndex(snapshots.length - 1);
    }
  });
  if (snapshots.length === 0) {
    return /* @__PURE__ */ jsxs7(Box9, { flexDirection: "column", padding: 1, children: [
      /* @__PURE__ */ jsxs7(Text8, { bold: true, children: [
        "Timeline \u2500 ",
        sessionName
      ] }),
      /* @__PURE__ */ jsx9(Text8, { children: " " }),
      /* @__PURE__ */ jsx9(Text8, { dimColor: true, children: "No timeline data" }),
      /* @__PURE__ */ jsx9(Text8, { children: " " }),
      /* @__PURE__ */ jsx9(Text8, { dimColor: true, children: "Press q or Esc to close" })
    ] });
  }
  const selected = snapshots[selectedIndex];
  const scrollOffset = scrollOffsetRef.current;
  const needsWindowing = snapshots.length > VISIBLE_SNAPSHOTS;
  const visibleSlice = needsWindowing ? snapshots.slice(scrollOffset, scrollOffset + VISIBLE_SNAPSHOTS) : snapshots;
  return /* @__PURE__ */ jsxs7(Box9, { flexDirection: "column", padding: 1, children: [
    /* @__PURE__ */ jsxs7(Text8, { bold: true, children: [
      "Timeline \u2500 ",
      sessionName
    ] }),
    /* @__PURE__ */ jsxs7(Text8, { dimColor: true, children: [
      snapshots.length,
      " snapshots \u2502 j/k:navigate  q/Esc:close"
    ] }),
    /* @__PURE__ */ jsx9(Text8, { children: " " }),
    /* @__PURE__ */ jsxs7(Box9, { flexDirection: "row", children: [
      /* @__PURE__ */ jsxs7(Box9, { flexDirection: "column", width: 38, children: [
        needsWindowing && scrollOffset > 0 && /* @__PURE__ */ jsxs7(Text8, { dimColor: true, children: [
          "  \u25B2 ",
          scrollOffset,
          " more"
        ] }),
        visibleSlice.map((snap, i) => {
          const realIndex = (needsWindowing ? scrollOffset : 0) + i;
          const isSel = realIndex === selectedIndex;
          const ts = formatTimestamp(snap.timestamp);
          const s = snap.summary;
          return /* @__PURE__ */ jsxs7(Text8, { color: isSel ? "cyan" : void 0, bold: isSel, children: [
            isSel ? "\u203A" : " ",
            " ",
            ts,
            "  ",
            s.completed,
            "/",
            s.total,
            " ",
            s.progressPct,
            "%"
          ] }, realIndex);
        }),
        needsWindowing && scrollOffset + VISIBLE_SNAPSHOTS < snapshots.length && /* @__PURE__ */ jsxs7(Text8, { dimColor: true, children: [
          "  \u25BC ",
          snapshots.length - scrollOffset - VISIBLE_SNAPSHOTS,
          " more"
        ] })
      ] }),
      /* @__PURE__ */ jsxs7(Box9, { flexDirection: "column", flexGrow: 1, marginLeft: 2, children: [
        /* @__PURE__ */ jsxs7(Text8, { bold: true, underline: true, children: [
          "Snapshot ",
          selectedIndex + 1,
          "/",
          snapshots.length,
          " \u2500 ",
          formatTimestamp(selected.timestamp)
        ] }),
        /* @__PURE__ */ jsxs7(Text8, { dimColor: true, children: [
          selected.summary.completed,
          "\u2713 ",
          selected.summary.inProgress,
          "\u27F3 ",
          selected.summary.pending,
          "\u25CB (",
          selected.summary.progressPct,
          "%) ",
          progressBar(selected.summary.progressPct)
        ] }),
        /* @__PURE__ */ jsx9(Text8, { children: " " }),
        selected.todos.map((todo, i) => /* @__PURE__ */ jsxs7(Text8, { color: STATUS_COLOR[todo.status] ?? void 0, children: [
          STATUS_ICON2[todo.status] ?? "?",
          " ",
          todo.content
        ] }, i))
      ] })
    ] })
  ] });
}

// src/components/ActivityOverlay.tsx
import { useState as useState5, useRef as useRef4, useMemo as useMemo2 } from "react";
import { Box as Box10, Text as Text9, useInput as useInput5, useStdout } from "ink";
import { Fragment, jsx as jsx10, jsxs as jsxs8 } from "react/jsx-runtime";
function formatTime(iso) {
  if (!iso)
    return "??:??";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()))
    return iso.slice(0, 5);
  return d.toISOString().slice(11, 16);
}
function formatTimestamp2(iso) {
  if (!iso)
    return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()))
    return iso;
  return d.toISOString().slice(0, 19).replace("T", " ");
}
function formatDuration(start, end) {
  if (!start || !end)
    return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0)
    return "";
  const secs = Math.floor(ms / 1e3);
  if (secs < 60)
    return `(${secs}s)`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `(${mins}m${remSecs}s)`;
}
function truncate3(text, maxLen) {
  if (text.length <= maxLen)
    return text;
  return text.slice(0, maxLen - 1) + "\u2026";
}
function entryIcon(entry) {
  if (entry.status === "error")
    return { icon: "\u2717", color: "red" };
  if (entry.status === "running")
    return { icon: "\u27F3", color: "yellow" };
  return { icon: "\u2713", color: "green" };
}
function entryLabelColor(entry) {
  switch (entry.type) {
    case "skill":
      return "magenta";
    case "tool":
      return "yellow";
    case "mcp":
      return "green";
    case "command":
      return "blue";
    case "hook":
      return "red";
    default:
      return "cyan";
  }
}
function hookShortEvent(description) {
  if (description.startsWith("Stop"))
    return "Stop";
  if (description.startsWith("SessionStart"))
    return "Start";
  if (description === "Hook Error")
    return "Error";
  return description.split(":")[0] || "Hook";
}
function entryBadge(entry) {
  switch (entry.type) {
    case "skill":
      return "[Skill]";
    case "tool":
      return `[${entry.toolName ?? "Tool"}]`;
    case "mcp":
      return `[${parseMcpFunctionName(entry.toolName ?? "")}]`;
    case "command":
      return `[/${entry.description}]`;
    case "hook":
      return `[Hook:${hookShortEvent(entry.description)}]`;
    default:
      return `[${entry.subagentType ?? "Agent"}]`;
  }
}
function graphChar(prefix) {
  switch (prefix) {
    case "first":
      return "\u252C ";
    case "middle":
      return "\u251C ";
    case "last":
      return "\u2514 ";
    default:
      return "  ";
  }
}
function ActivityOverlay({
  entries,
  sessionName,
  onClose
}) {
  const [selectedIndex, setSelectedIndex] = useState5(0);
  const scrollOffsetRef = useRef4(0);
  const { stdout } = useStdout();
  const prefixes = useMemo2(() => computeConcurrencyPrefixes(entries), [entries]);
  const termRows = stdout?.rows ?? 24;
  const listVisibleHeight = Math.max(3, Math.floor((termRows - 8) / 2));
  if (entries.length <= listVisibleHeight) {
    scrollOffsetRef.current = 0;
  } else {
    if (selectedIndex < scrollOffsetRef.current) {
      scrollOffsetRef.current = selectedIndex;
    } else if (selectedIndex >= scrollOffsetRef.current + listVisibleHeight) {
      scrollOffsetRef.current = selectedIndex - listVisibleHeight + 1;
    }
  }
  useInput5((input, key) => {
    if (key.escape || input === "q") {
      onClose();
      return;
    }
    if (entries.length === 0)
      return;
    if (input === "j" || key.downArrow) {
      setSelectedIndex((prev) => prev + 1 >= entries.length ? 0 : prev + 1);
    } else if (input === "k" || key.upArrow) {
      setSelectedIndex((prev) => prev - 1 < 0 ? entries.length - 1 : prev - 1);
    } else if (input === "g") {
      setSelectedIndex(0);
    } else if (input === "G") {
      setSelectedIndex(entries.length - 1);
    }
  });
  const subagents = entries.filter((e) => e.type === "subagent");
  const skills = entries.filter((e) => e.type === "skill");
  const tools = entries.filter((e) => e.type === "tool");
  const mcps = entries.filter((e) => e.type === "mcp");
  const commands = entries.filter((e) => e.type === "command");
  const hooks = entries.filter((e) => e.type === "hook");
  const running = entries.filter((e) => e.status === "running").length;
  if (entries.length === 0) {
    return /* @__PURE__ */ jsxs8(Box10, { flexDirection: "column", padding: 1, children: [
      /* @__PURE__ */ jsxs8(Text9, { bold: true, children: [
        "Activity \u2500 ",
        sessionName
      ] }),
      /* @__PURE__ */ jsx10(Text9, { children: " " }),
      /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "No activity recorded in this session" }),
      /* @__PURE__ */ jsx10(Text9, { children: " " }),
      /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Press q or Esc to close" })
    ] });
  }
  const selected = entries[selectedIndex];
  const scrollOffset = scrollOffsetRef.current;
  const needsWindowing = entries.length > listVisibleHeight;
  const visibleSlice = needsWindowing ? entries.slice(scrollOffset, scrollOffset + listVisibleHeight) : entries;
  const promptLines = selected.prompt ? selected.prompt.split("\n").slice(0, 15) : [];
  const resultLines = selected.resultSummary ? selected.resultSummary.split("\n").slice(0, 5) : [];
  return /* @__PURE__ */ jsxs8(Box10, { flexDirection: "column", padding: 1, children: [
    /* @__PURE__ */ jsxs8(Text9, { bold: true, children: [
      "Activity \u2500 ",
      entries.length,
      " total \u2502 ",
      subagents.length,
      " agents \u2502 ",
      skills.length,
      " skills \u2502 ",
      tools.length,
      " tools \u2502 ",
      mcps.length,
      " mcp \u2502 ",
      commands.length,
      " cmds \u2502 ",
      hooks.length,
      " hooks \u2502 ",
      running,
      " running"
    ] }),
    /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "j/k:navigate  g/G:first/last  q/Esc:close" }),
    /* @__PURE__ */ jsx10(Text9, { children: " " }),
    /* @__PURE__ */ jsxs8(Box10, { flexDirection: "column", children: [
      needsWindowing && scrollOffset > 0 && /* @__PURE__ */ jsxs8(Text9, { dimColor: true, children: [
        "  \u25B2 ",
        scrollOffset,
        " more"
      ] }),
      visibleSlice.map((entry, i) => {
        const realIndex = (needsWindowing ? scrollOffset : 0) + i;
        const isSel = realIndex === selectedIndex;
        const { icon, color: iconColor } = entryIcon(entry);
        const labelColor = entryLabelColor(entry);
        const badge = entryBadge(entry);
        const duration = formatDuration(entry.timestamp, entry.completedAt);
        const desc = truncate3(entry.description, 30);
        const badgePad = badge.padEnd(16).slice(0, 16);
        return /* @__PURE__ */ jsxs8(Box10, { children: [
          /* @__PURE__ */ jsx10(Text9, { color: isSel ? labelColor : void 0, bold: isSel, children: isSel ? "\u203A " : "  " }),
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: graphChar(prefixes[realIndex]) }),
          /* @__PURE__ */ jsx10(Text9, { color: iconColor, children: icon }),
          /* @__PURE__ */ jsxs8(Text9, { color: isSel ? labelColor : void 0, bold: isSel, children: [
            " ",
            formatTime(entry.timestamp),
            "  "
          ] }),
          /* @__PURE__ */ jsx10(Text9, { color: labelColor, children: badgePad }),
          /* @__PURE__ */ jsxs8(Text9, { color: isSel ? labelColor : void 0, bold: isSel, children: [
            " ",
            desc
          ] }),
          duration && /* @__PURE__ */ jsxs8(Text9, { dimColor: true, children: [
            " ",
            duration
          ] })
        ] }, entry.id);
      }),
      needsWindowing && scrollOffset + listVisibleHeight < entries.length && /* @__PURE__ */ jsxs8(Text9, { dimColor: true, children: [
        "  \u25BC ",
        entries.length - scrollOffset - listVisibleHeight,
        " more"
      ] })
    ] }),
    /* @__PURE__ */ jsx10(Text9, { children: " " }),
    /* @__PURE__ */ jsxs8(Box10, { flexDirection: "column", children: [
      /* @__PURE__ */ jsx10(Text9, { bold: true, underline: true, children: selected.description || "Activity detail" }),
      /* @__PURE__ */ jsx10(Text9, { children: " " }),
      selected.type === "subagent" ? /* @__PURE__ */ jsxs8(Fragment, { children: [
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Type:    " }),
          /* @__PURE__ */ jsx10(Text9, { children: selected.subagentType })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Status:  " }),
          /* @__PURE__ */ jsx10(Text9, { color: selected.status === "completed" ? "green" : selected.status === "error" ? "red" : "yellow", children: selected.status === "completed" ? "\u2713 Completed" : selected.status === "error" ? "\u2717 Error" : "\u27F3 Running" })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Spawned: " }),
          /* @__PURE__ */ jsx10(Text9, { children: formatTimestamp2(selected.timestamp) })
        ] }),
        selected.completedAt && /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Duration:" }),
          /* @__PURE__ */ jsxs8(Text9, { children: [
            " ",
            formatDuration(selected.timestamp, selected.completedAt)
          ] })
        ] }),
        selected.agentId && /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Agent:   " }),
          /* @__PURE__ */ jsx10(Text9, { children: selected.agentId.slice(0, 7) })
        ] })
      ] }) : selected.type === "skill" ? /* @__PURE__ */ jsxs8(Fragment, { children: [
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Skill:   " }),
          /* @__PURE__ */ jsx10(Text9, { color: "magenta", children: selected.skillName })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Status:  " }),
          /* @__PURE__ */ jsx10(Text9, { color: selected.status === "completed" ? "green" : selected.status === "error" ? "red" : "yellow", children: selected.status === "completed" ? "\u2713 Completed" : selected.status === "error" ? "\u2717 Error" : "\u27F3 Running" })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Invoked: " }),
          /* @__PURE__ */ jsx10(Text9, { children: formatTimestamp2(selected.timestamp) })
        ] }),
        selected.skillArgs && /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Args:    " }),
          /* @__PURE__ */ jsx10(Text9, { children: selected.skillArgs })
        ] })
      ] }) : selected.type === "tool" ? /* @__PURE__ */ jsxs8(Fragment, { children: [
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Tool:    " }),
          /* @__PURE__ */ jsx10(Text9, { color: "yellow", children: selected.toolName })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Status:  " }),
          /* @__PURE__ */ jsx10(Text9, { color: selected.status === "completed" ? "green" : selected.status === "error" ? "red" : "yellow", children: selected.status === "completed" ? "\u2713 Completed" : selected.status === "error" ? "\u2717 Error" : "\u27F3 Running" })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Called:  " }),
          /* @__PURE__ */ jsx10(Text9, { children: formatTimestamp2(selected.timestamp) })
        ] }),
        selected.completedAt && /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Duration:" }),
          /* @__PURE__ */ jsxs8(Text9, { children: [
            " ",
            formatDuration(selected.timestamp, selected.completedAt)
          ] })
        ] })
      ] }) : selected.type === "command" ? /* @__PURE__ */ jsxs8(Fragment, { children: [
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Command: " }),
          /* @__PURE__ */ jsxs8(Text9, { color: "blue", children: [
            "/",
            selected.description
          ] })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Status:  " }),
          /* @__PURE__ */ jsx10(Text9, { color: "green", children: "\u2713 Completed" })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Invoked: " }),
          /* @__PURE__ */ jsx10(Text9, { children: formatTimestamp2(selected.timestamp) })
        ] })
      ] }) : selected.type === "hook" ? /* @__PURE__ */ jsxs8(Fragment, { children: [
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Event:   " }),
          /* @__PURE__ */ jsx10(Text9, { color: "red", children: hookShortEvent(selected.description) })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Hook:    " }),
          /* @__PURE__ */ jsx10(Text9, { children: selected.description })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Status:  " }),
          /* @__PURE__ */ jsx10(Text9, { color: "green", children: "\u2713 Completed" })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Fired:   " }),
          /* @__PURE__ */ jsx10(Text9, { children: formatTimestamp2(selected.timestamp) })
        ] })
      ] }) : /* @__PURE__ */ jsxs8(Fragment, { children: [
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Plugin:  " }),
          /* @__PURE__ */ jsx10(Text9, { color: "green", children: selected.description })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Function:" }),
          /* @__PURE__ */ jsxs8(Text9, { children: [
            " ",
            parseMcpFunctionName(selected.toolName ?? "")
          ] })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Status:  " }),
          /* @__PURE__ */ jsx10(Text9, { color: selected.status === "completed" ? "green" : selected.status === "error" ? "red" : "yellow", children: selected.status === "completed" ? "\u2713 Completed" : selected.status === "error" ? "\u2717 Error" : "\u27F3 Running" })
        ] }),
        /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Called:  " }),
          /* @__PURE__ */ jsx10(Text9, { children: formatTimestamp2(selected.timestamp) })
        ] }),
        selected.completedAt && /* @__PURE__ */ jsxs8(Text9, { children: [
          /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Duration:" }),
          /* @__PURE__ */ jsxs8(Text9, { children: [
            " ",
            formatDuration(selected.timestamp, selected.completedAt)
          ] })
        ] })
      ] }),
      promptLines.length > 0 && /* @__PURE__ */ jsxs8(Box10, { flexDirection: "column", marginTop: 1, children: [
        /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: selected.type === "skill" || selected.type === "command" ? "Args:" : selected.type === "tool" || selected.type === "mcp" ? "Input:" : selected.type === "hook" ? "Command:" : "Prompt:" }),
        promptLines.map((line, i) => /* @__PURE__ */ jsx10(Text9, { wrap: "truncate", children: line }, i))
      ] }),
      resultLines.length > 0 && /* @__PURE__ */ jsxs8(Box10, { flexDirection: "column", marginTop: 1, children: [
        /* @__PURE__ */ jsx10(Text9, { dimColor: true, children: "Result:" }),
        resultLines.map((line, i) => /* @__PURE__ */ jsx10(Text9, { color: selected.isError ? "red" : "green", wrap: "truncate", children: line }, i))
      ] })
    ] })
  ] });
}

// src/App.tsx
import { jsx as jsx11, jsxs as jsxs9 } from "react/jsx-runtime";
function App({ adapter, projectPath }) {
  const { sessions, currentTasks, loading, error, selectSession } = useBackendData(adapter, { projectPath });
  const { exit } = useApp();
  const { stdout } = useStdout2();
  const sidebarVisibleHeight = Math.max(3, Math.floor(((stdout?.rows ?? 24) - 6) / 2));
  const [selectedSessionIndex, setSelectedSessionIndex] = useState6(0);
  const [selectedSessionId, setSelectedSessionId] = useState6(null);
  const [focusedPanel, setFocusedPanel] = useState6("sidebar");
  const [filter, setFilter] = useState6("active");
  const [showHelp, setShowHelp] = useState6(false);
  const [showTimeline, setShowTimeline] = useState6(false);
  const [timelineSnapshots, setTimelineSnapshots] = useState6([]);
  const [timelineLoading, setTimelineLoading] = useState6(false);
  const [showActivity, setShowActivity] = useState6(false);
  const [activityEntries, setActivityEntries] = useState6([]);
  const [activityLoading, setActivityLoading] = useState6(false);
  const filteredSessions = useMemo3(() => {
    if (filter === "all")
      return sessions;
    if (filter === "active")
      return sessions.filter((s) => !s.isArchived);
    return sessions.filter((s) => s.isArchived);
  }, [sessions, filter]);
  useEffect3(() => {
    if (filteredSessions.length === 0)
      return;
    if (!selectedSessionId) {
      setSelectedSessionId(filteredSessions[0].id);
      selectSession(filteredSessions[0].id);
      return;
    }
    const newIndex = filteredSessions.findIndex((s) => s.id === selectedSessionId);
    if (newIndex !== -1 && newIndex !== selectedSessionIndex) {
      setSelectedSessionIndex(newIndex);
    }
  }, [filteredSessions, selectedSessionId]);
  const prevSessionsRef = useRef5([]);
  useEffect3(() => {
    const prev = prevSessionsRef.current;
    if (prev.length > 0 && sessions.length > 0) {
      const changed = sessions.some((s) => {
        const p = prev.find((ps) => ps.id === s.id);
        return p && (p.completed !== s.completed || p.inProgress !== s.inProgress || p.pending !== s.pending);
      });
      if (changed && stdout) {
        stdout.write("\x07");
      }
    }
    prevSessionsRef.current = sessions;
  }, [sessions, stdout]);
  const handleSelectSession = useCallback3(
    (index) => {
      setSelectedSessionIndex(index);
      const session = filteredSessions[index];
      if (session) {
        setSelectedSessionId(session.id);
        selectSession(session.id);
      }
    },
    [filteredSessions, selectSession]
  );
  const handleOpenSession = useCallback3(
    (id) => {
      selectSession(id);
      setFocusedPanel("kanban");
    },
    [selectSession]
  );
  const handleFilterChange = useCallback3((newFilter) => {
    const lower = newFilter.toLowerCase();
    if (lower === "all" || lower === "active" || lower === "archived") {
      setFilter(lower);
    }
  }, []);
  const handleOpenTimeline = useCallback3(async () => {
    if (!adapter.capabilities.timeline)
      return;
    const session = filteredSessions[selectedSessionIndex];
    if (!session)
      return;
    setTimelineLoading(true);
    try {
      const snaps = await adapter.loadTimeline(session.id);
      setTimelineSnapshots(snaps);
      setShowTimeline(true);
    } finally {
      setTimelineLoading(false);
    }
  }, [adapter, filteredSessions, selectedSessionIndex]);
  const handleOpenActivity = useCallback3(async () => {
    if (!adapter.capabilities.activity)
      return;
    const session = filteredSessions[selectedSessionIndex];
    if (!session)
      return;
    setActivityLoading(true);
    try {
      const entries = await adapter.loadActivity(session.id);
      setActivityEntries(entries);
      setShowActivity(true);
    } finally {
      setActivityLoading(false);
    }
  }, [adapter, filteredSessions, selectedSessionIndex]);
  useInput6((input, key) => {
    if (showHelp) {
      if (key.escape || input === "?" || input === "q") {
        setShowHelp(false);
      }
      return;
    }
    if (showTimeline) {
      return;
    }
    if (showActivity) {
      return;
    }
    if (input === "q") {
      exit();
      return;
    }
    if (input === "?") {
      setShowHelp(true);
      return;
    }
    if (input === "f" && focusedPanel === "sidebar") {
      setFilter((prev) => {
        if (prev === "all")
          return "active";
        if (prev === "active")
          return "archived";
        return "all";
      });
      setSelectedSessionIndex(0);
      setSelectedSessionId(null);
      return;
    }
    if (input === "t" && focusedPanel === "sidebar" && filteredSessions.length > 0 && adapter.capabilities.timeline) {
      handleOpenTimeline();
      return;
    }
    if (input === "a" && focusedPanel === "sidebar" && filteredSessions.length > 0 && adapter.capabilities.activity) {
      handleOpenActivity();
      return;
    }
    if (key.tab) {
      setFocusedPanel((prev) => prev === "sidebar" ? "kanban" : "sidebar");
      return;
    }
  });
  const totalTasks = currentTasks.length;
  const doneTasks = currentTasks.filter((t) => t.status === "completed").length;
  const activeTasks = currentTasks.filter((t) => t.status === "in_progress").length;
  const pendingTasks = currentTasks.filter((t) => t.status === "pending").length;
  const clampedIndex = filteredSessions.length > 0 ? Math.min(selectedSessionIndex, filteredSessions.length - 1) : 0;
  const selectedSession = filteredSessions[clampedIndex];
  const projectName = useMemo3(() => projectPath ? path7.basename(projectPath) : null, [projectPath]);
  const sidebarHints = useMemo3(() => {
    const parts = ["j/k:navigate", "g/G:first/last", "f:filter"];
    if (adapter.capabilities.timeline)
      parts.push("t:timeline");
    if (adapter.capabilities.activity)
      parts.push("a:activity");
    parts.push("Enter:select", "Tab:\u2192kanban", "?:help", "q:quit");
    return parts.join("  ");
  }, [adapter.capabilities]);
  if (showHelp) {
    return /* @__PURE__ */ jsx11(Box11, { flexDirection: "column", children: /* @__PURE__ */ jsx11(Panel, { title: "Help", borderColor: "yellow", children: /* @__PURE__ */ jsx11(HelpOverlay, { onClose: () => setShowHelp(false) }) }) });
  }
  if (showTimeline) {
    return /* @__PURE__ */ jsx11(Box11, { flexDirection: "column", children: /* @__PURE__ */ jsx11(Panel, { title: "Timeline", borderColor: "magenta", children: /* @__PURE__ */ jsx11(
      TimelineOverlay,
      {
        snapshots: timelineSnapshots,
        sessionName: selectedSession?.name ?? selectedSession?.id ?? "Unknown",
        onClose: () => setShowTimeline(false)
      }
    ) }) });
  }
  if (showActivity) {
    return /* @__PURE__ */ jsx11(Box11, { flexDirection: "column", children: /* @__PURE__ */ jsx11(Panel, { title: "Activity", borderColor: "blue", children: /* @__PURE__ */ jsx11(
      ActivityOverlay,
      {
        entries: activityEntries,
        sessionName: selectedSession?.name ?? selectedSession?.id ?? "Unknown",
        onClose: () => setShowActivity(false)
      }
    ) }) });
  }
  return /* @__PURE__ */ jsxs9(Box11, { flexDirection: "column", children: [
    /* @__PURE__ */ jsxs9(Box11, { children: [
      /* @__PURE__ */ jsxs9(Text10, { bold: true, color: "cyan", children: [
        " CLIboard",
        projectName ? ` \u2500 ${projectName}` : "",
        " "
      ] }),
      /* @__PURE__ */ jsx11(Text10, { dimColor: true, children: " \u2502 " }),
      loading || timelineLoading || activityLoading ? /* @__PURE__ */ jsxs9(Text10, { color: "yellow", children: [
        "\u27F3 ",
        timelineLoading ? "loading timeline..." : activityLoading ? "loading agents..." : "loading..."
      ] }) : /* @__PURE__ */ jsxs9(Text10, { dimColor: true, children: [
        filteredSessions.length,
        " sessions",
        adapter.displayName !== "Claude Code" ? ` (${adapter.displayName})` : "",
        selectedSession ? ` \u2502 ${selectedSession.name ?? selectedSession.id}` : "",
        selectedSession?.gitBranch ? ` (${selectedSession.gitBranch})` : "",
        totalTasks > 0 ? ` \u2502 ${doneTasks}\u2713 ${activeTasks}\u27F3 ${pendingTasks}\u25CB` : ""
      ] })
    ] }),
    error && /* @__PURE__ */ jsx11(Box11, { marginLeft: 1, children: /* @__PURE__ */ jsxs9(Text10, { color: "red", children: [
      "\u26A0 ",
      error
    ] }) }),
    /* @__PURE__ */ jsxs9(Box11, { flexDirection: "row", flexGrow: 1, children: [
      /* @__PURE__ */ jsx11(Box11, { width: 32, children: /* @__PURE__ */ jsx11(
        Panel,
        {
          title: `Sessions (${filteredSessions.length > 0 ? clampedIndex + 1 : 0}/${filteredSessions.length})`,
          borderColor: focusedPanel === "sidebar" ? "cyan" : "gray",
          focused: focusedPanel === "sidebar",
          children: /* @__PURE__ */ jsx11(
            Sidebar,
            {
              sessions: filteredSessions,
              selectedIndex: clampedIndex,
              onSelect: handleSelectSession,
              onOpen: handleOpenSession,
              filter,
              onFilterChange: handleFilterChange,
              isActive: focusedPanel === "sidebar",
              visibleHeight: sidebarVisibleHeight
            }
          )
        }
      ) }),
      /* @__PURE__ */ jsx11(Box11, { flexGrow: 1, children: /* @__PURE__ */ jsx11(
        Panel,
        {
          title: `Tasks${selectedSession ? ` \u2500 ${selectedSession.name ?? selectedSession.id}` : ""}`,
          borderColor: focusedPanel === "kanban" ? "cyan" : "gray",
          focused: focusedPanel === "kanban",
          children: adapter.capabilities.tasks ? /* @__PURE__ */ jsx11(NavigableKanban, { tasks: currentTasks, isActive: focusedPanel === "kanban" }) : /* @__PURE__ */ jsx11(Text10, { dimColor: true, children: "No tasks available for this backend" })
        }
      ) })
    ] }),
    /* @__PURE__ */ jsx11(Box11, { children: /* @__PURE__ */ jsxs9(Text10, { backgroundColor: "gray", color: "white", children: [
      " ",
      focusedPanel === "sidebar" ? sidebarHints : "h/j/k/l:navigate  Enter:open  Tab:\u2192sessions  Esc:back  ?:help  q:quit",
      " "
    ] }) })
  ] });
}
function Panel({ title, borderColor = "gray", focused, children }) {
  return /* @__PURE__ */ jsxs9(
    Box11,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor,
      flexGrow: 1,
      paddingLeft: 1,
      paddingRight: 1,
      children: [
        /* @__PURE__ */ jsxs9(Box11, { marginTop: -1, children: [
          /* @__PURE__ */ jsx11(Text10, { color: borderColor, children: focused ? "\u2578" : " " }),
          /* @__PURE__ */ jsxs9(Text10, { bold: true, color: focused ? "cyan" : "white", children: [
            " ",
            title,
            " "
          ] })
        ] }),
        children
      ]
    }
  );
}

// src/cli.tsx
function expandTilde(filePath) {
  if (filePath.startsWith("~")) {
    return path8.join(os4.homedir(), filePath.slice(1));
  }
  return filePath;
}
function resolveDir(opts, fallback) {
  let dir = opts.dir ?? fallback ?? process.env.CLAUDE_DIR ?? path8.join(os4.homedir(), ".claude");
  if (dir.startsWith("~")) {
    dir = expandTilde(dir);
  }
  return dir;
}
function createProgram(claudeDir) {
  const program = new Command4();
  program.name("cliboard").description("CLIboard \u2014 terminal kanban for AI coding agent tasks").version("1.0.0").option("--dir <path>", "Claude config directory").option("--project <path>", "Scope to a specific project directory").option("--backend <backend>", "Backend: claude, opencode, auto (default: auto)").action(async () => {
    const opts = program.opts();
    const dir = resolveDir(opts, claudeDir);
    const projectPath = opts.project;
    const backend = opts.backend ?? "auto";
    if (process.stdout.isTTY) {
      const adapter = await createAdapter(backend, dir);
      render(React7.createElement(App, { adapter, projectPath }));
    }
  });
  const resolvedDir = claudeDir ?? process.env.CLAUDE_DIR ?? path8.join(os4.homedir(), ".claude");
  program.addCommand(createListCommand(resolvedDir));
  program.addCommand(createShowCommand(resolvedDir));
  program.addCommand(createWatchCommand(resolvedDir));
  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (typeof opts.dir === "string") {
      opts.dir = expandTilde(opts.dir);
    }
  });
  return program;
}
var isTestEnv = typeof process.env.VITEST !== "undefined";
if (!isTestEnv) {
  const program = createProgram();
  program.parse(process.argv);
}
export {
  createProgram
};
