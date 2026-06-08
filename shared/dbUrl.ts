export type ParsedDatabaseUrl = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean };
};

/** Parse DATABASE_URL for drivers that ignore ssl when using a connection string (e.g. drizzle-kit). */
export function parseDatabaseUrl(connectionString: string): ParsedDatabaseUrl {
  const url = new URL(connectionString);
  const needsSSL =
    /sslmode=require|ssl=true/i.test(connectionString) ||
    url.hostname.endsWith('.railway.app');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  };
}
