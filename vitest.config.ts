import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import {
  capVitestWorkersForLane,
  resolveVitestLaneFiles,
  resolveVitestTestLane
} from "./scripts/vitest-test-lanes";
import { resolveVitestMaxWorkers } from "./scripts/vitest-worker-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testLane = resolveVitestTestLane();
const testLaneFiles = resolveVitestLaneFiles(testLane);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    environment: "node",
    exclude: testLaneFiles.exclude,
    execArgv: ["--disable-warning=DEP0040"],
    fileParallelism: true,
    globalSetup: ["tests/helpers/test-db-global-setup.ts"],
    hookTimeout: 30_000,
    include: testLaneFiles.include,
    isolate: true,
    maxWorkers: capVitestWorkersForLane(testLane, resolveVitestMaxWorkers()),
    testTimeout: 30_000
  }
});
