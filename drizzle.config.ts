import { defineConfig } from "drizzle-kit";
import { parseDatabaseUrl } from "./shared/dbUrl";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
if (
  !parsed.ssl &&
  /\.rlwy\.net|railway\.app|sslmode=require/i.test(process.env.DATABASE_URL)
) {
  parsed.ssl = { rejectUnauthorized: false };
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: parsed,
  schemaFilters: ["public"],
});
