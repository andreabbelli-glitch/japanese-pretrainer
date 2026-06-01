import path from "node:path";

import { describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const entryBriefScriptPath = path.join(
  process.cwd(),
  "scripts",
  "content-entry-brief.ts"
);

describe("content entry brief CLI", () => {
  it("prints a compact term brief for an exact surface", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        entryBriefScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "食べる"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("ENTRY term term-taberu media=sample-anime");
    expect(stdout).toContain('display="食べる"');
    expect(stdout).toContain("reading=たべる");
    expect(stdout).toContain('meaning="mangiare"');
    expect(stdout).toContain("audio=ok");
    expect(stdout).toContain("pitch=2");
    expect(stdout).toContain("CARD card-taberu-recognition");
    expect(stdout).toContain("LESSON ep01-intro order=10");
    expect(stdout).not.toContain("audio_src");
    expect(stdout).not.toContain("Test Native Speaker");
  });

  it("matches normalized grammar wave variants", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        entryBriefScriptPath,
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

    expect(stdout).toContain("ENTRY grammar grammar-teiru");
    expect(stdout).toContain('display="～ている"');
    expect(stdout).toContain("CARD card-teiru-concept");
  });

  it("emits stable JSON with cards and references", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        entryBriefScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--entry-id",
        "term-taberu",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      cards: Array<{ id: string; lesson_slug?: string }>;
      entry: { id: string };
      references: Array<{ lesson_slug?: string }>;
    };

    expect(payload.entry.id).toBe("term-taberu");
    expect(payload.cards).toEqual([
      expect.objectContaining({
        id: "card-taberu-recognition",
        lesson_slug: "ep01-intro"
      })
    ]);
    expect(payload.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lesson_slug: "ep01-intro"
        })
      ])
    );
    expect(payload.references).toHaveLength(1);
  });

  it("does not match meanings as duplicate evidence", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryBriefScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "mangiare"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("No exact entry match found.")
    });
  });

  it("rejects unsafe media slugs before building paths", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryBriefScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "../sample-anime",
          "食べる"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--media-slug must be a URL-safe slug segment."
      )
    });
  });

  it("rejects conflicting entry id and query selectors", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          entryBriefScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--entry-id",
          "grammar-teiru",
          "食べる"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--entry-id cannot be combined with an entry query."
      )
    });
  });
});
