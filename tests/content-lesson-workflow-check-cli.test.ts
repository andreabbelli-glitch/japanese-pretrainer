import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validContentRoot } from "./helpers/content-fixtures";
import { runNodeCli } from "./helpers/run-cli";

const workflowCheckScriptPath = path.join(
  process.cwd(),
  "scripts",
  "content-lesson-workflow-check.ts"
);

describe("content lesson workflow check CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("blocks import planning when editorial warnings are present", async () => {
    let failure: { code?: number; stdout?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          workflowCheckScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--lesson-slug",
          "ep01-intro"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stdout?: string };
    }

    expect(failure).not.toBeNull();
    expect(failure?.code).toBe(3);
    expect(failure?.stdout).toContain(
      "LESSON_WORKFLOW_CHECK attention media=sample-anime lessons=1 mode=check"
    );
    expect(failure?.stdout).toContain("EDITORIAL warn warnings=1 P0=1 P1=0");
    expect(failure?.stdout).toContain("IMPORT withheld");
    expect(failure?.stdout).toContain("editorial warnings block import");
  });

  it("prints a compact lesson-scoped validation and import plan", async () => {
    const contentRoot = await copyGreenContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        workflowCheckScriptPath,
        "--content-root",
        contentRoot,
        "--media-slug",
        "sample-anime",
        "--lesson-slug",
        "ep01-intro"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain(
      "LESSON_WORKFLOW_CHECK pass media=sample-anime lessons=1 mode=check"
    );
    expect(stdout).toContain("VALIDATE pass files=3 lessons=1 cards_files=1");
    expect(stdout).toContain("EDITORIAL pass warnings=0 P0=0 P1=0");
    expect(stdout).toContain("SCOPE lesson lessons=ep01-intro");
    expect(stdout).toContain("IMPORT planned command=");
    expect(stdout).toContain(
      "--media-slug sample-anime --lesson-slug ep01-intro"
    );
    expect(stdout).toContain(
      "NOTE import not run; rerun with --import when DB sync is intended"
    );
  });

  it("allows editorial warnings only when explicitly requested", async () => {
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        workflowCheckScriptPath,
        "--content-root",
        validContentRoot,
        "--media-slug",
        "sample-anime",
        "--lesson-slug",
        "ep01-intro",
        "--allow-editorial-warnings"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("LESSON_WORKFLOW_CHECK attention");
    expect(stdout).toContain("EDITORIAL warn warnings=1");
    expect(stdout).toContain("IMPORT planned command=");
    expect(stdout).not.toContain("editorial warnings block import");
  });

  it("emits stable JSON for automation", async () => {
    const contentRoot = await copyGreenContentFixture(tempDirs);
    const { stdout } = await runNodeCli(
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--experimental-strip-types",
        workflowCheckScriptPath,
        "--content-root",
        contentRoot,
        "--media-slug",
        "sample-anime",
        "--lesson-slug",
        "ep01-intro",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );
    const payload = JSON.parse(stdout) as {
      commands: { import: string };
      editorial: { counts: { total: number } };
      lesson_slugs: string[];
      media_slug: string;
      scope: { mode: string };
      status: string;
    };

    expect(payload).toEqual(
      expect.objectContaining({
        lesson_slugs: ["ep01-intro"],
        media_slug: "sample-anime",
        status: "pass"
      })
    );
    expect(payload.editorial.counts.total).toBe(0);
    expect(payload.scope.mode).toBe("lesson");
    expect(payload.commands.import).toContain("--lesson-slug ep01-intro");
  });

  it("rejects unsafe and unknown lesson scopes before planning import", async () => {
    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          workflowCheckScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--lesson-slug",
          "../bad"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--lesson-slug must be a URL-safe lowercase slug."
      )
    });

    await expect(
      runNodeCli(
        [
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "--experimental-strip-types",
          workflowCheckScriptPath,
          "--content-root",
          validContentRoot,
          "--media-slug",
          "sample-anime",
          "--lesson-slug",
          "missing-lesson"
        ],
        { timeoutMs: 60_000 }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Unknown lesson slug(s): missing-lesson.")
    });
  });
});

async function copyGreenContentFixture(tempDirs: string[]) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-lesson-workflow-"));
  const contentRoot = path.join(tempDir, "content");

  tempDirs.push(tempDir);
  await cp(validContentRoot, contentRoot, { recursive: true });

  const lessonPath = path.join(
    contentRoot,
    "media",
    "sample-anime",
    "textbook",
    "001-intro.md"
  );
  const source = await readFile(lessonPath, "utf8");

  await writeFile(
    lessonPath,
    source.replace(
      "In questa lezione vediamo [食べる](term:term-taberu) e la forma\n[～ている](grammar:grammar-teiru).",
      "Nella scena, [食べる](term:term-taberu) e la forma [～ている](grammar:grammar-teiru) compaiono mentre il personaggio descrive l'azione."
    ),
    "utf8"
  );

  return contentRoot;
}
