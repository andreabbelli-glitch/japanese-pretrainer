import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const FEATURE_ROOT = path.join(PROJECT_ROOT, "src", "features");

describe("feature layer boundary", () => {
  it("keeps model, client, and top-level feature types off server, DB, and Next imports", async () => {
    const files = await listFeatureLayerFiles();
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+|export\s+type\s+[^;]*?\s+from\s+)["'](?:@\/db(?:["'/])|(?:\.\.\/)+(?:\.\.\/)*db(?:["'/])|drizzle-orm(?:["'/])|next\/|node:|@\/features\/[^"']+\/(?:server|tooling|ui)(?:["'/]))/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps production feature runtime modules off feature tooling imports", async () => {
    const files = await listFeatureRuntimeFiles();
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/features\/[^"']+\/tooling(?:["'/])|(?:\.\.\/)+(?:[^"']+\/)*tooling(?:["'/]))/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps feature root barrels from re-exporting server or tooling modules", async () => {
    const files = (await listSourceFiles(FEATURE_ROOT)).filter((file) =>
      /^src\/features\/[^/]+\/index\.ts$/u.test(normalizeGitPath(file))
    );
    const violations = await findImportViolations(
      files,
      /(?:from\s+|export\s+\*\s+from\s+|export\s+type\s+\*\s+from\s+)["']\.\/(?:server|tooling)(?:["'/])/u
    );

    expect(violations).toEqual([]);
  });
});

async function listFeatureLayerFiles() {
  const files = await listSourceFiles(FEATURE_ROOT);

  return files.filter((file) => {
    const normalized = normalizeGitPath(file);

    return (
      /^src\/features\/[^/]+\/types\.ts$/u.test(normalized) ||
      /\/model\//u.test(normalized) ||
      /\/client\//u.test(normalized)
    );
  });
}

async function listFeatureRuntimeFiles() {
  const files = await listSourceFiles(FEATURE_ROOT);

  return files.filter(
    (file) => !/\/(?:testing|tooling)\//u.test(normalizeGitPath(file))
  );
}

async function findImportViolations(files: string[], pattern: RegExp) {
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

  return violations.sort((left, right) => left.localeCompare(right));
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

function normalizeGitPath(candidate: string) {
  return candidate.replaceAll("\\", "/");
}
