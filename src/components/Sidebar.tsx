import React from 'react';
import { Box, Text } from 'ink';
import { FilterBar } from './FilterBar.js';
import { SessionList } from './SessionList.js';
import type { Session } from '../lib/types.js';

interface SidebarProps {
  sessions: Session[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (id: string) => void;
  filter: 'all' | 'active' | 'archived';
  onFilterChange: (filter: string) => void;
  isActive?: boolean;
  visibleHeight?: number;
}

const FILTERS = ['All', 'Active'];

export function Sidebar({
  sessions,
  selectedIndex,
  onSelect,
  onOpen,
  filter,
  onFilterChange,
  isActive,
  visibleHeight,
}: SidebarProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Sessions</Text>
      <FilterBar
        filters={FILTERS}
        activeFilter={filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'All'}
        onFilterChange={onFilterChange}
      />
      <SessionList
        sessions={sessions}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        onOpen={onOpen}
        isActive={isActive}
        visibleHeight={visibleHeight}
      />
    </Box>
  );
}
