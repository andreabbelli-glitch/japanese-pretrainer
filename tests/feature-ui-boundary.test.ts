import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("feature UI boundary", () => {
  it("keeps feature UI client modules away from server, action, tooling, and DB imports", async () => {
    const files = await listFeatureUiClientFiles();
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/actions(?:["']|\/)|@\/db(?:["']|\/)|@\/features\/[^"']+\/(?:server|tooling)(?:["']|\/)|drizzle-orm(?:["']|\/)|node:)/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps feature UI client modules from depending on legacy feature component folders", async () => {
    const files = await listFeatureUiClientFiles();
    const featureNames = await listFeatureNames();
    const featureComponentImportPattern = new RegExp(
      `(?:from\\s+|import\\s*\\(|import\\s+type\\s+[^;]*?\\s+from\\s+)["']@/components/(?:${featureNames.join("|")})(?:["']|/)`,
      "u"
    );

    expect(
      featureComponentImportPattern.test(
        'import { Example } from "@/components/glossary/example";'
      )
    ).toBe(true);
    const violations = await findImportViolations(
      files,
      featureComponentImportPattern
    );

    expect(violations).toEqual([]);
  });

  it("keeps reusable glossary autocomplete UI out of legacy component imports", async () => {
    const files = await listSourceFiles(["src/components", "tests"]);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+|vi\.mock\()["']@\/components\/glossary\/(?:glossary-autocomplete-dropdown|use-glossary-autocomplete)(?:["']|\/)/u
    );

    expect(violations).toEqual([]);
  });
});

async function listFeatureUiClientFiles() {
  const featureRoot = path.join(PROJECT_ROOT, "src", "features");
  const featureNames = await listFeatureNames();
  const files: string[] = [];

  for (const featureName of featureNames) {
    await collectSourceFiles(
      path.join(featureRoot, featureName, "ui", "client"),
      files
    );
  }

  return files
    .map((file) => path.relative(PROJECT_ROOT, file))
    .sort((left, right) => left.localeCompare(right));
}

async function listFeatureNames() {
  const entries = await readdir(path.join(PROJECT_ROOT, "src", "features"), {
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

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
  try {
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
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function findImportViolations(files: readonly string[], pattern: RegExp) {
  const violations: string[] = [];

  for (const relativePath of files) {
    const source = await readFile(path.join(PROJECT_ROOT, relativePath), "utf8");

    if (pattern.test(source)) {
      violations.push(relativePath);
    }
  }

  return violations;
}
