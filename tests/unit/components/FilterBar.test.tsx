import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { FilterBar } from '../../../src/components/FilterBar.js';

describe('FilterBar', () => {
  it('should display all provided filter labels', () => {
    const onFilterChange = vi.fn();

    const { lastFrame } = render(
      React.createElement(FilterBar, {
        filters: ['All', 'Active'],
        activeFilter: 'All',
        onFilterChange,
      })
    );
    const output = lastFrame();

    expect(output).toContain('All');
    expect(output).toContain('Active');
  });

  it('should visually distinguish the active filter from inactive filters', () => {
    const onFilterChange = vi.fn();

    const { lastFrame: frameWithAllActive } = render(
      React.createElement(FilterBar, {
        filters: ['All', 'Active'],
        activeFilter: 'All',
        onFilterChange,
      })
    );

    const { lastFrame: frameWithActiveActive } = render(
      React.createElement(FilterBar, {
        filters: ['All', 'Active'],
        activeFilter: 'Active',
        onFilterChange,
      })
    );

    const outputAll = frameWithAllActive();
    const outputActive = frameWithActiveActive();

    // When a different filter is active, the output should differ
    expect(outputAll).not.toEqual(outputActive);
  });
});
