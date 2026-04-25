import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const productionGlossaryRoots = [
  "src/app/api/glossary",
  "src/app/glossary",
  "src/app/media/[mediaSlug]/glossary",
  "src/components/glossary"
] as const;
const productionGlossaryFiles = [
  "src/components/review/review-page-stage.tsx",
  "src/components/review/review-page-state.ts",
  "src/components/review/use-review-forced-contrast-controller.ts",
  "src/components/review/use-review-page-controller.ts"
] as const;
const legacyGlossaryShims = [
  "src/lib/glossary.ts",
  "src/lib/glossary-autocomplete.ts",
  "src/lib/glossary-detail-helpers.ts",
  "src/lib/glossary-filter.ts",
  "src/lib/glossary-format.ts",
  "src/lib/glossary-loaders.ts",
  "src/lib/glossary-search.ts",
  "src/lib/glossary-types.ts"
] as const;
const clientTypeConsumerRoots = ["src/components/glossary"] as const;
const clientTypeConsumerFiles = [
  "src/components/review/review-page-stage.tsx",
  "src/components/review/review-page-state.ts",
  "src/components/review/use-review-forced-contrast-controller.ts",
  "src/components/review/use-review-page-controller.ts"
] as const;

describe("glossary feature boundary", () => {
  it("keeps production glossary consumers off legacy lib glossary modules", async () => {
    const files = [
      ...(await listSourceFiles(productionGlossaryRoots)),
      ...productionGlossaryFiles
    ];
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/lib\/glossary(?:["']|[-/])/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps legacy lib glossary modules as compatibility shims only", async () => {
    const violations: string[] = [];

    for (const relativePath of legacyGlossaryShims) {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );
      const executableLines = source
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("//"));
      const hasOnlyExports = executableLines.every((line) =>
        /^export\s+(?:\*\s+from|type\s+\*\s+from|\{[\s\S]*\}\s+from)\s+["']@\/features\/glossary\//u.test(
          line
        )
      );

      if (!hasOnlyExports) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps client glossary type consumers away from the server entrypoint", async () => {
    const files = [
      ...(await listSourceFiles(clientTypeConsumerRoots)),
      ...clientTypeConsumerFiles
    ];
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/features\/glossary\/server(?:["']|\/)/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps glossary study signal queries out of textbook query ownership", async () => {
    const source = await readFile(
      path.join(PROJECT_ROOT, "src/db/queries/textbook.ts"),
      "utf8"
    );

    expect(source).not.toContain("listEntryStudySignals");
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
  const entries = await readdir(directory, { withFileTypes: true });

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
    const source = await readFile(
      path.join(PROJECT_ROOT, relativePath),
      "utf8"
    );

    if (pattern.test(source)) {
      violations.push(relativePath);
    }
  }

  return violations;
}
