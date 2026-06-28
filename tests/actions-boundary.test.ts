import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const execFileAsync = promisify(execFile);

describe("server action boundary", () => {
  it("keeps src/actions free of direct database imports", async () => {
    const files = await listActionFiles();
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["'](?:@\/db(?:["']|\/)|drizzle-orm(?:["']|\/))/u
    );

    expect(violations).toEqual([]);
  });

  it("keeps src/actions on feature server barrels instead of feature internals", async () => {
    const files = await listActionFiles();
    const violations = await findImportViolations(
      files,
      /(?:from\s+|import\s*\(|import\s+type\s+[^;]*?\s+from\s+)["']@\/features\/[^"']+\/(?:client|model|server\/[^"']+|tooling|ui)(?:["']|\/)/u
    );

    expect(violations).toEqual([]);
  });

  it.each(["src/actions/review.ts", "src/actions/textbook.ts"])(
    "%s keeps the final ESLint server action import boundary",
    async (relativePath) => {
      const finalRule = await readFinalNoRestrictedImportsRule(relativePath);

      expect(JSON.stringify(finalRule)).toContain(
        "Server actions must not import database modules"
      );
    },
    90_000
  );
});

async function listActionFiles() {
  const directory = path.join(PROJECT_ROOT, "src", "actions");
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /\.ts$/u.test(entry.name))
    .map((entry) => path.join("src", "actions", entry.name))
    .sort((left, right) => left.localeCompare(right));
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

async function readFinalNoRestrictedImportsRule(relativePath: string) {
  const { stdout } = await execFileAsync(
    "node",
    ["./node_modules/eslint/bin/eslint.js", "--print-config", relativePath],
    {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024
    }
  );
  const config = JSON.parse(stdout) as {
    rules?: Record<string, unknown>;
  };

  return config.rules?.["no-restricted-imports"];
}
