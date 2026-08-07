/**
 * Cross-platform production build (Windows + Linux).
 * Usage: node scripts/build-prod.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const nodeOptions = process.env.NODE_OPTIONS || '--max-old-space-size=4096';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

run(npx, ['vite', 'build']);
run(npx, [
  'esbuild',
  'server/index.ts',
  '--platform=node',
  '--packages=external',
  '--external:./vite',
  '--external:./vite.js',
  '--bundle',
  '--format=esm',
  '--outdir=dist',
]);
run('node', ['scripts/copy-migrations.js']);
run('node', ['scripts/write-version.js']);

console.log('[BUILD] Production build completed successfully.');
