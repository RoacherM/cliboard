import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import path from 'node:path';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { useBackendData } from './hooks/useBackendData.js';
import { Sidebar } from './components/Sidebar.js';
import { NavigableKanban } from './components/NavigableKanban.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { TimelineOverlay } from './components/TimelineOverlay.js';
import { ActivityOverlay } from './components/ActivityOverlay.js';
import type { BackendAdapter } from './lib/backends/types.js';
import type { TaskSnapshot, ActivityEntry } from './lib/types.js';

interface AppProps {
  adapter: BackendAdapter;
  projectPath?: string;
}

type FocusedPanel = 'sidebar' | 'kanban';

export function App({ adapter, projectPath }: AppProps): React.ReactElement {
  const { sessions, currentTasks, loading, error, selectSession } = useBackendData(adapter, { projectPath });
  const { exit } = useApp();
  const { stdout } = useStdout();
  const sidebarVisibleHeight = Math.max(3, Math.floor(((stdout?.rows ?? 24) - 6) / 2));

  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>('sidebar');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [showHelp, setShowHelp] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineSnapshots, setTimelineSnapshots] = useState<TaskSnapshot[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Filter sessions by active/archived status
  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions;
    if (filter === 'active') return sessions.filter((s) => !s.isArchived);
    return sessions.filter((s) => s.isArchived); // 'archived'
  }, [sessions, filter]);

  // Preserve selection by session ID across list refreshes/reorders
  useEffect(() => {
    if (filteredSessions.length === 0) return;
    if (!selectedSessionId) {
      // Initial load: select first session
      setSelectedSessionId(filteredSessions[0]!.id);
      selectSession(filteredSessions[0]!.id);
      return;
    }
    const newIndex = filteredSessions.findIndex((s) => s.id === selectedSessionId);
    if (newIndex !== -1 && newIndex !== selectedSessionIndex) {
      setSelectedSessionIndex(newIndex);
    }
  }, [filteredSessions, selectedSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ring terminal bell when any session's task counts change
  const prevSessionsRef = useRef<typeof sessions>([]);
  useEffect(() => {
    const prev = prevSessionsRef.current;
    if (prev.length > 0 && sessions.length > 0) {
      const changed = sessions.some((s) => {
        const p = prev.find((ps) => ps.id === s.id);
        return p && (p.completed !== s.completed || p.inProgress !== s.inProgress || p.pending !== s.pending);
      });
      if (changed && stdout) {
        stdout.write('\x07');
      }
    }
    prevSessionsRef.current = sessions;
  }, [sessions, stdout]);

  const handleSelectSession = useCallback(
    (index: number) => {
      setSelectedSessionIndex(index);
      const session = filteredSessions[index];
      if (session) {
        setSelectedSessionId(session.id);
        selectSession(session.id);
      }
    },
    [filteredSessions, selectSession],
  );

  const handleOpenSession = useCallback(
    (id: string) => {
      selectSession(id);
      setFocusedPanel('kanban');
    },
    [selectSession],
  );

  const handleFilterChange = useCallback((newFilter: string) => {
    const lower = newFilter.toLowerCase();
    if (lower === 'all' || lower === 'active' || lower === 'archived') {
      setFilter(lower);
    }
  }, []);

  const handleOpenTimeline = useCallback(async () => {
    if (!adapter.capabilities.timeline) return;
    const session = filteredSessions[selectedSessionIndex];
    if (!session) return;
    setTimelineLoading(true);
    try {
      const snaps = await adapter.loadTimeline(session.id);
      setTimelineSnapshots(snaps);
      setShowTimeline(true);
    } finally {
      setTimelineLoading(false);
    }
  }, [adapter, filteredSessions, selectedSessionIndex]);

  const handleOpenActivity = useCallback(async () => {
    if (!adapter.capabilities.activity) return;
    const session = filteredSessions[selectedSessionIndex];
    if (!session) return;
    setActivityLoading(true);
    try {
      const entries = await adapter.loadActivity(session.id);
      setActivityEntries(entries);
      setShowActivity(true);
    } finally {
      setActivityLoading(false);
    }
  }, [adapter, filteredSessions, selectedSessionIndex]);

  useInput((input, key) => {
    if (showHelp) {
      if (key.escape || input === '?' || input === 'q') {
        setShowHelp(false);
      }
      return;
    }

    if (showTimeline) {
      // TimelineOverlay handles its own input
      return;
    }

    if (showActivity) {
      // ActivityOverlay handles its own input
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }

    if (input === '?') {
      setShowHelp(true);
      return;
    }

    if (input === 'f' && focusedPanel === 'sidebar') {
      setFilter((prev) => {
        if (prev === 'all') return 'active';
        if (prev === 'active') return 'archived';
        return 'all';
      });
      setSelectedSessionIndex(0);
      setSelectedSessionId(null);
      return;
    }

    if (input === 't' && focusedPanel === 'sidebar' && filteredSessions.length > 0 && adapter.capabilities.timeline) {
      handleOpenTimeline();
      return;
    }

    if (input === 'a' && focusedPanel === 'sidebar' && filteredSessions.length > 0 && adapter.capabilities.activity) {
      handleOpenActivity();
      return;
    }

    if (key.tab) {
      setFocusedPanel((prev) => (prev === 'sidebar' ? 'kanban' : 'sidebar'));
      return;
    }
  });

  // Compute summary stats
  const totalTasks = currentTasks.length;
  const doneTasks = currentTasks.filter(t => t.status === 'completed').length;
  const activeTasks = currentTasks.filter(t => t.status === 'in_progress').length;
  const pendingTasks = currentTasks.filter(t => t.status === 'pending').length;
  const clampedIndex = filteredSessions.length > 0 ? Math.min(selectedSessionIndex, filteredSessions.length - 1) : 0;
  const selectedSession = filteredSessions[clampedIndex];
  const projectName = useMemo(() => projectPath ? path.basename(projectPath) : null, [projectPath]);

  // Build capability-aware status bar hints
  const sidebarHints = useMemo(() => {
    const parts = ['j/k:navigate', 'g/G:first/last', 'f:filter'];
    if (adapter.capabilities.timeline) parts.push('t:timeline');
    if (adapter.capabilities.activity) parts.push('a:activity');
    parts.push('Enter:select', 'Tab:→kanban', '?:help', 'q:quit');
    return parts.join('  ');
  }, [adapter.capabilities]);

  if (showHelp) {
    return (
      <Box flexDirection="column">
        <Panel title="Help" borderColor="yellow">
          <HelpOverlay onClose={() => setShowHelp(false)} />
        </Panel>
      </Box>
    );
  }

  if (showTimeline) {
    return (
      <Box flexDirection="column">
        <Panel title="Timeline" borderColor="magenta">
          <TimelineOverlay
            snapshots={timelineSnapshots}
            sessionName={selectedSession?.name ?? selectedSession?.id ?? 'Unknown'}
            onClose={() => setShowTimeline(false)}
          />
        </Panel>
      </Box>
    );
  }

  if (showActivity) {
    return (
      <Box flexDirection="column">
        <Panel title="Activity" borderColor="blue">
          <ActivityOverlay
            entries={activityEntries}
            sessionName={selectedSession?.name ?? selectedSession?.id ?? 'Unknown'}
            onClose={() => setShowActivity(false)}
          />
        </Panel>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Title bar */}
      <Box>
        <Text bold color="cyan"> CLIboard{projectName ? ` ─ ${projectName}` : ''} </Text>
        <Text dimColor> │ </Text>
        {loading || timelineLoading || activityLoading ? (
          <Text color="yellow">⟳ {timelineLoading ? 'loading timeline...' : activityLoading ? 'loading agents...' : 'loading...'}</Text>
        ) : (
          <Text dimColor>
            {filteredSessions.length} sessions
            {adapter.displayName !== 'Claude Code' ? ` (${adapter.displayName})` : ''}
            {selectedSession ? ` │ ${selectedSession.name ?? selectedSession.id}` : ''}
            {selectedSession?.gitBranch ? ` (${selectedSession.gitBranch})` : ''}
            {totalTasks > 0 ? ` │ ${doneTasks}✓ ${activeTasks}⟳ ${pendingTasks}○` : ''}
          </Text>
        )}
      </Box>

      {error && (
        <Box marginLeft={1}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      )}

      {/* Main layout */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Sessions panel */}
        <Box width={32}>
          <Panel
            title={`Sessions (${filteredSessions.length > 0 ? clampedIndex + 1 : 0}/${filteredSessions.length})`}
            borderColor={focusedPanel === 'sidebar' ? 'cyan' : 'gray'}
            focused={focusedPanel === 'sidebar'}
          >
            <Sidebar
              sessions={filteredSessions}
              selectedIndex={clampedIndex}
              onSelect={handleSelectSession}
              onOpen={handleOpenSession}
              filter={filter}
              onFilterChange={handleFilterChange}
              isActive={focusedPanel === 'sidebar'}
              visibleHeight={sidebarVisibleHeight}
            />
          </Panel>
        </Box>

        {/* Kanban panel */}
        <Box flexGrow={1}>
          <Panel
            title={`Tasks${selectedSession ? ` ─ ${selectedSession.name ?? selectedSession.id}` : ''}`}
            borderColor={focusedPanel === 'kanban' ? 'cyan' : 'gray'}
            focused={focusedPanel === 'kanban'}
          >
            {adapter.capabilities.tasks ? (
              <NavigableKanban tasks={currentTasks} isActive={focusedPanel === 'kanban'} />
            ) : (
              <Text dimColor>No tasks available for this backend</Text>
            )}
          </Panel>
        </Box>
      </Box>

      {/* Status bar */}
      <Box>
        <Text backgroundColor="gray" color="white">
          {' '}
          {focusedPanel === 'sidebar'
            ? sidebarHints
            : 'h/j/k/l:navigate  Enter:open  Tab:→sessions  Esc:back  ?:help  q:quit'}
          {' '}
        </Text>
      </Box>
    </Box>
  );
}

/* ── Bordered panel component (lazygit-style) ── */

interface PanelProps {
  title: string;
  borderColor?: string;
  focused?: boolean;
  children: React.ReactNode;
}

function Panel({ title, borderColor = 'gray', focused, children }: PanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      flexGrow={1}
      paddingLeft={1}
      paddingRight={1}
    >
      <Box marginTop={-1}>
        <Text color={borderColor}>
          {focused ? '╸' : ' '}
        </Text>
        <Text bold color={focused ? 'cyan' : 'white'}> {title} </Text>
      </Box>
      {children}
    </Box>
  );
}
