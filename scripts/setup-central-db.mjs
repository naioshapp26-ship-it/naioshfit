import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: 'shuttle.proxy.rlwy.net',
  port: 41026,
  user: 'postgres',
  password: 'wWLSoGvNpROTODgkatyFXfRVsNtavVAe',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

async function testAndMigrate() {
  console.log('Testing database connection...');
  
  try {
    const testResult = await pool.query('SELECT version()');
    console.log('✓ Connected to PostgreSQL\n');
    
    // Apply migrations
    console.log('Applying migrations...\n');
    
    // Helper function (no PostgreSQL extensions — cPanel compatible)
    console.log('1. Creating helper function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✓ Helper function created\n');
    
    // Tenants table
    console.log('2. Creating tenants table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subdomain VARCHAR(255) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        subscription_plan VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        database_url_encrypted BYTEA NOT NULL,
        database_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Tenants table created\n');
    
    // Tenant admins table
    console.log('4. Creating tenant_admins table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Tenant admins table created\n');
    
    // Provisioning logs table
    console.log('5. Creating provisioning_logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS provisioning_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        step VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    console.log('✓ Provisioning logs table created\n');
    
    // Subscriptions table
    console.log('6. Creating subscriptions table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Subscriptions table created\n');
    
    // Payment transactions table
    console.log('7. Creating payment_transactions table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(50) NOT NULL,
        payment_method VARCHAR(100),
        transaction_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Payment transactions table created\n');
    
    // Verify tables
    console.log('Verifying created tables...');
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('tenants', 'tenant_admins', 'provisioning_logs', 'subscriptions', 'payment_transactions')
      ORDER BY tablename
    `);
    
    console.log('\nCentral database tables:');
    result.rows.forEach(row => console.log(`  ✓ ${row.tablename}`));
    
    console.log('\n✓ All migrations applied successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAndMigrate();
