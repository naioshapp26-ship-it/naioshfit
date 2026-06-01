#!/usr/bin/env node
/**
 * Writes dist/public/version.json containing { version, commit, builtAt }.
 * - version: short git SHA or timestamp fallback
 * - commit: full SHA if available
 * - builtAt: ISO timestamp
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function getGitSha() {
  try {
    const full = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const short = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { full, short };
  } catch {
    return null;
  }
}

function main() {
  const distPublic = path.resolve(process.cwd(), 'dist', 'public');
  mkdirSync(distPublic, { recursive: true });

  const sha = getGitSha();
  const builtAt = new Date().toISOString();
  const version = sha?.short || String(Math.floor(Date.now() / 1000));
  const payload = {
    version,
    commit: sha?.full || null,
    builtAt,
  };

  const outPath = path.join(distPublic, 'version.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`[version] wrote ${outPath}:`, payload);
}

main();
