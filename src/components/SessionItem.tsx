import React, { useState, useEffect } from 'react';
import path from 'node:path';
import { Box, Text } from 'ink';
import type { Session } from '../lib/types.js';

interface SessionItemProps {
  session: Session;
  isSelected?: boolean;
  maxWidth?: number;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

const PULSE_CHARS = ['●', '◉', '○', '◉'];
const PULSE_INTERVAL = 400;

function PulsingDot(): React.ReactElement {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), PULSE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Use Date.now() so all instances stay in sync
  const frame = Math.floor(Date.now() / PULSE_INTERVAL) % PULSE_CHARS.length;

  return <Text color="green">{PULSE_CHARS[frame]}</Text>;
}

export function SessionItem({ session, isSelected, maxWidth = 26 }: SessionItemProps): React.ReactElement {
  const prefix = isSelected ? '› ' : '  ';
  const counts = `${session.completed}/${session.taskCount}`;
  const hasActive = session.inProgress > 0;
  const staticTag = session.isArchived ? ' ✕' : hasActive ? ' .' : '';

  // Line 1: name + counts + tag
  // Budget: maxWidth - prefix(2) - space(1) - counts(~3-5) - tag(0-2)
  const suffix = ` ${counts}${staticTag}`;
  const nameMax = maxWidth - prefix.length - suffix.length;
  const name = truncate(session.name ?? session.id, Math.max(nameMax, 6));

  // Line 2: subtitle — cwd folder or git branch
  const subtitle = session.project
    ? path.basename(session.project)
    : session.gitBranch ?? null;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isSelected ? 'cyan' : undefined}>
          {prefix}{name}
        </Text>
        <Text dimColor> {counts}</Text>
        {hasActive && !session.isArchived && (
          <Text> <PulsingDot /></Text>
        )}
        {session.isArchived && <Text dimColor> ✕</Text>}
      </Box>
      {subtitle && (
        <Box>
          <Text dimColor>  {truncate(subtitle, maxWidth - 2)}</Text>
        </Box>
      )}
    </Box>
  );
}
