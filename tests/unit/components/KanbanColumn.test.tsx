import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { KanbanColumn } from '../../../src/components/KanbanColumn.js';
import { createTask } from '../../helpers/index.js';

describe('KanbanColumn', () => {
  it('should render header with title and task count', () => {
    const tasks = [
      createTask({ id: '1', subject: 'Task one' }),
      createTask({ id: '2', subject: 'Task two' }),
      createTask({ id: '3', subject: 'Task three' }),
    ];
    const { lastFrame } = render(
      React.createElement(KanbanColumn, { title: 'Pending', tasks })
    );
    const output = lastFrame();

    expect(output).toContain('Pending');
    expect(output).toContain('3');
  });

  it('should render all task subjects', () => {
    const tasks = [
      createTask({ id: '1', subject: 'Write unit tests' }),
      createTask({ id: '2', subject: 'Review pull request' }),
    ];
    const { lastFrame } = render(
      React.createElement(KanbanColumn, { title: 'Pending', tasks })
    );
    const output = lastFrame();

    expect(output).toContain('Write unit tests');
    expect(output).toContain('Review pull request');
  });

  it('should render header but no task content when column is empty', () => {
    const { lastFrame } = render(
      React.createElement(KanbanColumn, { title: 'Pending', tasks: [] })
    );
    const output = lastFrame();

    expect(output).toContain('Pending');
    // With zero tasks there should be no task subject text
    expect(output).not.toContain('Test task');
  });

  it('should sort tasks by ID in ascending order', () => {
    const tasks = [
      createTask({ id: '3', subject: 'Later task' }),
      createTask({ id: '1', subject: 'Earlier task' }),
    ];
    const { lastFrame } = render(
      React.createElement(KanbanColumn, { title: 'Pending', tasks })
    );
    const output = lastFrame()!;

    const indexOfId1 = output.indexOf('#1');
    const indexOfId3 = output.indexOf('#3');

    expect(indexOfId1).toBeGreaterThan(-1);
    expect(indexOfId3).toBeGreaterThan(-1);
    expect(indexOfId1).toBeLessThan(indexOfId3);
  });
});
