import { Command } from 'commander';
import { TASKS_SUBDIR } from '../lib/constants.js';

export function createWatchCommand(claudeDir: string): Command {
  const cmd = new Command('watch');

  cmd
    .description('Watch tasks directory for changes');

  cmd.action(async () => {
    const { default: chokidar } = await import('chokidar');
    const path = await import('node:path');

    const tasksDir = path.join(claudeDir, TASKS_SUBDIR);
    console.log(`Watching ${tasksDir} for changes...`);

    const watcher = chokidar.watch(tasksDir, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', (filePath: string) => {
      console.log(`Changed: ${filePath}`);
    });

    watcher.on('add', (filePath: string) => {
      console.log(`Added: ${filePath}`);
    });

    watcher.on('unlink', (filePath: string) => {
      console.log(`Removed: ${filePath}`);
    });
  });

  return cmd;
}
