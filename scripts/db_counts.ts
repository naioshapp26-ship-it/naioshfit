// Dynamic import to support both CJS and ESM builds of 'pg'
let ClientCtor: any;
async function loadPg() {
  try {
    const mod: any = await import('pg');
    ClientCtor = mod.Client || mod.default?.Client || mod.Pool || mod.default;
    if (!ClientCtor) throw new Error('Unable to resolve Client export from pg');
  } catch (e) {
    console.error('Failed to load pg module. Ensure it is installed (npm i pg).', e);
    process.exit(1);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set. Usage: DATABASE_URL=postgres://... npm run db:counts');
    process.exit(1);
  }
  if (!ClientCtor) await loadPg();
  const client = new ClientCtor({ connectionString: url });
  await client.connect();
  try {
    const tablesRes: any = await client.query(
      `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`);
    const tables = (tablesRes.rows as any[]).map((r: any) => r.table_name as string);
    console.log(`Found ${tables.length} tables.`);
    const results: { table: string; count: number }[] = [];
    for (const t of tables) {
      try {
  const c: any = await client.query(`select count(*)::text as count from "${t}"`);
  results.push({ table: t, count: Number((c.rows[0] as any).count) });
      } catch (err) {
        console.warn(`Failed counting table ${t}:`, (err as any).message);
      }
    }
    const width = Math.max(...results.map(r => r.table.length), 5);
    console.log('\nRow counts by table:');
    for (const r of results) {
      console.log(r.table.padEnd(width, ' '), ' | ', r.count);
    }
    const total = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`\nTotal rows across tables: ${total}`);
    console.log('\nTip: Run this against your Replit DB and Railway DB and compare.');
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
