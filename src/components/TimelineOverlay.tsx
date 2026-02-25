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
            return (
              <Text key={realIndex} color={isSel ? 'cyan' : undefined} bold={isSel}>
                {isSel ? '›' : ' '} {ts}  {s.completed}/{s.total} {s.progressPct}%
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
