import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findLargeTouchedFiles,
  getLineLimitForPath,
  isFileSizeCheckedPath
} from "../scripts/file-size-check";

describe("file size check", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-file-size-check-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("reports touched source files that exceed the source limit", async () => {
    const relativePath = "src/features/demo/server/index.ts";

    await writeWorkspaceFile(relativePath, makeLines(1001));

    const violations = await findLargeTouchedFiles(tempDir, [relativePath]);

    expect(violations).toEqual([
      {
        limit: 1000,
        lineCount: 1001,
        path: relativePath
      }
    ]);
  });

  it("does not count a trailing newline as an extra line", async () => {
    const relativePath = "src/features/demo/server/index.ts";

    await writeWorkspaceFile(relativePath, `${makeLines(1000)}\n`);

    await expect(
      findLargeTouchedFiles(tempDir, [relativePath])
    ).resolves.toEqual([]);
  });

  it("uses separate limits for source, tests, and CSS", () => {
    expect(getLineLimitForPath("src/features/demo/server/index.ts")).toBe(1000);
    expect(getLineLimitForPath("scripts/import-content.ts")).toBe(1000);
    expect(getLineLimitForPath("tests/textbook.test.ts")).toBe(1500);
    expect(getLineLimitForPath("src/styles/base.css")).toBe(1600);
  });

  it("ignores docs, content, generated files, declarations, and missing paths", async () => {
    const checkedPath = "src/features/demo/server/page-data.ts";
    const ignoredPaths = [
      "docs/dev-tooling.md",
      "content/media/demo/textbook/001.md",
      "drizzle/0001_snapshot.sql",
      "src/features/demo/model/types.generated.ts",
      "src/types/generated.d.ts",
      "src/features/demo/server/deleted.ts"
    ];

    await writeWorkspaceFile(checkedPath, makeLines(12));
    await writeWorkspaceFile(
      "src/features/demo/model/types.generated.ts",
      makeLines(2000)
    );
    await writeWorkspaceFile("src/types/generated.d.ts", makeLines(2000));

    const violations = await findLargeTouchedFiles(tempDir, [
      checkedPath,
      ...ignoredPaths
    ]);

    expect(violations).toEqual([]);
  });

  it("checks only human-maintained TypeScript, JavaScript, test, and CSS paths", () => {
    expect(isFileSizeCheckedPath("src/app/page.tsx")).toBe(true);
    expect(isFileSizeCheckedPath("scripts/agent-check.ts")).toBe(true);
    expect(isFileSizeCheckedPath("tests/review.test.ts")).toBe(true);
    expect(isFileSizeCheckedPath("src/styles/base.css")).toBe(true);
    expect(isFileSizeCheckedPath("package.json")).toBe(false);
    expect(isFileSizeCheckedPath("docs/agent-orientation.md")).toBe(false);
  });

  async function writeWorkspaceFile(relativePath: string, source: string) {
    const absolutePath = path.join(tempDir, relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, source);
  }
});

function makeLines(count: number) {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`).join(
    "\n"
  );
}
