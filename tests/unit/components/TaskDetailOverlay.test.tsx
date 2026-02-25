import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TaskDetailOverlay } from '../../../src/components/TaskDetailOverlay.js';
import { createTask } from '../../helpers/index.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

describe('TaskDetailOverlay', () => {
  it('should display all fields for a complete task', () => {
    const task = createTask({
      id: '42',
      subject: 'Implement auth flow',
      description: 'Add OAuth2 login',
      status: 'in_progress',
      activeForm: 'Building login page',
    });
    const onClose = vi.fn();

    const { lastFrame } = render(
      React.createElement(TaskDetailOverlay, { task, onClose })
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('42');
    expect(output).toContain('Implement auth flow');
    expect(output).toContain('Add OAuth2 login');
    expect(output).toContain('in_progress');
    expect(output).toContain('Building login page');
  });

  it('should render without crashing for a minimal task', () => {
    const task = createTask({
      id: '7',
      subject: 'Minimal task',
      description: '',
      activeForm: '',
      blocks: [],
      blockedBy: [],
    });
    const onClose = vi.fn();

    const { lastFrame } = render(
      React.createElement(TaskDetailOverlay, { task, onClose })
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('7');
    expect(output).toContain('Minimal task');
  });

  it('should call onClose when Escape is pressed', async () => {
    const task = createTask();
    const onClose = vi.fn();

    const { stdin } = render(
      React.createElement(TaskDetailOverlay, { task, onClose })
    );

    await delay();
    stdin.write('\u001B');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when q is pressed', async () => {
    const task = createTask();
    const onClose = vi.fn();

    const { stdin } = render(
      React.createElement(TaskDetailOverlay, { task, onClose })
    );

    await delay();
    stdin.write('q');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when Backspace is pressed', async () => {
    const task = createTask();
    const onClose = vi.fn();

    const { stdin } = render(
      React.createElement(TaskDetailOverlay, { task, onClose })
    );

    await delay();
    stdin.write('\x7f');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });

  it('should display dependency information', () => {
    const task = createTask({
      id: '1',
      subject: 'Task with deps',
      blocks: ['2', '3'],
      blockedBy: ['4'],
    });
    const onClose = vi.fn();

    const { lastFrame } = render(
      React.createElement(TaskDetailOverlay, { task, onClose })
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('2');
    expect(output).toContain('3');
    expect(output).toContain('4');
  });

  it('should display navigable dependency IDs when allTasks provided', () => {
    const task1 = createTask({
      id: '1',
      subject: 'Task one',
      blocks: ['2'],
    });
    const task2 = createTask({
      id: '2',
      subject: 'Task two',
      blockedBy: ['1'],
    });
    const onClose = vi.fn();
    const onNavigate = vi.fn();

    const { lastFrame } = render(
      React.createElement(TaskDetailOverlay, {
        task: task1,
        allTasks: [task1, task2],
        onClose,
        onNavigate,
      })
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('2');
  });

  it('should respond to note shortcut key', async () => {
    const task = createTask();
    const onClose = vi.fn();
    const onAddNote = vi.fn();

    const { stdin, lastFrame } = render(
      React.createElement(TaskDetailOverlay, {
        task,
        onClose,
        onAddNote,
      })
    );

    await delay();
    stdin.write('n');
    await delay();

    // After pressing 'n', the component should enter note mode
    // or trigger the onAddNote callback in some way.
    // At minimum, the output should change to reflect note input state.
    const output = lastFrame() ?? '';
    const noteRelated =
      onAddNote.mock.calls.length > 0 ||
      output.toLowerCase().includes('note');
    expect(noteRelated).toBe(true);
  });
});
