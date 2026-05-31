import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const legacySettingsFsrsModules = [
  "settings.ts",
  "fsrs-optimizer.ts",
  "fsrs-optimizer-trainer.ts"
] as const;

describe("settings and FSRS optimizer feature boundary", () => {
  it("has no settings or FSRS optimizer implementation modules under src/lib", async () => {
    const existingLegacyModules: string[] = [];

    for (const filename of legacySettingsFsrsModules) {
      const relativePath = path.join("src", "lib", filename);

      if (await fileExists(path.join(PROJECT_ROOT, relativePath))) {
        existingLegacyModules.push(relativePath);
      }
    }

    expect(existingLegacyModules).toEqual([]);
  });

  it("keeps source and script consumers off legacy lib settings and FSRS modules", async () => {
    const files = [
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "src"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "scripts"))),
      ...(await listSourceFiles(path.join(PROJECT_ROOT, "tests")))
    ];
    const legacyImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/lib\/(?:settings|fsrs-optimizer|fsrs-optimizer-trainer)|(?:\.\.\/)+(?:src\/)?lib\/(?:settings|fsrs-optimizer|fsrs-optimizer-trainer)(?:\.ts)?)["']/u;
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

  it("keeps the FSRS seed snapshot model free of server, database, and cache details", async () => {
    const source = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "fsrs-optimizer",
        "model",
        "snapshot.ts"
      ),
      "utf8"
    );
    const implementationImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/db(?:["'/])|@\/features\/cache(?:["'/])|@\/features\/fsrs-optimizer\/server(?:["'/])|next\/cache(?:["'/])|node:(?:fs|path)(?:["'/]))/u;

    expect(source).not.toMatch(implementationImportPattern);
  });

  it("centralizes user setting persistence in the database query layer", async () => {
    const sharedHelperPath = path.join(
      PROJECT_ROOT,
      "src",
      "db",
      "queries",
      "user-settings.ts"
    );
    const violations: string[] = [];

    if (!(await fileExists(sharedHelperPath))) {
      violations.push("missing src/db/queries/user-settings.ts");
    }

    for (const relativePath of [
      "src/features/settings/server/index.ts",
      "src/features/fsrs-optimizer/server/index.ts"
    ]) {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      if (/\buserSetting\b/u.test(source)) {
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
