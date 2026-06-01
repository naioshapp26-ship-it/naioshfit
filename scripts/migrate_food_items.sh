#!/bin/bash

# Food Items Migration Script
# This script migrates all food items from shared/foodDatabase.ts to PostgreSQL

set -e  # Exit on error

echo "================================="
echo "Food Items Migration Script"
echo "================================="
echo ""

# Check if DATABASE_URL is set
if [[ -z "${DATABASE_URL}" ]]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set."
  echo ""
  echo "Please set it before running this script:"
  echo "  export DATABASE_URL='your-railway-postgres-connection-string'"
  echo ""
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Step 1: Check if table exists
echo "Step 1: Checking if food_items table exists..."
echo ""

TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'food_items');")

if [[ "$TABLE_EXISTS" == "t" ]]; then
  echo "✅ Table 'food_items' exists"
else
  echo "❌ Table 'food_items' does not exist"
  echo ""
  echo "Creating table from migration file..."
  psql "$DATABASE_URL" -f migrations/0005_add_food_items_table.sql
  echo "✅ Table created successfully"
fi

echo ""

# Step 2: Check current status
echo "Step 2: Checking current database status..."
echo ""
npm run check:food-items

echo ""
echo "================================="
echo ""

# Step 3: Ask user if they want to proceed
CURRENT_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM food_items;")
echo "Current items in database: $CURRENT_COUNT"
echo ""

if [[ "$CURRENT_COUNT" -gt 0 ]]; then
  echo "⚠️  WARNING: The table already contains $CURRENT_COUNT items."
  echo ""
  echo "Options:"
  echo "  1) Clear table and migrate fresh (recommended)"
  echo "  2) Add to existing items (may create duplicates)"
  echo "  3) Cancel migration"
  echo ""
  read -p "Choose option (1/2/3): " choice
  
  case $choice in
    1)
      echo ""
      echo "Clearing existing items..."
      psql "$DATABASE_URL" -c "DELETE FROM food_items;"
      echo "✅ Table cleared"
      ;;
    2)
      echo ""
      echo "Proceeding with adding to existing items..."
      ;;
    3)
      echo ""
      echo "Migration cancelled."
      exit 0
      ;;
    *)
      echo ""
      echo "Invalid option. Exiting."
      exit 1
      ;;
  esac
fi

echo ""

# Step 4: Run the migration
echo "Step 3: Running migration..."
echo ""
npm run migrate:food-items

echo ""
echo "================================="
echo "✅ Migration process complete!"
echo "================================="
echo ""

# Step 5: Final verification
echo "Final verification:"
npm run check:food-items
