import { describe, it, expect } from 'vitest';
import { createListCommand } from '../../../src/commands/list.js';

describe('createListCommand', () => {
  it('lists sessions with task info', () => {
    const cmd = createListCommand('/tmp/claude');

    expect(cmd).toBeDefined();
    expect(cmd.name()).toBe('list');
  });

  it('supports --json flag for JSON output', () => {
    const cmd = createListCommand('/tmp/claude');

    const jsonOption = cmd.options.find(
      (opt) => opt.long === '--json'
    );
    expect(jsonOption).toBeDefined();
  });

  it('supports --backend flag', () => {
    const cmd = createListCommand('/tmp/claude');

    const backendOption = cmd.options.find(
      (opt) => opt.long === '--backend'
    );
    expect(backendOption).toBeDefined();
  });
});
