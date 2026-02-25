import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  context: 'sessionList' | 'kanban' | 'detail' | 'search';
}

const hints: Record<StatusBarProps['context'], string[]> = {
  sessionList: ['Tab: Switch view', '/: Search', 'Enter: Select', 'q: Quit'],
  kanban: ['h/j/k/l: Navigate', 'Enter: Open', 'Esc: Back'],
  detail: ['Esc: Back', 'n: Add note', 'd: Delete'],
  search: ['Esc: Close search'],
};

export function StatusBar({ context }: StatusBarProps): React.ReactElement {
  return (
    <Box>
      <Text>{hints[context].join('  ')}</Text>
    </Box>
  );
}
