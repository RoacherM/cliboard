import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Sidebar } from '../../src/components/Sidebar.js';
import { createSession } from '../helpers/index.js';
import type { Session } from '../../src/lib/types.js';

describe('Sidebar', () => {
  it('should render all session names', () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'Project Alpha' }),
      createSession({ id: 's2', name: 'Project Beta' }),
    ];

    const { lastFrame } = render(
      React.createElement(Sidebar, {
        sessions,
        selectedIndex: 0,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        filter: 'all' as const,
        onFilterChange: vi.fn(),
      })
    );
    const output = lastFrame()!;

    expect(output).toContain('Project Alpha');
    expect(output).toContain('Project Beta');
  });

  it('should display filter options All and Active', () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'Test session' }),
    ];

    const { lastFrame } = render(
      React.createElement(Sidebar, {
        sessions,
        selectedIndex: 0,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        filter: 'all' as const,
        onFilterChange: vi.fn(),
      })
    );
    const output = lastFrame()!;

    expect(output).toContain('All');
    expect(output).toContain('Active');
  });

  it('should display a Sessions header', () => {
    const sessions: Session[] = [
      createSession({ id: 's1', name: 'Test session' }),
    ];

    const { lastFrame } = render(
      React.createElement(Sidebar, {
        sessions,
        selectedIndex: 0,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        filter: 'all' as const,
        onFilterChange: vi.fn(),
      })
    );
    const output = lastFrame()!;

    expect(output).toMatch(/Sessions/i);
  });
});
