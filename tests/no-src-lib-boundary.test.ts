import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("src lib boundary", () => {
  it("has no implementation files left under src/lib", async () => {
    const libPath = path.join(PROJECT_ROOT, "src", "lib");

    expect(await listFilesIfExists(libPath)).toEqual([]);
  });

  it("keeps source, scripts, and tests off src/lib imports", async () => {
    const files = [
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "src"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "scripts"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "tests")))
    ];
    const legacyImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+|vi\.(?:doMock|mock|doUnmock)\()["'](?:@\/lib(?:["'/])|(?:\.\.\/)+(?:src\/)?lib(?:["'/]))/u;
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

async function listFilesIfExists(directory: string) {
  try {
    await access(directory);
  } catch {
    return [];
  }

  const files: string[] = [];
  await collectFiles(directory, files);
  return files
    .map((file) => path.relative(PROJECT_ROOT, file))
    .sort((left, right) => left.localeCompare(right));
}

async function collectFiles(directory: string, files: string[]) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(entryPath, files);
      continue;
    }

    files.push(entryPath);
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
