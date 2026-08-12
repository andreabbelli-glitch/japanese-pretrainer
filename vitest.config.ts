import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { resolveVitestMaxWorkers } from "./scripts/vitest-worker-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    environment: "node",
    execArgv: ["--disable-warning=DEP0040"],
    fileParallelism: true,
    globalSetup: ["tests/helpers/test-db-global-setup.ts"],
    hookTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    isolate: true,
    maxWorkers: resolveVitestMaxWorkers(),
    testTimeout: 30_000
  }
});
