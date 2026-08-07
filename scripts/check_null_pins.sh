#!/bin/bash

# Script to check for users with null PIN numbers across all databases

DB_HOST="trolley.proxy.rlwy.net"
DB_PORT="51243"
DB_USER="postgres"
DB_NAME="railway"
PGPASSWORD="RJYtiOLwqtxtNfjnQwCKEoIuktKGypaU"

export PGPASSWORD

echo "========================================"
echo "Checking Central Database"
echo "========================================"
echo ""
echo "Users with NULL PIN in central database:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT id, COALESCE(username, email) as identifier, first_name, last_name, role 
   FROM users 
   WHERE pin_number IS NULL 
   ORDER BY id;"

echo ""
echo "========================================"
echo "Checking Tenant Databases"
echo "========================================"
echo ""

# Get list of active tenants
TENANTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' -c \
  "SELECT subdomain, database_name FROM tenants WHERE status != 'deleted' ORDER BY subdomain;")

# Check each tenant database
while IFS='|' read -r subdomain db_name; do
  if [ ! -z "$subdomain" ]; then
    echo "--- Tenant: $subdomain ($db_name) ---"
    
    # Check if users table exists and count null PINs
    COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
      "SELECT COUNT(*) FROM $db_name.users WHERE pin_number IS NULL;" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$COUNT" != "0" ]; then
      echo "Found $COUNT users with NULL PIN:"
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
        "SELECT id, COALESCE(username, email) as identifier, first_name, last_name, role 
         FROM $db_name.users 
         WHERE pin_number IS NULL 
         ORDER BY id;"
    else
      echo "No users with NULL PIN"
    fi
    echo ""
  fi
done <<< "$TENANTS"

echo "========================================"
echo "Check Complete"
echo "========================================"
