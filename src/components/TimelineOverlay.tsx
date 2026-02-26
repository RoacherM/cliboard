import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import type { TaskSnapshot } from '../lib/types.js';

interface TimelineOverlayProps {
  snapshots: TaskSnapshot[];
  sessionName: string;
  onClose: () => void;
}

const STATUS_ICON: Record<string, string> = {
  completed: '✓',
  in_progress: '⟳',
  pending: '○',
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'green',
  in_progress: 'yellow',
  pending: 'gray',
};

const RESPONSE_ICON: Record<string, string> = {
  completed: '✓',
  running: '⟳',
  error: '✗',
  unknown: '?',
};

const RESPONSE_COLOR: Record<string, string> = {
  completed: 'green',
  running: 'yellow',
  error: 'red',
  unknown: 'gray',
};

const RESPONSE_LABEL: Record<string, string> = {
  completed: 'Completed',
  running: 'Running',
  error: 'Error',
  unknown: 'Unknown',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function progressBar(pct: number, width = 12): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return `[${'#'.repeat(filled)}${'.'.repeat(width - filled)}]`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

const VISIBLE_SNAPSHOTS = 16;

export function TimelineOverlay({
  snapshots,
  sessionName,
  onClose,
}: TimelineOverlayProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollOffsetRef = useRef(0);

  // Synchronous scroll offset (same pattern as SessionList)
  if (snapshots.length <= VISIBLE_SNAPSHOTS) {
    scrollOffsetRef.current = 0;
  } else {
    if (selectedIndex < scrollOffsetRef.current) {
      scrollOffsetRef.current = selectedIndex;
    } else if (selectedIndex >= scrollOffsetRef.current + VISIBLE_SNAPSHOTS) {
      scrollOffsetRef.current = selectedIndex - VISIBLE_SNAPSHOTS + 1;
    }
  }

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }
    if (snapshots.length === 0) return;

    if (input === 'j' || key.downArrow) {
      setSelectedIndex((prev) => (prev + 1 >= snapshots.length ? 0 : prev + 1));
    } else if (input === 'k' || key.upArrow) {
      setSelectedIndex((prev) => (prev - 1 < 0 ? snapshots.length - 1 : prev - 1));
    } else if (input === 'g') {
      setSelectedIndex(0);
    } else if (input === 'G') {
      setSelectedIndex(snapshots.length - 1);
    }
  });

  if (snapshots.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Timeline ─ {sessionName}</Text>
        <Text> </Text>
        <Text dimColor>No timeline data</Text>
        <Text> </Text>
        <Text dimColor>Press q or Esc to close</Text>
      </Box>
    );
  }

  const selected = snapshots[selectedIndex];
  const scrollOffset = scrollOffsetRef.current;
  const needsWindowing = snapshots.length > VISIBLE_SNAPSHOTS;
  const visibleSlice = needsWindowing
    ? snapshots.slice(scrollOffset, scrollOffset + VISIBLE_SNAPSHOTS)
    : snapshots;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Timeline ─ {sessionName}</Text>
      <Text dimColor>{snapshots.length} snapshots │ j/k:navigate  q/Esc:close</Text>
      <Text> </Text>

      <Box flexDirection="row">
        {/* Left: snapshot list */}
        <Box flexDirection="column" width={38}>
          {needsWindowing && scrollOffset > 0 && (
            <Text dimColor>  ▲ {scrollOffset} more</Text>
          )}
          {visibleSlice.map((snap, i) => {
            const realIndex = (needsWindowing ? scrollOffset : 0) + i;
            const isSel = realIndex === selectedIndex;
            const ts = formatTimestamp(snap.timestamp);
            const s = snap.summary;
            const responseStatus = snap.responseStatus ?? 'unknown';
            return (
              <Text key={realIndex} color={isSel ? 'cyan' : undefined} bold={isSel}>
                {isSel ? '›' : ' '} {RESPONSE_ICON[responseStatus] ?? '?'} {ts}  {s.completed}/{s.total} {s.progressPct}%
              </Text>
            );
          })}
          {needsWindowing && scrollOffset + VISIBLE_SNAPSHOTS < snapshots.length && (
            <Text dimColor>  ▼ {snapshots.length - scrollOffset - VISIBLE_SNAPSHOTS} more</Text>
          )}
        </Box>

        {/* Right: tasks at selected snapshot */}
        <Box flexDirection="column" flexGrow={1} marginLeft={2}>
          <Text bold underline>
            Snapshot {selectedIndex + 1}/{snapshots.length} ─ {formatTimestamp(selected.timestamp)}
          </Text>
          <Text dimColor>
            {selected.summary.completed}✓ {selected.summary.inProgress}⟳ {selected.summary.pending}○ ({selected.summary.progressPct}%) {progressBar(selected.summary.progressPct)}
          </Text>
          <Text>
            Response:{' '}
            <Text color={RESPONSE_COLOR[selected.responseStatus ?? 'unknown'] ?? 'gray'}>
              {RESPONSE_ICON[selected.responseStatus ?? 'unknown'] ?? '?'} {RESPONSE_LABEL[selected.responseStatus ?? 'unknown'] ?? 'Unknown'}
            </Text>
            {selected.responseAt ? ` @ ${formatTimestamp(selected.responseAt)}` : ''}
          </Text>
          {selected.responseSummary && (
            <Text dimColor>{truncate(selected.responseSummary.replace(/\s+/g, ' ').trim(), 120)}</Text>
          )}
          <Text> </Text>
          {selected.todos.map((todo, i) => (
            <Text key={i} color={STATUS_COLOR[todo.status] ?? undefined}>
              {STATUS_ICON[todo.status] ?? '?'} {todo.content}
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
