import { access } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const legacyPitchAccentFiles = [
  "src/lib/pitch-accent.ts",
  "src/lib/pitch-accent-fetch.ts",
  "src/lib/pitch-accent-local-sources.ts"
] as const;

describe("pitch accent feature boundary", () => {
  it("has no legacy Pitch Accent modules under src/lib", async () => {
    const existing: string[] = [];

    for (const relativePath of legacyPitchAccentFiles) {
      try {
        await access(path.join(PROJECT_ROOT, relativePath));
        existing.push(relativePath);
      } catch {
        // Missing is the expected state.
      }
    }

    expect(existing).toEqual([]);
  });
});
