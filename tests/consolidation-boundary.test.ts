import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("consolidation feature boundary", () => {
  it("has no legacy consolidation implementation module under src/lib", async () => {
    const legacyPath = path.join(
      PROJECT_ROOT,
      "src",
      "lib",
      "consolidation.ts"
    );

    expect(await fileExists(legacyPath)).toBe(false);
  });

  it("keeps consumers off the legacy lib consolidation module", async () => {
    const files = [
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "src"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "scripts"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "tests")))
    ];
    const legacyImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/lib\/consolidation|(?:\.\.\/)+(?:src\/)?lib\/consolidation(?:\.ts)?)["']/u;
    const violations: string[] = [];

    for (const relativePath of files) {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      if (legacyImportPattern.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps production consumers on the public consolidation server facade", async () => {
    const files = [
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "src"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "scripts"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "tests")))
    ].filter(
      (relativePath) =>
        !relativePath.startsWith("src/features/consolidation/server/")
    );
    const internalServerImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+|vi\.mock\()["']@\/features\/consolidation\/server\/[^"']+["']/u;
    const violations: string[] = [];

    for (const relativePath of files) {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      if (internalServerImportPattern.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps the consolidation server facade free of implementation details", async () => {
    const source = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "consolidation",
        "server",
        "index.ts"
      ),
      "utf8"
    );
    const implementationImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/db(?:["'/])|drizzle-orm(?:["'/])|@\/features\/(?:review|textbook)\/server(?:["'/]))/u;
    const mutationCallPattern = /\.(?:transaction|insert|update)\s*\(/u;

    expect(source).not.toMatch(implementationImportPattern);
    expect(source).not.toMatch(mutationCallPattern);
    expect(source).toContain('from "./enqueue"');
    expect(source).toContain('from "./lesson-completion"');
    expect(source).toContain('from "./mutations"');
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
