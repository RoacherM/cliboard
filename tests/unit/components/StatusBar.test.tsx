import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../../../src/components/StatusBar.js';

describe('StatusBar', () => {
  describe('sessionList context', () => {
    it('should display key hints for Tab, /, Enter, and q', () => {
      const { lastFrame } = render(<StatusBar context="sessionList" />);
      const output = lastFrame();

      expect(output).toContain('Tab');
      expect(output).toContain('/');
      expect(output).toContain('Enter');
      expect(output).toContain('q');
    });
  });

  describe('kanban context', () => {
    it('should display key hints for h/j/k/l, Enter, and Esc', () => {
      const { lastFrame } = render(<StatusBar context="kanban" />);
      const output = lastFrame();

      expect(output).toContain('h');
      expect(output).toContain('j');
      expect(output).toContain('k');
      expect(output).toContain('l');
      expect(output).toContain('Enter');
      expect(output).toContain('Esc');
    });
  });

  describe('detail context', () => {
    it('should display key hints for Esc, n (note), and d (delete)', () => {
      const { lastFrame } = render(<StatusBar context="detail" />);
      const output = lastFrame();

      expect(output).toContain('Esc');
      expect(output).toContain('n');
      expect(output).toContain('d');
    });
  });

  describe('search context', () => {
    it('should display Esc hint to close search', () => {
      const { lastFrame } = render(<StatusBar context="search" />);
      const output = lastFrame();

      expect(output).toContain('Esc');
    });
  });
});
