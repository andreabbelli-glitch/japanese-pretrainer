import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  type DuelMastersRealBundleStats,
  formatStatsDiff,
  resolveRealBundleStatsCliOptions,
  runRealBundleStatsCommand
} from "@/features/content/tooling/duel-masters-real-bundle-stats";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const defaultExpectedStatsPath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "content",
  "duel-masters-real-bundle-stats.json"
);

describe("real bundle test stats CLI", () => {
  const scriptPath = path.join(
    repoRoot,
    "scripts",
    "update-real-bundle-test-stats.ts"
  );

  it("resolves paths and supported read-only flags", () => {
    expect(
      resolveRealBundleStatsCliOptions(
        [
          "--",
          "--content-root",
          "alternate-content",
          "--diff",
          "--expected-stats-file",
          "alternate-stats.json"
        ],
        { cwd: repoRoot, defaultExpectedStatsPath }
      )
    ).toEqual({
      acceptFailure: false,
      contentRoot: path.join(repoRoot, "alternate-content"),
      diff: true,
      expectedStatsPath: path.join(repoRoot, "alternate-stats.json"),
      write: false
    });
  });

  it("rejects missing or unknown option values before computing stats", () => {
    expect(() => resolveOptions(["--content-root", "--write"])).toThrow(
      "Missing value for --content-root."
    );
    expect(() => resolveOptions(["--expected-stats-file"])).toThrow(
      "Missing value for --expected-stats-file."
    );
    expect(() => resolveOptions(["--unknown"])).toThrow(
      "Unknown argument: --unknown"
    );
  });

  it("rejects accepting failures while writing stats fixtures", () => {
    expect(() => resolveOptions(["--write", "--accept-failure"])).toThrow(
      "--accept-failure cannot be combined with --write."
    );
  });

  it("rejects unsafe real-bundle canary diff flag combinations", () => {
    expect(() => resolveOptions(["--diff", "--write"])).toThrow(
      "--diff cannot be combined with --write."
    );
    expect(() => resolveOptions(["--diff", "--accept-failure"])).toThrow(
      "--diff cannot be combined with --accept-failure."
    );
    expect(() =>
      resolveOptions(["--expected-stats-file", "expected.json"])
    ).toThrow("--expected-stats-file can only be used with --diff.");
  });

  it("formats changed stats without mutating either snapshot", () => {
    const previousStats = buildStats();
    const nextStats = buildStats();

    nextStats.parser.lessons = 77;
    nextStats.importer.card = 429;

    expect(formatStatsDiff(previousStats, nextStats)).toEqual([
      "parser.lessons: 76 -> 77",
      "importer.card: 428 -> 429"
    ]);
    expect(formatStatsDiff(previousStats, previousStats)).toEqual([]);
    expect(previousStats.parser.lessons).toBe(76);
  });

  it("reports a changed diff as a failure without writing the fixture", async () => {
    const previousStats = buildStats();
    const nextStats = buildStats();
    let writeCount = 0;

    nextStats.importer.card = 429;

    const result = await runRealBundleStatsCommand({
      args: ["--diff", "--expected-stats-file", "alternate-stats.json"],
      cwd: repoRoot,
      dependencies: {
        collectStats: async () => nextStats,
        readRequiredStats: async () => previousStats,
        writeStatsFile: async () => {
          writeCount += 1;
        }
      },
      repositoryRoot: repoRoot
    });

    expect(result).toEqual({
      exitCode: 1,
      stderr: "",
      stdout: [
        "CONTENT_CANARY_DIFF changed alternate-stats.json",
        "importer.card: 428 -> 429",
        "COMMAND ./scripts/with-node.sh pnpm content:test-stats -- --write",
        ""
      ].join("\n")
    });
    expect(writeCount).toBe(0);
  });

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
});

function resolveOptions(args: string[]) {
  return resolveRealBundleStatsCliOptions(args, {
    cwd: repoRoot,
    defaultExpectedStatsPath
  });
}

function buildStats(): DuelMastersRealBundleStats {
  return {
    parser: {
      lessons: 76,
      cardFiles: 70,
      terms: 289,
      grammarPatterns: 95,
      cards: 428,
      references: 7611
    },
    importer: {
      term: 289,
      termAlias: 839,
      grammarPattern: 95,
      grammarAlias: 142,
      entryLink: 1935,
      card: 428,
      cardEntryLink: 610
    }
  };
}
