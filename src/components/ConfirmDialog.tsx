import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps): React.ReactElement {
  useInput((input) => {
    if (input === 'y') {
      onConfirm();
    } else if (input === 'n') {
      onCancel();
    }
  });

  return (
    <Box>
      <Text>{message}</Text>
    </Box>
  );
}
