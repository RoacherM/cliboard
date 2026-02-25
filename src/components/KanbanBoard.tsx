import React from 'react';
import { Box } from 'ink';
import type { Task } from '../lib/types.js';
import { KanbanColumn } from './KanbanColumn.js';

interface KanbanBoardProps {
  tasks: Task[];
  focusedColumn?: number;
  focusedRow?: number;
}

const COLUMNS: { title: string; status: Task['status'] }[] = [
  { title: 'Pending', status: 'pending' },
  { title: 'In Progress', status: 'in_progress' },
  { title: 'Completed', status: 'completed' },
];

export function KanbanBoard({ tasks, focusedColumn, focusedRow }: KanbanBoardProps): React.ReactElement {
  return (
    <Box flexDirection="row">
      {COLUMNS.map((col, index) => {
        const filtered = tasks.filter((t) => t.status === col.status);
        const focusedIndex = focusedColumn === index ? focusedRow : undefined;
        return (
          <KanbanColumn
            key={col.status}
            title={col.title}
            tasks={filtered}
            focusedIndex={focusedIndex}
          />
        );
      })}
    </Box>
  );
}
