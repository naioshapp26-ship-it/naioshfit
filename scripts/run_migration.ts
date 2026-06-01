// Simple migration runner for SQL files
// Usage: node --experimental-specifier-resolution=node --loader tsx scripts/run_migration.ts <migration-file>
// Or in production: node dist/run_migration.js <migration-file>

import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const { Pool } = pg;

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Usage: npm run db:migrate-file migrations/<migration-file>.sql');
    process.exit(1);
  }

  // Support both full path and just filename
  const migrationPath = migrationFile.includes('migrations/') 
    ? migrationFile 
    : path.join(process.cwd(), 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log(`\n📋 Running migration: ${path.basename(migrationPath)}`);
    console.log('─'.repeat(50));
    console.log(sql);
    console.log('─'.repeat(50));
    
    await pool.query(sql);
    
    console.log('\n✅ Migration completed successfully!\n');
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

runMigration();
