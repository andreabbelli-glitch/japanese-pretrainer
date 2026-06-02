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

  it("prints ordered batch query blocks and a compact summary", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--query",
        "{{食|た}}べる",
        "--query",
        "~ている",
        "--query",
        "mangiare"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain('QUERY "{{食|た}}べる"');
    expect(stdout).toContain('QUERY "~ている"');
    expect(stdout).toContain('QUERY "mangiare"');
    expect(stdout).toContain(
      "SUMMARY total=3 covered-card=2 entry-only=0 new=1 truncated=0"
    );
    expect(stdout.indexOf('QUERY "{{食|た}}べる"')).toBeLessThan(
      stdout.indexOf('QUERY "~ている"')
    );
    expect(stdout.indexOf('QUERY "~ている"')).toBeLessThan(
      stdout.indexOf('QUERY "mangiare"')
    );
  });

  it("emits stable JSON for batch lookup results", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--json",
        "--query",
        "{{食|た}}べる",
        "--query",
        "mangiare"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      results: Array<{ query: string; verdict: string }>;
      summary: { coveredCard: number; new: number; total: number };
    };

    expect(payload.summary).toEqual(
      expect.objectContaining({
        coveredCard: 1,
        new: 1,
        total: 2
      })
    );
    expect(payload.results.map((result) => result.query)).toEqual([
      "{{食|た}}べる",
      "mangiare"
    ]);
  });

  it("accepts typed batch shortcuts for term and grammar lookups", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lookupScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--term",
        "{{食|た}}べる",
        "--grammar",
        "~ている",
        "--card",
        "食べる"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain('QUERY "{{食|た}}べる"');
    expect(stdout).toContain("HIT term term-taberu");
    expect(stdout).toContain('QUERY "~ている"');
    expect(stdout).toContain("HIT grammar grammar-teiru");
    expect(stdout).toContain('QUERY "食べる"');
    expect(stdout).toContain("HIT card card-taberu-recognition");
    expect(stdout).toContain(
      "SUMMARY total=3 covered-card=3 entry-only=0 new=0 truncated=0"
    );
  });

  it("rejects batch query flags combined with a positional query", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          lookupScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--query",
          "食べる",
          "mangiare"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--query cannot be combined with a positional lookup query."
      )
    });
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
