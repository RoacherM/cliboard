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

const PULSE_INTERVAL = 500;
// Cycle: bold+color → color → dim → color → (repeat)
const PULSE_FRAMES = [
  { bold: true, dim: false },
  { bold: false, dim: false },
  { bold: false, dim: true },
  { bold: false, dim: false },
] as const;

function PulsingBadge({ char, color }: { char: string; color: string }): React.ReactElement {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), PULSE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const frame = Math.floor(Date.now() / PULSE_INTERVAL) % PULSE_FRAMES.length;
  const { bold, dim } = PULSE_FRAMES[frame]!;

  return <Text color={color} bold={bold} dimColor={dim}>{char}</Text>;
}

export function SessionItem({ session, isSelected, maxWidth = 26 }: SessionItemProps): React.ReactElement {
  const prefix = isSelected ? '› ' : '  ';
  const counts = `${session.completed}/${session.taskCount}`;
  // Badge: backend letter (C/O) or ✕ for archived, null if no backendId and not archived
  const badge = session.backendId
    ? (session.isArchived ? '✕' : session.backendId === 'claude' ? 'C' : 'O')
    : (session.isArchived ? '✕' : null);
  const badgeColor = session.backendId === 'claude' ? 'cyan'
    : session.backendId === 'opencode' ? 'magenta' : undefined;
  const badgePulses = !!session.backendId && session.isLive && !session.isArchived;

  // Line 1 budget: prefix + name + badge(2) + " counts"
  const badgeWidth = badge ? 2 : 0;
  const countsStr = ` ${counts}`;
  const nameMax = maxWidth - prefix.length - countsStr.length - badgeWidth;
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
        {badge && (badgePulses
          ? <Text> <PulsingBadge char={badge} color={badgeColor!} /></Text>
          : <Text color={badgeColor} dimColor={session.isArchived}> {badge}</Text>
        )}
        <Text dimColor>{countsStr}</Text>
      </Box>
      {subtitle && (
        <Box>
          <Text dimColor>  {truncate(subtitle, maxWidth - 2)}</Text>
        </Box>
      )}
    </Box>
  );
}
