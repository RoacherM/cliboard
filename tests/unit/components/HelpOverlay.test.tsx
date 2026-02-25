import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HelpOverlay } from '../../../src/components/HelpOverlay.js';

describe('HelpOverlay', () => {
  it('should display Global shortcuts section with q, ?, and Tab', () => {
    const onClose = vi.fn();
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose }));
    const output = lastFrame() ?? '';

    expect(output).toMatch(/Global/i);
    expect(output).toContain('q');
    expect(output).toContain('?');
    expect(output).toContain('Tab');
  });

  it('should display Session List shortcuts section', () => {
    const onClose = vi.fn();
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose }));
    const output = lastFrame() ?? '';

    expect(output).toMatch(/Session/i);
    expect(output).toMatch(/[jk]|[↑↓]/);
    expect(output).toContain('Enter');
  });

  it('should display Kanban shortcuts section', () => {
    const onClose = vi.fn();
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose }));
    const output = lastFrame() ?? '';

    expect(output).toMatch(/Kanban/i);
    expect(output).toMatch(/[hl]|[←→]/);
  });

  it('should display Task Detail shortcuts section', () => {
    const onClose = vi.fn();
    const { lastFrame } = render(React.createElement(HelpOverlay, { onClose }));
    const output = lastFrame() ?? '';

    expect(output).toMatch(/Detail|Task/i);
    expect(output).toContain('q/Esc');
    expect(output).toContain('n');
  });

  it('should call onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const { stdin } = render(React.createElement(HelpOverlay, { onClose }));
    await new Promise(r => setTimeout(r, 0));
    stdin.write('\u001B'); // Escape
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when q is pressed', async () => {
    const onClose = vi.fn();
    const { stdin } = render(React.createElement(HelpOverlay, { onClose }));
    await new Promise(r => setTimeout(r, 0));
    stdin.write('q');
    expect(onClose).toHaveBeenCalled();
  });
});
