import fs from 'node:fs/promises';
import type { SubAgentEntry, ActivityEntry, GraphPrefix } from './types.js';

interface SpawnInfo {
  spawnId: string;
  timestamp: string | null;
  subagentType: string;
  description: string;
  prompt: string;
}

/**
 * Parse sub-agent spawns and completions from a Claude Code session jsonl file.
 *
 * Data sources:
 * - Task tool_use blocks (type: "assistant") → spawn entries
 * - tool_result blocks (type: "user") → completion matching by tool_use_id
 * - agent_progress entries (type: "progress", data.type: "agent_progress") → agentId linking
 */
export async function parseSubAgents(jsonlPath: string): Promise<SubAgentEntry[]> {
  let content: string;
  try {
    content = await fs.readFile(jsonlPath, 'utf-8');
  } catch {
    return [];
  }

  const spawns: SpawnInfo[] = [];
  const results = new Map<string, { timestamp: string | null; content: string }>();
  const agentIds = new Map<string, string>(); // parentToolUseID → agentId

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let row: any;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Collect Task tool_use blocks from assistant messages
    if (
      row.type === 'assistant' &&
      row.message?.content &&
      Array.isArray(row.message.content)
    ) {
      for (const block of row.message.content) {
        if (
          block?.type === 'tool_use' &&
          block.name === 'Task' &&
          block.id
        ) {
          const input = block.input ?? {};
          spawns.push({
            spawnId: block.id,
            timestamp: row.timestamp ?? null,
            subagentType: input.subagent_type ?? 'unknown',
            description: input.description ?? '',
            prompt: input.prompt ?? '',
          });
        }
      }
    }

    // Collect tool_result blocks from user messages
    if (
      row.type === 'user' &&
      row.message?.content &&
      Array.isArray(row.message.content)
    ) {
      for (const block of row.message.content) {
        if (block?.type === 'tool_result' && block.tool_use_id) {
          const text = extractResultText(block.content);
          results.set(block.tool_use_id, {
            timestamp: row.timestamp ?? null,
            content: text,
          });
        }
      }
    }

    // Collect agent_progress entries
    if (row.type === 'progress') {
      const data = row.data ?? {};
      if (
        data.type === 'agent_progress' &&
        data.parentToolUseID &&
        data.agentId
      ) {
        agentIds.set(data.parentToolUseID, data.agentId);
      }
    }
  }

  // Build entries by matching spawns with results and agentIds
  const entries: SubAgentEntry[] = spawns.map((spawn) => {
    const result = results.get(spawn.spawnId);
    const agentId = agentIds.get(spawn.spawnId) ?? null;

    return {
      spawnId: spawn.spawnId,
      agentId,
      timestamp: spawn.timestamp,
      subagentType: spawn.subagentType,
      description: spawn.description,
      prompt: spawn.prompt,
      status: result ? 'completed' : 'running',
      completedAt: result?.timestamp ?? null,
      resultSummary: result ? result.content.slice(0, 200) : null,
    };
  });

  // Sort by spawn timestamp
  entries.sort((a, b) => {
    if (!a.timestamp) return -1;
    if (!b.timestamp) return 1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  return entries;
}

function extractResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('\n');
  }
  return '';
}

interface ActivitySpawnInfo {
  id: string;
  type: 'subagent' | 'skill' | 'tool' | 'mcp' | 'command';
  timestamp: string | null;
  // Sub-agent
  subagentType: string | null;
  description: string;
  prompt: string;
  // Skill
  skillName: string | null;
  skillArgs: string | null;
  // Tool/MCP
  toolName: string | null;
}

/**
 * Parse all activity (sub-agents + skills) from a Claude Code session jsonl file.
 */
