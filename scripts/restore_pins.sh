#!/bin/bash

# Script to restore PIN numbers for users who have lost them

DB_HOST="trolley.proxy.rlwy.net"
DB_PORT="51243"
DB_USER="postgres"
DB_NAME="railway"
PGPASSWORD="RJYtiOLwqtxtNfjnQwCKEoIuktKGypaU"

export PGPASSWORD

# Function to set PIN for a user
set_pin() {
  local user_id=$1
  local pin=$2
  local database=${3:-"users"}  # Default to main users table
  
  if [ "$database" = "users" ]; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
      "UPDATE users SET pin_number = '$pin' WHERE id = $user_id;"
  else
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
      "UPDATE $database.users SET pin_number = '$pin' WHERE id = $user_id;"
  fi
  
  echo "PIN set to '$pin' for user ID $user_id"
}

echo "========================================"
echo "PIN Restoration Tool"
echo "========================================"
echo ""
echo "Affected users:"
echo ""

# Show users with null PINs
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT id, COALESCE(username, email) as identifier, first_name, last_name, role 
   FROM users 
   WHERE pin_number IS NULL 
   ORDER BY id;"

echo ""
echo "Options:"
echo "1) Set default PIN '1234' for all affected users"
echo "2) Set custom PIN for specific user"
echo "3) Cancel"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
  1)
    echo "Setting default PIN '1234' for all affected users..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
      "UPDATE users SET pin_number = '1234' WHERE pin_number IS NULL;"
    echo "Done!"
    ;;
  2)
    read -p "Enter user ID: " user_id
    read -p "Enter 4-digit PIN: " pin
    
    # Validate PIN
    if [[ ! "$pin" =~ ^[0-9]{4}$ ]]; then
      echo "Error: PIN must be exactly 4 digits"
      exit 1
    fi
    
    set_pin "$user_id" "$pin"
    ;;
  3)
    echo "Cancelled"
    exit 0
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "Verification - Users with null PIN (should be empty):"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT id, COALESCE(username, email) as identifier, first_name, last_name, role, pin_number 
   FROM users 
   WHERE pin_number IS NULL 
   ORDER BY id;"
