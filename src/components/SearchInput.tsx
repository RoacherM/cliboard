import React, { useState } from 'react';
import { Box, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface SearchInputProps {
  onChange: (query: string) => void;
  onClose: () => void;
}

export function SearchInput({ onChange, onClose }: SearchInputProps): React.ReactElement {
  const [value, setValue] = useState('');

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
    }
  });

  const handleChange = (newValue: string): void => {
    setValue(newValue);
    onChange(newValue);
  };

  return (
    <Box>
      <TextInput value={value} onChange={handleChange} />
    </Box>
  );
}
