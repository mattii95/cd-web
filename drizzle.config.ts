import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema",
  out: "./db/migrations",
  casing: "snake_case",
  strict: true,
  dbCredentials: { url: process.env.DATABASE_URL! },
});
