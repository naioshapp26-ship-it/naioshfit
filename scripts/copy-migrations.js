// Copy migrations folder to dist directory
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const migrationsSource = path.join(rootDir, 'migrations');
const migrationsDest = path.join(rootDir, 'dist', 'migrations');
const saasMigrationsSource = path.join(rootDir, 'saas', 'migrations');
const saasMigrationsDest = path.join(rootDir, 'dist', 'saas', 'migrations');

function copyDir(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
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
  console.log('[BUILD] Copying migrations folder to dist...');
  copyDir(migrationsSource, migrationsDest);
  if (fs.existsSync(saasMigrationsSource)) {
    console.log('[BUILD] Copying SaaS migrations folder to dist...');
    copyDir(saasMigrationsSource, saasMigrationsDest);
  }
  console.log('[BUILD] Migrations copied successfully');
} catch (error) {
  console.error('[BUILD] Error copying migrations:', error);
  process.exit(1);
}
