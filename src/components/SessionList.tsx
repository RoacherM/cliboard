import React, { useRef } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import { SessionItem } from './SessionItem.js';
import type { Session } from '../lib/types.js';

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (id: string) => void;
  isActive?: boolean;
  visibleHeight?: number;
}

export function SessionList({
  sessions,
  selectedIndex,
  onSelect,
  onOpen,
  isActive = true,
  visibleHeight = 20,
}: SessionListProps): React.ReactElement {
  const scrollOffsetRef = useRef(0);

  // Compute scroll offset synchronously so first render is correct
  if (sessions.length <= visibleHeight) {
    scrollOffsetRef.current = 0;
  } else {
    if (selectedIndex < scrollOffsetRef.current) {
      scrollOffsetRef.current = selectedIndex;
    } else if (selectedIndex >= scrollOffsetRef.current + visibleHeight) {
      scrollOffsetRef.current = selectedIndex - visibleHeight + 1;
    }
  }

  useInput((input, key) => {
    if (sessions.length === 0) return;

    if (input === 'j' || key.downArrow) {
      const next = selectedIndex + 1 >= sessions.length ? 0 : selectedIndex + 1;
      onSelect(next);
    } else if (input === 'k' || key.upArrow) {
      const prev = selectedIndex - 1 < 0 ? sessions.length - 1 : selectedIndex - 1;
      onSelect(prev);
    } else if (input === 'g') {
      onSelect(0);
    } else if (input === 'G') {
      onSelect(sessions.length - 1);
    } else if (input === 'd' && key.ctrl) {
      const halfPage = Math.floor(visibleHeight / 2);
      const next = Math.min(selectedIndex + halfPage, sessions.length - 1);
      onSelect(next);
    } else if (input === 'u' && key.ctrl) {
      const halfPage = Math.floor(visibleHeight / 2);
      const next = Math.max(selectedIndex - halfPage, 0);
      onSelect(next);
    } else if (key.return) {
      if (sessions[selectedIndex]) {
        onOpen(sessions[selectedIndex].id);
      }
    }
  }, { isActive });

  const scrollOffset = scrollOffsetRef.current;
  const needsWindowing = sessions.length > visibleHeight;
  const clampedOffset = needsWindowing
    ? Math.min(scrollOffset, sessions.length - visibleHeight)
    : 0;
  const visibleSessions = needsWindowing
    ? sessions.slice(clampedOffset, clampedOffset + visibleHeight)
    : sessions;

  const aboveCount = clampedOffset;
  const belowCount = needsWindowing
    ? sessions.length - (clampedOffset + visibleHeight)
    : 0;

  return (
    <Box flexDirection="column">
      {aboveCount > 0 && (
        <Text dimColor>  ▲ {aboveCount} more</Text>
      )}
      {visibleSessions.map((session, i) => (
        <SessionItem
          key={session.id}
          session={session}
          isSelected={clampedOffset + i === selectedIndex}
        />
      ))}
      {belowCount > 0 && (
        <Text dimColor>  ▼ {belowCount} more</Text>
      )}
    </Box>
  );
}
