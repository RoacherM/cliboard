import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { OpenCodeBackendAdapter } from '../../../../../src/lib/backends/opencode/adapter.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Create a temp DB file for tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliboard-opencode-'));
const dbPath = path.join(tmpDir, 'test-opencode.db');

function seedDatabase() {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      worktree TEXT NOT NULL,
      vcs TEXT,
      name TEXT,
      icon_url TEXT,
      icon_color TEXT,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      time_initialized INTEGER,
      sandboxes TEXT NOT NULL,
      commands TEXT
    );

    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      slug TEXT NOT NULL,
      directory TEXT NOT NULL,
      title TEXT NOT NULL,
      version TEXT NOT NULL,
      share_url TEXT,
      summary_additions INTEGER,
      summary_deletions INTEGER,
      summary_files INTEGER,
      summary_diffs TEXT,
      revert TEXT,
      permission TEXT,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      time_compacting INTEGER,
      time_archived INTEGER,
      FOREIGN KEY (project_id) REFERENCES project(id)
    );

    CREATE TABLE todo (
      session_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      position INTEGER NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      PRIMARY KEY (session_id, position),
      FOREIGN KEY (session_id) REFERENCES session(id)
    );

    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES session(id)
    );

    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES message(id)
    );
  `);

  const now = Date.now();
  const hour = 3600_000;

  // Insert project
  db.prepare(
    `INSERT INTO project (id, worktree, sandboxes, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?)`,
  ).run('proj-1', '/home/user/my-project', '[]', now - 10 * hour, now);

  // Insert sessions: one with todos, one without, one child session
  db.prepare(
    `INSERT INTO session (id, project_id, parent_id, slug, directory, title, version, time_created, time_updated, time_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-1', 'proj-1', null, 'my-session', '/home/user/my-project', 'Build Feature X', 'v1', now - 5 * hour, now - hour, null);

  db.prepare(
    `INSERT INTO session (id, project_id, parent_id, slug, directory, title, version, time_created, time_updated, time_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-2', 'proj-1', null, 'empty-session', '/home/user/my-project', 'Empty Session', 'v1', now - 3 * hour, now - 2 * hour, null);

  // Child session (sub-session) — should NOT appear in results
  db.prepare(
    `INSERT INTO session (id, project_id, parent_id, slug, directory, title, version, time_created, time_updated, time_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-3', 'proj-1', 'ses-1', 'child-session', '/home/user/my-project', 'Sub Session', 'v1', now - 2 * hour, now - hour, null);

  // Archived session with todos
  db.prepare(
    `INSERT INTO session (id, project_id, parent_id, slug, directory, title, version, time_created, time_updated, time_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-4', 'proj-1', null, 'archived-session', '/home/user/my-project', 'Old Session', 'v1', now - 20 * hour, now - 10 * hour, now - 5 * hour);

  // Insert todos for ses-1
  db.prepare(
    `INSERT INTO todo (session_id, content, status, priority, position, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-1', 'Setup database', 'completed', 'high', 0, now - 4 * hour, now - 3 * hour);

  db.prepare(
    `INSERT INTO todo (session_id, content, status, priority, position, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-1', 'Build API endpoints', 'in_progress', 'high', 1, now - 3 * hour, now - 2 * hour);

  db.prepare(
    `INSERT INTO todo (session_id, content, status, priority, position, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-1', 'Write tests', 'pending', 'medium', 2, now - 2 * hour, now - hour);

  // Insert todos for child session (should be loadable when directly requested)
  db.prepare(
    `INSERT INTO todo (session_id, content, status, priority, position, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-3', 'Child task', 'pending', 'low', 0, now - 2 * hour, now - hour);

  // Insert todos for archived session
  db.prepare(
    `INSERT INTO todo (session_id, content, status, priority, position, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('ses-4', 'Legacy task', 'completed', 'high', 0, now - 15 * hour, now - 10 * hour);

  // Insert message for parts
  db.prepare(
    `INSERT INTO message (id, session_id, role, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run('msg-1', 'ses-1', 'assistant', now - 3 * hour, now - 3 * hour, '{}');

  // Insert parts (tool calls + subtask)
  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    'prt-1', 'msg-1', 'ses-1', now - 3 * hour, now - 3 * hour,
    JSON.stringify({
      type: 'tool',
      tool: 'bash',
      state: {
        status: 'completed',
        input: { command: 'npm test', description: 'Run tests' },
        output: 'All tests passed',
        title: 'Run tests',
        time: { start: now - 3 * hour, end: now - 3 * hour + 5000 },
      },
    }),
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    'prt-2', 'msg-1', 'ses-1', now - 2.5 * hour, now - 2.5 * hour,
    JSON.stringify({
      type: 'tool',
      tool: 'read',
      state: {
        status: 'completed',
        input: { filePath: '/src/index.ts' },
        title: '',
        time: { start: now - 2.5 * hour, end: now - 2.5 * hour + 100 },
      },
    }),
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    'prt-3', 'msg-1', 'ses-1', now - 2 * hour, now - 2 * hour,
    JSON.stringify({
      type: 'subtask',
      prompt: 'Explore the codebase',
      description: 'explore codebase',
      agent: 'Explore',
      command: 'explore',
    }),
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    'prt-4', 'msg-1', 'ses-1', now - 1.5 * hour, now - 1.5 * hour,
    JSON.stringify({
      type: 'tool',
      tool: 'grep_app_searchGitHub',
      state: {
        status: 'completed',
        input: { query: 'interface Config' },
        title: 'Search GitHub for interface Config',
        time: { start: now - 1.5 * hour, end: now - 1.5 * hour + 2000 },
      },
    }),
  );

  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    'prt-5', 'msg-1', 'ses-1', now - hour, now - hour,
    JSON.stringify({
      type: 'tool',
      tool: 'skill',
      state: {
        status: 'completed',
        input: { name: 'commit', args: '-m "fix: bug"' },
        title: 'Invoke skill: commit',
        time: { start: now - hour, end: now - hour + 500 },
      },
    }),
  );

  // Insert a text/thinking part that should be skipped
  db.prepare(
    `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    'prt-6', 'msg-1', 'ses-1', now - 0.5 * hour, now - 0.5 * hour,
    JSON.stringify({ type: 'text', content: 'Let me think about this...' }),
  );

  db.close();
}

let adapter: OpenCodeBackendAdapter;

beforeAll(() => {
  seedDatabase();
  adapter = new OpenCodeBackendAdapter(dbPath);
});

afterAll(async () => {
  await adapter.dispose();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('OpenCodeBackendAdapter', () => {
  describe('initialize', () => {
    it('should return true when database exists', async () => {
      expect(await adapter.initialize()).toBe(true);
    });

    it('should return false when database does not exist', async () => {
      const missing = new OpenCodeBackendAdapter('/nonexistent/path.db');
      expect(await missing.initialize()).toBe(false);
    });
  });

  describe('loadSessions', () => {
    it('should load only parent sessions with todos', async () => {
      const sessions = await adapter.loadSessions();
      // ses-1 (has todos), ses-4 (archived, has todos) — ses-2 (no todos) and ses-3 (child) excluded
      expect(sessions).toHaveLength(2);
      const ids = sessions.map((s) => s.id);
      expect(ids).toContain('ses-1');
      expect(ids).toContain('ses-4');
      expect(ids).not.toContain('ses-2'); // no todos
      expect(ids).not.toContain('ses-3'); // child session
    });

    it('should populate session fields correctly', async () => {
      const sessions = await adapter.loadSessions();
      const s1 = sessions.find((s) => s.id === 'ses-1')!;

      expect(s1.name).toBe('Build Feature X');
      expect(s1.slug).toBe('my-session');
      expect(s1.project).toBe('/home/user/my-project');
      expect(s1.taskCount).toBe(3);
      expect(s1.completed).toBe(1);
      expect(s1.inProgress).toBe(1);
      expect(s1.pending).toBe(1);
      expect(s1.isArchived).toBe(false);
      expect(s1.backendId).toBe('opencode');
      expect(s1.jsonlPath).toBeNull();
    });

    it('should mark archived sessions correctly', async () => {
      const sessions = await adapter.loadSessions();
      const s4 = sessions.find((s) => s.id === 'ses-4')!;
      expect(s4.isArchived).toBe(true);
    });

    it('should sort sessions by time_updated descending', async () => {
      const sessions = await adapter.loadSessions();
      for (let i = 1; i < sessions.length; i++) {
        const prev = new Date(sessions[i - 1].modifiedAt).getTime();
        const curr = new Date(sessions[i].modifiedAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  describe('loadSessionTasks', () => {
    it('should load todos for a session', async () => {
      const tasks = await adapter.loadSessionTasks('ses-1');
      expect(tasks).toHaveLength(3);
    });

    it('should map task fields correctly', async () => {
      const tasks = await adapter.loadSessionTasks('ses-1');
      const first = tasks[0];

      expect(first.subject).toBe('Setup database');
      expect(first.status).toBe('completed');
      expect(first.priority).toBe(3); // high → 3
      expect(first.position).toBe(0);
      expect(first.sessionId).toBe('ses-1');
    });

    it('should preserve task ordering by position', async () => {
      const tasks = await adapter.loadSessionTasks('ses-1');
      expect(tasks[0].subject).toBe('Setup database');
      expect(tasks[1].subject).toBe('Build API endpoints');
      expect(tasks[2].subject).toBe('Write tests');
    });

    it('should map all priority levels', async () => {
      const tasks = await adapter.loadSessionTasks('ses-1');
      expect(tasks[0].priority).toBe(3); // high
      expect(tasks[2].priority).toBe(2); // medium
    });

    it('should return empty array for session with no todos', async () => {
      const tasks = await adapter.loadSessionTasks('ses-2');
      expect(tasks).toHaveLength(0);
    });
  });

  describe('loadActivity', () => {
    it('should load tool and subtask activity entries', async () => {
      const entries = await adapter.loadActivity('ses-1');
      // prt-1 (bash tool), prt-2 (read tool), prt-3 (subtask), prt-4 (mcp tool), prt-5 (skill)
      // prt-6 (text) should be excluded
      expect(entries).toHaveLength(5);
    });

    it('should classify tool types correctly', async () => {
      const entries = await adapter.loadActivity('ses-1');
      const types = entries.map((e) => e.type);
      expect(types).toContain('tool');      // bash, read
      expect(types).toContain('subagent');  // subtask
      expect(types).toContain('mcp');       // grep_app_searchGitHub
      expect(types).toContain('skill');     // skill tool
    });

    it('should populate tool activity fields', async () => {
      const entries = await adapter.loadActivity('ses-1');
      const bash = entries.find((e) => e.toolName === 'bash')!;

      expect(bash.type).toBe('tool');
      expect(bash.description).toBe('Run tests');
      expect(bash.status).toBe('completed');
      expect(bash.resultSummary).toBe('All tests passed');
    });

    it('should populate subtask activity fields', async () => {
      const entries = await adapter.loadActivity('ses-1');
      const subtask = entries.find((e) => e.type === 'subagent')!;

      expect(subtask.subagentType).toBe('Explore');
      expect(subtask.description).toBe('explore codebase');
    });

    it('should classify MCP tools correctly', async () => {
      const entries = await adapter.loadActivity('ses-1');
      const mcp = entries.find((e) => e.type === 'mcp')!;

      expect(mcp.toolName).toBe('grep_app_searchGitHub');
      expect(mcp.description).toBe('grep_app');
    });

    it('should classify skill tools correctly', async () => {
      const entries = await adapter.loadActivity('ses-1');
      const skill = entries.find((e) => e.type === 'skill')!;

      expect(skill.skillName).toBe('commit');
      expect(skill.skillArgs).toBe('-m "fix: bug"');
    });

    it('should return empty array for session with no parts', async () => {
      const entries = await adapter.loadActivity('ses-2');
      expect(entries).toHaveLength(0);
    });
  });

  describe('loadTimeline', () => {
    it('should return empty array (not supported)', async () => {
      const snapshots = await adapter.loadTimeline('ses-1');
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('capabilities', () => {
    it('should report correct capabilities', () => {
      expect(adapter.capabilities.tasks).toBe(true);
      expect(adapter.capabilities.timeline).toBe(false);
      expect(adapter.capabilities.activity).toBe(true);
      expect(adapter.capabilities.gitBranch).toBe(false);
    });
  });

  describe('checkCacheState', () => {
    it('should detect stale state on first call', async () => {
      const fresh = new OpenCodeBackendAdapter(dbPath);
      const { isStale } = await fresh.checkCacheState();
      expect(isStale).toBe(true);
      await fresh.dispose();
    });

    it('should report not stale on second consecutive call', async () => {
      const fresh = new OpenCodeBackendAdapter(dbPath);
      await fresh.checkCacheState(); // sets mtime
      const { isStale } = await fresh.checkCacheState();
      expect(isStale).toBe(false);
      await fresh.dispose();
    });
  });
});
