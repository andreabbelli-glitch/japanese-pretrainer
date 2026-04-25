import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const disallowedInstrumentationTerms = [
  "@/lib/review",
  "@/db",
  "@/lib/pronunciation",
  "Forvo",
  "forvo",
  "playwright"
] as const;

describe("instrumentation boundary", () => {
  it("keeps the root instrumentation entrypoint free of app runtime imports", async () => {
    const source = await readFile(
      path.join(PROJECT_ROOT, "src/instrumentation.ts"),
      "utf8"
    );

    for (const term of disallowedInstrumentationTerms) {
      expect(source).not.toContain(term);
    }
  });
});
