#!/usr/bin/env tsx
import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:wWLSoGvNpROTODgkatyFXfRVsNtavVAe@shuttle.proxy.rlwy.net:41026/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('\n🔧 Running orders migration...\n');
    
    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        total REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EGP',
        shipping_address TEXT,
        shipping_city TEXT,
        shipping_country TEXT,
        shipping_phone TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);
    console.log('✅ Created orders table');

    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        product_image_url TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        subtotal REAL NOT NULL
      );
    `);
    console.log('✅ Created order_items table');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
    `);
    console.log('✅ Created indexes');

    // Add sample products
    await client.query(`
      INSERT INTO products (name, description, price, category, rating, review_count, stock, image_url)
      VALUES 
        ('Whey Protein Isolate 2kg', 'Premium quality whey protein isolate with 90% protein content. Perfect for post-workout recovery and muscle building.', 299.99, 'supplements', 4.8, 156, 45, 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&h=400&fit=crop'),
        ('Pre-Workout Energy Boost', 'Advanced pre-workout formula with caffeine, beta-alanine, and creatine for enhanced performance.', 159.99, 'supplements', 4.6, 89, 60, 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=600&h=400&fit=crop'),
        ('BCAA Recovery Formula', 'Branch chain amino acids blend for faster recovery and reduced muscle soreness. 2:1:1 ratio.', 189.99, 'supplements', 4.7, 120, 55, 'https://images.unsplash.com/photo-1591228127791-8e2eaef098d3?w=600&h=400&fit=crop'),
        ('Premium Yoga Mat', 'Extra thick (6mm) non-slip yoga mat with carrying strap. Perfect for yoga, pilates, and floor exercises.', 129.99, 'equipment', 4.9, 234, 80, 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=400&fit=crop'),
        ('Adjustable Dumbbells Set', 'Space-saving adjustable dumbbells from 2kg to 24kg. Perfect for home workouts.', 599.99, 'equipment', 4.8, 178, 35, 'https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=600&h=400&fit=crop'),
        ('Resistance Bands Set', 'Complete set of 5 resistance bands with different resistance levels, handles, and door anchor.', 89.99, 'equipment', 4.7, 298, 120, 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=600&h=400&fit=crop'),
        ('Smart Water Bottle', 'LED reminder smart water bottle that tracks your hydration. 750ml capacity, BPA-free.', 149.99, 'accessories', 4.5, 67, 90, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=400&fit=crop'),
        ('Gym Bag Pro', 'Large capacity gym bag with separate shoe compartment and water bottle holder. Water-resistant material.', 199.99, 'accessories', 4.6, 145, 70, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=400&fit=crop'),
        ('Protein Shaker Bottle', 'Leak-proof protein shaker with mixing ball and measurement markings. 700ml capacity.', 49.99, 'accessories', 4.8, 412, 200, 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=600&h=400&fit=crop'),
        ('Meal Prep Containers Set', 'Set of 10 BPA-free meal prep containers with 3 compartments. Microwave and dishwasher safe.', 179.99, 'nutrition', 4.9, 287, 95, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop')
      ON CONFLICT DO NOTHING;
    `);
    
    const countResult = await client.query('SELECT COUNT(*) FROM products');
    const count = parseInt(countResult.rows[0].count);
    console.log(`✅ Products in database: ${count}`);

    console.log('\n✨ Migration completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
