import { build } from 'esbuild';

await build({
  entryPoints: ['src/cli.tsx'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/cli.js',
  external: ['ink', 'react', 'chokidar', 'ink-text-input', 'commander'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  sourcemap: false,
  minify: false,
});
