import { Command } from 'commander';
import { TASKS_SUBDIR } from '../lib/constants.js';

export function createWatchCommand(claudeDir: string): Command {
  const cmd = new Command('watch');

  cmd
    .description('Watch tasks directory for changes (Claude Code only)');

  cmd.action(async () => {
    const backend: string = cmd.parent?.opts()?.backend ?? 'auto';

    if (backend === 'opencode') {
      console.error('Watch mode is not supported for OpenCode backend. Use the TUI instead.');
      process.exitCode = 1;
      return;
    }

    const { default: chokidar } = await import('chokidar');
    const path = await import('node:path');
    const dir: string = cmd.parent?.opts()?.dir ?? claudeDir;

    const tasksDir = path.join(dir, TASKS_SUBDIR);
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
