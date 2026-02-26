import { Command } from 'commander';
import { TaskDataService } from '../lib/taskDataService.js';

export function createShowCommand(claudeDir: string): Command {
  const cmd = new Command('show');

  cmd
    .description('Show details for a specific task')
    .argument('<id>', 'Task ID to show')
    .option('--session <sessionId>', 'Scope to a specific session');

  cmd.action(async (id: string) => {
    const opts = cmd.opts();
    const service = new TaskDataService(claudeDir);

    if (opts.session) {
      // Scoped to a specific session — unambiguous lookup
      const tasks = await service.readSessionTasks(opts.session);
      const task = tasks.find((t) => t.id === id);
      if (!task) {
        console.error(`Task not found: ${id} in session ${opts.session}`);
        process.exitCode = 1;
        return;
      }
      task.sessionId = opts.session;
      console.log(JSON.stringify(task, null, 2));
    } else {
      // Search all sessions — warn if ambiguous
      const tasks = await service.readAllTasks();
      const matches = tasks.filter((t) => t.id === id);

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
  });

  return cmd;
}
