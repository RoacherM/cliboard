import React, { useState } from 'react';
import { Box, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface NoteInputProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function NoteInput({ onSubmit, onCancel }: NoteInputProps): React.ReactElement {
  const [value, setValue] = useState('');

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const handleSubmit = (text: string): void => {
    if (text.length > 0) {
      onSubmit(text);
    }
  };

  return (
    <Box>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}
