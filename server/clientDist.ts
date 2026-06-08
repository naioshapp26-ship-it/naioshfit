/**
 * Resolve where the built client (index.html + assets) lives at runtime.
 * Railway/Nixpacks layouts differ; try bundled path first, then repo paths.
 */
import fs from 'fs';
import path from 'path';

export function resolveClientDistRoot(): string | null {
  const candidates = [
    path.resolve(import.meta.dirname, 'public'),
    path.join(process.cwd(), 'dist', 'public'),
    path.join(process.cwd(), 'docs'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return null;
}
