import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskDataService } from '../../../src/lib/taskDataService.js';
import {
  createTempDir,
  cleanupTempDir,
} from '../../helpers/index.js';

describe('TaskDataService - write operations (todos format)', () => {
  let tmpDir: string;
  let service: TaskDataService;

  beforeEach(async () => {
    tmpDir = await createTempDir();
    service = new TaskDataService(tmpDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tmpDir);
  });

  describe('addNote', () => {
    it('throws because todos format is read-only', async () => {
      await expect(
        service.addNote('session-1', '1', 'My note'),
      ).rejects.toThrow(/read-only/);
    });
  });

  describe('deleteTask', () => {
    it('throws because todos format is read-only', async () => {
      await expect(
        service.deleteTask('session-1', '1'),
      ).rejects.toThrow(/read-only/);
    });
  });
});
