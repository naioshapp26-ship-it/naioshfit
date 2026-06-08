import { defineConfig } from "drizzle-kit";
import { parseDatabaseUrl } from "./shared/dbUrl";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const dbCredentials = parseDatabaseUrl(process.env.DATABASE_URL);

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials,
});
