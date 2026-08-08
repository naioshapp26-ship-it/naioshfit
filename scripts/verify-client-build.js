// Fail the build if the production client bundle is missing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(rootDir, 'dist', 'public', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('[BUILD] FATAL: dist/public/index.html is missing.');
  console.error('[BUILD] Set CLIENT_OUT_DIR=dist/public for Railway, or ensure vite outDir is dist/public.');
  process.exit(1);
}

console.log('[BUILD] Verified dist/public/index.html');
