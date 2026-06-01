import path from "node:path";

import { describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const nextIdScriptPath = path.join(
  process.cwd(),
  "scripts",
  "content-next-id.ts"
);

describe("content next-id CLI", () => {
  it("prints append-only paths and IDs for a new lesson/card pair", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        nextIdScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--slug",
        "ep02-followup"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      "textbook_path: tests/fixtures/content/valid/content/media/sample-anime/textbook/002-ep02-followup.md"
    );
    expect(stdout).toContain(
      "cards_path: tests/fixtures/content/valid/content/media/sample-anime/cards/002-ep02-followup.md"
    );
    expect(stdout).toContain("media_id: media-sample-anime");
    expect(stdout).toContain("lesson_id: lesson-sample-anime-ep02-followup");
    expect(stdout).toContain("cards_id: cards-sample-anime-ep02-followup");
    expect(stdout).toContain("lesson_slug: ep02-followup");
    expect(stdout).toContain("order: 11");
  });

  it("emits stable JSON for automation", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        nextIdScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--slug",
        "ep02-followup",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );

    const payload = JSON.parse(stdout) as {
      next: {
        filename_prefix: string;
        lesson_id: string;
        lesson_slug: string;
        order: number;
      };
    };

    expect(payload.next).toMatchObject({
      filename_prefix: "002",
      lesson_id: "lesson-sample-anime-ep02-followup",
      lesson_slug: "ep02-followup",
      order: 11
    });
  });

  it("uses a globally non-colliding order when a segment-scoped next order is occupied", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        nextIdScriptPath,
        "--media-slug",
        "duel-masters-dm25",
        "--segment-ref",
        "live-duel-encounters",
        "--slug",
        "live-duel-encounters-example-card",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );

    const payload = JSON.parse(stdout) as {
      next: {
        order: number;
      };
      warnings: string[];
    };

    expect(payload.next.order).toBeGreaterThan(111);
    expect(payload.warnings).not.toContain("order-collision:111");
  }, 60_000);

  it("rejects unsafe numeric overrides instead of truncating them", async () => {
    let failure: { code?: number; stderr?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          nextIdScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--slug",
          "ep02-followup",
          "--order",
          "12abc"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }

    expect(failure).not.toBeNull();
    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("--order must be a positive integer.");
  });
});
