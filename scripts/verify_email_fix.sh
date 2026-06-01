#!/bin/bash
# Quick verification script to check if email fields are now properly set

DBURL="postgresql://postgres:RJYtiOLwqtxtNfjnQwCKEoIuktKGypaU@trolley.proxy.rlwy.net:51243/railway"

echo "================================"
echo "Email/Username Fix Verification"
echo "================================"
echo ""

echo "1. Users with email addresses:"
psql "$DBURL" -t -A -c "SELECT COUNT(*) FROM users WHERE email IS NOT NULL;"

echo ""
echo "2. Sample of users with emails:"
psql "$DBURL" -t -A -c "SELECT id, COALESCE(username, 'NULL') as username, email, first_name, last_name FROM users WHERE email IS NOT NULL LIMIT 5;" | column -t -s'|'

echo ""
echo "3. Users with email-like usernames (should be 0):"
psql "$DBURL" -t -A -c "SELECT COUNT(*) FROM users WHERE username LIKE '%@%';"

echo ""
echo "================================"
echo "Verification complete!"
echo "================================"
