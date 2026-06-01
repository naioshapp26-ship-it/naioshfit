import { db } from '../server/db';
import { foodItems } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function checkFoodItemsTable() {
  try {
    console.log('Checking food_items table status...\n');

    // Check if table exists and count items
    try {
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(foodItems);
      const count = countResult[0].count;
      
      console.log(`✅ Table 'food_items' exists`);
      console.log(`📊 Current items in database: ${count}`);

      if (count > 0) {
        // Get category breakdown
        const categoryResults = await db.execute(sql`
          SELECT category, COUNT(*) as count 
          FROM food_items 
          GROUP BY category 
          ORDER BY count DESC
        `);
        
        console.log('\n📋 Items by category:');
        categoryResults.rows.forEach((row: any) => {
          console.log(`   ${row.category}: ${row.count}`);
        });

        // Get some sample items
        const samples = await db.select({
          id: foodItems.id,
          name: foodItems.name,
          nameAr: foodItems.nameAr,
          category: foodItems.category,
          calories: foodItems.calories,
        }).from(foodItems).limit(5);

        console.log('\n🔍 Sample items (first 5):');
        samples.forEach(item => {
          console.log(`   [${item.id}] ${item.name} (${item.nameAr}) - ${item.category} - ${item.calories} cal`);
        });

        // Check for items with brands
        const brandedCount = await db.execute(sql`
          SELECT COUNT(*) as count FROM food_items WHERE brand IS NOT NULL
        `);
        console.log(`\n🏷️  Items with brands: ${brandedCount.rows[0].count}`);

        // Check creation info
        const createdInfo = await db.execute(sql`
          SELECT 
            COUNT(CASE WHEN created_by IS NULL THEN 1 END) as system_created,
            COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as user_created
          FROM food_items
        `);
        console.log(`\n👤 System-created: ${createdInfo.rows[0].system_created}`);
        console.log(`👤 User-created: ${createdInfo.rows[0].user_created}`);

      } else {
        console.log('\n⚠️  Table is empty. Run migration to populate it.');
        console.log('   Command: npm run migrate:food-items');
      }

    } catch (error: any) {
      if (error.message && error.message.includes('does not exist')) {
        console.log('❌ Table "food_items" does not exist');
        console.log('\n📝 Create the table first:');
        console.log('   psql $DATABASE_URL -f migrations/0005_add_food_items_table.sql');
      } else {
        throw error;
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking table:', error);
    process.exit(1);
  }
}

// Run the check
checkFoodItemsTable();
