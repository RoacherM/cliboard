import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { NoteInput } from '../../../src/components/NoteInput.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

describe('NoteInput', () => {
  it('should call onSubmit with the typed text when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    const { stdin } = render(
      React.createElement(NoteInput, { onSubmit, onCancel })
    );

    await delay();
    stdin.write('My note');
    await delay();
    stdin.write('\r');
    await delay();

    expect(onSubmit).toHaveBeenCalledWith('My note');
  });

  it('should call onCancel and not onSubmit when Escape is pressed', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    const { stdin } = render(
      React.createElement(NoteInput, { onSubmit, onCancel })
    );

    await delay();
    stdin.write('\u001B');
    await delay();

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should not call onSubmit when Enter is pressed without typing anything', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    const { stdin } = render(
      React.createElement(NoteInput, { onSubmit, onCancel })
    );

    await delay();
    stdin.write('\r');
    await delay();

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
