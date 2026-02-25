import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

describe('ConfirmDialog', () => {
  it('should display the provided message', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { lastFrame } = render(
      React.createElement(ConfirmDialog, {
        message: 'Delete task #3?',
        onConfirm,
        onCancel,
      })
    );
    const output = lastFrame();

    expect(output).toContain('Delete task #3?');
  });

  it('should call onConfirm when "y" is pressed', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Delete task #3?',
        onConfirm,
        onCancel,
      })
    );

    await delay();
    stdin.write('y');
    await delay();

    expect(onConfirm).toHaveBeenCalled();
  });

  it('should call onCancel when "n" is pressed', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { stdin } = render(
      React.createElement(ConfirmDialog, {
        message: 'Delete task #3?',
        onConfirm,
        onCancel,
      })
    );

    await delay();
    stdin.write('n');
    await delay();

    expect(onCancel).toHaveBeenCalled();
  });
});
