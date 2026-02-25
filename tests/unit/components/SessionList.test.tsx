import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { SessionList } from '../../../src/components/SessionList.js';
import { createSession } from '../../helpers/index.js';
import type { Session } from '../../../src/lib/types.js';

const delay = () => new Promise((r) => setTimeout(r, 0));

describe('SessionList', () => {
  it('should render all session names', () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'Alpha project' }),
      createSession({ id: 's2', name: 'Beta project' }),
      createSession({ id: 's3', name: 'Gamma project' }),
    ];
    const onSelect = vi.fn();
    const onOpen = vi.fn();

    const { lastFrame } = render(
      React.createElement(SessionList, {
        sessions,
        selectedIndex: 0,
        onSelect,
        onOpen,
      })
    );
    const output = lastFrame();

    expect(output).toContain('Alpha project');
    expect(output).toContain('Beta project');
    expect(output).toContain('Gamma project');
  });

  it('should visually highlight the selected session', () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'First' }),
      createSession({ id: 's2', name: 'Second' }),
      createSession({ id: 's3', name: 'Third' }),
    ];
    const onSelect = vi.fn();
    const onOpen = vi.fn();

    const { lastFrame: frameIdx0 } = render(
      React.createElement(SessionList, {
        sessions,
        selectedIndex: 0,
        onSelect,
        onOpen,
      })
    );
    const { lastFrame: frameIdx1 } = render(
      React.createElement(SessionList, {
        sessions,
        selectedIndex: 1,
        onSelect,
        onOpen,
      })
    );

    const output0 = frameIdx0();
    const output1 = frameIdx1();

    // Changing the selected index should produce different visual output
    expect(output0).not.toEqual(output1);
  });

  it('should call onSelect with next index when j is pressed', async () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'First' }),
      createSession({ id: 's2', name: 'Second' }),
      createSession({ id: 's3', name: 'Third' }),
    ];
    const onSelect = vi.fn();
    const onOpen = vi.fn();

    const { stdin } = render(
      React.createElement(SessionList, {
        sessions,
        selectedIndex: 0,
        onSelect,
        onOpen,
      })
    );

    await delay();
    stdin.write('j');
    await delay();

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('should call onSelect with previous index when k is pressed', async () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'First' }),
      createSession({ id: 's2', name: 'Second' }),
      createSession({ id: 's3', name: 'Third' }),
    ];
    const onSelect = vi.fn();
    const onOpen = vi.fn();

    const { stdin } = render(
      React.createElement(SessionList, {
        sessions,
        selectedIndex: 2,
        onSelect,
        onOpen,
      })
    );

    await delay();
    stdin.write('k');
    await delay();

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('should wrap around when k is pressed at index 0', async () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'First' }),
      createSession({ id: 's2', name: 'Second' }),
      createSession({ id: 's3', name: 'Third' }),
    ];
    const onSelect = vi.fn();
    const onOpen = vi.fn();

    const { stdin } = render(
      React.createElement(SessionList, {
        sessions,
        selectedIndex: 0,
        onSelect,
        onOpen,
      })
    );

    await delay();
    stdin.write('k');
    await delay();

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('should call onOpen with the selected session id when Enter is pressed', async () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'First' }),
      createSession({ id: 's2', name: 'Second' }),
      createSession({ id: 's3', name: 'Third' }),
    ];
    const onSelect = vi.fn();
    const onOpen = vi.fn();

    const { stdin } = render(
      React.createElement(SessionList, {
        sessions,
        selectedIndex: 1,
        onSelect,
        onOpen,
      })
    );

    await delay();
    stdin.write('\r');
    await delay();

    expect(onOpen).toHaveBeenCalledWith('s2');
  });

  describe('viewport windowing', () => {
    function makeSessions(count: number): Session[] {
      return Array.from({ length: count }, (_, i) =>
        createSession({ id: `s${i}`, name: `Session ${i}` }),
      );
    }

    it('should only render visibleHeight items when sessions exceed viewport', () => {
      const sessions = makeSessions(30);
      const { lastFrame } = render(
        React.createElement(SessionList, {
          sessions,
          selectedIndex: 0,
          onSelect: vi.fn(),
          onOpen: vi.fn(),
          visibleHeight: 5,
        }),
      );
      const output = lastFrame()!;

      expect(output).toContain('Session 0');
      expect(output).toContain('Session 4');
      expect(output).not.toContain('Session 5');
    });

    it('should show ▼ indicator when more items below', () => {
      const sessions = makeSessions(30);
      const { lastFrame } = render(
        React.createElement(SessionList, {
          sessions,
          selectedIndex: 0,
          onSelect: vi.fn(),
          onOpen: vi.fn(),
          visibleHeight: 5,
        }),
      );
      const output = lastFrame()!;

      expect(output).toContain('▼');
      expect(output).toContain('25 more');
    });

    it('should show ▲ indicator when more items above', () => {
      const sessions = makeSessions(30);
      const { lastFrame } = render(
        React.createElement(SessionList, {
          sessions,
          selectedIndex: 29,
          onSelect: vi.fn(),
          onOpen: vi.fn(),
          visibleHeight: 5,
        }),
      );
      const output = lastFrame()!;

      expect(output).toContain('▲');
      expect(output).toContain('25 more');
    });

    it('should not show indicators when all items fit', () => {
      const sessions = makeSessions(3);
      const { lastFrame } = render(
        React.createElement(SessionList, {
          sessions,
          selectedIndex: 0,
          onSelect: vi.fn(),
          onOpen: vi.fn(),
          visibleHeight: 5,
        }),
      );
      const output = lastFrame()!;

      expect(output).not.toContain('▲');
      expect(output).not.toContain('▼');
    });

    it('should call onSelect(0) when g is pressed', async () => {
      const sessions = makeSessions(30);
      const onSelect = vi.fn();
      const { stdin } = render(
        React.createElement(SessionList, {
          sessions,
          selectedIndex: 15,
          onSelect,
          onOpen: vi.fn(),
          visibleHeight: 5,
        }),
      );

      await delay();
      stdin.write('g');
      await delay();

      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('should call onSelect(last) when G is pressed', async () => {
      const sessions = makeSessions(30);
      const onSelect = vi.fn();
      const { stdin } = render(
        React.createElement(SessionList, {
          sessions,
          selectedIndex: 0,
          onSelect,
          onOpen: vi.fn(),
          visibleHeight: 5,
        }),
      );

      await delay();
      stdin.write('G');
      await delay();

      expect(onSelect).toHaveBeenCalledWith(29);
    });
  });
});
