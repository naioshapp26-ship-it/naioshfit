#!/usr/bin/env tsx

/**
 * Script to migrate existing hardcoded food database to the database
 * Run this script after applying the food_items table migration
 */

import { db } from '../server/db';
import { foodItems } from '@shared/schema';
import { foodDatabase } from '../shared/foodDatabase';
import { eq } from 'drizzle-orm';

async function migrateFoodData() {
  console.log('Starting food data migration...');
  console.log(`Total items to migrate: ${foodDatabase.length}`);
  
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const food of foodDatabase) {
    try {
      // Check if food already exists by name and serving size
      const existing = await db
        .select()
        .from(foodItems)
        .where(eq(foodItems.name, food.name))
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      // Insert the food item
      await db.insert(foodItems).values({
        name: food.name,
        nameAr: food.nameAr || null,
        brand: null, // Brand info not available in legacy data
        brandAr: null,
        calories: food.calories,
        proteins: food.proteins,
        carbs: food.carbs,
        fats: food.fats,
        fiber: food.fiber,
        servingSize: food.servingSize,
        servingSizeGrams: food.servingSizeGrams,
        category: food.category,
        createdBy: null, // System-migrated foods have no creator
      });
      
      inserted++;
      
      if (inserted % 100 === 0) {
        console.log(`Progress: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
      }
    } catch (error) {
      errors++;
      console.error(`Error migrating food "${food.name}":`, error);
    }
  }
  
  console.log('\nMigration complete!');
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  
  process.exit(0);
}

// Run migration
migrateFoodData().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
