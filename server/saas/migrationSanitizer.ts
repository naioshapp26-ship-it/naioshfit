/** Strip PostgreSQL extension usage that shared hosting (cPanel) often lacks. */
export function sanitizeMigrationSql(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !/CREATE\s+EXTENSION\s+.*["']?pgcrypto["']?/i.test(line))
    .filter((line) => !/COMMENT\s+ON\s+EXTENSION\s+pgcrypto/i.test(line))
    .filter((line) => !/pgp_sym_(en|de)crypt/i.test(line))
    .join('\n')
    .replace(/\buuid_generate_v4\s*\(\s*\)/gi, 'gen_random_uuid()');
}
