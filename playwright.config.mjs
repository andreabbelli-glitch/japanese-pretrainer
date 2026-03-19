import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const e2eDatabasePath = path.join(
  __dirname,
  ".tmp",
  "e2e",
  "japanese-custom-study-e2e.sqlite"
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "env -u NO_COLOR ./scripts/with-node.sh pnpm start:e2e",
    cwd: __dirname,
    env: {
      ...process.env,
      DATABASE_URL: e2eDatabasePath
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3100"
  },
  workers: 1
});
