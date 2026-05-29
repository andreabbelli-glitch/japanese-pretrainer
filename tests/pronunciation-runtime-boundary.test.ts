import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const productionTextbookConsumerRoots = [
  "src/actions/textbook.ts",
  "src/app/media/[mediaSlug]/textbook",
  "src/components/textbook"
] as const;
const textbookConsumerFacingTests = [
  "tests/textbook.test.ts",
  "tests/textbook-index-cache.test.ts",
  "tests/textbook-lesson-scheduling.test.ts",
  "tests/lesson-reader-client-sync.test.ts"
] as const;
const textbookFacadeFiles = [
  "src/features/textbook/types.ts",
  "src/features/textbook/client/reader-state.ts",
  "src/features/textbook/server/index.ts"
] as const;
const runtimePronunciationConsumers = [
  "src/features/review/server/card-hydration.ts",
  "src/features/textbook/server/tooltips.ts",
  "src/features/glossary/model/format.ts",
  "src/features/review/types.ts",
  "src/features/glossary/types.ts",
  "src/features/textbook/types.ts",
  "src/components/ui/pronunciation-audio.tsx"
] as const;
const runtimePronunciationDisplayRoots = [
  "src/components/textbook",
  "src/components/ui/pronunciation-audio.tsx",
  "src/features/glossary",
  "src/features/textbook",
  "src/features/review/server/card-hydration.ts",
  "src/features/review/types.ts",
  "src/features/textbook/server/tooltips.ts"
] as const;
const workflowOnlyTerms = [
  "Forvo",
  "forvo",
  "playwright",
  "node:fs",
  "node:path",
  "pronunciation-workflow",
  "pronunciation-reuse"
] as const;
const legacyPronunciationLibFiles = [
  "fetch-throttle.ts",
  "forvo-known-missing.ts",
  "forvo-pronunciation-fetch.ts",
  "forvo-pronunciation-helpers.ts",
  "forvo-word-add.ts",
  "manifest-helpers.ts",
  "pronunciation-data.ts",
  "pronunciation-resolve.ts",
  "pronunciation-reuse.ts",
  "pronunciation-shared.ts",
  "pronunciation-workflow.ts",
  "pronunciation.ts",
  "tofugu-pronunciation-dataset.ts"
] as const;
const legacyTextbookShimImportPattern =
  /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/lib\/textbook(?:["']|[-/])/u;
const workflowPronunciationImportPattern =
  /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/lib\/pronunciation(?:["']|\/)|@\/features\/pronunciation(?:["']|\/tooling\/))/u;

describe("pronunciation runtime boundary", () => {
  it("has no legacy textbook modules under src/lib", async () => {
    const libEntries = await readdir(path.join(PROJECT_ROOT, "src", "lib"), {
      withFileTypes: true
    });
    const legacyTextbookFiles = libEntries
      .filter(
        (entry) =>
          entry.isFile() && /^textbook(?:-|\.ts$)/u.test(entry.name)
      )
      .map((entry) => `src/lib/${entry.name}`)
      .sort((left, right) => left.localeCompare(right));

    expect(legacyTextbookFiles).toEqual([]);
  });

  it("keeps production textbook consumers on the feature facade", async () => {
    const files = await listSourceFiles(productionTextbookConsumerRoots);
    const violations = await findImportViolations(
      files,
      legacyTextbookShimImportPattern
    );

    expect(violations).toEqual([]);
  });

  it("keeps consumer-facing textbook tests on the feature facade", async () => {
    const violations = await findImportViolations(
      textbookConsumerFacingTests,
      legacyTextbookShimImportPattern
    );

    expect(violations).toEqual([]);
  });

  it("provides the intended textbook feature facade files", async () => {
    const missingOrEmpty: string[] = [];

    for (const relativePath of textbookFacadeFiles) {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      if (!source.includes("export")) {
        missingOrEmpty.push(relativePath);
      }
    }

    expect(missingOrEmpty).toEqual([]);
  });

  it("keeps runtime pronunciation display consumers off workflow modules", async () => {
    const files = await listSourceFiles(runtimePronunciationDisplayRoots);
    const violations = await findImportViolations(
      files,
      workflowPronunciationImportPattern
    );

    expect(violations).toEqual([]);
  });

  it.each(runtimePronunciationConsumers)(
    "%s imports the runtime-only pronunciation data module",
    async (relativePath) => {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      expect(source).not.toMatch(
        /from\s+["'](?:@\/lib\/pronunciation|@\/features\/pronunciation|\.\/pronunciation)["']/u
      );
      expect(source).toContain("@/features/pronunciation/model/data");
    }
  );

  it("has no pronunciation workflow or tooling modules under src/lib", async () => {
    const libEntries = await readdir(path.join(PROJECT_ROOT, "src", "lib"), {
      withFileTypes: true
    });
    const legacyFiles = new Set<string>(legacyPronunciationLibFiles);
    const found = libEntries
      .filter((entry) => entry.isFile() && legacyFiles.has(entry.name))
      .map((entry) => `src/lib/${entry.name}`)
      .sort((left, right) => left.localeCompare(right));

    expect(found).toEqual([]);
  });

  it("keeps pronunciation-data free of workflow and Node-only dependencies", async () => {
    const source = await readFile(
      path.join(PROJECT_ROOT, "src/features/pronunciation/model/data.ts"),
      "utf8"
    );

    for (const term of workflowOnlyTerms) {
      expect(source).not.toContain(term);
    }
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

async function collectSourceFiles(candidatePath: string, files: string[]) {
  const entry = await findDirectoryEntry(candidatePath);

  if (entry.isDirectory()) {
    await collectSourceFilesFromDirectory(candidatePath, files);
    return;
  }

  if (/\.(?:ts|tsx)$/u.test(entry.name)) {
    files.push(candidatePath);
  }
}

async function findDirectoryEntry(candidatePath: string) {
  const entries = await readdir(path.dirname(candidatePath), {
    withFileTypes: true
  });
  const entryName = path.basename(candidatePath);
  const entry = entries.find((item) => item.name === entryName);

  if (!entry) {
    throw new Error(`Boundary root does not exist: ${candidatePath}`);
  }

  return entry;
}

async function collectSourceFilesFromDirectory(
  directory: string,
  files: string[]
) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectSourceFilesFromDirectory(entryPath, files);
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
