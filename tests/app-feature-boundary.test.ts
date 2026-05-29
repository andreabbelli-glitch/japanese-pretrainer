import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const legacyAppFeatureModules = [
  "dashboard.ts",
  "media-shell.ts",
  "media-shell-snapshot.ts",
  "progress.ts",
  "study-entry.ts",
  "study-format.ts",
  "study-metrics.ts",
  "study-search.ts"
] as const;

describe("app feature boundary", () => {
  it("has no app feature implementation modules under src/lib", async () => {
    const existingLegacyModules: string[] = [];

    for (const filename of legacyAppFeatureModules) {
      const relativePath = path.join("src", "lib", filename);

      if (await fileExists(path.join(PROJECT_ROOT, relativePath))) {
        existingLegacyModules.push(relativePath);
      }
    }

    expect(existingLegacyModules).toEqual([]);
  });

  it("keeps production app feature consumers off legacy lib modules", async () => {
    const files = await listSourceFiles(path.join(PROJECT_ROOT, "src"));
    const legacyImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/lib\/(?:dashboard|media-shell|media-shell-snapshot|progress|study-entry|study-format|study-metrics|study-search)|(?:\.\.\/)+(?:lib\/)?(?:dashboard|media-shell|media-shell-snapshot|progress|study-entry|study-format|study-metrics|study-search)(?:\.ts)?)["']/u;
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

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSourceFiles(directory: string) {
  const { readdir } = await import("node:fs/promises");
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
