import { Pool } from 'pg';

function resolveConnectionString(): string {
  const url = process.env.CENTRAL_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing CENTRAL_DATABASE_URL (or DATABASE_URL) environment variable.');
  }
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('sslrootcert');
    parsed.searchParams.delete('sslcert');
    parsed.searchParams.delete('sslkey');
    return parsed.toString();
  } catch {
    return url;
  }
}

function resolveTargetEmail(): string {
  const cliEmail = process.argv[2];
  const envEmail = process.env.SUPER_ADMIN_EMAIL;
  const email = (cliEmail || envEmail || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Missing target email. Pass as first argument or set SUPER_ADMIN_EMAIL.');
  }
  return email;
}

async function promoteSuperAdmin() {
  const connectionString = resolveConnectionString();
  const email = resolveTargetEmail();

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    },
  });

  try {
    const columnsResult = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name IN ('email', 'username', 'role', 'id')`
    );
    const columns = new Set(columnsResult.rows.map((row) => row.column_name));
    const hasEmail = columns.has('email');
    const hasUsername = columns.has('username');

    if (!columns.has('id') || !columns.has('role')) {
      throw new Error('users table must include id and role columns.');
    }

    let lookupCondition = '';
    if (hasEmail && hasUsername) {
      lookupCondition = "LOWER(COALESCE(email, username, '')) = LOWER($1)";
    } else if (hasEmail) {
      lookupCondition = 'LOWER(email) = LOWER($1)';
    } else if (hasUsername) {
      lookupCondition = 'LOWER(username) = LOWER($1)';
    } else {
      throw new Error('users table has neither email nor username column for lookup.');
    }

    const selectColumns = ['id'];
    if (hasEmail) selectColumns.push('email');
    if (hasUsername) selectColumns.push('username');
    selectColumns.push('role');

    const existing = await pool.query<{
      id: number;
      email: string | null;
      username: string | null;
      role: string;
    }>(
      `SELECT ${selectColumns.join(', ')}
       FROM users
       WHERE ${lookupCondition}
       ORDER BY id`,
      [email]
    );

    if (existing.rows.length === 0) {
      throw new Error(`No user found with email: ${email}`);
    }

    const alreadySuper = existing.rows.every((row) => row.role === 'super_admin');
    if (alreadySuper) {
      console.log(`No changes needed. ${email} is already super_admin.`);
      return;
    }

    const ids = existing.rows.map((row) => row.id);
    const returningColumns = ['id'];
    if (hasEmail) returningColumns.push('email');
    if (hasUsername) returningColumns.push('username');
    returningColumns.push('role');

    const updated = await pool.query(
      `UPDATE users
       SET role = 'super_admin'
       WHERE id = ANY($1::int[])
       RETURNING ${returningColumns.join(', ')}`,
      [ids]
    );

    console.log(`Promoted ${updated.rowCount ?? 0} user(s) to super_admin for email ${email}.`);
    for (const row of updated.rows) {
      console.log(`- id=${row.id}, email=${row.email ?? 'null'}, username=${row.username ?? 'null'}, role=${row.role}`);
    }
  } finally {
    await pool.end();
  }
}

promoteSuperAdmin().catch((error) => {
  console.error('[promote_super_admin] Failed:', error.message || error);
  process.exit(1);
});
