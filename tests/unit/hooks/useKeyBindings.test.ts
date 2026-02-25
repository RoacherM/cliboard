import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useKeyBindings } from '../../../src/hooks/useKeyBindings.js';

interface KeyBinding {
  key: string;
  context?: string;
  handler: () => void;
}

/**
 * Wrapper component that exercises useKeyBindings inside a real Ink render tree.
 * Renders a simple Text node so ink-testing-library can capture frames.
 */
function TestComponent({
  bindings,
  activeContext,
}: {
  bindings: KeyBinding[];
  activeContext: string;
}) {
  useKeyBindings(bindings, activeContext);
  return React.createElement(Text, null, `context:${activeContext}`);
}

describe('useKeyBindings', () => {
  describe('context-aware handlers', () => {
    it('should fire handler when key matches and activeContext matches binding context', () => {
      const handler = vi.fn();
      const bindings: KeyBinding[] = [
        { key: 'q', context: 'global', handler },
      ];

      const { stdin } = render(
        React.createElement(TestComponent, {
          bindings,
          activeContext: 'global',
        }),
      );

      stdin.write('q');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should NOT fire handler when activeContext does not match binding context', () => {
      const handler = vi.fn();
      const bindings: KeyBinding[] = [
        { key: 'q', context: 'global', handler },
      ];

      const { stdin } = render(
        React.createElement(TestComponent, {
          bindings,
          activeContext: 'search',
        }),
      );

      stdin.write('q');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('multiple bindings', () => {
    it('should fire only the handler whose key matches the input', () => {
      const quitHandler = vi.fn();
      const helpHandler = vi.fn();
      const searchHandler = vi.fn();

      const bindings: KeyBinding[] = [
        { key: 'q', context: 'global', handler: quitHandler },
        { key: 'h', context: 'global', handler: helpHandler },
        { key: '/', context: 'global', handler: searchHandler },
      ];

      const { stdin } = render(
        React.createElement(TestComponent, {
          bindings,
          activeContext: 'global',
        }),
      );

      stdin.write('h');

      expect(quitHandler).not.toHaveBeenCalled();
      expect(helpHandler).toHaveBeenCalledTimes(1);
      expect(searchHandler).not.toHaveBeenCalled();
    });

    it('should allow multiple keys to each fire their own handler independently', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      const bindings: KeyBinding[] = [
        { key: 'a', context: 'global', handler: handlerA },
        { key: 'b', context: 'global', handler: handlerB },
      ];

      const { stdin } = render(
        React.createElement(TestComponent, {
          bindings,
          activeContext: 'global',
        }),
      );

      stdin.write('a');
      stdin.write('b');
      stdin.write('a');

      expect(handlerA).toHaveBeenCalledTimes(2);
      expect(handlerB).toHaveBeenCalledTimes(1);
    });
  });
});
