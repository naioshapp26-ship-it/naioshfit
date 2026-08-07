// Manual migration runner - creates affiliate_products table if it doesn't exist
// Run with: tsx scripts/init-affiliate-products.ts

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('railway') 
    ? { rejectUnauthorized: false } 
    : undefined,
});

const migrationSQL = `
-- Add affiliate_products table
CREATE TABLE IF NOT EXISTS affiliate_products (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT,
  source TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert initial affiliate products from the provided links (only if table is empty)
INSERT INTO affiliate_products (title, url, description, source, category, is_active)
SELECT * FROM (VALUES
  ('Noon Product 1', 'https://s.noon.com/0Hvn2lWp3V8', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Noon Product 2', 'https://s.noon.com/ttanJfyoYxI', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Noon Product 3', 'https://s.noon.com/QBfKGfCc5cA', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Noon Product 4', 'https://s.noon.com/XvfIreZO8vo', 'Affiliate product from Noon', 'noon', 'general', true),
  ('Amazon Product 1', 'https://amzn.to/3LxdRyj', 'Affiliate product from Amazon', 'amazon', 'general', true),
  ('Amazon Product 2', 'https://amzn.to/49Ie2Rg', 'Affiliate product from Amazon', 'amazon', 'general', true),
  ('Amazon Product 3', 'https://amzn.to/47PrWyI', 'Affiliate product from Amazon', 'amazon', 'general', true)
) AS v(title, url, description, source, category, is_active)
WHERE NOT EXISTS (SELECT 1 FROM affiliate_products LIMIT 1);
`;

async function runMigration() {
  try {
    console.log('\n🔧 Running affiliate products migration...\n');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'affiliate_products'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`📋 Table exists: ${tableExists}`);
    
    // Run migration
    console.log('📝 Executing migration SQL...\n');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!\n');
    
    // Verify products were inserted
    const countResult = await pool.query('SELECT COUNT(*) FROM affiliate_products');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📊 Total affiliate products in database: ${count}\n`);
    
    if (count === 0) {
      console.log('⚠️  No products found. This might indicate an issue with the INSERT statement.');
    } else {
      console.log('✅ Products successfully loaded!\n');
      
      // Show first few products
      const products = await pool.query('SELECT id, title, url, source FROM affiliate_products ORDER BY id LIMIT 5');
      console.log('📦 Sample products:');
      products.rows.forEach(p => {
        console.log(`  ${p.id}. ${p.title} (${p.source})`);
        console.log(`     ${p.url}`);
      });
    }
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
