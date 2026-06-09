export type ParsedDatabaseUrl = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean };
};

/** Railway internal DB hostnames do not support SSL. */
export function getPostgresSslConfig(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  if (/\.railway\.internal/i.test(connectionString)) {
    return undefined;
  }
  const needsSSL =
    /sslmode=require|ssl=true/i.test(connectionString) ||
    /\.railway\.app|\.proxy\.rlwy\.net|\.rlwy\.net/i.test(connectionString);
  return needsSSL ? { rejectUnauthorized: false } : undefined;
}

/** Strip ssl query params and align ssl config for node-postgres Pool. */
export function normalizePostgresConnection(connectionString: string): {
  connectionString: string;
  ssl: { rejectUnauthorized: boolean } | undefined;
} {
  const ssl = getPostgresSslConfig(connectionString);
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('ssl');
    url.searchParams.delete('sslrootcert');
    url.searchParams.delete('sslcert');
    url.searchParams.delete('sslkey');
    return { connectionString: url.toString(), ssl };
  } catch {
    return { connectionString, ssl };
  }
}

/** Parse DATABASE_URL for drivers that ignore ssl when using a connection string (e.g. drizzle-kit). */
export function parseDatabaseUrl(connectionString: string): ParsedDatabaseUrl {
  const url = new URL(connectionString);
  const ssl = getPostgresSslConfig(connectionString);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl,
  };
}
