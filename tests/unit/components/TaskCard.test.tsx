import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TaskCard } from '../../../src/components/TaskCard.js';
import { createTask } from '../../helpers/index.js';

describe('TaskCard', () => {
  it('should render task id and subject', () => {
    const task = createTask({ id: '1', subject: 'Fix login bug' });
    const { lastFrame } = render(
      React.createElement(TaskCard, { task })
    );
    const output = lastFrame();

    expect(output).toContain('#1');
    expect(output).toContain('Fix login bug');
  });

  it('should display the activeForm when task is in progress', () => {
    const task = createTask({
      status: 'in_progress',
      activeForm: 'Fixing login',
    });
    const { lastFrame } = render(
      React.createElement(TaskCard, { task })
    );
    const output = lastFrame();

    expect(output).toContain('Fixing login');
  });

  it('should show a blocked indicator when task has blockedBy dependencies', () => {
    const task = createTask({ blockedBy: ['2', '3'] });
    const { lastFrame } = render(
      React.createElement(TaskCard, { task })
    );
    const output = lastFrame();

    // Expect a blocked symbol or text
    const hasBlockedIndicator =
      output!.includes('⊘') || output!.toLowerCase().includes('blocked');
    expect(hasBlockedIndicator).toBe(true);
  });

  it('should show a blocks indicator when task blocks other tasks', () => {
    const task = createTask({ blocks: ['4'] });
    const { lastFrame } = render(
      React.createElement(TaskCard, { task })
    );
    const output = lastFrame();

    // Expect a blocks symbol or text
    const hasBlocksIndicator =
      output!.includes('→') || output!.toLowerCase().includes('blocks');
    expect(hasBlocksIndicator).toBe(true);
  });

  it('should visually distinguish a focused task from an unfocused one', () => {
    const task = createTask();

    const { lastFrame: unfocusedFrame } = render(
      React.createElement(TaskCard, { task, isFocused: false })
    );
    const { lastFrame: focusedFrame } = render(
      React.createElement(TaskCard, { task, isFocused: true })
    );

    const unfocusedOutput = unfocusedFrame();
    const focusedOutput = focusedFrame();

    // Focused output should differ (e.g., contain a focus indicator like ▶ or ›)
    expect(focusedOutput).not.toEqual(unfocusedOutput);
    const hasFocusIndicator =
      focusedOutput!.includes('▶') ||
      focusedOutput!.includes('›') ||
      focusedOutput!.includes('>');
    expect(hasFocusIndicator).toBe(true);
  });

  it('should truncate a very long subject with an ellipsis', () => {
    const longSubject =
      'This is an extremely long task subject that should definitely be truncated because it exceeds any reasonable display width for a terminal card component';
    const task = createTask({ subject: longSubject });
    const { lastFrame } = render(
      React.createElement(TaskCard, { task })
    );
    const output = lastFrame();

    // Either the output contains an ellipsis or it is shorter than the full subject
    const isTruncated =
      output!.includes('…') || !output!.includes(longSubject);
    expect(isTruncated).toBe(true);
  });
});
