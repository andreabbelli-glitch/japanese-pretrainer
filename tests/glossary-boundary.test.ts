import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const productionGlossaryRoots = [
  "src/app/api/glossary",
  "src/app/glossary",
  "src/app/media/[mediaSlug]/glossary",
  "src/components/glossary",
  "src/components/review"
] as const;
const clientTypeConsumerRoots = [
  "src/components/glossary",
  "src/components/review"
] as const;
const clientTypeConsumerFiles = [
  "src/features/glossary/ui/client/glossary-autocomplete-dropdown.tsx",
  "src/features/glossary/ui/client/use-glossary-autocomplete.ts"
] as const;

describe("glossary feature boundary", () => {
  it("lints every review component against glossary client boundaries", async () => {
    const eslint = new ESLint({ cwd: PROJECT_ROOT });
    const probePath = path.join(
      PROJECT_ROOT,
      "src/components/review/__glossary-boundary-probe.tsx"
    );

    for (const forbiddenImport of [
      "@/features/glossary/server",
      "@/lib/glossary"
    ]) {
      const [result] = await eslint.lintText(`import "${forbiddenImport}";\n`, {
        filePath: probePath
      });

      expect(
        result?.messages.some(
          (message) => message.ruleId === "no-restricted-imports"
        )
      ).toBe(true);
    }
  });

  it("keeps production glossary consumers off legacy lib glossary modules", async () => {
    const files = await listSourceFiles(productionGlossaryRoots);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/lib\/glossary(?:["']|[-/])/u
    );

    expect(violations).toEqual([]);
  });

  it("has no legacy glossary compatibility modules under src/lib", async () => {
    const libEntries = await listDirectoryEntries(
      path.join(PROJECT_ROOT, "src", "lib")
    );
    const legacyGlossaryFiles = libEntries
      .filter(
        (entry) => entry.isFile() && /^glossary(?:-|\.ts$)/u.test(entry.name)
      )
      .map((entry) => `src/lib/${entry.name}`)
      .sort((left, right) => left.localeCompare(right));

    expect(legacyGlossaryFiles).toEqual([]);
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

  it("keeps the global glossary result pipeline out of the route-facing loaders", async () => {
    const routeLoaderSource = await readFile(
      path.join(PROJECT_ROOT, "src/features/glossary/server/loaders.ts"),
      "utf8"
    );
    const globalResultSource = await readOptionalTextFile(
      path.join(PROJECT_ROOT, "src/features/glossary/server/global-results.ts")
    );
    const globalQueryPrimitives = [
      "countGlobalGlossaryBrowseGroups",
      "getGlobalGlossaryAggregateStats",
      "getGlossaryEntriesByIds",
      "listGlobalGlossaryBrowseGroupRefs",
      "listGlossarySearchCandidateRefs"
    ];

    for (const primitive of globalQueryPrimitives) {
      const primitivePattern = new RegExp(`\\b${primitive}\\b`, "u");

      expect(routeLoaderSource).not.toMatch(primitivePattern);
      expect(globalResultSource).toMatch(primitivePattern);
    }

    const forbiddenImports = readImportSpecifiers(globalResultSource).filter(
      (specifier) =>
        /^(?:\.|\.\/index|\.\/loaders|@\/features\/glossary\/server(?:\/index|\/loaders)?)$/u.test(
          specifier
        )
    );

    expect(forbiddenImports).toEqual([]);
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

async function listDirectoryEntries(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readOptionalTextFile(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function readImportSpecifiers(source: string) {
  const specifiers = new Set<string>();
  const importPatterns = [
    /\bfrom\s+["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    /^\s*import\s+["']([^"']+)["']/gmu
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];

      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers].sort((left, right) => left.localeCompare(right));
}
