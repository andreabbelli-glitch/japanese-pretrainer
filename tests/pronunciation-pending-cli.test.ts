import path from "node:path";
import { execFile } from "node:child_process";
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

describe("pronunciation pending CLI", () => {
  it("rejects missing media slug values before running the workflow", async () => {
    await expect(
      runPendingCli(
        "--content-root",
        validContentRoot,
        "--media-slug",
        "--known-missing-file"
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --media-slug.")
    });
  }, 60_000);
});

function runPendingCli(...args: string[]) {
  return execFileAsync(
    process.execPath,
    [
      "--experimental-strip-types",
      path.join(repoRoot, "scripts", "update-pronunciation-pending.ts"),
      ...args
    ],
    {
      cwd: repoRoot
    }
  );
}
