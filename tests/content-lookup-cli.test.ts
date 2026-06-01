import path from "node:path";

import { describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const lookupScriptPath = path.join(
  process.cwd(),
  "scripts",
  "content-lookup.ts"
);

describe("content lookup CLI", () => {
  it("prints a compact covered-card verdict for an existing card front", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "{{食|た}}べる"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERDICT covered-card");
    expect(stdout).toContain("ACTION reuse existing card");
    expect(stdout).toContain("HIT term term-taberu");
    expect(stdout).toContain("CARD card-taberu-recognition");
    expect(stdout).not.toContain("HIT card card-taberu-recognition");
    expect(stdout).not.toContain("パンを");
  });

  it("matches grammar wave variants without fuzzy substring matching", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--kind",
        "grammar",
        "~ている"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERDICT covered-card");
    expect(stdout).toContain("HIT grammar grammar-teiru");
    expect(stdout).toContain("CARD card-teiru-concept");
  });

  it("does not match meanings or substrings as duplicate evidence", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "mangiare"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERDICT new");
    expect(stdout).not.toContain("term-taberu");
  });

  it("lists scoped entries as a lightweight inventory view", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--list",
        "entries"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("term term-taberu 食べる reading=たべる cards=1");
    expect(stdout).toContain("grammar grammar-teiru ～ている cards=1");
    expect(stdout).not.toContain("パンを");
  });

  it("keeps a covered-card verdict in compact limited output", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--limit",
        "1",
        "食べる"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("VERDICT covered-card");
    expect(stdout).toContain("HIT term term-taberu");
    expect(stdout).not.toContain("HIT card card-taberu-recognition");
  });

  it("reports a missing query without masking the error handler", async () => {
    let failure: { code?: number; stderr?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          lookupScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }

    expect(failure).not.toBeNull();
    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("Missing lookup query.");
    expect(failure?.stderr).not.toContain("Cannot access");
  });

  it("rejects unsafe limit values instead of truncating them", async () => {
    let failure: { code?: number; stderr?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          lookupScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--limit",
          "2abc",
          "食べる"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }

    expect(failure).not.toBeNull();
    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("--limit must be a positive integer.");
  });
});
