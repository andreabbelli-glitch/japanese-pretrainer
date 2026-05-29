import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("content feature boundary", () => {
  it("has no content parser/importer implementation directory under src/lib", async () => {
    const legacyPath = path.join(PROJECT_ROOT, "src", "lib", "content");

    expect(await pathExists(legacyPath)).toBe(false);
  });

  it("keeps source, scripts, tests, and docs off legacy lib content modules", async () => {
    const files = [
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "src"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "scripts"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "tests"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "docs")))
    ];
    const legacyImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/lib\/content|(?:\.\.\/)+(?:src\/)?lib\/content)(?:["']|\/)/u;
    const legacyDocPattern = /src\/lib\/content|@\/lib\/content/u;
    const violations: string[] = [];

    for (const relativePath of files) {
      const source = await readFile(path.join(PROJECT_ROOT, relativePath), "utf8");
      const pattern = relativePath.endsWith(".md")
        ? legacyDocPattern
        : legacyImportPattern;

      if (pattern.test(source)) {
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

    if (/\.(?:md|ts|tsx)$/u.test(entry.name)) {
      files.push(path.relative(PROJECT_ROOT, entryPath));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}
