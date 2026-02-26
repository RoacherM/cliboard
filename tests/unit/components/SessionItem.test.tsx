import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { SessionItem } from '../../../src/components/SessionItem.js';
import { createSession } from '../../helpers/index.js';

describe('SessionItem', () => {
  it('should render the session name', () => {
    const session = createSession({ name: 'My project' });
    const { lastFrame } = render(
      React.createElement(SessionItem, { session })
    );
    const output = lastFrame();

    expect(output).toContain('My project');
  });

  it('should display task completion counts', () => {
    const session = createSession({ taskCount: 10, completed: 3 });
    const { lastFrame } = render(
      React.createElement(SessionItem, { session })
    );
    const output = lastFrame();

    // Expect a fraction like "3/10" representing completed out of total
    expect(output).toContain('3/10');
  });

  it('should show a pulsing indicator for live sessions', () => {
    const session = createSession({ isLive: true });
    const { lastFrame } = render(
      React.createElement(SessionItem, { session })
    );
    const output = lastFrame();

    // PulsingDot cycles through ●◉○◉
    const hasPulsingIndicator =
      output!.includes('●') ||
      output!.includes('◉') ||
      output!.includes('○');
    expect(hasPulsingIndicator).toBe(true);
  });

  it('should visually distinguish a selected session from an unselected one', () => {
    const session = createSession();

    const { lastFrame: unselectedFrame } = render(
      React.createElement(SessionItem, { session, isSelected: false })
    );
    const { lastFrame: selectedFrame } = render(
      React.createElement(SessionItem, { session, isSelected: true })
    );

    const unselectedOutput = unselectedFrame();
    const selectedOutput = selectedFrame();

    expect(selectedOutput).not.toEqual(unselectedOutput);
  });

  it('should show a dim static indicator for stale in-progress sessions (not live)', () => {
    const staleSession = createSession({ inProgress: 2, isLive: false });
    const liveSession = createSession({ inProgress: 2, isLive: true });

    const { lastFrame: staleFrame } = render(
      React.createElement(SessionItem, { session: staleSession })
    );
    const { lastFrame: liveFrame } = render(
      React.createElement(SessionItem, { session: liveSession })
    );

    const staleOutput = staleFrame()!;
    const liveOutput = liveFrame()!;

    // Stale session should show a dim ○ (not a pulsing dot)
    expect(staleOutput).toContain('○');
    // They should render differently
    expect(staleOutput).not.toEqual(liveOutput);
  });

  it('should indicate when a session is archived', () => {
    const archivedSession = createSession({ isArchived: true });
    const activeSession = createSession({ isArchived: false });

    const { lastFrame: archivedFrame } = render(
      React.createElement(SessionItem, { session: archivedSession })
    );
    const { lastFrame: activeFrame } = render(
      React.createElement(SessionItem, { session: activeSession })
    );

    const archivedOutput = archivedFrame();
    const activeOutput = activeFrame();

    // Archived session should differ from active, or contain an archived indicator
    const hasArchivedIndicator =
      archivedOutput!.toLowerCase().includes('archived') ||
      archivedOutput!.includes('📦') ||
      archivedOutput !== activeOutput;
    expect(hasArchivedIndicator).toBe(true);
  });
});
