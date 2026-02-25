import React from 'react';
import { Box, Text } from 'ink';
import type { Task } from '../lib/types.js';
import { TaskCard } from './TaskCard.js';

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  focusedIndex?: number;
}

const STATUS_COLORS: Record<string, string> = {
  Pending: 'yellow',
  'In Progress': 'blue',
  Completed: 'green',
};

export function KanbanColumn({ title, tasks, focusedIndex }: KanbanColumnProps): React.ReactElement {
  const sorted = [...tasks].sort((a, b) => Number(a.id) - Number(b.id));
  const color = STATUS_COLORS[title] ?? 'white';

  return (
    <Box flexDirection="column" flexGrow={1} marginRight={1}>
      <Box>
        <Text bold color={color}>{title}</Text>
        <Text dimColor> ({tasks.length})</Text>
      </Box>
      <Box>
        <Text color={color}>{'─'.repeat(20)}</Text>
      </Box>
      {sorted.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor italic>  (empty)</Text>
        </Box>
      ) : (
        sorted.map((task, index) => (
          <TaskCard key={task.id} task={task} isFocused={index === focusedIndex} />
        ))
      )}
    </Box>
  );
}
