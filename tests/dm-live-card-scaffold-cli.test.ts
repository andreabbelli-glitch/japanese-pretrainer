import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseMediaDirectory } from "@/features/content";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const scaffoldScriptPath = path.join(
  process.cwd(),
  "scripts",
  "dm-live-card-scaffold.ts"
);

describe("dm live card scaffold CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("prints a Duel Masters live-card plan without writing files", async () => {
    const tempContentRoot = await copyDmContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        scaffoldScriptPath,
        "--content-root",
        tempContentRoot,
        "--card-slug",
        "scaffold-test-card",
        "--title",
        "貝獣 ラリア: G・ゼロ e condizione",
        "--summary",
        "Leggere G Zero come condizione gia verificata.",
        "--tag",
        "water",
        "--tag",
        "blocker",
        "--asset-ext",
        "jpg",
        "--official-id",
        "dm25rp4-T07"
      ],
      { timeoutMs: 60_000 }
    );

    const textbookPath = path.join(
      tempContentRoot,
      "media",
      "duel-masters-dm25",
      "textbook",
      "086-live-duel-encounters-scaffold-test-card.md"
    );
    const cardsPath = path.join(
      tempContentRoot,
      "media",
      "duel-masters-dm25",
      "cards",
      "086-live-duel-encounters-scaffold-test-card.md"
    );
    const assetPath = path.join(
      tempContentRoot,
      "media",
      "duel-masters-dm25",
      "assets",
      "cards",
      "live-duel",
      "scaffold-test-card.jpg"
    );

    expect(stdout).toContain("DM_LIVE_CARD_SCAFFOLD ready write=false");
    expect(stdout).toContain(
      "TEXTBOOK " +
        path.relative(process.cwd(), textbookPath).replaceAll("\\", "/")
    );
    expect(stdout).toContain(
      "CARDS not-created " +
        path.relative(process.cwd(), cardsPath).replaceAll("\\", "/")
    );
    expect(stdout).toContain(
      "ASSET planned " +
        path.relative(process.cwd(), assetPath).replaceAll("\\", "/")
    );
    expect(stdout).toContain(
      "LESSON_SLUG live-duel-encounters-scaffold-test-card"
    );
    expect(stdout).toContain("ORDER 115");
    expect(stdout).toContain(
      "DM_CARD_FETCH ./scripts/with-node.sh pnpm dm:card-fetch -- --official-id dm25rp4-T07"
    );
    expect(stdout).toContain(
      "WARNING user screenshot/text remains ground truth"
    );
    await expect(access(textbookPath)).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(access(cardsPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(assetPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("quotes URL card-fetch hints so they are copyable in zsh", async () => {
    const tempContentRoot = await copyDmContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        scaffoldScriptPath,
        "--content-root",
        tempContentRoot,
        "--card-slug",
        "scaffold-test-card",
        "--title",
        "Scaffold test card",
        "--url",
        "https://dm.takaratomy.co.jp/card/detail/?id=dmr19-067"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      "DM_CARD_FETCH ./scripts/with-node.sh pnpm dm:card-fetch -- --url 'https://dm.takaratomy.co.jp/card/detail/?id=dmr19-067'"
    );
  });

  it("writes only a valid textbook scaffold when --write is passed", async () => {
    const tempContentRoot = await copyDmContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        scaffoldScriptPath,
        "--content-root",
        tempContentRoot,
        "--card-slug",
        "live-duel-encounters-scaffold-test-card",
        "--title",
        "貝獣 ラリア: G・ゼロ e condizione",
        "--summary",
        "Leggere G Zero come condizione gia verificata.",
        "--write"
      ],
      { timeoutMs: 60_000 }
    );
    const mediaDirectory = path.join(
      tempContentRoot,
      "media",
      "duel-masters-dm25"
    );
    const textbookPath = path.join(
      mediaDirectory,
      "textbook",
      "086-live-duel-encounters-scaffold-test-card.md"
    );
    const cardsPath = path.join(
      mediaDirectory,
      "cards",
      "086-live-duel-encounters-scaffold-test-card.md"
    );

    expect(stdout).toContain("DM_LIVE_CARD_SCAFFOLD created write=true");
    expect(stdout).toContain("CARDS not-created");
    await expect(access(cardsPath)).rejects.toMatchObject({ code: "ENOENT" });

    const source = await readFile(textbookPath, "utf8");
    expect(source).toContain(
      'id: "lesson-duel-masters-dm25-live-duel-encounters-scaffold-test-card"'
    );
    expect(source).toContain('segment_ref: "live-duel-encounters"');
    expect(source).toContain('tags: ["live-duel", "card"]');
    expect(source).toContain("# 貝獣 ラリア: G・ゼロ e condizione");

    const parseResult = await parseMediaDirectory(mediaDirectory);
    expect(parseResult.ok).toBe(true);
  });

  it("emits stable JSON for automation", async () => {
    const tempContentRoot = await copyDmContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        scaffoldScriptPath,
        "--content-root",
        tempContentRoot,
        "--card-slug",
        "scaffold-test-card",
        "--title",
        "貝獣 ラリア: G・ゼロ e condizione",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      asset: { path: string };
      files: { cards: { action: string }; textbook: { path: string } };
      next: { lesson_slug: string; order: number };
      warnings: string[];
    };
    const expectedAssetPath = path
      .relative(
        process.cwd(),
        path.join(
          tempContentRoot,
          "media",
          "duel-masters-dm25",
          "assets",
          "cards",
          "live-duel",
          "scaffold-test-card.<ext>"
        )
      )
      .replaceAll("\\", "/");

    expect(payload.next).toEqual(
      expect.objectContaining({
        lesson_slug: "live-duel-encounters-scaffold-test-card",
        order: 115
      })
    );
    expect(payload.files.cards.action).toBe("not-created");
    expect(payload.asset.path).toBe(expectedAssetPath);
    expect(payload.warnings).toContain(
      "user screenshot/text remains ground truth"
    );
  });

  it("refuses unsafe slugs and duplicate live encounter slugs", async () => {
    const tempContentRoot = await copyDmContentFixture(tempDirs);

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--card-slug",
          "../kaiju-laria",
          "--title",
          "Unsafe"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--card-slug must be a URL-safe slug, optionally prefixed with live-duel-encounters-."
      )
    });

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--card-slug",
          "live-duel-encounters-live-duel-encounters-review",
          "--title",
          "Double prefix"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--card-slug must not repeat the live-duel-encounters- prefix."
      )
    });

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--card-slug",
          "baby-baki",
          "--title",
          "Duplicate"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringContaining("next-id plan has conflicts")
    });
  });

  it("validates summary through the existing content scaffold rules", async () => {
    const tempContentRoot = await copyDmContentFixture(tempDirs);

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--card-slug",
          "scaffold-test-card",
          "--title",
          "貝獣 ラリア",
          "--summary",
          "条件"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("frontmatter.summary-bare-kanji")
    });
  });
});

async function copyDmContentFixture(tempDirs: string[]) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-dm-live-scaffold-"));
  const tempContentRoot = path.join(tempDir, "content");

  tempDirs.push(tempDir);
  await cp(validContentRoot, tempContentRoot, { recursive: true });
  await cp(
    path.join(process.cwd(), "content", "media", "duel-masters-dm25"),
    path.join(tempContentRoot, "media", "duel-masters-dm25"),
    { recursive: true }
  );

  return tempContentRoot;
}
