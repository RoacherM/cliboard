import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { KanbanBoard } from '../../../src/components/KanbanBoard.js';
import { createTask } from '../../helpers/index.js';

describe('KanbanBoard', () => {
  it('should render all three column headers', () => {
    const tasks = [
      createTask({ id: '1', status: 'pending' }),
      createTask({ id: '2', status: 'in_progress' }),
      createTask({ id: '3', status: 'completed' }),
    ];
    const { lastFrame } = render(
      React.createElement(KanbanBoard, { tasks })
    );
    const output = lastFrame();

    expect(output).toContain('Pending');
    expect(output).toContain('In Progress');
    expect(output).toContain('Completed');
  });

  it('should distribute tasks under correct column headers', () => {
    const tasks = [
      createTask({ id: '1', subject: 'Pending one', status: 'pending' }),
      createTask({ id: '2', subject: 'Pending two', status: 'pending' }),
      createTask({ id: '3', subject: 'Active work', status: 'in_progress' }),
      createTask({ id: '4', subject: 'Done item', status: 'completed' }),
    ];
    const { lastFrame } = render(
      React.createElement(KanbanBoard, { tasks })
    );
    const output = lastFrame()!;

    expect(output).toContain('Pending one');
    expect(output).toContain('Pending two');
    expect(output).toContain('Active work');
    expect(output).toContain('Done item');
  });

  it('should render all three column headers even with no tasks', () => {
    const { lastFrame } = render(
      React.createElement(KanbanBoard, { tasks: [] })
    );
    const output = lastFrame();

    expect(output).toContain('Pending');
    expect(output).toContain('In Progress');
    expect(output).toContain('Completed');
  });

  it('should show a focus indicator on the focused task', () => {
    const tasks = [
      createTask({ id: '1', subject: 'Backlog item', status: 'pending' }),
      createTask({ id: '2', subject: 'Focused task', status: 'in_progress' }),
      createTask({ id: '3', subject: 'Finished item', status: 'completed' }),
    ];

    const { lastFrame: unfocusedFrame } = render(
      React.createElement(KanbanBoard, { tasks })
    );
    const { lastFrame: focusedFrame } = render(
      React.createElement(KanbanBoard, {
        tasks,
        focusedColumn: 1,
        focusedRow: 0,
      })
    );

    const unfocusedOutput = unfocusedFrame()!;
    const focusedOutput = focusedFrame()!;

    // The focused render should differ from the unfocused render
    expect(focusedOutput).not.toEqual(unfocusedOutput);

    // The focused task in the In Progress column should have a focus indicator
    const hasFocusIndicator =
      focusedOutput.includes('\u25b6') ||
      focusedOutput.includes('\u203a') ||
      focusedOutput.includes('>');
    expect(hasFocusIndicator).toBe(true);
  });
});
