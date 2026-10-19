import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration for the API workspace.
 *
 * The config file replaces the deprecated `package.json#prisma` property.
 * `dotenv/config` preserves the previous behaviour of loading `apps/api/.env`
 * for local commands; deployed environments provide the variables directly.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
