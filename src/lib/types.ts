export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  subject: string;
  description: string;
  activeForm: string;
  status: TaskStatus;
  blocks: string[];
  blockedBy: string[];
  createdAt?: string;
  updatedAt?: string;
  sessionId?: string;
  sessionName?: string;
  project?: string;
}

export interface Session {
  id: string;
  name: string | null;
  slug: string | null;
  project: string | null;
  description: string | null;
  gitBranch: string | null;
  taskCount: number;
  completed: number;
  inProgress: number;
  pending: number;
  createdAt: string | null;
  modifiedAt: string;
  isArchived: boolean;
  jsonlPath: string | null;
}

export interface SessionMetadata {
  customTitle: string | null;
  slug: string | null;
  project: string | null;
  projectDir: string;
  jsonlPath: string;
  description: string | null;
  gitBranch: string | null;
  created: string | null;
  summary: string | null;
}

export interface SessionIndexEntry {
  id: string;
  name?: string;
  description?: string;
  gitBranch?: string;
  created?: string;
  summary?: string;
  slug?: string;
  project?: string;
}

export interface SessionsIndex {
  sessions: SessionIndexEntry[];
}

export interface JsonlEntry {
  type?: string;
  message?: {
    role?: string;
    content?: string;
  };
  cwd?: string;
  slug?: string;
  customTitle?: string;
  gitBranch?: string;
  parentMessageId?: string;
  timestamp?: string;
}

export interface TodoTimelineEntry {
  timestamp: string | null;
  source: 'tool_use' | 'tool_result';
  todos: Array<{ content: string; status: string; activeForm?: string }>;
}

export interface SubAgentEntry {
  spawnId: string;            // tool_use id from Task block
  agentId: string | null;     // from agent_progress
  timestamp: string | null;   // spawn time
  subagentType: string;       // "Explore", "Plan", "general-purpose", etc.
  description: string;        // input.description
  prompt: string;             // input.prompt (full text)
  status: 'running' | 'completed';
  completedAt: string | null;
  resultSummary: string | null; // first ~200 chars of tool_result content
}

export interface TaskSnapshot {
  timestamp: string | null;
  todos: Array<{ content: string; status: string; activeForm?: string }>;
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    progressPct: number;
  };
}
