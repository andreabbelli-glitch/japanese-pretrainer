import "dotenv/config";

import { defineConfig } from "drizzle-kit";

import { DEFAULT_DATABASE_PATH } from "./src/db/config.ts";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_PATH
  },
  strict: true,
  verbose: true
});
