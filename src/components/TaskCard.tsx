import React from 'react';
import { Box, Text } from 'ink';
import type { Task } from '../lib/types.js';

interface TaskCardProps {
  task: Task;
  isFocused?: boolean;
}

const MAX_SUBJECT_LENGTH = 50;

const STATUS_ICON: Record<string, string> = {
  pending: '○',
  in_progress: '◉',
  completed: '✓',
};

export function TaskCard({ task, isFocused }: TaskCardProps): React.ReactElement {
  const truncatedSubject =
    task.subject.length > MAX_SUBJECT_LENGTH
      ? task.subject.slice(0, MAX_SUBJECT_LENGTH) + '…'
      : task.subject;

  const showActiveForm = task.status === 'in_progress' && task.activeForm;
  const isBlocked = task.blockedBy.length > 0;
  const blocksOthers = task.blocks.length > 0;
  const icon = STATUS_ICON[task.status] ?? '○';

  return (
    <Box flexDirection="column">
      <Box>
        {isFocused ? (
          <Text color="cyan" bold>{'› '}</Text>
        ) : (
          <Text>{'  '}</Text>
        )}
        <Text dimColor>{icon} </Text>
        <Text color={isFocused ? 'cyan' : undefined} dimColor={task.status === 'completed'}>
          {truncatedSubject}
        </Text>
        <Text dimColor> #{task.id}</Text>
        {isBlocked && <Text color="red"> ⊘</Text>}
        {blocksOthers && <Text color="yellow"> →</Text>}
      </Box>
      {showActiveForm && (
        <Box marginLeft={4}>
          <Text color="blue" dimColor>⟳ {task.activeForm}</Text>
        </Box>
      )}
    </Box>
  );
}
