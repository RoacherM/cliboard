import { Command } from 'commander';
import { createAdapter } from '../lib/backends/detect.js';

export function createShowCommand(claudeDir: string): Command {
  const cmd = new Command('show');

  cmd
    .description('Show details for a specific task')
    .argument('<id>', 'Task ID to show')
    .option('--session <sessionId>', 'Scope to a specific session')
    .option('--backend <backend>', 'Backend: claude, opencode, auto (default: auto)');

  cmd.action(async (id: string) => {
    const opts = cmd.opts();
    const backend: string = cmd.parent?.opts()?.backend ?? opts.backend ?? 'auto';
    const dir: string = cmd.parent?.opts()?.dir ?? claudeDir;
    const adapter = await createAdapter(backend, dir);

    try {
      if (opts.session) {
        const tasks = await adapter.loadSessionTasks(opts.session);
        const task = tasks.find((t) => t.id === id);
        if (!task) {
          console.error(`Task not found: ${id} in session ${opts.session}`);
          process.exitCode = 1;
          return;
        }
        task.sessionId = opts.session;
        console.log(JSON.stringify(task, null, 2));
      } else {
        const sessions = await adapter.loadSessions();
        const matches = [];

        for (const session of sessions) {
          const tasks = await adapter.loadSessionTasks(session.id);
          for (const task of tasks) {
            if (task.id === id) {
              task.sessionId = session.id;
              task.sessionName = session.name ?? undefined;
              matches.push(task);
            }
          }
        }

        if (matches.length === 0) {
          console.error(`Task not found: ${id}`);
          process.exitCode = 1;
          return;
        }

        if (matches.length > 1) {
          console.error(
            `Multiple tasks with id ${id} found across ${matches.length} sessions. ` +
            `Use --session <sessionId> to disambiguate.`,
          );
          for (const m of matches) {
            console.error(`  session: ${m.sessionId}  subject: ${m.subject}`);
          }
          process.exitCode = 1;
          return;
        }

        console.log(JSON.stringify(matches[0], null, 2));
      }
    } finally {
      await adapter.dispose();
    }
  });

  return cmd;
}
