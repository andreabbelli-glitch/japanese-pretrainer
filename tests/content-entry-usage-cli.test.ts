import path from "node:path";

import { describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const entryUsageScriptPath = path.join(
  process.cwd(),
  "scripts",
  "content-entry-usage.ts"
);

describe("content entry usage CLI", () => {
  it("prints compact semantic usage coordinates for an exact entry id", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        entryUsageScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--entry-id",
        "term-taberu"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      "ENTRY term term-taberu media=sample-anime status=covered-card"
    );
    expect(stdout).toContain("CANONICAL cards=1 lessons=1 usages=2");
    expect(stdout).toContain(
      "USAGE lesson field=lesson.body lesson=ep01-intro line=16"
    );
    expect(stdout).toContain(
      "USAGE lesson field=image.caption lesson=ep01-intro line=26"
    );
    expect(stdout).not.toContain("audio_src");
    expect(stdout).not.toContain("Test Native Speaker");
  });

  it("matches a normalized grammar surface and emits stable JSON", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        entryUsageScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--kind",
        "grammar",
        "--surface",
        "~ている",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      entry: { id: string; status: string };
      counts: { cards: number; usages: number };
      usages: Array<{ card_id?: string; field: string; line?: number }>;
    };

    expect(payload.entry).toMatchObject({
      id: "grammar-teiru",
      status: "covered-card"
    });
    expect(payload.counts).toEqual(
      expect.objectContaining({
        cards: 1,
        usages: 2
      })
    );
    expect(payload.usages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "card.notes_it",
          line: 47,
          card_id: "card-teiru-concept"
        })
      ])
    );
  });

  it("requires a safe media slug and exactly one selector", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryUsageScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "../sample-anime",
          "--entry-id",
          "term-taberu"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--media-slug must be a URL-safe slug segment."
      )
    });

    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryUsageScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--entry-id",
          "term-taberu",
          "--surface",
          "食べる"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--entry-id cannot be combined with --surface or a positional surface."
      )
    });

    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryUsageScriptPath,
          "--content-root",
          validContentRoot,
          "--entry-id",
          "term-taberu"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--media-slug is required.")
    });

    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryUsageScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--surface",
          "食べる",
          "--surface",
          "~ている"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--surface cannot be provided more than once."
      )
    });

    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryUsageScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--surface",
          "食べる",
          "~ている"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--surface cannot be combined with a positional surface."
      )
    });
  });
});
