import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: 'postgresql://postgres:wWLSoGvNpROTODgkatyFXfRVsNtavVAe@shuttle.proxy.rlwy.net:41026/railway?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'saas', 'migrations', 'central');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log('Applying central database migrations...\n');

    for (const file of files) {
      console.log(`=== Applying ${file} ===`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      try {
        await pool.query(sql);
        console.log(`✓ ${file} applied successfully\n`);
      } catch (error) {
        if (error.code === '42P07' || error.message?.includes('already exists')) {
          console.log(`→ ${file} skipped (already exists)\n`);
        } else {
          console.error(`✗ ${file} failed:`, error.message, '\n');
        }
      }
    }

    console.log('Migration complete!\n');
    console.log('Verifying tables...');
    
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tables in database:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
