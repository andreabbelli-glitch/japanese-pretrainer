import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const scopeScriptPath = path.join(process.cwd(), "scripts", "content-scope.ts");
const sampleMediaRoot = path.join(validContentRoot, "media", "sample-anime");

describe("content scope CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("maps touched textbook and cards files to a lesson-scoped import", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        scopeScriptPath,
        "--content-root",
        validContentRoot,
        path.join(sampleMediaRoot, "textbook", "001-intro.md"),
        path.join(sampleMediaRoot, "cards", "001-core.md")
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("SCOPE lesson");
    expect(stdout).toContain("MEDIA sample-anime");
    expect(stdout).toContain("LESSONS ep01-intro");
    expect(stdout).toContain(
      "VALIDATE ./scripts/with-node.sh pnpm content:validate -- --content-root tests/fixtures/content/valid/content --media-slug sample-anime"
    );
    expect(stdout).toContain(
      "IMPORT ./scripts/with-node.sh pnpm content:import -- --content-root tests/fixtures/content/valid/content --media-slug sample-anime --lesson-slug ep01-intro"
    );
    expect(stdout).not.toContain("ep01-core");
  });

  it("validates but skips import for asset-only changes", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        scopeScriptPath,
        "--content-root",
        validContentRoot,
        path.join(
          sampleMediaRoot,
          "assets",
          "episode-01",
          "sample-anime-meal.svg"
        )
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("SCOPE no-import");
    expect(stdout).toContain("MEDIA sample-anime");
    expect(stdout).toContain(
      "VALIDATE ./scripts/with-node.sh pnpm content:validate -- --content-root tests/fixtures/content/valid/content --media-slug sample-anime"
    );
    expect(stdout).toContain("IMPORT none");
    expect(stdout).toContain("REASON assets file changed");
  });

  it("escalates cards slug fallbacks that are not textbook lesson slugs", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);
    const cardsPath = path.join(
      tempContentRoot,
      "media",
      "sample-anime",
      "cards",
      "002-empty-cards-slug.md"
    );

    await writeFile(
      cardsPath,
      `---
id: cards-sample-anime-ep01-extra
media_id: media-sample-anime
slug: ep01-core
title: Extra cards
order: 11
segment_ref: episode-01
---

# Extra cards
`
    );

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        scopeScriptPath,
        "--content-root",
        tempContentRoot,
        cardsPath
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("SCOPE media");
    expect(stdout).toContain("MEDIA sample-anime");
    expect(stdout).toContain(
      "IMPORT ./scripts/with-node.sh pnpm content:import"
    );
    expect(stdout).not.toContain("--lesson-slug ep01-core");
    expect(stdout).toContain(
      "WARNING cards slug is not a textbook lesson slug: ep01-core"
    );
  });

  it("recommends full import for deleted media descriptors", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);
    const mediaFilePath = path.join(
      tempContentRoot,
      "media",
      "sample-anime",
      "media.md"
    );

    await rm(mediaFilePath);

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        scopeScriptPath,
        "--content-root",
        tempContentRoot,
        mediaFilePath
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("SCOPE full");
    expect(stdout).toContain("MEDIA sample-anime");
    expect(stdout).toContain("MODE full");
    expect(stdout).toContain(
      "VALIDATE ./scripts/with-node.sh pnpm content:validate"
    );
    expect(stdout).toContain(
      "IMPORT ./scripts/with-node.sh pnpm content:import"
    );
    expect(stdout).not.toContain("--media-slug sample-anime");
    expect(stdout).toContain("REASON media descriptor deleted");
  });

  it("escalates deleted textbook files to media scope for archive handling", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        scopeScriptPath,
        "--content-root",
        validContentRoot,
        path.join(sampleMediaRoot, "textbook", "999-removed.md")
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("SCOPE media");
    expect(stdout).toContain("MEDIA sample-anime");
    expect(stdout).toContain(
      "IMPORT ./scripts/with-node.sh pnpm content:import"
    );
    expect(stdout).not.toContain("--lesson-slug");
    expect(stdout).toContain(
      "REASON textbook file deleted; archive/prune needs media scope"
    );
  });

  it("emits stable JSON for automation", async () => {
    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        scopeScriptPath,
        "--content-root",
        validContentRoot,
        "--json",
        path.join(sampleMediaRoot, "cards", "001-core.md")
      ],
      { timeoutMs: 60_000 }
    );

    const payload = JSON.parse(stdout) as {
      media: Array<{
        lessonSlugs: string[];
        mediaSlug: string;
        mode: string;
      }>;
      mode: string;
    };

    expect(payload.mode).toBe("lesson");
    expect(payload.media).toEqual([
      {
        importCommand:
          "./scripts/with-node.sh pnpm content:import -- --content-root tests/fixtures/content/valid/content --media-slug sample-anime --lesson-slug ep01-intro",
        lessonSlugs: ["ep01-intro"],
        mediaSlug: "sample-anime",
        mode: "lesson",
        reasons: ["cards file maps to lesson scope"],
        validateCommand:
          "./scripts/with-node.sh pnpm content:validate -- --content-root tests/fixtures/content/valid/content --media-slug sample-anime",
        warnings: []
      }
    ]);
  });
});

async function copyValidContentFixture(tempDirs: string[]) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-content-scope-"));
  const tempContentRoot = path.join(tempDir, "content");

  tempDirs.push(tempDir);
  await cp(validContentRoot, tempContentRoot, { recursive: true });

  return tempContentRoot;
}
