import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const legacyModulePaths = [
  "src/lib/image-workflow-records.ts",
  "src/lib/image-workflow.ts",
  "src/lib/media-assets.ts"
] as const;

describe("media assets and image workflow boundary", () => {
  it("has no media asset or image workflow implementation files under src/lib", async () => {
    const found: string[] = [];

    for (const relativePath of legacyModulePaths) {
      if (await pathExists(path.join(PROJECT_ROOT, relativePath))) {
        found.push(relativePath);
      }
    }

    expect(found).toEqual([]);
  });

  it("keeps source, scripts, and tests off legacy media asset workflow modules", async () => {
    const files = [
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "src"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "scripts"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "tests")))
    ];
    const legacyImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/lib\/(?:image-workflow|media-assets)|(?:\.\.\/)+(?:src\/)?lib\/(?:image-workflow|media-assets))(?:["']|\/)/u;
    const violations: string[] = [];

    for (const relativePath of files) {
      const source = await readFile(path.join(PROJECT_ROOT, relativePath), "utf8");

      if (legacyImportPattern.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSourceFiles(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)));
      continue;
    }

    if (/\.(?:ts|tsx)$/u.test(entry.name)) {
      files.push(path.relative(PROJECT_ROOT, entryPath));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}
