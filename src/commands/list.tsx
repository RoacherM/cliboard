import { Command } from 'commander';
import { TaskDataService } from '../lib/taskDataService.js';

export function createListCommand(claudeDir: string): Command {
  const cmd = new Command('list');

  cmd
    .description('List sessions and tasks')
    .option('--json', 'Output as JSON');

  cmd.action(async () => {
    const opts = cmd.opts();
    const service = new TaskDataService(claudeDir);
    const tasks = await service.readAllTasks();

    if (opts.json) {
      console.log(JSON.stringify(tasks, null, 2));
    } else {
      for (const task of tasks) {
        console.log(`${task.id}\t${task.status}\t${task.subject}`);
      }
    }
  });

  return cmd;
}
