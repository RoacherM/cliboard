import { useState, useEffect, useRef, useCallback } from 'react';
import { SEARCH_DEBOUNCE_MS } from '../lib/constants.js';

export interface UseSearchResult<T> {
  query: string;
  setQuery: (q: string) => void;
  results: T[];
  isSearching: boolean;
}

export function useSearch<T>(
  items: T[],
  searchFn: (items: T[], query: string) => T[],
): UseSearchResult<T> {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<T[]>(items);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (q === '') {
      // Empty query: restore all items immediately, no debounce needed
      setResults(items);
      setIsSearching(false);
    } else {
      // Non-empty query: clear results immediately, schedule search
      setResults([]);
      setIsSearching(true);

      timerRef.current = setTimeout(() => {
        setResults(searchFn(items, q));
        setIsSearching(false);
      }, SEARCH_DEBOUNCE_MS);
    }
  }, [items, searchFn]);

  // Sync results when items change externally
  useEffect(() => {
    if (query === '') {
      setResults(items);
    }
  }, [items, query]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { query, setQuery, results, isSearching };
}
