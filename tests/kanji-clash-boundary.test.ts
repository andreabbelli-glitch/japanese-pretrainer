import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const productionKanjiClashRoots = [
  "src/app/kanji-clash",
  "src/components/kanji-clash"
] as const;
const productionKanjiClashFiles = [
  "scripts/generate-kanji-clash-similar-kanji-dataset.ts",
  "src/actions/kanji-clash.ts",
  "src/db/queries/kanji-clash.ts",
  "src/db/queries/kanji-clash-session.ts",
  "src/lib/review-service.ts"
] as const;
const legacyKanjiClashRoot = "src/lib/kanji-clash";
const modelBoundaryRoot = "src/features/kanji-clash/model";
const clientKanjiClashRoots = ["src/components/kanji-clash"] as const;

describe("kanji clash feature boundary", () => {
  it("keeps production Kanji Clash consumers off legacy lib modules", async () => {
    const files = [
      ...(await listSourceFiles(productionKanjiClashRoots)),
      ...productionKanjiClashFiles
    ];
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/lib\/kanji-clash|(?:\.\.\/)+src\/lib\/kanji-clash)(?:["']|\/)/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps legacy lib Kanji Clash modules as compatibility shims only", async () => {
    const files = await listSourceFiles([legacyKanjiClashRoot]);
    const violations: string[] = [];

    for (const relativePath of files) {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );
      const executableLines = source
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("//"));
      const hasOnlyExports = executableLines.every((line) =>
        /^export\s+(?:\*\s+from|type\s+\*\s+from|\{[\s\S]*\}\s+from)\s+["']@\/features\/kanji-clash\//u.test(
          line
        )
      );

      if (!hasOnlyExports) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps pure Kanji Clash model code independent from server and UI modules", async () => {
    const files = await listSourceFiles([modelBoundaryRoot]);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:next(?:\/|["'])|@\/db(?:\/|["'])|drizzle-orm(?:\/|["'])|@\/actions(?:\/|["'])|@\/components(?:\/|["']))/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps client Kanji Clash UI away from the server entrypoint", async () => {
    const files = await listSourceFiles(clientKanjiClashRoots);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/features\/kanji-clash\/server(?:["']|\/)/u
    );

    expect(violations).toEqual([]);
  });
});

async function listSourceFiles(roots: readonly string[]) {
  const files: string[] = [];

  for (const root of roots) {
    await collectSourceFiles(path.join(PROJECT_ROOT, root), files);
  }

  return files
    .map((file) => path.relative(PROJECT_ROOT, file))
    .sort((left, right) => left.localeCompare(right));
}

async function collectSourceFiles(directory: string, files: string[]) {
  let entries: Dirent<string>[];

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    files.push(directory);
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectSourceFiles(entryPath, files);
      continue;
    }

    if (/\.(?:ts|tsx)$/u.test(entry.name)) {
      files.push(entryPath);
    }
  }
}

async function findImportViolations(files: readonly string[], pattern: RegExp) {
  const violations: string[] = [];

  for (const relativePath of files) {
    let source: string;

    try {
      source = await readFile(path.join(PROJECT_ROOT, relativePath), "utf8");
    } catch {
      violations.push(relativePath);
      continue;
    }

    if (pattern.test(source)) {
      violations.push(relativePath);
    }
  }

  return violations;
}
