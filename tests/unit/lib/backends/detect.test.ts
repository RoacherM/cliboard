import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import { createAdapter, detectAvailableBackends } from '../../../../src/lib/backends/detect.js';
import { ClaudeBackendAdapter } from '../../../../src/lib/backends/claude/adapter.js';
import { CompositeBackendAdapter } from '../../../../src/lib/backends/composite/adapter.js';

describe('createAdapter', () => {
  it('should create a ClaudeBackendAdapter when backend is "claude"', async () => {
    const adapter = await createAdapter('claude', '/tmp/fake-claude');
    expect(adapter).toBeInstanceOf(ClaudeBackendAdapter);
    expect(adapter.id).toBe('claude');
    expect(adapter.displayName).toBe('Claude Code');
  });

  it('should create an OpenCodeBackendAdapter when backend is "opencode"', async () => {
    const adapter = await createAdapter('opencode', '/tmp/fake');
    expect(adapter.id).toBe('opencode');
    expect(adapter.displayName).toBe('OpenCode');
    await adapter.dispose();
  });

  it('should throw on unknown backend', async () => {
    await expect(createAdapter('invalid', '/tmp')).rejects.toThrow('Unknown backend');
  });
});

describe('detectAvailableBackends', () => {
  let accessSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    accessSpy = vi.spyOn(fs, 'access');
  });

  afterEach(() => {
    accessSpy.mockRestore();
  });

  it('should detect claude when claudeDir exists', async () => {
    accessSpy.mockImplementation(async (p: any) => {
      if (String(p) === '/custom/claude') return undefined as any;
      throw new Error('ENOENT');
    });

    const result = await detectAvailableBackends('/custom/claude');
    expect(result).toContain('claude');
    expect(result).not.toContain('opencode');
  });

  it('should use custom claudeDir instead of default', async () => {
    accessSpy.mockImplementation(async (p: any) => {
      // Only the custom path should work, not the default ~/.claude
      if (String(p) === '/my/custom/dir') return undefined as any;
      throw new Error('ENOENT');
    });

    const result = await detectAvailableBackends('/my/custom/dir');
    expect(result).toContain('claude');
  });

  it('should return empty when nothing exists', async () => {
    accessSpy.mockRejectedValue(new Error('ENOENT'));

    const result = await detectAvailableBackends('/nonexistent');
    expect(result).toEqual([]);
  });
});

describe('createAdapter auto mode', () => {
  let accessSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    accessSpy = vi.spyOn(fs, 'access');
  });

  afterEach(() => {
    accessSpy.mockRestore();
  });

  it('should default to claude when no backends detected', async () => {
    accessSpy.mockRejectedValue(new Error('ENOENT'));

    const adapter = await createAdapter('auto', '/tmp/fake-claude');
    expect(adapter).toBeInstanceOf(ClaudeBackendAdapter);
    expect(adapter.id).toBe('claude');
  });

  it('should return single adapter when only claude detected', async () => {
    accessSpy.mockImplementation(async (p: any) => {
      if (String(p) === '/tmp/fake-claude') return undefined as any;
      throw new Error('ENOENT');
    });

    const adapter = await createAdapter('auto', '/tmp/fake-claude');
    expect(adapter).toBeInstanceOf(ClaudeBackendAdapter);
    expect(adapter.id).toBe('claude');
  });

  it('should create CompositeBackendAdapter when both backends detected', async () => {
    // Both paths exist
    accessSpy.mockResolvedValue(undefined as any);

    const adapter = await createAdapter('auto', '/tmp/fake-claude');
    expect(adapter).toBeInstanceOf(CompositeBackendAdapter);
    expect(adapter.displayName).toContain('+');
    await adapter.dispose();
  });
});
