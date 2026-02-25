import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  loading?: boolean;
  status?: string;
}

export function Header({ loading, status }: HeaderProps): React.ReactElement {
  return (
    <Box>
      <Text bold color="cyan">CLIboard</Text>
      {loading && <Text dimColor> loading...</Text>}
      {status && <Text dimColor> {status}</Text>}
    </Box>
  );
}
