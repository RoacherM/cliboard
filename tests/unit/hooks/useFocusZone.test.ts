import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useFocusZone } from '../../../src/hooks/useFocusZone.js';

import type { FocusZoneResult } from '../../../src/hooks/useFocusZone.js';

/**
 * Wrapper component that exposes the useFocusZone result via a ref-like callback.
 * The onResult callback captures the hook return value so tests can inspect and
 * invoke methods (cycleForward, cycleBackward, setActiveZone) imperatively.
 */
function TestComponent({
  zones,
  options,
  onResult,
}: {
  zones: string[];
  options?: { trapped?: string };
  onResult: (result: FocusZoneResult) => void;
}) {
  const result = useFocusZone(zones, options);
  // Call onResult on every render so the test always has the latest state
  onResult(result);
  return React.createElement(Text, null, `zone:${result.activeZone}`);
}

describe('useFocusZone', () => {
  describe('cycle forward', () => {
    it('should start at the first zone and cycle forward through zones', () => {
      let hookResult: FocusZoneResult | undefined;
      const onResult = (r: FocusZoneResult) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          zones: ['sidebar', 'kanban'],
          onResult,
        }),
      );

      expect(hookResult).toBeDefined();
      expect(hookResult!.activeZone).toBe('sidebar');

      hookResult!.cycleForward();
      expect(hookResult!.activeZone).toBe('kanban');
    });

    it('should wrap around to the first zone after the last zone', () => {
      let hookResult: FocusZoneResult | undefined;
      const onResult = (r: FocusZoneResult) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          zones: ['sidebar', 'kanban'],
          onResult,
        }),
      );

      // sidebar -> kanban -> sidebar (wrap)
      hookResult!.cycleForward();
      hookResult!.cycleForward();
      expect(hookResult!.activeZone).toBe('sidebar');
    });
  });

  describe('cycle backward', () => {
    it('should wrap backward from the first zone to the last zone', () => {
      let hookResult: FocusZoneResult | undefined;
      const onResult = (r: FocusZoneResult) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          zones: ['sidebar', 'kanban', 'detail'],
          onResult,
        }),
      );

      expect(hookResult!.activeZone).toBe('sidebar');

      // From sidebar, going backward should wrap to detail
      hookResult!.cycleBackward();
      expect(hookResult!.activeZone).toBe('detail');
    });

    it('should cycle backward through all zones correctly', () => {
      let hookResult: FocusZoneResult | undefined;
      const onResult = (r: FocusZoneResult) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          zones: ['sidebar', 'kanban', 'detail'],
          onResult,
        }),
      );

      // sidebar -> detail -> kanban -> sidebar
      hookResult!.cycleBackward();
      expect(hookResult!.activeZone).toBe('detail');

      hookResult!.cycleBackward();
      expect(hookResult!.activeZone).toBe('kanban');

      hookResult!.cycleBackward();
      expect(hookResult!.activeZone).toBe('sidebar');
    });
  });

  describe('trapped zone', () => {
    it('should not cycle when the active zone matches the trapped option', () => {
      let hookResult: FocusZoneResult | undefined;
      const onResult = (r: FocusZoneResult) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          zones: ['sidebar', 'kanban', 'detail'],
          options: { trapped: 'detail' },
          onResult,
        }),
      );

      // Move to 'detail' zone first
      hookResult!.setActiveZone('detail');
      expect(hookResult!.activeZone).toBe('detail');

      // Cycling forward should be disabled (trapped)
      hookResult!.cycleForward();
      expect(hookResult!.activeZone).toBe('detail');

      // Cycling backward should also be disabled (trapped)
      hookResult!.cycleBackward();
      expect(hookResult!.activeZone).toBe('detail');
    });

    it('should allow cycling when the active zone does NOT match the trapped option', () => {
      let hookResult: FocusZoneResult | undefined;
      const onResult = (r: FocusZoneResult) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          zones: ['sidebar', 'kanban', 'detail'],
          options: { trapped: 'detail' },
          onResult,
        }),
      );

      // Start at sidebar — not trapped, should be able to cycle
      expect(hookResult!.activeZone).toBe('sidebar');

      hookResult!.cycleForward();
      expect(hookResult!.activeZone).toBe('kanban');
    });
  });
});
