import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { NavigableKanban } from '../../src/components/NavigableKanban.js';
import { createTask } from '../helpers/index.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

describe('KanbanNavigation', () => {
  it('should move focus down with j key (vertical navigation)', async () => {
    const tasks = [
      createTask({ id: '1', subject: 'First pending', status: 'pending' }),
      createTask({ id: '2', subject: 'Second pending', status: 'pending' }),
      createTask({ id: '3', subject: 'Third pending', status: 'pending' }),
    ];

    const { stdin, lastFrame } = render(
      React.createElement(NavigableKanban, { tasks })
    );

    // Initially focused on row 0 — the focus indicator should be on #1
    const before = lastFrame()!;
    expect(before).toContain('First pending');

    await delay();
    stdin.write('j');
    await delay();

    const after = lastFrame()!;
    // After pressing j, focus should move to row 1 (Second pending)
    // The focus indicator character (›) should appear next to #2
    expect(after).toContain('\u203a');
    // Verify the focused row changed — the output should differ from before
    expect(after).not.toEqual(before);
  });

  it('should move focus down with arrow key (vertical navigation)', async () => {
    const tasks = [
      createTask({ id: '1', subject: 'First pending', status: 'pending' }),
      createTask({ id: '2', subject: 'Second pending', status: 'pending' }),
    ];

    const { stdin, lastFrame } = render(
      React.createElement(NavigableKanban, { tasks })
    );

    const before = lastFrame()!;

    await delay();
    stdin.write('\u001B[B'); // Down arrow escape sequence
    await delay();

    const after = lastFrame()!;
    expect(after).not.toEqual(before);
  });

  it('should move focus right with l key (horizontal navigation)', async () => {
    const tasks = [
      createTask({ id: '1', subject: 'Pending task', status: 'pending' }),
      createTask({ id: '2', subject: 'Active task', status: 'in_progress' }),
      createTask({ id: '3', subject: 'Done task', status: 'completed' }),
    ];

    const { stdin, lastFrame } = render(
      React.createElement(NavigableKanban, { tasks })
    );

    // Initially focused on column 0 (Pending)
    const before = lastFrame()!;

    await delay();
    stdin.write('l');
    await delay();

    const after = lastFrame()!;
    // Focus should now be on column 1 (In Progress) — output should change
    expect(after).not.toEqual(before);
  });

  it('should move focus right with arrow key (horizontal navigation)', async () => {
    const tasks = [
      createTask({ id: '1', subject: 'Pending task', status: 'pending' }),
      createTask({ id: '2', subject: 'Active task', status: 'in_progress' }),
    ];

    const { stdin, lastFrame } = render(
      React.createElement(NavigableKanban, { tasks })
    );

    const before = lastFrame()!;

    await delay();
    stdin.write('\u001B[C'); // Right arrow escape sequence
    await delay();

    const after = lastFrame()!;
    expect(after).not.toEqual(before);
  });

  it('should not respond to input when isActive is false', async () => {
    const tasks = [
      createTask({ id: '1', subject: 'First pending', status: 'pending' }),
      createTask({ id: '2', subject: 'Second pending', status: 'pending' }),
    ];

    const { stdin, lastFrame } = render(
      React.createElement(NavigableKanban, { tasks, isActive: false })
    );

    const before = lastFrame()!;
    // Focus indicators should NOT appear when inactive
    expect(before).not.toContain('\u203a');

    await delay();
    stdin.write('j');
    await delay();

    const after = lastFrame()!;
    // Output should not change — input was ignored
    expect(after).toEqual(before);
  });

  it('should remember row position when switching columns and back', async () => {
    const tasks = [
      createTask({ id: '1', subject: 'Pending A', status: 'pending' }),
      createTask({ id: '2', subject: 'Pending B', status: 'pending' }),
      createTask({ id: '3', subject: 'Pending C', status: 'pending' }),
      createTask({ id: '4', subject: 'Active X', status: 'in_progress' }),
    ];

    const { stdin, lastFrame } = render(
      React.createElement(NavigableKanban, { tasks })
    );

    // Move down to row 2 in column 0
    await delay();
    stdin.write('j');
    await delay();
    stdin.write('j');
    await delay();

    const atRow2 = lastFrame()!;

    // Move right to column 1
    stdin.write('l');
    await delay();

    // Move back left to column 0
    stdin.write('h');
    await delay();

    const backAtCol0 = lastFrame()!;

    // Row should be remembered as 2 — output should match what it was at row 2
    expect(backAtCol0).toEqual(atRow2);
  });

  it('should focus empty column without skipping it', async () => {
    // Tasks only in columns 0 (pending) and 2 (completed) — column 1 is empty
    const tasks = [
      createTask({ id: '1', subject: 'Pending item', status: 'pending' }),
      createTask({ id: '2', subject: 'Completed item', status: 'completed' }),
    ];

    const { stdin, lastFrame } = render(
      React.createElement(NavigableKanban, { tasks })
    );

    // Initially focused on column 0
    const before = lastFrame()!;

    await delay();
    stdin.write('l');
    await delay();

    const afterOneL = lastFrame()!;
    // Column 1 (In Progress) should get focus, even though empty.
    // The output should change because the focus indicator moves away from column 0.
    expect(afterOneL).not.toEqual(before);

    // Press l again — should move to column 2 (Completed)
    stdin.write('l');
    await delay();

    const afterTwoL = lastFrame()!;
    // Should have moved to column 2, output differs from column 1 focus
    expect(afterTwoL).not.toEqual(afterOneL);
  });

  it('should call onOpenDetail with the focused task when Enter is pressed', async () => {
    const onOpenDetail = vi.fn();
    const tasks = [
      createTask({ id: '1', subject: 'First task', status: 'pending' }),
      createTask({ id: '2', subject: 'Second task', status: 'pending' }),
    ];

    const { stdin } = render(
      React.createElement(NavigableKanban, { tasks, onOpenDetail })
    );

    // Move focus to the second task
    await delay();
    stdin.write('j');
    await delay();

    // Press Enter
    stdin.write('\r');
    await delay();

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2', subject: 'Second task' })
    );
  });
});
