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
  "content-scaffold.ts"
);

describe("content scaffold CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("creates a valid textbook scaffold without creating an invalid empty cards file", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        scaffoldScriptPath,
        "--content-root",
        tempContentRoot,
        "--media-slug",
        "sample-anime",
        "--slug",
        "ep02-followup",
        "--title",
        "Episodio 2 - Follow-up",
        "--summary",
        "Ripasso operativo senza nuove card.",
        "--difficulty",
        "n5",
        "--segment-ref",
        "episode-01",
        "--tag",
        "followup"
      ],
      { timeoutMs: 60_000 }
    );
    const textbookPath = path.join(
      tempContentRoot,
      "media",
      "sample-anime",
      "textbook",
      "002-ep02-followup.md"
    );
    const cardsPath = path.join(
      tempContentRoot,
      "media",
      "sample-anime",
      "cards",
      "002-ep02-followup.md"
    );

    expect(stdout).toContain("SCAFFOLD created");
    expect(stdout).toContain(
      "TEXTBOOK " +
        path.relative(process.cwd(), textbookPath).replaceAll("\\", "/")
    );
    expect(stdout).toContain("CARDS not-created");
    expect(stdout).toContain("IMPORT withheld");
    await expect(access(cardsPath)).rejects.toMatchObject({ code: "ENOENT" });

    const source = await readFile(textbookPath, "utf8");
    expect(source).toContain('id: "lesson-sample-anime-ep02-followup"');
    expect(source).toContain('media_id: "media-sample-anime"');
    expect(source).toContain('slug: "ep02-followup"');
    expect(source).toContain('title: "Episodio 2 - Follow-up"');
    expect(source).toContain("order: 11");
    expect(source).toContain('segment_ref: "episode-01"');
    expect(source).toContain('tags: ["followup"]');
    expect(source).toContain("# Episodio 2 - Follow-up");

    const parseResult = await parseMediaDirectory(
      path.join(tempContentRoot, "media", "sample-anime")
    );
    expect(parseResult.ok).toBe(true);
  });

  it("prints a JSON plan without writing when --print is passed", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        scaffoldScriptPath,
        "--content-root",
        tempContentRoot,
        "--media-slug",
        "sample-anime",
        "--slug",
        "ep02-followup",
        "--title",
        "Episodio 2 - Follow-up",
        "--print",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      files: { textbook: { path: string } };
      next: { lesson_slug: string };
      status: string;
    };

    expect(payload.status).toBe("ready");
    expect(payload.next.lesson_slug).toBe("ep02-followup");
    await expect(
      access(
        path.join(
          tempContentRoot,
          "media",
          "sample-anime",
          "textbook",
          "002-ep02-followup.md"
        )
      )
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses to write when the next-id plan has conflicts", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--media-slug",
          "sample-anime",
          "--slug",
          "ep01-intro",
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

  it("refuses to write on order collisions", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--media-slug",
          "sample-anime",
          "--slug",
          "ep02-followup",
          "--title",
          "Episodio 2 - Follow-up",
          "--order",
          "10"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringContaining("order-collision:10")
    });
  });

  it("refuses to write summaries rejected by content validation", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--media-slug",
          "sample-anime",
          "--slug",
          "ep02-followup",
          "--title",
          "Episodio 2 - Follow-up",
          "--summary",
          "読む"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("frontmatter.summary-bare-kanji")
    });
  });

  it("rejects missing title values before writing", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--media-slug",
          "sample-anime",
          "--slug",
          "ep02-followup"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing --title.")
    });
  });

  it("rejects multiline titles before writing", async () => {
    const tempContentRoot = await copyValidContentFixture(tempDirs);

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          scaffoldScriptPath,
          "--content-root",
          tempContentRoot,
          "--media-slug",
          "sample-anime",
          "--slug",
          "ep02-followup",
          "--title",
          "Episodio 2\n:::card"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("line breaks")
    });
  });
});

async function copyValidContentFixture(tempDirs: string[]) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-content-scaffold-"));
  const tempContentRoot = path.join(tempDir, "content");

  tempDirs.push(tempDir);
  await cp(validContentRoot, tempContentRoot, { recursive: true });

  return tempContentRoot;
}
