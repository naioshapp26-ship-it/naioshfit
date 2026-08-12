#!/usr/bin/env node
/**
 * Writes dist/public/version.json containing { version, commit, builtAt, mainDomain }.
 * Prefer RAILWAY_GIT_COMMIT_SHA (Docker/Railway builds exclude .git), then local git, then timestamp.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function normalizeMainDomain(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return 'naioshfit.com';
  try {
    const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return trimmed.replace(/^www\./i, '').toLowerCase() || 'naioshfit.com';
  }
}

function getGitSha() {
  const fromEnv =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    process.env.GITHUB_SHA ||
    '';

  if (fromEnv.trim()) {
    const full = fromEnv.trim();
    return { full, short: full.slice(0, 7) };
  }

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
    mainDomain: normalizeMainDomain(process.env.MAIN_DOMAIN),
  };

  const outPath = path.join(distPublic, 'version.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`[version] wrote ${outPath}:`, payload);
}

main();
