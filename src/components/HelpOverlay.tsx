import React from 'react';
import { Box, Text, useInput } from 'ink';

interface HelpOverlayProps {
  onClose: () => void;
}

interface Shortcut {
  keys: string;
  description: string;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const sections: Section[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: 'q', description: 'Quit' },
      { keys: '?', description: 'Help' },
      { keys: 'Tab', description: 'Switch panel' },
      { keys: 'Ctrl+C', description: 'Quit' },
    ],
  },
  {
    title: 'Session List',
    shortcuts: [
      { keys: 'j/k or ↑/↓', description: 'Navigate' },
      { keys: 'g/G', description: 'First/Last' },
      { keys: 'Enter', description: 'Select' },
      { keys: 'f', description: 'Cycle filter (All/Active/Archived)' },
      { keys: 't', description: 'Timeline' },
      { keys: 'a', description: 'Activity' },
    ],
  },
  {
    title: 'Kanban',
    shortcuts: [
      { keys: 'h/l or ←/→', description: 'Columns' },
      { keys: 'j/k or ↑/↓', description: 'Rows' },
      { keys: 'Enter', description: 'Open detail' },
    ],
  },
  {
    title: 'Timeline',
    shortcuts: [
      { keys: 'j/k or ↑/↓', description: 'Navigate snapshots' },
      { keys: 'q/Esc', description: 'Close' },
    ],
  },
  {
    title: 'Task Detail',
    shortcuts: [
      { keys: 'q/Esc', description: 'Close' },
      { keys: 'Backspace', description: 'Back' },
    ],
  },
];

export function HelpOverlay({ onClose }: HelpOverlayProps): React.ReactElement {
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Keyboard Shortcuts</Text>
      <Text> </Text>
      {sections.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold underline>{section.title}</Text>
          {section.shortcuts.map((shortcut) => (
            <Text key={shortcut.keys}>  {shortcut.keys}  {shortcut.description}</Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
