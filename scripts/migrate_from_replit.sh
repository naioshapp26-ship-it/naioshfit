#!/usr/bin/env bash
set -euo pipefail

if [[ "${REPLIT_URL:-}" == "" ]]; then
  echo "ERROR: REPLIT_URL env var not set (source database)." >&2
  exit 1
fi
if [[ "${DATABASE_URL:-}" == "" ]]; then
  echo "ERROR: DATABASE_URL env var not set (destination Railway database)." >&2
  exit 1
fi

timestamp=$(date +%Y%m%d_%H%M%S)
dump_file="replit_dump_${timestamp}.sql"

echo "[1/3] Dumping source Replit database to $dump_file ..." >&2
pg_dump --no-owner --no-privileges "$REPLIT_URL" > "$dump_file"

echo "[2/3] Importing dump into Railway destination ..." >&2
psql "$DATABASE_URL" < "$dump_file"

echo "[3/3] Done. A copy of the dump is saved locally at: $dump_file" >&2
echo "You may want to move this dump to a secure backups location." >&2
