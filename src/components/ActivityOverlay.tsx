import React, { useState, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { ActivityEntry, GraphPrefix } from '../lib/types.js';
import { parseMcpFunctionName, computeConcurrencyPrefixes } from '../lib/activityService.js';

interface ActivityOverlayProps {
  entries: ActivityEntry[];
  sessionName: string;
  onClose: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return '??:??';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 5);
  return d.toISOString().slice(11, 16); // HH:MM
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `(${secs}s)`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `(${mins}m${remSecs}s)`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function entryIcon(entry: ActivityEntry): { icon: string; color: string } {
  if (entry.status === 'error') return { icon: '✗', color: 'red' };
  if (entry.status === 'running') return { icon: '⟳', color: 'yellow' };
  return { icon: '✓', color: 'green' };
}

function entryLabelColor(entry: ActivityEntry): string {
  switch (entry.type) {
    case 'skill': return 'magenta';
    case 'tool': return 'yellow';
    case 'mcp': return 'green';
    default: return 'cyan';
  }
}

function entryBadge(entry: ActivityEntry): string {
  switch (entry.type) {
    case 'skill': return '[Skill]';
    case 'tool': return `[${entry.toolName ?? 'Tool'}]`;
    case 'mcp': return `[${entry.description}]`;
    default: return `[${entry.subagentType ?? 'Agent'}]`;
  }
}

function graphChar(prefix: GraphPrefix): string {
  switch (prefix) {
    case 'first': return '┬ ';
    case 'middle': return '├ ';
    case 'last': return '└ ';
    default: return '  ';
  }
}

export function ActivityOverlay({
  entries,
  sessionName,
  onClose,
}: ActivityOverlayProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollOffsetRef = useRef(0);
  const { stdout } = useStdout();

  const prefixes = useMemo(() => computeConcurrencyPrefixes(entries), [entries]);

  const termRows = stdout?.rows ?? 24;
  const listVisibleHeight = Math.max(3, Math.floor((termRows - 8) / 2));

  // Synchronous scroll offset
  if (entries.length <= listVisibleHeight) {
    scrollOffsetRef.current = 0;
  } else {
    if (selectedIndex < scrollOffsetRef.current) {
      scrollOffsetRef.current = selectedIndex;
    } else if (selectedIndex >= scrollOffsetRef.current + listVisibleHeight) {
      scrollOffsetRef.current = selectedIndex - listVisibleHeight + 1;
    }
  }

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (entries.length === 0) return;

    if (input === 'j' || key.downArrow) {
      setSelectedIndex((prev) => (prev + 1 >= entries.length ? 0 : prev + 1));
    } else if (input === 'k' || key.upArrow) {
      setSelectedIndex((prev) => (prev - 1 < 0 ? entries.length - 1 : prev - 1));
    } else if (input === 'g') {
      setSelectedIndex(0);
    } else if (input === 'G') {
      setSelectedIndex(entries.length - 1);
    }
  });

  const subagents = entries.filter((e) => e.type === 'subagent');
  const skills = entries.filter((e) => e.type === 'skill');
  const tools = entries.filter((e) => e.type === 'tool');
  const mcps = entries.filter((e) => e.type === 'mcp');
  const running = entries.filter((e) => e.status === 'running').length;

  if (entries.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Activity ─ {sessionName}</Text>
        <Text> </Text>
        <Text dimColor>No activity recorded in this session</Text>
        <Text> </Text>
        <Text dimColor>Press q or Esc to close</Text>
      </Box>
    );
  }

  const selected = entries[selectedIndex];
  const scrollOffset = scrollOffsetRef.current;
  const needsWindowing = entries.length > listVisibleHeight;
  const visibleSlice = needsWindowing
    ? entries.slice(scrollOffset, scrollOffset + listVisibleHeight)
    : entries;

  // Detail panel content
  const promptLines = selected.prompt
    ? selected.prompt.split('\n').slice(0, 15)
    : [];
  const resultLines = selected.resultSummary
    ? selected.resultSummary.split('\n').slice(0, 5)
    : [];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Text bold>
        Activity ─ {entries.length} total │ {subagents.length} agents │ {skills.length} skills │ {tools.length} tools │ {mcps.length} mcp │ {running} running
      </Text>
      <Text dimColor>j/k:navigate  g/G:first/last  q/Esc:close</Text>
      <Text> </Text>

      {/* Top panel: list */}
      <Box flexDirection="column">
        {needsWindowing && scrollOffset > 0 && (
          <Text dimColor>  ▲ {scrollOffset} more</Text>
        )}
        {visibleSlice.map((entry, i) => {
          const realIndex = (needsWindowing ? scrollOffset : 0) + i;
          const isSel = realIndex === selectedIndex;
          const { icon, color: iconColor } = entryIcon(entry);
          const labelColor = entryLabelColor(entry);
          const badge = entryBadge(entry);
          const duration = formatDuration(entry.timestamp, entry.completedAt);
          const desc = truncate(entry.description, 30);
          const badgePad = badge.padEnd(16).slice(0, 16);

          return (
            <Box key={entry.id}>
              <Text color={isSel ? labelColor : undefined} bold={isSel}>
                {isSel ? '› ' : '  '}
              </Text>
              <Text dimColor>{graphChar(prefixes[realIndex])}</Text>
              <Text color={iconColor}>{icon}</Text>
              <Text color={isSel ? labelColor : undefined} bold={isSel}>
                {' '}{formatTime(entry.timestamp)}  </Text>
              <Text color={labelColor}>{badgePad}</Text>
              <Text color={isSel ? labelColor : undefined} bold={isSel}>
                {' '}{desc}
              </Text>
              {duration && <Text dimColor> {duration}</Text>}
            </Box>
          );
        })}
        {needsWindowing && scrollOffset + listVisibleHeight < entries.length && (
          <Text dimColor>  ▼ {entries.length - scrollOffset - listVisibleHeight} more</Text>
        )}
      </Box>

      <Text> </Text>

      {/* Bottom panel: detail */}
      <Box flexDirection="column">
        <Text bold underline>{selected.description || 'Activity detail'}</Text>
        <Text> </Text>
        {selected.type === 'subagent' ? (
          <>
            <Text>
              <Text dimColor>Type:    </Text>
              <Text>{selected.subagentType}</Text>
            </Text>
            <Text>
              <Text dimColor>Status:  </Text>
              <Text color={selected.status === 'completed' ? 'green' : selected.status === 'error' ? 'red' : 'yellow'}>
                {selected.status === 'completed' ? '✓ Completed' : selected.status === 'error' ? '✗ Error' : '⟳ Running'}
              </Text>
            </Text>
            <Text>
              <Text dimColor>Spawned: </Text>
              <Text>{formatTimestamp(selected.timestamp)}</Text>
            </Text>
            {selected.completedAt && (
              <Text>
                <Text dimColor>Duration:</Text>
                <Text> {formatDuration(selected.timestamp, selected.completedAt)}</Text>
              </Text>
            )}
            {selected.agentId && (
              <Text>
                <Text dimColor>Agent:   </Text>
                <Text>{selected.agentId.slice(0, 7)}</Text>
              </Text>
            )}
          </>
        ) : selected.type === 'skill' ? (
          <>
            <Text>
              <Text dimColor>Skill:   </Text>
              <Text color="magenta">{selected.skillName}</Text>
            </Text>
            <Text>
              <Text dimColor>Status:  </Text>
              <Text color={selected.status === 'completed' ? 'green' : selected.status === 'error' ? 'red' : 'yellow'}>
                {selected.status === 'completed' ? '✓ Completed' : selected.status === 'error' ? '✗ Error' : '⟳ Running'}
              </Text>
            </Text>
            <Text>
              <Text dimColor>Invoked: </Text>
              <Text>{formatTimestamp(selected.timestamp)}</Text>
            </Text>
            {selected.skillArgs && (
              <Text>
                <Text dimColor>Args:    </Text>
                <Text>{selected.skillArgs}</Text>
              </Text>
            )}
          </>
        ) : selected.type === 'tool' ? (
          <>
            <Text>
              <Text dimColor>Tool:    </Text>
              <Text color="yellow">{selected.toolName}</Text>
            </Text>
            <Text>
              <Text dimColor>Status:  </Text>
              <Text color={selected.status === 'completed' ? 'green' : selected.status === 'error' ? 'red' : 'yellow'}>
                {selected.status === 'completed' ? '✓ Completed' : selected.status === 'error' ? '✗ Error' : '⟳ Running'}
              </Text>
            </Text>
            <Text>
              <Text dimColor>Called:  </Text>
              <Text>{formatTimestamp(selected.timestamp)}</Text>
            </Text>
            {selected.completedAt && (
              <Text>
                <Text dimColor>Duration:</Text>
                <Text> {formatDuration(selected.timestamp, selected.completedAt)}</Text>
              </Text>
            )}
          </>
        ) : (
          <>
            <Text>
              <Text dimColor>Plugin:  </Text>
              <Text color="green">{selected.description}</Text>
            </Text>
            <Text>
              <Text dimColor>Function:</Text>
              <Text> {parseMcpFunctionName(selected.toolName ?? '')}</Text>
            </Text>
            <Text>
              <Text dimColor>Status:  </Text>
              <Text color={selected.status === 'completed' ? 'green' : selected.status === 'error' ? 'red' : 'yellow'}>
                {selected.status === 'completed' ? '✓ Completed' : selected.status === 'error' ? '✗ Error' : '⟳ Running'}
              </Text>
            </Text>
            <Text>
              <Text dimColor>Called:  </Text>
              <Text>{formatTimestamp(selected.timestamp)}</Text>
            </Text>
            {selected.completedAt && (
              <Text>
                <Text dimColor>Duration:</Text>
                <Text> {formatDuration(selected.timestamp, selected.completedAt)}</Text>
              </Text>
            )}
          </>
        )}
        {promptLines.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>{selected.type === 'skill' ? 'Args:' : selected.type === 'tool' || selected.type === 'mcp' ? 'Input:' : 'Prompt:'}</Text>
            {promptLines.map((line, i) => (
              <Text key={i} wrap="truncate">{line}</Text>
            ))}
          </Box>
        )}
        {resultLines.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Result:</Text>
            {resultLines.map((line, i) => (
              <Text key={i} color={selected.isError ? 'red' : 'green'} wrap="truncate">{line}</Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
