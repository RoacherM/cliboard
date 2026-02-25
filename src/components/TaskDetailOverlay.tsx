import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Task } from '../lib/types.js';

interface TaskDetailOverlayProps {
  task: Task;
  allTasks?: Task[];
  onClose: () => void;
  onNavigate?: (taskId: string) => void;
  onAddNote?: (note: string) => void;
}

export function TaskDetailOverlay({
  task,
  allTasks,
  onClose,
  onNavigate,
  onAddNote,
}: TaskDetailOverlayProps): React.ReactElement {
  const [noteMode, setNoteMode] = useState(false);

  useInput((input, key) => {
    if (noteMode) {
      return;
    }

    if (key.escape || key.backspace || key.delete || input === 'q') {
      onClose();
      return;
    }

    if (input === 'n') {
      if (onAddNote) {
        onAddNote('');
      }
      setNoteMode(true);
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1} width="100%">
      <Text bold>Task Detail</Text>
      <Text> </Text>

      <Box flexDirection="column">
        <Text><Text bold>ID:</Text> {task.id}</Text>
        <Text><Text bold>Subject:</Text> {task.subject}</Text>
        {task.description ? (
          <Text><Text bold>Description:</Text> {task.description}</Text>
        ) : null}
        <Text><Text bold>Status:</Text> {task.status}</Text>
        {task.activeForm ? (
          <Text><Text bold>Active Form:</Text> {task.activeForm}</Text>
        ) : null}
      </Box>

      {task.blockedBy.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Blocked By:</Text>
          {task.blockedBy.map((depId) => (
            <Text key={depId}>  {depId}</Text>
          ))}
        </Box>
      ) : null}

      {task.blocks.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Blocks:</Text>
          {task.blocks.map((depId) => (
            <Text key={depId}>  {depId}</Text>
          ))}
        </Box>
      ) : null}

      {noteMode ? (
        <Box marginTop={1}>
          <Text>Note: Enter your note...</Text>
        </Box>
      ) : null}
    </Box>
  );
}
