import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useSearch } from '../../../src/hooks/useSearch.js';

import type { UseSearchResult } from '../../../src/hooks/useSearch.js';

interface TestItem {
  id: number;
  name: string;
}

const sampleItems: TestItem[] = [
  { id: 1, name: 'Build dashboard' },
  { id: 2, name: 'Fix login bug' },
  { id: 3, name: 'Add unit tests' },
  { id: 4, name: 'Deploy to staging' },
];

const searchFn = (items: TestItem[], query: string): TestItem[] =>
  items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );

/**
 * Wrapper component that exposes the useSearch result via an onResult callback.
 */
function TestComponent({
  items,
  searchFunction,
  onResult,
}: {
  items: TestItem[];
  searchFunction: (items: TestItem[], query: string) => TestItem[];
  onResult: (result: UseSearchResult<TestItem>) => void;
}) {
  const result = useSearch(items, searchFunction);
  onResult(result);
  return React.createElement(
    Text,
    null,
    `query:${result.query} results:${result.results.length} searching:${result.isSearching}`,
  );
}

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounced search', () => {
    it('should NOT update results immediately after setQuery', () => {
      let hookResult: UseSearchResult<TestItem> | undefined;
      const onResult = (r: UseSearchResult<TestItem>) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          items: sampleItems,
          searchFunction: searchFn,
          onResult,
        }),
      );

      // Set a query — results should not change immediately due to debounce
      hookResult!.setQuery('bug');

      // Before debounce fires, results should still reflect previous state
      // (either all items or empty, depending on initial behavior with empty query)
      const resultsBeforeDebounce = hookResult!.results;
      expect(
        resultsBeforeDebounce.some((r) => r.name === 'Fix login bug'),
      ).toBe(false);
    });

    it('should update results after the debounce period elapses', () => {
      let hookResult: UseSearchResult<TestItem> | undefined;
      const onResult = (r: UseSearchResult<TestItem>) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          items: sampleItems,
          searchFunction: searchFn,
          onResult,
        }),
      );

      hookResult!.setQuery('bug');

      // Advance timers past the debounce threshold (150ms)
      vi.advanceTimersByTime(150);

      expect(hookResult!.results).toHaveLength(1);
      expect(hookResult!.results[0].name).toBe('Fix login bug');
    });
  });

  describe('empty query returns all items', () => {
    it('should return all items when query is empty string', () => {
      let hookResult: UseSearchResult<TestItem> | undefined;
      const onResult = (r: UseSearchResult<TestItem>) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          items: sampleItems,
          searchFunction: searchFn,
          onResult,
        }),
      );

      // Initially the query is empty — should have all items
      expect(hookResult!.query).toBe('');
      expect(hookResult!.results).toHaveLength(sampleItems.length);
    });

    it('should return all items after clearing a non-empty query', () => {
      let hookResult: UseSearchResult<TestItem> | undefined;
      const onResult = (r: UseSearchResult<TestItem>) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          items: sampleItems,
          searchFunction: searchFn,
          onResult,
        }),
      );

      // Set a query, let it debounce
      hookResult!.setQuery('deploy');
      vi.advanceTimersByTime(150);
      expect(hookResult!.results).toHaveLength(1);

      // Clear the query
      hookResult!.setQuery('');
      vi.advanceTimersByTime(150);

      expect(hookResult!.results).toHaveLength(sampleItems.length);
    });
  });

  describe('isSearching flag', () => {
    it('should be true while debounce is pending', () => {
      let hookResult: UseSearchResult<TestItem> | undefined;
      const onResult = (r: UseSearchResult<TestItem>) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          items: sampleItems,
          searchFunction: searchFn,
          onResult,
        }),
      );

      // Initially not searching
      expect(hookResult!.isSearching).toBe(false);

      // Set query — debounce starts, isSearching should be true
      hookResult!.setQuery('dashboard');
      expect(hookResult!.isSearching).toBe(true);

      // After debounce resolves, isSearching should be false
      vi.advanceTimersByTime(150);
      expect(hookResult!.isSearching).toBe(false);
    });

    it('should reset to false even when query produces no matches', () => {
      let hookResult: UseSearchResult<TestItem> | undefined;
      const onResult = (r: UseSearchResult<TestItem>) => {
        hookResult = r;
      };

      render(
        React.createElement(TestComponent, {
          items: sampleItems,
          searchFunction: searchFn,
          onResult,
        }),
      );

      hookResult!.setQuery('zzzznonexistent');
      expect(hookResult!.isSearching).toBe(true);

      vi.advanceTimersByTime(150);
      expect(hookResult!.isSearching).toBe(false);
      expect(hookResult!.results).toHaveLength(0);
    });
  });
});
