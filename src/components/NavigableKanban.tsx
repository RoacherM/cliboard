import React, { useState, useCallback, useMemo } from 'react';
import { useInput } from 'ink';
import type { Task } from '../lib/types.js';
import { KanbanBoard } from './KanbanBoard.js';

interface NavigableKanbanProps {
  tasks: Task[];
  isActive?: boolean;
  onOpenDetail?: (task: Task) => void;
}

const COLUMN_STATUSES: Task['status'][] = ['pending', 'in_progress', 'completed'];
const NUM_COLUMNS = COLUMN_STATUSES.length;

export function NavigableKanban({ tasks, isActive = true, onOpenDetail }: NavigableKanbanProps): React.ReactElement {
  const [focusedColumn, setFocusedColumn] = useState(0);
  const [focusedRow, setFocusedRow] = useState(0);
  const [columnMemory, setColumnMemory] = useState<Record<number, number>>({ 0: 0, 1: 0, 2: 0 });

  // Build sorted task lists per column (same sort as KanbanColumn: numeric id)
  const columnTasks = useMemo(() => {
    return COLUMN_STATUSES.map((status) =>
      [...tasks.filter((t) => t.status === status)].sort((a, b) => Number(a.id) - Number(b.id))
    );
  }, [tasks]);

  const getColumnLength = useCallback((col: number) => columnTasks[col].length, [columnTasks]);

  useInput((input, key) => {
    if (input === 'j' || key.downArrow) {
      // Move down in current column
      const maxRow = getColumnLength(focusedColumn) - 1;
      if (focusedRow < maxRow) {
        const newRow = focusedRow + 1;
        setFocusedRow(newRow);
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: newRow }));
      }
    } else if (input === 'k' || key.upArrow) {
      // Move up in current column
      if (focusedRow > 0) {
        const newRow = focusedRow - 1;
        setFocusedRow(newRow);
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: newRow }));
      }
    } else if (input === 'l' || key.rightArrow) {
      // Move right to next column
      if (focusedColumn < NUM_COLUMNS - 1) {
        // Save current row position for current column
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: focusedRow }));
        const newCol = focusedColumn + 1;
        const restoredRow = columnMemory[newCol] ?? 0;
        const maxRow = Math.max(0, getColumnLength(newCol) - 1);
        const clampedRow = Math.min(restoredRow, maxRow);
        setFocusedColumn(newCol);
        setFocusedRow(clampedRow);
      }
    } else if (input === 'h' || key.leftArrow) {
      // Move left to previous column
      if (focusedColumn > 0) {
        // Save current row position for current column
        setColumnMemory((prev) => ({ ...prev, [focusedColumn]: focusedRow }));
        const newCol = focusedColumn - 1;
        const restoredRow = columnMemory[newCol] ?? 0;
        const maxRow = Math.max(0, getColumnLength(newCol) - 1);
        const clampedRow = Math.min(restoredRow, maxRow);
        setFocusedColumn(newCol);
        setFocusedRow(clampedRow);
      }
    } else if (key.return) {
      // Open detail for focused task
      const tasksInColumn = columnTasks[focusedColumn];
      if (tasksInColumn[focusedRow] && onOpenDetail) {
        onOpenDetail(tasksInColumn[focusedRow]);
      }
    }
  }, { isActive });

  return React.createElement(KanbanBoard, {
    tasks,
    focusedColumn: isActive ? focusedColumn : undefined,
    focusedRow: isActive ? focusedRow : undefined,
  });
}
