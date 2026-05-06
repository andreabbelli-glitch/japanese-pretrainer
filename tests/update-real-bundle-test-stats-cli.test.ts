import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

describe("real bundle test stats CLI", () => {
  it("rejects flag-like content root values before computing stats", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(repoRoot, "scripts", "update-real-bundle-test-stats.ts"),
          "--content-root",
          "--write"
        ],
        {
          cwd: repoRoot
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --content-root.")
    });
  }, 60_000);
});
