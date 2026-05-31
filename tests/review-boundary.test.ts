import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const productionReviewRoots = [
  "src/actions",
  "src/app/review",
  "src/app/media/[mediaSlug]/review",
  "src/components/review"
] as const;
const reviewFacadeFiles = [
  "src/features/review/types.ts",
  "src/features/review/model/index.ts",
  "src/features/review/client/index.ts",
  "src/features/review/server/index.ts"
] as const;
const pureReviewFacadeRoots = [
  "src/features/review/model",
  "src/features/review/client"
] as const;

describe("review feature boundary", () => {
  it("has no legacy review implementation files under src/lib", async () => {
    const libEntries = await listDirectoryEntries(
      path.join(PROJECT_ROOT, "src", "lib")
    );
    const legacyReviewFiles = libEntries
      .filter(
        (entry) => entry.isFile() && /^review(?:-|\.ts$)/u.test(entry.name)
      )
      .map((entry) => `src/lib/${entry.name}`)
      .sort((left, right) => left.localeCompare(right));

    expect(legacyReviewFiles).toEqual([]);
  });

  it("keeps review feature files from re-exporting legacy lib review modules", async () => {
    const files = await listSourceFiles(["src/features/review"]);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/lib\/review(?:["']|[-/])/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps production review consumers off legacy lib review modules", async () => {
    const files = await listSourceFiles(productionReviewRoots);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/lib\/review(?:["']|[-/])/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps review components away from the server facade", async () => {
    const files = await listSourceFiles(["src/components/review"]);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/features\/review\/server(?:["']|\/)/u
    );

    expect(violations).toEqual([]);
  });

  it("provides the intended review feature facade files", async () => {
    const missingOrEmpty: string[] = [];

    for (const relativePath of reviewFacadeFiles) {
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

  it("keeps review model and client facades independent from database and Next.js modules", async () => {
    const files = await listSourceFiles(pureReviewFacadeRoots);
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/db(?:["']|\/)|next(?:["']|\/))/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps ReviewSessionInput owned by the public review DTO boundary", async () => {
    const transitionSource = await readFile(
      path.join(
        PROJECT_ROOT,
        "src/features/review/server/session-transition.ts"
      ),
      "utf8"
    );

    expect(transitionSource).toContain(
      'export type { ReviewSessionInput } from "@/features/review/types";'
    );
    expect(transitionSource).not.toContain(
      "export type ReviewSessionInput = {"
    );
  });

  it("keeps review action mutations out of the grading service", async () => {
    const source = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "review",
        "server",
        "action-mutations.ts"
      ),
      "utf8"
    );

    const serviceImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/features\/review\/server\/service|\.\/service(?:\.ts)?)(?:["'])/u;

    expect(source).toContain("@/features/review/server/mutations");
    expect(source).not.toMatch(serviceImportPattern);
  });

  it("keeps review queue projection free of database, cache, and mutation details", async () => {
    const source = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "review",
        "server",
        "queue-projection.ts"
      ),
      "utf8"
    );
    const implementationImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/db(?:["'/])|@\/features\/cache(?:["'/])|@\/features\/fsrs-optimizer\/server(?:["'/])|next\/cache(?:["'/]))/u;
    const mutationCallPattern = /\.(?:transaction|insert|update|delete)\s*\(/u;
    const localContextPresenterPattern =
      /(?:function|const|let)\s+buildReviewCardContexts\b/u;

    expect(source).not.toMatch(implementationImportPattern);
    expect(source).not.toMatch(mutationCallPattern);
    expect(source).toContain('from "./card-presenters"');
    expect(source).not.toMatch(localContextPresenterPattern);
    expect(source).not.toContain("@/features/study/ui/furigana");
    expect(source).not.toContain('from "./card-hydration"');
  });

  it("keeps review card presenters free of hydration, database, cache, and mutation details", async () => {
    const source = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "review",
        "server",
        "card-presenters.ts"
      ),
      "utf8"
    );
    const implementationImportPattern =
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/db(?:["'/])|@\/features\/cache(?:["'/])|@\/features\/consolidation(?:["'/])|@\/features\/fsrs-optimizer\/server(?:["'/])|next\/cache(?:["'/])|\.\/(?:card-hydration|page-data|loader|service)(?:["'/]))/u;
    const mutationCallPattern = /\.(?:transaction|insert|update|delete)\s*\(/u;

    expect(source).not.toMatch(implementationImportPattern);
    expect(source).not.toMatch(mutationCallPattern);
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
