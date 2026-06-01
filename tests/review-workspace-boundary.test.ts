import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("review workspace server boundary", () => {
  it("keeps common workspace completion in the shared core module", async () => {
    const violations: string[] = [];
    const workspaceCorePath = path.join(
      PROJECT_ROOT,
      "src",
      "features",
      "review",
      "server",
      "workspace-core.ts"
    );
    const loaderSource = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "review",
        "server",
        "loader.ts"
      ),
      "utf8"
    );
    const overviewLoaderSource = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "review",
        "server",
        "overview-loader.ts"
      ),
      "utf8"
    );

    if (!(await fileExists(workspaceCorePath))) {
      violations.push("missing review workspace core module");
    }

    for (const [filename, source] of [
      ["loader.ts", loaderSource],
      ["overview-loader.ts", overviewLoaderSource]
    ] as const) {
      if (!source.includes("resolveLoadedReviewWorkspaceCore")) {
        violations.push(`${filename} does not use the shared workspace core`);
      }

      if (
        /const\s+subjectGroupsPromise\s*=\s*stableWorkspacePromise\.then/u.test(
          source
        )
      ) {
        violations.push(`${filename} still resolves subject groups inline`);
      }
    }

    if (overviewLoaderSource.includes('from "./loader"')) {
      violations.push("overview-loader.ts still depends on loader.ts");
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
