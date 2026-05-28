import { describe, expect, it } from "vitest";

import {
  contentsMatchByteForByte,
  findMissingSkillVerificationSections,
  findProtectedPathChanges,
  hasExactVerificationHeading,
  trackedDiffArgs
} from "../scripts/agent-check";

describe("agent check helpers", () => {
  it("requires an exact second-level Verification heading in repo skills", () => {
    expect(hasExactVerificationHeading("# Skill\n\n## Verification\n")).toBe(
      true
    );
    expect(hasExactVerificationHeading("# Skill\n\n### Verification\n")).toBe(
      false
    );
    expect(
      hasExactVerificationHeading("# Skill\n\n## Verification commands\n")
    ).toBe(false);
  });

  it("reports every repo-scoped skill that is missing Verification", () => {
    const missing = findMissingSkillVerificationSections([
      {
        path: ".agents/skills/ready/SKILL.md",
        source: "# Ready\n\n## Verification\n"
      },
      {
        path: ".agents/skills/missing/SKILL.md",
        source: "# Missing\n\n## Workflow\n"
      }
    ]);

    expect(missing).toEqual([".agents/skills/missing/SKILL.md"]);
  });

  it("finds changed protected paths from tracked and untracked file lists", () => {
    const protectedPaths = findProtectedPathChanges([
      "src/app/page.tsx",
      "content/media/demo/textbook/001-intro.md",
      "content/media/demo/workflow/image-requests.yaml",
      "drizzle/0001_snapshot.sql",
      "docs/dev-tooling.md"
    ]);

    expect(protectedPaths).toEqual([
      "content/media/demo/textbook/001-intro.md",
      "content/media/demo/workflow/image-requests.yaml",
      "drizzle/0001_snapshot.sql"
    ]);
  });

  it("uses a tracked diff filter that includes protected deletions", () => {
    expect(trackedDiffArgs).toContain("--diff-filter=ACDMRTUXB");
  });

  it("normalizes git path separators before protected-path matching", () => {
    expect(findProtectedPathChanges(["content\\media\\demo\\media.md"])).toEqual(
      ["content/media/demo/media.md"]
    );
  });

  it("compares mirrored documentation byte-for-byte", () => {
    expect(contentsMatchByteForByte("same\n", "same\n")).toBe(true);
    expect(contentsMatchByteForByte("same\n", "same")).toBe(false);
  });
});
