import { db } from '../server/db';
import { foodItems } from '../shared/schema';
import { foodDatabase } from '../shared/foodDatabase';
import { sql } from 'drizzle-orm';

async function migrateFoodItems() {
  try {
    console.log('Starting food items migration...');
    console.log(`Found ${foodDatabase.length} food items to migrate`);

    // First, check if there are already items in the database
    const existingCount = await db.select({ count: sql<number>`count(*)` }).from(foodItems);
    console.log(`Current food items in database: ${existingCount[0].count}`);

    if (existingCount[0].count > 0) {
      console.log('\n⚠️  WARNING: Database already contains food items!');
      console.log('This script will insert ALL items from foodDatabase.ts');
      console.log('You may want to clear the table first or skip items with duplicate IDs.');
      console.log('\nTo clear the table, run: DELETE FROM food_items;');
      console.log('\nProceeding with migration in 5 seconds... (Ctrl+C to cancel)');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Prepare data for insertion
    const itemsToInsert = foodDatabase.map(item => ({
      name: item.name,
      nameAr: item.nameAr || null,
      brand: item.brand || null,
      brandAr: item.brandAr || null,
      calories: item.calories,
      proteins: item.proteins,
      carbs: item.carbs,
      fats: item.fats,
      fiber: item.fiber,
      servingSize: item.servingSize,
      servingSizeGrams: item.servingSizeGrams,
      category: item.category,
      createdBy: null, // System migration, no user association
    }));

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < itemsToInsert.length; i += batchSize) {
      const batch = itemsToInsert.slice(i, i + batchSize);
      await db.insert(foodItems).values(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${itemsToInsert.length} items...`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`Total items migrated: ${inserted}`);

    // Verify the migration
    const finalCount = await db.select({ count: sql<number>`count(*)` }).from(foodItems);
    console.log(`Final count in database: ${finalCount[0].count}`);

    // Show some sample statistics
    const categoryCounts = await db.execute(sql`
      SELECT category, COUNT(*) as count 
      FROM food_items 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    console.log('\nItems by category:');
    categoryCounts.rows.forEach((row: any) => {
      console.log(`  ${row.category}: ${row.count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateFoodItems();
