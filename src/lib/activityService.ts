import fs from 'node:fs/promises';
import type { SubAgentEntry } from './types.js';

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
