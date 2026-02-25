import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createTempDir,
  writeTempJsonlFile,
  writeTempSessionsIndex,
  cleanupTempDir,
} from '../../helpers/mockFs.js';
import { createSessionMetadata } from '../../helpers/fixtures.js';
import {
  MetadataService,
  METADATA_CACHE_TTL,
  JSONL_READ_LIMIT,
  encodeProjectKey,
} from '../../../src/lib/metadataService.js';
import type { JsonlEntry, SessionMetadata } from '../../../src/lib/types.js';

describe('MetadataService', () => {
  let tmpDir: string;
  let service: MetadataService;

  beforeEach(async () => {
    tmpDir = await createTempDir();
    service = new MetadataService(tmpDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tmpDir);
  });

  // ---------------------------------------------------------------------------
  // 1. JSONL metadata extraction
  // ---------------------------------------------------------------------------
  describe('readSessionInfoFromJsonl', () => {
    it('extracts customTitle, slug, and project from JSONL entries', async () => {
      const entries: JsonlEntry[] = [
        { type: 'system', message: { role: 'system', content: 'init' } },
        { type: 'custom-title', customTitle: 'My Project' },
        { slug: 'my-project' },
        { cwd: '/Users/dev/project' },
        { message: { role: 'user', content: 'hello' } },
      ];

      const jsonlPath = await writeTempJsonlFile(tmpDir, 'default', 'sess-001', entries);
      const result = await service.readSessionInfoFromJsonl(jsonlPath);

      expect(result.customTitle).toBe('My Project');
      expect(result.slug).toBe('my-project');
      expect(result.project).toBe('/Users/dev/project');
    });

    it('returns partial metadata when only some fields are present', async () => {
      const entries: JsonlEntry[] = [
        { slug: 'only-slug' },
      ];

      const jsonlPath = await writeTempJsonlFile(tmpDir, 'default', 'sess-002', entries);
      const result = await service.readSessionInfoFromJsonl(jsonlPath);

      expect(result.slug).toBe('only-slug');
      expect(result.customTitle).toBeUndefined();
      expect(result.project).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. JSONL 64KB read limit
  // ---------------------------------------------------------------------------
  describe('JSONL 64KB limit', () => {
    it('exports the expected constant value', () => {
      expect(JSONL_READ_LIMIT).toBe(65_536);
    });

    it('does NOT read customTitle placed beyond the 64KB boundary', async () => {
      // Build a JSONL file where the first 64KB+ is padding, then a customTitle
      const paddingLine: JsonlEntry = {
        message: { role: 'user', content: 'x'.repeat(500) },
      };

      // Each line is ~530 bytes as JSON + newline. We need ~130 lines to exceed 64KB.
      const lineCount = Math.ceil(JSONL_READ_LIMIT / 530) + 10;
      const paddingEntries: JsonlEntry[] = Array.from({ length: lineCount }, () => paddingLine);

      // The customTitle entry is placed AFTER the 64KB boundary
      const allEntries: JsonlEntry[] = [
        ...paddingEntries,
        { type: 'custom-title', customTitle: 'Hidden Title' },
      ];

      const jsonlPath = await writeTempJsonlFile(tmpDir, 'default', 'sess-big', allEntries);

      // Verify file is actually larger than JSONL_READ_LIMIT
      const stat = await fs.stat(jsonlPath);
      expect(stat.size).toBeGreaterThan(JSONL_READ_LIMIT);

      const result = await service.readSessionInfoFromJsonl(jsonlPath);
      expect(result.customTitle).toBeUndefined();
    });

    it('reads customTitle placed WITHIN the 64KB boundary', async () => {
      const entries: JsonlEntry[] = [
        { type: 'custom-title', customTitle: 'Visible Title' },
        { message: { role: 'user', content: 'x'.repeat(500) } },
      ];

      const jsonlPath = await writeTempJsonlFile(tmpDir, 'default', 'sess-small', entries);
      const result = await service.readSessionInfoFromJsonl(jsonlPath);

      expect(result.customTitle).toBe('Visible Title');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. sessions-index.json reading
  // ---------------------------------------------------------------------------
  describe('loadSessionsIndex', () => {
    it('parses sessions-index.json and returns entries', async () => {
      const index = {
        sessions: [
          {
            id: 'aaa-111',
            name: 'First Session',
            description: 'Does things',
            gitBranch: 'feat/one',
            created: '2026-01-01T00:00:00Z',
            slug: 'first-session',
            project: '/projects/one',
          },
          {
            id: 'bbb-222',
            name: 'Second Session',
            summary: 'A summary',
            slug: 'second-session',
          },
        ],
      };

      await writeTempSessionsIndex(tmpDir, 'default', index);
      const projectDir = path.join(tmpDir, 'projects', 'default');
      const entries = await service.loadSessionsIndex(projectDir);

      expect(entries).toHaveLength(2);

      expect(entries[0].id).toBe('aaa-111');
      expect(entries[0].name).toBe('First Session');
      expect(entries[0].description).toBe('Does things');
      expect(entries[0].gitBranch).toBe('feat/one');
      expect(entries[0].created).toBe('2026-01-01T00:00:00Z');
      expect(entries[0].slug).toBe('first-session');
      expect(entries[0].project).toBe('/projects/one');

      expect(entries[1].id).toBe('bbb-222');
      expect(entries[1].name).toBe('Second Session');
      expect(entries[1].summary).toBe('A summary');
      expect(entries[1].slug).toBe('second-session');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Name resolution priority
  // ---------------------------------------------------------------------------
  describe('resolveSessionName', () => {
    it('returns customTitle when available', () => {
      const metadata = createSessionMetadata({
        customTitle: 'My Custom Title',
        slug: 'some-slug',
      });
      const name = service.resolveSessionName('abcdef12-3456-7890-abcd-ef1234567890', metadata);
      expect(name).toBe('My Custom Title');
    });

    it('returns slug when customTitle is null', () => {
      const metadata = createSessionMetadata({
        customTitle: null,
        slug: 'fallback-slug',
      });
      const name = service.resolveSessionName('abcdef12-3456-7890-abcd-ef1234567890', metadata);
      expect(name).toBe('fallback-slug');
    });

    it('returns first 8 chars of session ID + "..." when neither customTitle nor slug', () => {
      const metadata = createSessionMetadata({
        customTitle: null,
        slug: null,
      });
      const sessionId = 'abcdef12-3456-7890-abcd-ef1234567890';
      const name = service.resolveSessionName(sessionId, metadata);
      expect(name).toBe('abcdef12...');
    });

    it('falls back to truncated ID when no metadata is provided', () => {
      const sessionId = 'deadbeef-1234-5678-9abc-def012345678';
      const name = service.resolveSessionName(sessionId);
      expect(name).toBe('deadbeef...');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Caching behavior
  // ---------------------------------------------------------------------------
  describe('caching', () => {
    it('exports the expected cache TTL constant', () => {
      expect(METADATA_CACHE_TTL).toBe(10_000);
    });

    it('returns cached data on second call within TTL', async () => {
      // Set up a minimal project structure with a sessions-index and a JSONL file
      const sessionId = 'cache-test-01';
      const entries: JsonlEntry[] = [
        { type: 'custom-title', customTitle: 'Cached Title' },
      ];

      await writeTempJsonlFile(tmpDir, 'default', sessionId, entries);
      await writeTempSessionsIndex(tmpDir, 'default', {
        sessions: [{ id: sessionId, name: 'Cache Test' }],
      });

      const result1 = await service.loadAllMetadata();
      const result2 = await service.loadAllMetadata();

      // Both calls should return the same Map reference (cached)
      expect(result1).toBe(result2);
    });

    it('re-reads after invalidateCache is called', async () => {
      const sessionId = 'cache-invalidate-01';
      const entries: JsonlEntry[] = [
        { type: 'custom-title', customTitle: 'Original Title' },
      ];

      await writeTempJsonlFile(tmpDir, 'default', sessionId, entries);
      await writeTempSessionsIndex(tmpDir, 'default', {
        sessions: [{ id: sessionId, name: 'Invalidate Test' }],
      });

      const result1 = await service.loadAllMetadata();
      expect(result1.get(sessionId)?.customTitle).toBe('Original Title');

      // Update the underlying JSONL file
      const updatedEntries: JsonlEntry[] = [
        { type: 'custom-title', customTitle: 'Updated Title' },
      ];
      await writeTempJsonlFile(tmpDir, 'default', sessionId, updatedEntries);

      // Invalidate the cache
      service.invalidateCache();

      const result2 = await service.loadAllMetadata();

      // After invalidation, the new data should be loaded
      expect(result2).not.toBe(result1);
      expect(result2.get(sessionId)?.customTitle).toBe('Updated Title');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('returns empty partial for a missing JSONL file', async () => {
      const missingPath = path.join(tmpDir, 'nonexistent', 'missing.jsonl');
      const result = await service.readSessionInfoFromJsonl(missingPath);

      // Should not throw; should return an empty partial
      expect(result).toBeDefined();
      expect(result.customTitle).toBeUndefined();
      expect(result.slug).toBeUndefined();
      expect(result.project).toBeUndefined();
    });

    it('returns empty partial for an empty JSONL file', async () => {
      // Write a JSONL file with no entries (empty array produces empty file)
      const jsonlDir = path.join(tmpDir, 'projects', 'empty-test');
      await fs.mkdir(jsonlDir, { recursive: true });
      const emptyPath = path.join(jsonlDir, 'empty.jsonl');
      await fs.writeFile(emptyPath, '', 'utf-8');

      const result = await service.readSessionInfoFromJsonl(emptyPath);

      expect(result).toBeDefined();
      expect(result.customTitle).toBeUndefined();
      expect(result.slug).toBeUndefined();
    });

    it('skips malformed JSON lines without throwing', async () => {
      const jsonlDir = path.join(tmpDir, 'projects', 'malformed-test');
      await fs.mkdir(jsonlDir, { recursive: true });
      const malformedPath = path.join(jsonlDir, 'bad.jsonl');

      const content = [
        '{"slug": "good-slug"}',
        'this is not json at all',
        '{"broken": true,}',           // trailing comma = invalid JSON
        '{"type": "custom-title", "customTitle": "Recovered"}',
        '',
      ].join('\n');

      await fs.writeFile(malformedPath, content, 'utf-8');

      const result = await service.readSessionInfoFromJsonl(malformedPath);

      // Should have extracted data from the valid lines
      expect(result.slug).toBe('good-slug');
      expect(result.customTitle).toBe('Recovered');
    });

    it('returns empty array when sessions-index.json is missing', async () => {
      const missingDir = path.join(tmpDir, 'projects', 'no-index');
      await fs.mkdir(missingDir, { recursive: true });

      const entries = await service.loadSessionsIndex(missingDir);

      expect(entries).toEqual([]);
    });

    it('returns empty array when sessions-index.json has no sessions key', async () => {
      const indexDir = path.join(tmpDir, 'projects', 'bad-index');
      await fs.mkdir(indexDir, { recursive: true });
      const indexPath = path.join(indexDir, 'sessions-index.json');
      await fs.writeFile(indexPath, JSON.stringify({ version: 1 }), 'utf-8');

      const entries = await service.loadSessionsIndex(indexDir);

      expect(entries).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. encodeProjectKey
  // ---------------------------------------------------------------------------
  describe('encodeProjectKey', () => {
    it('encodes absolute path by replacing slashes with dashes', () => {
      expect(encodeProjectKey('/Users/byron/foo')).toBe('-Users-byron-foo');
    });

    it('encodes root path', () => {
      expect(encodeProjectKey('/')).toBe('-');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. projectDir populated in metadata
  // ---------------------------------------------------------------------------
  describe('projectDir in metadata', () => {
    it('populates projectDir from the project directory name', async () => {
      const projDirName = '-Users-dev-myproject';
      const sessionId = 'proj-dir-test-01';
      const entries: JsonlEntry[] = [
        { slug: 'my-session' },
      ];

      await writeTempJsonlFile(tmpDir, projDirName, sessionId, entries);
      await writeTempSessionsIndex(tmpDir, projDirName, {
        sessions: [{ id: sessionId }],
      });

      const result = await service.loadAllMetadata();
      const metadata = result.get(sessionId);

      expect(metadata).toBeDefined();
      expect(metadata!.projectDir).toBe(projDirName);
    });

    it('different project dirs produce different projectDir values', async () => {
      const projA = '-Users-dev-projectA';
      const projB = '-Users-dev-projectB';

      await writeTempJsonlFile(tmpDir, projA, 'sess-a', [{ slug: 'a' }]);
      await writeTempSessionsIndex(tmpDir, projA, { sessions: [{ id: 'sess-a' }] });

      await writeTempJsonlFile(tmpDir, projB, 'sess-b', [{ slug: 'b' }]);
      await writeTempSessionsIndex(tmpDir, projB, { sessions: [{ id: 'sess-b' }] });

      const result = await service.loadAllMetadata();

      expect(result.get('sess-a')!.projectDir).toBe(projA);
      expect(result.get('sess-b')!.projectDir).toBe(projB);
    });
  });
});
