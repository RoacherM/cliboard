import { Command } from 'commander';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { render } from 'ink';
import { createListCommand } from './commands/list.js';
import { createShowCommand } from './commands/show.js';
import { createWatchCommand } from './commands/watch.js';
import { App } from './App.js';

function expandTilde(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

function resolveDir(opts: { dir?: string }, fallback?: string): string {
  let dir = opts.dir ?? fallback ?? process.env.CLAUDE_DIR ?? path.join(os.homedir(), '.claude');
  if (dir.startsWith('~')) {
    dir = expandTilde(dir);
  }
  return dir;
}

function findGitRoot(): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export function createProgram(claudeDir?: string): Command {
  const program = new Command();
  program
    .name('cliboard')
    .description('CLIboard — terminal kanban for AI coding agent tasks')
    .version('1.0.0')
    .option('--dir <path>', 'Claude config directory')
    .option('--project <path>', 'Scope to a specific project directory')
    .action(() => {
      const opts = program.opts();
      const dir = resolveDir(opts, claudeDir);
      const projectPath: string | undefined = opts.project;
      // Only render TUI when running in a real terminal
      if (process.stdout.isTTY) {
        render(React.createElement(App, { claudeDir: dir, projectPath }));
      }
    });

  // Resolve dir: --dir flag > CLAUDE_DIR env > ~/.claude
  const resolvedDir =
    claudeDir ?? process.env.CLAUDE_DIR ?? path.join(os.homedir(), '.claude');

  // Add subcommands
  program.addCommand(createListCommand(resolvedDir));
  program.addCommand(createShowCommand(resolvedDir));
  program.addCommand(createWatchCommand(resolvedDir));

  // Expand tilde in --dir after parsing
  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (typeof opts.dir === 'string') {
      opts.dir = expandTilde(opts.dir);
    }
  });

  return program;
}

// Main entry point — run when executed directly (not when imported in tests)
const isTestEnv = typeof process.env.VITEST !== 'undefined';

if (!isTestEnv) {
  const program = createProgram();
  program.parse(process.argv);
}
