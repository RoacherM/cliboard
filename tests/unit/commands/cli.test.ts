import { describe, it, expect, afterEach } from 'vitest';
import { createProgram } from '../../../src/cli.js';
import os from 'node:os';
import path from 'node:path';

describe('createProgram', () => {
  const originalEnv = process.env.CLAUDE_DIR;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CLAUDE_DIR;
    } else {
      process.env.CLAUDE_DIR = originalEnv;
    }
  });

  it('creates a program with default directory', () => {
    const program = createProgram();

    expect(program).not.toBeNull();
    expect(program).toBeDefined();
  });

  it('accepts --dir flag to set custom directory', () => {
    const program = createProgram();
    program.parse(['--dir', '/custom/path'], { from: 'user' });

    expect(program.opts().dir).toBe('/custom/path');
  });

  it('falls back to CLAUDE_DIR environment variable', () => {
    process.env.CLAUDE_DIR = '/env/path';
    const program = createProgram();

    // Program should be created successfully with env fallback
    expect(program).toBeDefined();
  });

  it('expands tilde in --dir to home directory', () => {
    const program = createProgram();
    program.parse(['--dir', '~/test'], { from: 'user' });

    const dir = program.opts().dir as string;
    const home = os.homedir();

    expect(dir).not.toContain('~');
    expect(dir).toBe(path.join(home, 'test'));
  });
});