export async function parseActivity(jsonlPath: string): Promise<ActivityEntry[]> {
  let content: string;
  try {
    content = await fs.readFile(jsonlPath, 'utf-8');
  } catch {
    return [];
  }

  const spawns: ActivitySpawnInfo[] = [];
  const results = new Map<string, { timestamp: string | null; content: string; isError: boolean }>();
  const agentIds = new Map<string, string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let row: any;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Collect Task and Skill tool_use blocks from assistant messages
    if (
      row.type === 'assistant' &&
      row.message?.content &&
      Array.isArray(row.message.content)
    ) {
      for (const block of row.message.content) {
        if (block?.type !== 'tool_use' || !block.id) continue;
        const input = block.input ?? {};

        if (block.name === 'Task' || block.name === '$AGENT') {
          spawns.push({
            id: block.id,
            type: 'subagent',
            timestamp: row.timestamp ?? null,
            subagentType: input.subagent_type ?? input.type ?? 'unknown',
            description: input.description ?? '',
            prompt: input.prompt ?? '',
            skillName: null,
            skillArgs: null,
            toolName: null,
          });
        } else if (block.name === 'Skill') {
          spawns.push({
            id: block.id,
            type: 'skill',
            timestamp: row.timestamp ?? null,
            subagentType: null,
            description: input.skill ?? 'unknown',
            prompt: input.args ?? '',
            skillName: input.skill ?? null,
            skillArgs: input.args ?? null,
            toolName: null,
          });
        } else if (block.name.startsWith('mcp__')) {
          spawns.push({
            id: block.id,
            type: 'mcp',
            timestamp: row.timestamp ?? null,
            subagentType: null,
            description: parseMcpPluginName(block.name),
            prompt: summarizeToolInput(block.name, input),
            skillName: null,
            skillArgs: null,
            toolName: block.name,
          });
        } else {
          spawns.push({
            id: block.id,
            type: 'tool',
            timestamp: row.timestamp ?? null,
            subagentType: null,
            description: block.name,
            prompt: summarizeToolInput(block.name, input),
            skillName: null,
            skillArgs: null,
            toolName: block.name,
          });
        }
      }
    }

    // Collect tool_result blocks from user messages
    if (
      row.type === 'user' &&
      row.message?.content &&
      Array.isArray(row.message.content)
    ) {
      for (const block of row.message.content) {
        if (block?.type === 'tool_result' && block.tool_use_id) {
          const text = extractResultText(block.content);
          results.set(block.tool_use_id, {
            timestamp: row.timestamp ?? null,
            content: text,
            isError: block.is_error === true,
          });
        }
      }
    }

    // Collect slash command invocations from string-content user messages
    if (
      row.type === 'user' &&
      typeof row.message?.content === 'string'
    ) {
      const content = row.message.content;
      const nameMatch = content.match(/<command-name>\/?(.+?)<\/command-name>/);
      if (nameMatch) {
        const argsMatch = content.match(/<command-args>([\s\S]*?)<\/command-args>/);
        const rawName = nameMatch[1]; // e.g. "review-loop:review-loop" or "exit"
        const displayName = rawName.includes(':') ? rawName.split(':').pop()! : rawName;
        spawns.push({
          id: `cmd_${row.timestamp ?? String(Date.now())}`,
          type: 'command',
          timestamp: row.timestamp ?? null,
          subagentType: null,
          description: displayName,
          prompt: argsMatch?.[1]?.trim() ?? '',
          skillName: null,
          skillArgs: null,
          toolName: null,
        });
      }
    }

    // Collect agent_progress entries
    if (row.type === 'progress') {
      const data = row.data ?? {};
      if (
        data.type === 'agent_progress' &&
        data.parentToolUseID &&
        data.agentId
      ) {
        agentIds.set(data.parentToolUseID, data.agentId);
      }
    }
  }

  // Build unified entries
  const entries: ActivityEntry[] = spawns.map((spawn) => {
    const result = results.get(spawn.id);
    const agentId = agentIds.get(spawn.id) ?? null;
    const isError = result?.isError ?? false;

    // Commands are instant (no tool_result), always completed
    if (spawn.type === 'command') {
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
        status: 'completed' as const,
        isError: false,
        completedAt: spawn.timestamp,
        resultSummary: null,
      };
    }

    let status: ActivityEntry['status'];
    if (!result) {
      status = 'running';
    } else if (isError) {
      status = 'error';
    } else {
      status = 'completed';
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
      resultSummary: result ? result.content.slice(0, 200) : null,
    };
  });

  // Sort by timestamp
  entries.sort((a, b) => {
    if (!a.timestamp) return -1;
    if (!b.timestamp) return 1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  return entries;
}

/**
 * Extract a human-readable plugin name from an MCP tool name.
 * e.g. "mcp__plugin_context7_context7__query-docs" → "context7"
 *      "mcp__plugin_claude-mem_mcp-search__search" → "claude-mem"
 */
export function parseMcpPluginName(name: string): string {
  const match = name.match(/^mcp__plugin_([^_]+)/);
  return match ? match[1] : name;
}

/**
 * Extract the MCP function name from a full tool name.
 * e.g. "mcp__plugin_context7_context7__query-docs" → "query-docs"
 */
export function parseMcpFunctionName(name: string): string {
  const match = name.match(/__([^_]+)$/);
  return match ? match[1] : name;
}

/**
 * Summarize tool input into a single readable line.
 */
export function summarizeToolInput(toolName: string, input: Record<string, any>): string {
  const baseName = toolName.startsWith('mcp__') ? parseMcpFunctionName(toolName) : toolName;

  switch (baseName) {
    case 'Read':
      return input.file_path ?? '';
    case 'Write':
      return input.file_path ?? '';
    case 'Edit':
      return input.file_path ?? '';
    case 'Bash':
      return input.description ?? truncateStr(input.command ?? '', 120);
    case 'Glob':
      return input.pattern ?? '';
    case 'Grep':
      return input.pattern ?? '';
    case 'WebFetch':
      return input.url ?? '';
    case 'WebSearch':
      return input.query ?? '';
    case 'EnterPlanMode':
      return 'Enter plan mode';
    case 'ExitPlanMode':
      return 'Exit plan mode';
    case 'AskUserQuestion': {
      const questions = input.questions;
      if (Array.isArray(questions) && questions.length > 0) {
        return questions[0].question ?? '';
      }
      return '';
    }
    case 'TaskCreate':
    case 'TaskUpdate':
    case 'TaskGet':
      return input.subject ?? input.taskId ?? '';
    case 'TaskList':
      return 'List tasks';
    case 'NotebookEdit':
      return input.notebook_path ?? '';
    case 'EnterWorktree':
      return input.name ?? 'Create worktree';
    default: {
      const keys = Object.keys(input);
      if (keys.length === 0) return '';
      const key = keys[0];
      const val = input[key];
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      return truncateStr(`${key}: ${str}`, 120);
    }
  }
}

function truncateStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

interface ParsedTime {
  start: number; // ms epoch, NaN if unparseable
  end: number;   // ms epoch, Infinity if still running, NaN if unparseable
  raw: string | null; // original timestamp for same-timestamp fast path
}

function parseTime(entry: ActivityEntry): ParsedTime {
  const raw = entry.timestamp;
  if (!raw) return { start: NaN, end: NaN, raw: null };
  const start = new Date(raw).getTime();
  const end = entry.completedAt ? new Date(entry.completedAt).getTime() : Infinity;
  return { start, end, raw };
}

/**
 * Check if two pre-parsed time entries overlap.
 * Same timestamp → true. Overlapping time ranges → true.
 * Null completedAt = still running = infinity (overlaps everything after).
 * Exact boundary (A ends = B starts) → NOT overlapping (sequential).
 */
function isOverlapping(a: ParsedTime, b: ParsedTime): boolean {
  if (!a.raw || !b.raw) return false;

  // Same timestamp → concurrent
  if (a.raw === b.raw) return true;

  if (Number.isNaN(a.start) || Number.isNaN(b.start)) return false;

  // Overlap: A starts before B ends AND B starts before A ends
  // Use strict < (not <=) so exact boundary is sequential
  return a.start < b.end && b.start < a.end;
}

/**
 * Compute concurrency graph prefixes for a sorted list of activity entries.
 * Groups entries that overlap with ANY other entry in the current group.
 * Pre-parses timestamps once to avoid redundant Date allocations in the inner loop.
 */
export function computeConcurrencyPrefixes(entries: ActivityEntry[]): GraphPrefix[] {
  if (entries.length === 0) return [];

  // Pre-parse all timestamps once (avoids O(n²) Date allocations)
  const times = entries.map(parseTime);

  const prefixes: GraphPrefix[] = new Array(entries.length).fill('solo');
  let groupStart = 0;

  for (let i = 1; i < entries.length; i++) {
    // Check if entry i overlaps with ANY entry in [groupStart..i-1]
    let overlaps = false;
    for (let j = groupStart; j < i; j++) {
      if (isOverlapping(times[j], times[i])) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      // Finalize previous group
      finalizeGroup(prefixes, groupStart, i - 1);
      groupStart = i;
    }
  }

  // Finalize last group
  finalizeGroup(prefixes, groupStart, entries.length - 1);

  return prefixes;
}

function finalizeGroup(prefixes: GraphPrefix[], start: number, end: number): void {
  if (start === end) {
    prefixes[start] = 'solo';
    return;
  }
  prefixes[start] = 'first';
  for (let i = start + 1; i < end; i++) {
    prefixes[i] = 'middle';
  }
  prefixes[end] = 'last';
}
