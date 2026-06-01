import path from "node:path";

import { describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const lessonBriefScriptPath = path.join(
  process.cwd(),
  "scripts",
  "content-lesson-brief.ts"
);

describe("content lesson brief CLI", () => {
  it("prints a compact lesson brief joined by lesson_id, not cards slug", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lessonBriefScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--lesson-slug",
        "ep01-intro"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("LESSON media=sample-anime slug=ep01-intro");
    expect(stdout).toContain(
      "FILES textbook=tests/fixtures/content/valid/content/media/sample-anime/textbook/001-intro.md cards=tests/fixtures/content/valid/content/media/sample-anime/cards/001-core.md"
    );
    expect(stdout).toContain("ENTRY grammar grammar-teiru");
    expect(stdout).toContain("ENTRY term term-taberu");
    expect(stdout).toContain("CARD card-taberu-recognition");
    expect(stdout).toContain("CARD card-teiru-concept");
    expect(stdout).not.toContain("example_jp=");
    expect(stdout).not.toContain("example_it=");
    expect(stdout).not.toContain("notes_it=");
    expect(stdout).toContain("IMAGE assets/episode-01/sample-anime-meal.svg");
    expect(stdout).toContain("WARNINGS total=1 P0=1 P1=0");
    expect(stdout).toContain(
      'COMMAND import="./scripts/with-node.sh pnpm content:import -- --content-root tests/fixtures/content/valid/content --media-slug sample-anime --lesson-slug ep01-intro"'
    );
    expect(stdout).not.toContain("ep01-core");
  });

  it("emits stable JSON for automation", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        lessonBriefScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--lesson-slug",
        "ep01-intro",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      cards: Array<{
        example_it?: string;
        example_jp?: string;
        id: string;
        notes_it?: string;
      }>;
      entries: Array<{ id: string; reason: string }>;
      files: { cards: string[] };
      lesson: { id: string; slug: string };
      warnings: { total: number };
    };

    expect(payload.lesson).toMatchObject({
      id: "lesson-sample-anime-ep01-intro",
      slug: "ep01-intro"
    });
    expect(payload.files.cards).toEqual([
      "tests/fixtures/content/valid/content/media/sample-anime/cards/001-core.md"
    ]);
    expect(payload.cards.map((card) => card.id)).toEqual([
      "card-taberu-recognition",
      "card-teiru-concept"
    ]);
    expect(payload.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          example_it: "Mangio il pane.",
          example_jp: "パンを食べる。",
          id: "card-taberu-recognition"
        })
      ])
    );
    expect(payload.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "card-teiru-concept",
          notes_it: "Si collega a ～ている."
        })
      ])
    );
    expect(payload.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "term-taberu",
          reason: "carded+referenced"
        }),
        expect.objectContaining({
          id: "grammar-teiru",
          reason: "carded+declared+referenced"
        })
      ])
    );
    expect(payload.warnings.total).toBe(1);
  });

  it("rejects unsafe slug segments before building paths", async () => {
    await expect(
      runNodeCli(
        [
          "--experimental-strip-types",
          lessonBriefScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "../sample-anime",
          "--lesson-slug",
          "ep01-intro"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--media-slug must be a URL-safe slug segment."
      )
    });
  });
});
