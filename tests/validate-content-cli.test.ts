import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const validContentRoot = path.resolve(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);

describe("validate content CLI", () => {
  it("rejects missing media slug values before validating content", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(repoRoot, "scripts", "validate-content.ts"),
          "--content-root",
          validContentRoot,
          "--media-slug",
          "--content-root"
        ],
        {
          cwd: repoRoot
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --media-slug.")
    });
  }, 60_000);
});
