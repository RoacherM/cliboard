import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Task, JsonlEntry, SessionsIndex } from '../../src/lib/types.js';

export async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cliboard-test-'));
  return dir;
}

/**
 * Writes a todos-format file: {sessionId}-agent-{agentId}.json
 * containing a JSON array of {content, status, activeForm} entries.
 */
export async function writeTempTodoFile(
  baseDir: string,
  sessionId: string,
  agentId: string,
  entries: Array<{ content: string; status: string; activeForm?: string }>,
): Promise<string> {
  const todosDir = path.join(baseDir, 'todos');
  await fs.mkdir(todosDir, { recursive: true });

  const filePath = path.join(todosDir, `${sessionId}-agent-${agentId}.json`);
  await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  return filePath;
}

/**
 * @deprecated Use writeTempTodoFile instead. Kept for backward compatibility.
 */
export async function writeTempTaskFile(
  baseDir: string,
  sessionId: string,
  taskId: string,
  task: Partial<Task>,
): Promise<string> {
  // Write as todos format: single-entry array file
  const entry = {
    content: task.subject ?? 'Test task',
    status: task.status ?? 'pending',
    activeForm: task.activeForm ?? 'Testing',
  };
  return writeTempTodoFile(baseDir, sessionId, taskId, [entry]);
}

export async function writeTempJsonlFile(
  baseDir: string,
  projectPath: string,
  sessionId: string,
  entries: JsonlEntry[],
): Promise<string> {
  const jsonlDir = path.join(baseDir, 'projects', projectPath);
  await fs.mkdir(jsonlDir, { recursive: true });

  const filePath = path.join(jsonlDir, `${sessionId}.jsonl`);
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export async function writeTempSessionsIndex(
  baseDir: string,
  projectPath: string,
  index: SessionsIndex,
): Promise<string> {
  const indexDir = path.join(baseDir, 'projects', projectPath);
  await fs.mkdir(indexDir, { recursive: true });

  const filePath = path.join(indexDir, 'sessions-index.json');
  await fs.writeFile(filePath, JSON.stringify(index, null, 2), 'utf-8');
  return filePath;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
