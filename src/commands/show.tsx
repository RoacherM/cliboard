import { Command } from 'commander';
import { TaskDataService } from '../lib/taskDataService.js';

export function createShowCommand(claudeDir: string): Command {
  const cmd = new Command('show');

  cmd
    .description('Show details for a specific task')
    .argument('<id>', 'Task ID to show');

  cmd.action(async (id: string) => {
    const service = new TaskDataService(claudeDir);
    const tasks = await service.readAllTasks();
    const task = tasks.find((t) => t.id === id);

    if (!task) {
      console.error(`Task not found: ${id}`);
      process.exitCode = 1;
      return;
    }

    console.log(JSON.stringify(task, null, 2));
  });

  return cmd;
}
