import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { BackendAdapter, BackendId } from './types.js';
import { ClaudeBackendAdapter } from './claude/adapter.js';
import { CompositeBackendAdapter } from './composite/adapter.js';

const OPENCODE_DB_PATH = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
const CLAUDE_DIR_PATH = path.join(os.homedir(), '.claude');

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function detectAvailableBackends(claudeDir?: string): Promise<BackendId[]> {
  const available: BackendId[] = [];

  if (await pathExists(claudeDir ?? CLAUDE_DIR_PATH)) {
    available.push('claude');
  }
  if (await pathExists(OPENCODE_DB_PATH)) {
    available.push('opencode');
  }

  return available;
}

async function createSingleAdapter(
  id: BackendId,
  claudeDir: string,
): Promise<BackendAdapter> {
  if (id === 'claude') {
    return new ClaudeBackendAdapter(claudeDir);
  }
  const { OpenCodeBackendAdapter } = await import('./opencode/adapter.js');
  return new OpenCodeBackendAdapter();
}

export async function createAdapter(
  backend: string,
  claudeDir: string,
): Promise<BackendAdapter> {
  if (backend === 'auto') {
    const available = await detectAvailableBackends(claudeDir);

    if (available.length > 1) {
      const adapters = await Promise.all(
        available.map((id) => createSingleAdapter(id, claudeDir)),
      );
      return new CompositeBackendAdapter(adapters);
    }

    if (available.length === 1) {
      return createSingleAdapter(available[0]!, claudeDir);
    }

    // Nothing detected — default to Claude
    return new ClaudeBackendAdapter(claudeDir);
  }

  if (backend === 'claude' || backend === 'opencode') {
    return createSingleAdapter(backend, claudeDir);
  }

  throw new Error(`Unknown backend: ${backend}. Valid options: claude, opencode, auto`);
}
