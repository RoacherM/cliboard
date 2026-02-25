import os from 'node:os';
import path from 'node:path';

export const DEFAULT_CLAUDE_DIR = path.join(os.homedir(), '.claude');
export const TASKS_SUBDIR = 'todos';
export const PROJECTS_SUBDIR = 'projects';
export const METADATA_CACHE_TTL = 10_000; // 10 seconds
export const ARCHIVE_THRESHOLD_DAYS = 7;
export const WATCHER_DEBOUNCE_MS = 200;
export const SEARCH_DEBOUNCE_MS = 150;
export const JSONL_READ_LIMIT = 65_536; // 64KB
export const AUTO_REFRESH_MS = 5_000; // 5 seconds
