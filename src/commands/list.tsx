import { Command } from 'commander';
import { createAdapter } from '../lib/backends/detect.js';

export function createListCommand(claudeDir: string): Command {
  const cmd = new Command('list');

  cmd
    .description('List sessions and tasks')
    .option('--json', 'Output as JSON')
    .option('--backend <backend>', 'Backend: claude, opencode, auto (default: auto)');

  cmd.action(async () => {
    const opts = cmd.opts();
    const backend: string = cmd.parent?.opts()?.backend ?? opts.backend ?? 'auto';
    const dir: string = cmd.parent?.opts()?.dir ?? claudeDir;
    const adapter = await createAdapter(backend, dir);

    try {
      const sessions = await adapter.loadSessions();
      const allTasks = [];

      for (const session of sessions) {
        const tasks = await adapter.loadSessionTasks(session.id);
        for (const task of tasks) {
          task.sessionId = session.id;
          task.sessionName = session.name ?? undefined;
        }
        allTasks.push(...tasks);
      }

      if (opts.json) {
        console.log(JSON.stringify(allTasks, null, 2));
      } else {
        for (const task of allTasks) {
          console.log(`${task.id}\t${task.status}\t${task.subject}`);
        }
      }
    } finally {
      await adapter.dispose();
    }
  });

  return cmd;
}
