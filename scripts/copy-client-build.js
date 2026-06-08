// Copy Vite output (docs/) into dist/public when Vite outDir is still docs/ (GitHub Pages).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const destIndex = path.join(rootDir, 'dist', 'public', 'index.html');

if (fs.existsSync(destIndex)) {
  console.log('[BUILD] dist/public/index.html already present — skipping docs copy');
  process.exit(0);
}

const sourceDir = path.join(rootDir, 'docs');
const destDir = path.join(rootDir, 'dist', 'public');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`[BUILD] Client build directory not found: ${src}`);
    console.error('[BUILD] Run vite build first.');
    process.exit(1);
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  console.log('[BUILD] Copying client build docs/ → dist/public/ ...');
  copyDir(sourceDir, destDir);
  if (!fs.existsSync(path.join(destDir, 'index.html'))) {
    throw new Error('index.html missing after copy');
  }
  console.log('[BUILD] Client assets copied to dist/public');
} catch (error) {
  console.error('[BUILD] Failed to copy client build:', error);
  process.exit(1);
}
