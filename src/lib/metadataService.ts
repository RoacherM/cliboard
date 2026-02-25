import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {
  PROJECTS_SUBDIR,
  METADATA_CACHE_TTL as _METADATA_CACHE_TTL,
  JSONL_READ_LIMIT as _JSONL_READ_LIMIT,
} from './constants.js';
import type {
  SessionMetadata,
  SessionIndexEntry,
  SessionsIndex,
  JsonlEntry,
} from './types.js';

// Re-export constants so tests can import from this module
export const METADATA_CACHE_TTL = _METADATA_CACHE_TTL;
export const JSONL_READ_LIMIT = _JSONL_READ_LIMIT;

/** Encode an absolute path to the directory-name format used under ~/.claude/projects/ */
export function encodeProjectKey(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

interface CacheEntry {
  data: Map<string, SessionMetadata>;
  timestamp: number;
}

export class MetadataService {
  private claudeDir: string;
  private cache: CacheEntry | null = null;

  constructor(claudeDir: string) {
    this.claudeDir = claudeDir;
  }

  async loadAllMetadata(): Promise<Map<string, SessionMetadata>> {
    // Return cached data if still valid
    if (this.cache && Date.now() - this.cache.timestamp < METADATA_CACHE_TTL) {
      return this.cache.data;
    }

    const result = new Map<string, SessionMetadata>();
    const projectsDir = path.join(this.claudeDir, PROJECTS_SUBDIR);

    let projectDirEntries: Array<{ fullPath: string; dirName: string }>;
    try {
      const entries = await fs.readdir(projectsDir, { withFileTypes: true });
      projectDirEntries = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ fullPath: path.join(projectsDir, e.name), dirName: e.name }));
    } catch {
      projectDirEntries = [];
    }

    for (const { fullPath: projectDir, dirName: projectDirName } of projectDirEntries) {
      // Load sessions index for this project
      const indexEntries = await this.loadSessionsIndex(projectDir);
      const indexMap = new Map<string, SessionIndexEntry>();
      for (const entry of indexEntries) {
        indexMap.set(entry.id, entry);
      }

      // Find all .jsonl files in this project directory
      let files: string[];
      try {
        const dirEntries = await fs.readdir(projectDir);
        files = dirEntries.filter((f) => f.endsWith('.jsonl'));
      } catch {
        files = [];
      }

      for (const file of files) {
        const sessionId = path.basename(file, '.jsonl');
        const jsonlPath = path.join(projectDir, file);

        // Read JSONL metadata
        const jsonlInfo = await this.readSessionInfoFromJsonl(jsonlPath);

        // Get index entry if available
        const indexEntry = indexMap.get(sessionId);

        const metadata: SessionMetadata = {
          customTitle: jsonlInfo.customTitle ?? null,
          slug: jsonlInfo.slug ?? indexEntry?.slug ?? null,
          project: jsonlInfo.project ?? indexEntry?.project ?? null,
          projectDir: projectDirName,
          jsonlPath,
          description: indexEntry?.description ?? null,
          gitBranch: jsonlInfo.gitBranch ?? indexEntry?.gitBranch ?? null,
          created: indexEntry?.created ?? null,
          summary: indexEntry?.summary ?? null,
        };

        result.set(sessionId, metadata);
      }
    }

    this.cache = {
      data: result,
      timestamp: Date.now(),
    };

    return result;
  }

  resolveSessionName(sessionId: string, metadata?: SessionMetadata): string {
    if (metadata?.customTitle) {
      return metadata.customTitle;
    }
    if (metadata?.slug) {
      return metadata.slug;
    }
    return sessionId.substring(0, 8) + '...';
  }

  async readSessionInfoFromJsonl(jsonlPath: string): Promise<Partial<SessionMetadata>> {
    const result: Partial<SessionMetadata> = {};

    let content: string;
    try {
      const fileHandle = await fs.open(jsonlPath, 'r');
      try {
        const buffer = Buffer.alloc(JSONL_READ_LIMIT);
        const { bytesRead } = await fileHandle.read(buffer, 0, JSONL_READ_LIMIT, 0);
        content = buffer.toString('utf-8', 0, bytesRead);
      } finally {
        await fileHandle.close();
      }
    } catch {
      return result;
    }

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let entry: JsonlEntry;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        // Skip malformed JSON lines
        continue;
      }

      if (entry.type === 'custom-title' && entry.customTitle) {
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

  async loadSessionsIndex(projectDir: string): Promise<SessionIndexEntry[]> {
    const indexPath = path.join(projectDir, 'sessions-index.json');
    try {
      const raw = await fs.readFile(indexPath, 'utf-8');
      const parsed = JSON.parse(raw) as SessionsIndex;
      if (!Array.isArray(parsed.sessions)) {
        return [];
      }
      return parsed.sessions;
    } catch {
      return [];
    }
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
