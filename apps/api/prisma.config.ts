import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma CLI configuration for the API workspace.
 *
 * Prisma 7 reads the CLI datasource URL, schema location, migration path,
 * and seed command from this file. `dotenv/config` loads `apps/api/.env`
 * for local commands; deployed environments provide the variables directly.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
