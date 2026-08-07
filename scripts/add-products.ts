#!/usr/bin/env tsx
import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:wWLSoGvNpROTODgkatyFXfRVsNtavVAe@shuttle.proxy.rlwy.net:41026/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

async function addProducts() {
  const client = await pool.connect();
  try {
    console.log('\n🛒 Adding products to database...\n');
    
    const products = [
      {
        name: 'Whey Protein Isolate 2kg',
        description: 'Premium quality whey protein isolate with 90% protein content. Perfect for post-workout recovery and muscle building. Fast absorption, low in carbs and fat.',
        price: 299.99,
        category: 'supplements',
        rating: 4.8,
        reviewCount: 156,
        stock: 45,
        imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&h=400&fit=crop'
      },
      {
        name: 'Pre-Workout Energy Boost',
        description: 'Advanced pre-workout formula with caffeine, beta-alanine, and creatine for enhanced performance. Increases energy, focus, and endurance.',
        price: 159.99,
        category: 'supplements',
        rating: 4.6,
        reviewCount: 89,
        stock: 60,
        imageUrl: 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=600&h=400&fit=crop'
      },
      {
        name: 'BCAA Recovery Formula',
        description: 'Branch chain amino acids blend for faster recovery and reduced muscle soreness. 2:1:1 ratio of leucine, isoleucine, and valine.',
        price: 189.99,
        category: 'supplements',
        rating: 4.7,
        reviewCount: 120,
        stock: 55,
        imageUrl: 'https://images.unsplash.com/photo-1591228127791-8e2eaef098d3?w=600&h=400&fit=crop'
      },
      {
        name: 'Creatine Monohydrate 500g',
        description: 'Pure micronized creatine monohydrate for increased strength and muscle mass. 100 servings per container.',
        price: 129.99,
        category: 'supplements',
        rating: 4.9,
        reviewCount: 203,
        stock: 75,
        imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&h=400&fit=crop'
      },
      {
        name: 'Premium Yoga Mat',
        description: 'Extra thick (6mm) non-slip yoga mat with carrying strap. Perfect for yoga, pilates, and floor exercises. Eco-friendly material.',
        price: 129.99,
        category: 'equipment',
        rating: 4.9,
        reviewCount: 234,
        stock: 80,
        imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=400&fit=crop'
      },
      {
        name: 'Adjustable Dumbbells Set',
        description: 'Space-saving adjustable dumbbells from 2kg to 24kg. Perfect for home workouts. Includes storage tray.',
        price: 599.99,
        category: 'equipment',
        rating: 4.8,
        reviewCount: 178,
        stock: 35,
        imageUrl: 'https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600&h=400&fit=crop'
      },
      {
        name: 'Resistance Bands Set',
        description: 'Complete set of 5 resistance bands with different resistance levels, handles, and door anchor. Perfect for strength training.',
        price: 89.99,
        category: 'equipment',
        rating: 4.7,
        reviewCount: 298,
        stock: 120,
        imageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=600&h=400&fit=crop'
      },
      {
        name: 'Kettlebell Set 3-Pack',
        description: 'Professional grade kettlebells in 8kg, 12kg, and 16kg. Perfect for full-body workouts and functional training.',
        price: 449.99,
        category: 'equipment',
        rating: 4.8,
        reviewCount: 145,
        stock: 40,
        imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop'
      },
      {
        name: 'Smart Water Bottle',
        description: 'LED reminder smart water bottle that tracks your hydration. 750ml capacity, BPA-free. Syncs with fitness apps.',
        price: 149.99,
        category: 'accessories',
        rating: 4.5,
        reviewCount: 67,
        stock: 90,
        imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=400&fit=crop'
      },
      {
        name: 'Gym Bag Pro',
        description: 'Large capacity gym bag with separate shoe compartment and water bottle holder. Water-resistant material. Multiple pockets.',
        price: 199.99,
        category: 'accessories',
        rating: 4.6,
        reviewCount: 145,
        stock: 70,
        imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=400&fit=crop'
      },
      {
        name: 'Protein Shaker Bottle',
        description: 'Leak-proof protein shaker with mixing ball and measurement markings. 700ml capacity. Dishwasher safe.',
        price: 49.99,
        category: 'accessories',
        rating: 4.8,
        reviewCount: 412,
        stock: 200,
        imageUrl: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=600&h=400&fit=crop'
      },
      {
        name: 'Fitness Tracker Watch',
        description: 'Advanced fitness tracker with heart rate monitor, sleep tracking, and GPS. 7-day battery life. Water-resistant.',
        price: 399.99,
        category: 'accessories',
        rating: 4.7,
        reviewCount: 289,
        stock: 55,
        imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&h=400&fit=crop'
      },
      {
        name: 'Meal Prep Containers Set',
        description: 'Set of 10 BPA-free meal prep containers with 3 compartments. Microwave and dishwasher safe. Stackable design.',
        price: 179.99,
        category: 'nutrition',
        rating: 4.9,
        reviewCount: 287,
        stock: 95,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop'
      },
      {
        name: 'Multivitamin Complex',
        description: 'Complete daily multivitamin with 25+ essential vitamins and minerals. 60 capsules. Supports immune system and energy.',
        price: 99.99,
        category: 'nutrition',
        rating: 4.6,
        reviewCount: 198,
        stock: 110,
        imageUrl: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&h=400&fit=crop'
      },
      {
        name: 'Omega-3 Fish Oil',
        description: 'High-potency omega-3 fish oil with EPA and DHA. Supports heart health, brain function, and joint health. 90 softgels.',
        price: 149.99,
        category: 'nutrition',
        rating: 4.7,
        reviewCount: 167,
        stock: 85,
        imageUrl: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=600&h=400&fit=crop'
      }
    ];

    // Clear existing products (optional - remove if you want to keep existing)
    await client.query('DELETE FROM products');
    console.log('🗑️  Cleared existing products');

    // Insert new products
    for (const product of products) {
      await client.query(`
        INSERT INTO products (name, description, price, category, rating, review_count, stock, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        product.name,
        product.description,
        product.price,
        product.category,
        product.rating,
        product.reviewCount,
        product.stock,
        product.imageUrl
      ]);
    }

    const countResult = await client.query('SELECT COUNT(*) FROM products');
    const count = parseInt(countResult.rows[0].count);
    
    console.log(`✅ Successfully added ${products.length} products to database`);
    console.log(`📊 Total products in database: ${count}\n`);

    // Display products by category
    const categoriesResult = await client.query(`
      SELECT category, COUNT(*) as count 
      FROM products 
      GROUP BY category 
      ORDER BY category
    `);
    
    console.log('📦 Products by category:');
    categoriesResult.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} products`);
    });
    
    console.log('\n✨ Products added successfully!\n');
  } catch (error) {
    console.error('❌ Error adding products:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
