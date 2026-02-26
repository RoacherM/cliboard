import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskDataService } from '../../../src/lib/taskDataService.js';
import {
  createTempDir,
  writeTempTodoFile,
  cleanupTempDir,
} from '../../helpers/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Fake UUIDs for deterministic tests
const SESSION_1 = '11111111-1111-1111-1111-111111111111';
const SESSION_2 = '22222222-2222-2222-2222-222222222222';
const SESSION_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SESSION_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const AGENT_1 = 'a0000001-0000-0000-0000-000000000001';
const AGENT_2 = 'a0000002-0000-0000-0000-000000000002';

describe('TaskDataService - read operations (todos format)', () => {
  let tmpDir: string;
  let service: TaskDataService;

  beforeEach(async () => {
    tmpDir = await createTempDir();
    service = new TaskDataService(tmpDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tmpDir);
  });

  describe('listSessions', () => {
    it('returns unique session UUIDs from todos/ filenames', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'Task A', status: 'pending' },
      ]);
      await writeTempTodoFile(tmpDir, SESSION_2, AGENT_2, [
        { content: 'Task B', status: 'pending' },
      ]);

      const sessions = await service.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(SESSION_1);
      expect(sessions).toContain(SESSION_2);
    });

    it('deduplicates when multiple agent files exist for same session', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'Task A', status: 'pending' },
      ]);
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_2, [
        { content: 'Task B', status: 'pending' },
      ]);

      const sessions = await service.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions).toContain(SESSION_1);
    });

    it('returns empty array when todos directory does not exist', async () => {
      const sessions = await service.listSessions();

      expect(sessions).toEqual([]);
    });

    it('returns empty array when todos directory is empty', async () => {
      await fs.mkdir(path.join(tmpDir, 'todos'), { recursive: true });

      const sessions = await service.listSessions();

      expect(sessions).toEqual([]);
    });

    it('ignores files not matching the todos naming pattern', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'Task A', status: 'pending' },
      ]);
      // Create a stray file that doesn't match the pattern
      await fs.writeFile(path.join(tmpDir, 'todos', 'stray-file.txt'), 'not a session');

      const sessions = await service.listSessions();

      expect(sessions).toEqual([SESSION_1]);
    });
  });

  describe('readSessionTasks', () => {
    it('reads task entries from a todos file', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'First task', status: 'pending' },
        { content: 'Second task', status: 'in_progress' },
        { content: 'Third task', status: 'completed' },
      ]);

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].subject).toBe('First task');
      expect(tasks[0].status).toBe('pending');
      expect(tasks[1].subject).toBe('Second task');
      expect(tasks[1].status).toBe('in_progress');
      expect(tasks[2].subject).toBe('Third task');
      expect(tasks[2].status).toBe('completed');
    });

    it('assigns sequential string IDs starting from 1', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'First', status: 'pending' },
        { content: 'Second', status: 'pending' },
      ]);

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks[0].id).toBe('1');
      expect(tasks[1].id).toBe('2');
    });

    it('maps activeForm from entry', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'Task', status: 'in_progress', activeForm: 'Running tests' },
      ]);

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks[0].activeForm).toBe('Running tests');
    });

    it('sets empty defaults for missing optional fields', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'Task', status: 'pending' },
      ]);

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks[0].description).toBe('');
      expect(tasks[0].activeForm).toBe('');
      expect(tasks[0].blocks).toEqual([]);
      expect(tasks[0].blockedBy).toEqual([]);
    });

    it('populates createdAt and updatedAt from file stats', async () => {
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'Timestamp test', status: 'pending' },
      ]);

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks[0].createdAt).toBeDefined();
      expect(tasks[0].updatedAt).toBeDefined();
      expect(() => new Date(tasks[0].createdAt!).toISOString()).not.toThrow();
      expect(() => new Date(tasks[0].updatedAt!).toISOString()).not.toThrow();
    });

    it('returns empty array for non-existent session', async () => {
      const tasks = await service.readSessionTasks('00000000-0000-0000-0000-000000000000');

      expect(tasks).toEqual([]);
    });

    it('returns empty for malformed JSON files', async () => {
      const todosDir = path.join(tmpDir, 'todos');
      await fs.mkdir(todosDir, { recursive: true });
      await fs.writeFile(
        path.join(todosDir, `${SESSION_1}-agent-${AGENT_1}.json`),
        '{not valid json!!!',
        'utf-8',
      );

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks).toEqual([]);
    });

    it('skips entries missing required content field', async () => {
      const todosDir = path.join(tmpDir, 'todos');
      await fs.mkdir(todosDir, { recursive: true });
      await fs.writeFile(
        path.join(todosDir, `${SESSION_1}-agent-${AGENT_1}.json`),
        JSON.stringify([
          { content: 'Good task', status: 'pending' },
          { content: '', status: 'pending' },
        ]),
        'utf-8',
      );

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].subject).toBe('Good task');
    });

    it('skips entries missing required status field', async () => {
      const todosDir = path.join(tmpDir, 'todos');
      await fs.mkdir(todosDir, { recursive: true });
      await fs.writeFile(
        path.join(todosDir, `${SESSION_1}-agent-${AGENT_1}.json`),
        JSON.stringify([
          { content: 'Good task', status: 'pending' },
          { content: 'Bad task' },
        ]),
        'utf-8',
      );

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].subject).toBe('Good task');
    });

    it('returns empty for non-array JSON', async () => {
      const todosDir = path.join(tmpDir, 'todos');
      await fs.mkdir(todosDir, { recursive: true });
      await fs.writeFile(
        path.join(todosDir, `${SESSION_1}-agent-${AGENT_1}.json`),
        JSON.stringify({ content: 'Not an array' }),
        'utf-8',
      );

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks).toEqual([]);
    });

    it('picks the newest file when multiple agent files exist for a session', async () => {
      // Write older file
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_1, [
        { content: 'Old task', status: 'pending' },
      ]);
      // Small delay so mtime differs
      await new Promise((r) => setTimeout(r, 50));
      // Write newer file
      await writeTempTodoFile(tmpDir, SESSION_1, AGENT_2, [
        { content: 'New task', status: 'completed' },
      ]);

      const tasks = await service.readSessionTasks(SESSION_1);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].subject).toBe('New task');
      expect(tasks[0].status).toBe('completed');
    });
  });

  describe('readAllTasks', () => {
    it('reads tasks across all sessions', async () => {
      await writeTempTodoFile(tmpDir, SESSION_A, AGENT_1, [
        { content: 'Task from session A', status: 'pending' },
        { content: 'Another from A', status: 'completed' },
      ]);
      await writeTempTodoFile(tmpDir, SESSION_B, AGENT_2, [
        { content: 'Task from session B', status: 'in_progress' },
      ]);

      const tasks = await service.readAllTasks();

      expect(tasks).toHaveLength(3);
      const subjects = tasks.map((t) => t.subject);
      expect(subjects).toContain('Task from session A');
      expect(subjects).toContain('Another from A');
      expect(subjects).toContain('Task from session B');
    });

    it('populates sessionId on each task', async () => {
      await writeTempTodoFile(tmpDir, SESSION_A, AGENT_1, [
        { content: 'Task A', status: 'pending' },
      ]);
      await writeTempTodoFile(tmpDir, SESSION_B, AGENT_2, [
        { content: 'Task B', status: 'pending' },
      ]);

      const tasks = await service.readAllTasks();

      expect(tasks).toHaveLength(2);
      const taskA = tasks.find((t) => t.subject === 'Task A');
      const taskB = tasks.find((t) => t.subject === 'Task B');
      expect(taskA?.sessionId).toBe(SESSION_A);
      expect(taskB?.sessionId).toBe(SESSION_B);
    });

    it('returns empty array when no todos directory exists', async () => {
      const tasks = await service.readAllTasks();

      expect(tasks).toEqual([]);
    });

    it('returns empty array when todos directory has no matching files', async () => {
      await fs.mkdir(path.join(tmpDir, 'todos'), { recursive: true });

      const tasks = await service.readAllTasks();

      expect(tasks).toEqual([]);
    });
  });

  describe('readSessionsTasks', () => {
    it('reads tasks for multiple sessions in one call', async () => {
      await writeTempTodoFile(tmpDir, SESSION_A, AGENT_1, [
        { content: 'Task from A', status: 'pending' },
      ]);
      await writeTempTodoFile(tmpDir, SESSION_B, AGENT_2, [
        { content: 'Task from B', status: 'in_progress' },
      ]);

      const result = await service.readSessionsTasks([SESSION_A, SESSION_B]);

      expect(result.get(SESSION_A)).toHaveLength(1);
      expect(result.get(SESSION_A)?.[0].subject).toBe('Task from A');
      expect(result.get(SESSION_B)).toHaveLength(1);
      expect(result.get(SESSION_B)?.[0].subject).toBe('Task from B');
    });

    it('returns empty task arrays for sessions with no matching files', async () => {
      await writeTempTodoFile(tmpDir, SESSION_A, AGENT_1, [
        { content: 'Task from A', status: 'pending' },
      ]);

      const result = await service.readSessionsTasks([
        SESSION_A,
        '00000000-0000-0000-0000-000000000000',
      ]);

      expect(result.get(SESSION_A)).toHaveLength(1);
      expect(result.get('00000000-0000-0000-0000-000000000000')).toEqual([]);
    });
  });
});
