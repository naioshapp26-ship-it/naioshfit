#!/bin/bash

DB_HOST="shuttle.proxy.rlwy.net"
DB_PORT="41026"
DB_USER="postgres"
DB_PASSWORD="wWLSoGvNpROTODgkatyFXfRVsNtavVAe"
DB_NAME="railway"

export PGPASSWORD="$DB_PASSWORD"

cd /workspaces/naioshfit/saas/migrations/central

echo "Applying central database migrations..."
echo ""

for file in *.sql; do
  echo "=== Applying $file ==="
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ $file applied successfully"
  else
    echo "✗ $file failed (may already exist)"
  fi
  echo ""
done

echo "Migration complete!"
echo ""
echo "Verifying tables..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>&1
