import React from 'react';
import { Box, Text } from 'ink';

interface FilterBarProps {
  filters: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function FilterBar({ filters, activeFilter }: FilterBarProps): React.ReactElement {
  return (
    <Box>
      {filters.map((filter) => (
        <Box key={filter} marginRight={1}>
          <Text bold={filter === activeFilter}>
            {filter === activeFilter ? `[${filter}]` : filter}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
