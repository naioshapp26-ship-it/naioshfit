import { db } from '../server/db';
import { foodItems } from '../shared/schema';
import { foodDatabase } from '../shared/foodDatabase';
import { sql } from 'drizzle-orm';

async function resetAndMigrateFoodItems() {
  try {
    console.log('== Reset & Migrate food_items ==');
    // Show current count
    const before = await db.select({ count: sql<number>`count(*)` }).from(foodItems);
    console.log(`Current rows in food_items: ${before[0].count}`);

    // Clear table first
    console.log('Clearing table food_items...');
    await db.execute(sql`DELETE FROM food_items;`);

    // Optional: reset serial sequence (Postgres specific)
    try {
      await db.execute(sql`ALTER SEQUENCE IF EXISTS food_items_id_seq RESTART WITH 1;`);
      console.log('Reset sequence food_items_id_seq (if existed).');
    } catch (e) {
      console.log('Sequence reset skipped/not applicable.');
    }

    // Prepare data
    const items = foodDatabase.map(item => ({
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
      createdBy: null as number | null,
    }));

    console.log(`Inserting ${items.length} items in batches...`);
    const batchSize = 200;
    let inserted = 0;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await db.insert(foodItems).values(batch);
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${items.length}`);
    }

    const after = await db.select({ count: sql<number>`count(*)` }).from(foodItems);
    console.log(`Done. Rows in food_items: ${after[0].count}`);

    // Show sample by category
    const categoryCounts = await db.execute(sql`
      SELECT category, COUNT(*) as cnt FROM food_items GROUP BY category ORDER BY cnt DESC;
    `);
    console.log('\nItems by category:');
    for (const row of categoryCounts.rows as any[]) {
      console.log(`  ${row.category}: ${row.cnt}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

resetAndMigrateFoodItems();
