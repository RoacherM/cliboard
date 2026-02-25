import React from 'react';
import { Box, Text } from 'ink';

interface EmptyStateProps {
  type: 'noSessions' | 'noTasks';
}

const messages: Record<EmptyStateProps['type'], { title: string; hint: string }> = {
  noSessions: {
    title: 'No sessions found',
    hint: 'Run claude to start a new session.',
  },
  noTasks: {
    title: 'No tasks',
    hint: 'Create a task to assign work to a session.',
  },
};

export function EmptyState({ type }: EmptyStateProps): React.ReactElement {
  const { title, hint } = messages[type];
  return (
    <Box flexDirection="column">
      <Text>{title}</Text>
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
