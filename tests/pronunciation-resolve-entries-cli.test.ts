import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const resolveEntriesCliScript = path.join(
  process.cwd(),
  "scripts",
  "resolve-pronunciation-entries.ts"
);

describe("pronunciation resolve entries CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("prints the canonical preflight and resolver commands for explicit entries", async () => {
    const { stdout } = await runResolveEntriesCli([
      "--media-slug",
      "sample-anime",
      "--entry",
      "term-taberu",
      "--entry",
      "grammar-teiru",
      "--preflight",
      "--print-command"
    ]);

    expect(stdout).toContain(
      "PRONUNCIATION_RESOLVE_ENTRIES media=sample-anime entries=2 preflight=true run=true"
    );
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm forvo:preflight -- --mode targeted --media sample-anime --entry term-taberu --entry grammar-teiru"
    );
    expect(stdout).toContain(
      "COMMAND ./scripts/with-node.sh pnpm pronunciations:resolve -- --mode targeted --media sample-anime --entry term-taberu --entry grammar-teiru"
    );
    expect(stdout).not.toContain("--limit");
  });

  it("supports entry files while preserving explicit resolver flags", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-resolve-entries-")
    );
    tempDirs.push(tempDir);
    const entriesFile = path.join(tempDir, "entries.txt");

    await writeFile(
      entriesFile,
      ["# new card entries", "term-taberu", "grammar-teiru", "term-taberu"].join(
        "\n"
      )
    );

    const { stdout } = await runResolveEntriesCli([
      "--media",
      "sample-anime",
      "--entries-file",
      entriesFile,
      "--dry-run",
      "--limit",
      "0",
      "--no-tofugu",
      "--print-command"
    ]);

    expect(stdout).toContain(
      "PRONUNCIATION_RESOLVE_ENTRIES media=sample-anime entries=2 preflight=false run=true"
    );
    expect(stdout).toContain(
      `--dry-run --limit 0 --no-tofugu --mode targeted --media sample-anime --entry term-taberu --entry grammar-teiru`
    );
  });

  it("runs preflight-only without opening the resolver", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-resolve-entries-preflight-")
    );
    tempDirs.push(tempDir);
    const knownMissingPath = path.join(tempDir, "forvo-known-missing.json");
    const requestRegistryPath = path.join(
      tempDir,
      "forvo-requested-word-add.json"
    );

    await writeFile(knownMissingPath, `{"version":1,"entries":[]}\n`);
    await writeFile(requestRegistryPath, `{"version":1,"entries":[]}\n`);

    const { stdout } = await runResolveEntriesCli(
      [
        "--content-root",
        validContentRoot,
        "--known-missing-file",
        knownMissingPath,
        "--request-registry-file",
        requestRegistryPath,
        "--media",
        "sample-anime",
        "--entry",
        "grammar-teiru",
        "--preflight-only"
      ],
      60_000
    );

    expect(stdout).toContain(
      "PRONUNCIATION_RESOLVE_ENTRIES media=sample-anime entries=1 preflight=true run=false"
    );
    expect(stdout).toContain("FORVO_PREFLIGHT");
    expect(stdout).toContain("mode=targeted media=sample-anime");
    expect(stdout).not.toContain("sample-anime: selected=");
  });

  it("rejects non-entry selector flags", async () => {
    await expect(
      runResolveEntriesCli([
        "--media",
        "sample-anime",
        "--word",
        "食べる"
      ])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "pronunciations:resolve-entries does not accept --word"
      )
    });
  });

  it("rejects mixed word rows in entries files", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-resolve-entries-invalid-")
    );
    tempDirs.push(tempDir);
    const entriesFile = path.join(tempDir, "entries.txt");

    await writeFile(entriesFile, "term-taberu\n食べる\n");

    await expect(
      runResolveEntriesCli([
        "--media",
        "sample-anime",
        "--entries-file",
        entriesFile,
        "--print-command"
      ])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        `${entriesFile}:2 must be an entry id starting with term- or grammar-.`
      )
    });
  });

  it("validates forwarded numeric options before printing commands", async () => {
    await expect(
      runResolveEntriesCli([
        "--media",
        "sample-anime",
        "--entry",
        "term-taberu",
        "--limit",
        "1.5",
        "--print-command"
      ])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--limit must be a non-negative integer.")
    });
  });
});

function runResolveEntriesCli(args: string[], timeoutMs = 45_000) {
  return runNodeCli(
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      resolveEntriesCliScript,
      ...args
    ],
    { timeoutMs }
  );
}
