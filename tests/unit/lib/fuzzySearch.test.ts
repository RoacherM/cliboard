import { describe, it, expect } from 'vitest';
import { fuzzySearch } from '../../../src/lib/fuzzySearch.js';

interface TestItem {
  text: string;
  secondary?: string;
}

function makeItem(text: string, secondary?: string): TestItem {
  return secondary !== undefined ? { text, secondary } : { text };
}

describe('fuzzySearch', () => {
  describe('exact substring matching', () => {
    it('should match a query that is an exact substring of an item text', () => {
      const items = [
        makeItem('Implement user authentication'),
        makeItem('Build dashboard UI'),
      ];

      const results = fuzzySearch(items, 'auth');

      expect(results.length).toBeGreaterThanOrEqual(1);

      const authResult = results.find(
        (r) => r.item.text === 'Implement user authentication',
      );
      expect(authResult).toBeDefined();
      expect(authResult!.score).toBeGreaterThan(0);
    });
  });

  describe('fuzzy matching', () => {
    it('should match characters appearing in order but not contiguously', () => {
      const items = [
        makeItem('web-application'),
        makeItem('unrelated-item'),
      ];

      const results = fuzzySearch(items, 'weba');

      const matched = results.find(
        (r) => r.item.text === 'web-application',
      );
      expect(matched).toBeDefined();
      expect(matched!.score).toBeGreaterThan(0);
    });
  });

  describe('case insensitivity', () => {
    it('should match regardless of letter casing', () => {
      const items = [makeItem('MyReactApp')];

      const results = fuzzySearch(items, 'myreactapp');

      expect(results).toHaveLength(1);
      expect(results[0].item.text).toBe('MyReactApp');
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe('special characters', () => {
    it('should match through hyphens, underscores, and dots', () => {
      const items = [
        makeItem('my-project_v2.0'),
        makeItem('something else entirely'),
      ];

      const results = fuzzySearch(items, 'project v2');

      const matched = results.find(
        (r) => r.item.text === 'my-project_v2.0',
      );
      expect(matched).toBeDefined();
      expect(matched!.score).toBeGreaterThan(0);
    });
  });

  describe('result ranking', () => {
    it('should score an exact prefix substring match higher than a later match', () => {
      const items = [
        makeItem('authentication handler'),
        makeItem('web-auth'),
        makeItem('authorization service'),
      ];

      const results = fuzzySearch(items, 'auth');

      expect(results.length).toBeGreaterThanOrEqual(2);

      const authenticationResult = results.find(
        (r) => r.item.text === 'authentication handler',
      );
      const webAuthResult = results.find(
        (r) => r.item.text === 'web-auth',
      );
      const authorizationResult = results.find(
        (r) => r.item.text === 'authorization service',
      );

      expect(authenticationResult).toBeDefined();
      expect(authorizationResult).toBeDefined();

      // "authentication handler" starts with "auth" — should score highest
      expect(authenticationResult!.score).toBeGreaterThan(
        webAuthResult!.score,
      );
      expect(authenticationResult!.score).toBeGreaterThanOrEqual(
        authorizationResult!.score,
      );
    });

    it('should return results sorted by score in descending order', () => {
      const items = [
        makeItem('web-auth'),
        makeItem('authentication handler'),
        makeItem('authorization service'),
      ];

      const results = fuzzySearch(items, 'auth');

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(
          results[i].score,
        );
      }
    });
  });

  describe('empty query', () => {
    it('should return all items when query is an empty string', () => {
      const items = [
        makeItem('alpha'),
        makeItem('beta'),
        makeItem('gamma'),
      ];

      const results = fuzzySearch(items, '');

      // Empty query should return all items (unfiltered)
      expect(results).toHaveLength(items.length);
    });
  });

  describe('no matches', () => {
    it('should return an empty array when no items match', () => {
      const items = [
        makeItem('hello world'),
        makeItem('foo bar'),
        makeItem('testing things'),
      ];

      const results = fuzzySearch(items, 'zzzzz');

      expect(results).toEqual([]);
    });
  });

  describe('multi-field search', () => {
    it('should match against the secondary field when present', () => {
      const items = [
        makeItem('Task One', 'database migration'),
        makeItem('Task Two', 'frontend styling'),
        makeItem('Task Three'),
      ];

      const results = fuzzySearch(items, 'migration');

      const matched = results.find(
        (r) => r.item.text === 'Task One',
      );
      expect(matched).toBeDefined();
      expect(matched!.score).toBeGreaterThan(0);
    });

    it('should not match items without a secondary field on a secondary-only query', () => {
      const items = [
        makeItem('Task One', 'database migration'),
        makeItem('Task Two'),
      ];

      const results = fuzzySearch(items, 'migration');

      const matched = results.find(
        (r) => r.item.text === 'Task Two',
      );
      expect(matched).toBeUndefined();
    });
  });

  describe('performance', () => {
    it('should search through 500 items in under 200ms', () => {
      const items = Array.from({ length: 500 }, (_, i) =>
        makeItem(`item-${i}-${Math.random().toString(36).substring(2, 10)}`),
      );

      const start = performance.now();
      const results = fuzzySearch(items, 'item-250');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(200);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
