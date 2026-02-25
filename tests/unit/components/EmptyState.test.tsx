import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { EmptyState } from '../../../src/components/EmptyState.js';

describe('EmptyState', () => {
  describe('noSessions type', () => {
    it('should display a "No sessions found" message', () => {
      const { lastFrame } = render(<EmptyState type="noSessions" />);
      const output = lastFrame();

      expect(output).toMatch(/no sessions/i);
    });

    it('should include a helpful hint about how to get started', () => {
      const { lastFrame } = render(<EmptyState type="noSessions" />);
      const output = lastFrame();

      // The hint should tell users how to create or start a session
      expect(output!.length).toBeGreaterThan(0);
      expect(output).toMatch(/start|create|run|claude/i);
    });
  });

  describe('noTasks type', () => {
    it('should display a "No tasks" message', () => {
      const { lastFrame } = render(<EmptyState type="noTasks" />);
      const output = lastFrame();

      expect(output).toMatch(/no tasks/i);
    });

    it('should include a helpful hint about how to get started', () => {
      const { lastFrame } = render(<EmptyState type="noTasks" />);
      const output = lastFrame();

      // The hint should tell users how to add tasks
      expect(output!.length).toBeGreaterThan(0);
      expect(output).toMatch(/add|create|start|assign/i);
    });
  });
});
