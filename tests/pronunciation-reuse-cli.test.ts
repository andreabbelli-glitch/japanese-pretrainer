import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runNodeCli } from "./helpers/run-cli";

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

describe("pronunciation reuse CLI", () => {
  it("rejects unknown flags instead of silently running every media", async () => {
    await expect(
      runReuseCli("--content-root", validContentRoot, "--dry-run", "--bogus")
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Unknown argument: --bogus")
    });
  }, 60_000);

  it("rejects missing media option values before running the workflow", async () => {
    await expect(
      runReuseCli("--content-root", validContentRoot, "--dry-run", "--media")
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --media.")
    });
  }, 60_000);
});

function runReuseCli(...args: string[]) {
  return runNodeCli(
    [
      "--experimental-strip-types",
      path.join(repoRoot, "scripts", "reuse-pronunciations.ts"),
      ...args
    ],
    {
      cwd: repoRoot
    }
  );
}
