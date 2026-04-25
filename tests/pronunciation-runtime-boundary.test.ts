import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const runtimePronunciationConsumers = [
  "src/lib/review-card-hydration.ts",
  "src/lib/textbook-tooltips.ts",
  "src/features/glossary/model/format.ts",
  "src/lib/review-types.ts",
  "src/features/glossary/types.ts",
  "src/features/textbook/types.ts",
  "src/components/ui/pronunciation-audio.tsx"
] as const;

const workflowOnlyTerms = [
  "Forvo",
  "forvo",
  "playwright",
  "node:fs",
  "node:path",
  "pronunciation-workflow",
  "pronunciation-reuse",
  "pronunciation-fetch"
] as const;

describe("pronunciation runtime boundary", () => {
  it.each(runtimePronunciationConsumers)(
    "%s imports the runtime-only pronunciation data module",
    async (relativePath) => {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      expect(source).not.toMatch(
        /from\s+["'](?:@\/lib\/pronunciation|\.\/pronunciation)["']/u
      );
    }
  );

  it("keeps pronunciation-data free of workflow and Node-only dependencies", async () => {
    const source = await readFile(
      path.join(PROJECT_ROOT, "src/lib/pronunciation-data.ts"),
      "utf8"
    );

    for (const term of workflowOnlyTerms) {
      expect(source).not.toContain(term);
    }
  });
});
