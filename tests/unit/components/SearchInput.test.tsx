import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { SearchInput } from '../../../src/components/SearchInput.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

describe('SearchInput', () => {
  it('should call onChange when a character is typed', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();

    const { stdin } = render(
      React.createElement(SearchInput, { onChange, onClose })
    );

    await delay();
    stdin.write('a');
    await delay();

    expect(onChange).toHaveBeenCalled();
  });

  it('should call onClose when Escape is pressed', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();

    const { stdin } = render(
      React.createElement(SearchInput, { onChange, onClose })
    );

    await delay();
    stdin.write('\u001B');
    await delay();

    expect(onClose).toHaveBeenCalled();
  });
});
