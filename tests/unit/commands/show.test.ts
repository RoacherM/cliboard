import { describe, it, expect } from 'vitest';
import { createShowCommand } from '../../../src/commands/show.js';

describe('createShowCommand', () => {
  it('creates a show command that accepts a task ID argument', () => {
    const cmd = createShowCommand('/tmp/claude');

    expect(cmd).toBeDefined();
    expect(cmd.name()).toBe('show');
  });

  it('supports --backend flag', () => {
    const cmd = createShowCommand('/tmp/claude');

    const backendOption = cmd.options.find(
      (opt) => opt.long === '--backend'
    );
    expect(backendOption).toBeDefined();
  });

  it('supports --session flag', () => {
    const cmd = createShowCommand('/tmp/claude');

    const sessionOption = cmd.options.find(
      (opt) => opt.long === '--session'
    );
    expect(sessionOption).toBeDefined();
  });
});
