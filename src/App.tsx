import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import path from 'node:path';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { useClaudeData } from './hooks/useClaudeData.js';
import { Sidebar } from './components/Sidebar.js';
import { NavigableKanban } from './components/NavigableKanban.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { TimelineOverlay } from './components/TimelineOverlay.js';
import { TimelineService } from './lib/timelineService.js';
import { ActivityOverlay } from './components/ActivityOverlay.js';
import { parseSubAgents } from './lib/activityService.js';
import type { TaskSnapshot, SubAgentEntry } from './lib/types.js';

interface AppProps {
  claudeDir: string;
  projectPath?: string;
}

type FocusedPanel = 'sidebar' | 'kanban';

export function App({ claudeDir, projectPath }: AppProps): React.ReactElement {
  const { sessions, currentTasks, loading, error, selectSession } = useClaudeData(claudeDir, { projectPath });
  const { exit } = useApp();
  const { stdout } = useStdout();
  // Terminal height minus title(1) + panel borders(2) + sidebar header(2) + status bar(1) = 6 overhead
  // Each session item is 2 lines (name + subtitle), so halve the available rows
  const sidebarVisibleHeight = Math.max(3, Math.floor(((stdout?.rows ?? 24) - 6) / 2));

  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [focusedPanel, setFocusedPanel] = useState<FocusedPanel>('sidebar');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [showHelp, setShowHelp] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineSnapshots, setTimelineSnapshots] = useState<TaskSnapshot[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activityEntries, setActivityEntries] = useState<SubAgentEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

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
      if (sessions[index]) {
        selectSession(sessions[index].id);
      }
    },
    [sessions, selectSession],
  );

  const handleOpenSession = useCallback(
    (id: string) => {
      selectSession(id);
      setFocusedPanel('kanban');
    },
    [selectSession],
  );

  const handleFilterChange = useCallback((newFilter: string) => {
    const normalized = newFilter.toLowerCase() as 'all' | 'active' | 'archived';
    setFilter(normalized);
  }, []);

  const handleOpenTimeline = useCallback(async () => {
    const session = sessions[selectedSessionIndex];
    if (!session?.jsonlPath) return;
    setTimelineLoading(true);
    try {
      const service = new TimelineService();
      const snaps = await service.parseSessionTimeline(session.jsonlPath);
      setTimelineSnapshots(snaps);
      setShowTimeline(true);
    } finally {
      setTimelineLoading(false);
    }
  }, [sessions, selectedSessionIndex]);

  const handleOpenActivity = useCallback(async () => {
    const session = sessions[selectedSessionIndex];
    if (!session?.jsonlPath) return;
    setActivityLoading(true);
    try {
      const entries = await parseSubAgents(session.jsonlPath);
      setActivityEntries(entries);
      setShowActivity(true);
    } finally {
      setActivityLoading(false);
    }
  }, [sessions, selectedSessionIndex]);

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

    if (input === 't' && focusedPanel === 'sidebar' && sessions.length > 0) {
      handleOpenTimeline();
      return;
    }

    if (input === 'a' && focusedPanel === 'sidebar' && sessions.length > 0) {
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
  const clampedIndex = sessions.length > 0 ? Math.min(selectedSessionIndex, sessions.length - 1) : 0;
  const selectedSession = sessions[clampedIndex];
  const projectName = useMemo(() => projectPath ? path.basename(projectPath) : null, [projectPath]);

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
        <Panel title="Sub-agents" borderColor="blue">
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
            {sessions.length} sessions
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
            title={`Sessions (${sessions.length > 0 ? clampedIndex + 1 : 0}/${sessions.length})`}
            borderColor={focusedPanel === 'sidebar' ? 'cyan' : 'gray'}
            focused={focusedPanel === 'sidebar'}
          >
            <Sidebar
              sessions={sessions}
              selectedIndex={selectedSessionIndex}
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
            <NavigableKanban tasks={currentTasks} isActive={focusedPanel === 'kanban'} />
          </Panel>
        </Box>
      </Box>

      {/* Status bar */}
      <Box>
        <Text backgroundColor="gray" color="white">
          {' '}
          {focusedPanel === 'sidebar'
            ? 'j/k:navigate  g/G:first/last  t:timeline  a:agents  Enter:select  Tab:→kanban  ?:help  q:quit'
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
