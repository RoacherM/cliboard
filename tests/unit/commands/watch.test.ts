import { describe, it, expect } from 'vitest';
import { createWatchCommand } from '../../../src/commands/watch.js';

describe('createWatchCommand', () => {
  it('returns a Command object', () => {
    const cmd = createWatchCommand('/tmp/claude');

    expect(cmd).toBeDefined();
    expect(cmd.name()).toBe('watch');
  });
});
