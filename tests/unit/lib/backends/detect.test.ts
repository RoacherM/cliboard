import { describe, it, expect, vi } from 'vitest';
import { createAdapter } from '../../../../src/lib/backends/detect.js';
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

  it('should default to claude in auto mode when ~/.claude exists', async () => {
    const adapter = await createAdapter('auto', '/tmp/fake-claude');
    expect(adapter.id).toBeDefined();
    expect(['claude', 'opencode']).toContain(adapter.id);
    await adapter.dispose();
  });

  it('should create a CompositeBackendAdapter when multiple backends are available', async () => {
    // Mock detectAvailableBackends to return both
    const detect = await import('../../../../src/lib/backends/detect.js');
    const spy = vi.spyOn(detect, 'detectAvailableBackends').mockResolvedValue(['claude', 'opencode']);

    const adapter = await createAdapter('auto', '/tmp/fake-claude');
    expect(adapter).toBeInstanceOf(CompositeBackendAdapter);
    expect(adapter.displayName).toContain('+');
    await adapter.dispose();

    spy.mockRestore();
  });
});
