import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

describe("real bundle test stats CLI", () => {
  const scriptPath = path.join(
    repoRoot,
    "scripts",
    "update-real-bundle-test-stats.ts"
  );

  it("rejects flag-like content root values before computing stats", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          scriptPath,
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

  it("accepts read-only real-bundle stats collection failures when requested", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-stats-failure-"));

    try {
      const { stderr, stdout } = await execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          scriptPath,
          "--content-root",
          tempDir,
          "--accept-failure"
        ],
        {
          cwd: repoRoot
        }
      );

      expect(stdout).toBe("");
      expect(stderr).toContain("Accepted real bundle stats failure:");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }, 60_000);

  it("rejects accepting failures while writing stats fixtures", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          scriptPath,
          "--write",
          "--accept-failure"
        ],
        {
          cwd: repoRoot
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--accept-failure cannot be combined with --write."
      )
    });
  }, 60_000);

  it("reports a clean real-bundle canary diff when stats match", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--experimental-strip-types", scriptPath, "--diff"],
      {
        cwd: repoRoot
      }
    );

    expect(stdout).toContain(
      "CONTENT_CANARY_DIFF clean tests/fixtures/content/duel-masters-real-bundle-stats.json"
    );
  }, 60_000);

  it("reports changed real-bundle canary stats without writing fixtures", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-stats-diff-"));
    const expectedStatsPath = path.join(tempDir, "expected.json");

    await writeFile(
      expectedStatsPath,
      `${JSON.stringify(
        {
          importer: {
            card: 0,
            cardEntryLink: 0,
            entryLink: 0,
            grammarAlias: 0,
            grammarPattern: 0,
            term: 0,
            termAlias: 0
          },
          parser: {
            cardFiles: 0,
            cards: 0,
            grammarPatterns: 0,
            lessons: 0,
            references: 0,
            terms: 0
          }
        },
        null,
        2
      )}\n`
    );

    try {
      await expect(
        execFileAsync(
          process.execPath,
          [
            "--experimental-strip-types",
            scriptPath,
            "--diff",
            "--expected-stats-file",
            expectedStatsPath
          ],
          {
            cwd: repoRoot
          }
        )
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("CONTENT_CANARY_DIFF changed")
      });
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }, 60_000);

  it("rejects unsafe real-bundle canary diff flag combinations", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        ["--experimental-strip-types", scriptPath, "--diff", "--write"],
        {
          cwd: repoRoot
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--diff cannot be combined with --write.")
    });

    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          scriptPath,
          "--diff",
          "--accept-failure"
        ],
        {
          cwd: repoRoot
        }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--diff cannot be combined with --accept-failure."
      )
    });
  }, 60_000);
});
