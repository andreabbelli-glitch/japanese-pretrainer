import { describe, expect, it } from "vitest";

import {
  buildVitestProfile,
  formatVitestProfileSummary,
  type VitestProfileFileInput
} from "../scripts/vitest-profile-reporter";

describe("Vitest profile reporter", () => {
  it("sorts files by worker time and aggregates test states", () => {
    const profile = buildVitestProfile(
      [
        makeFile("tests/fast.test.ts", 10, [
          { durationMs: 7, name: "fast suite > passes", state: "passed" }
        ]),
        makeFile("tests/slow.test.ts", 200, [
          { durationMs: 150, name: "slow suite > fails", state: "failed" },
          { durationMs: 25, name: "slow suite > skips", state: "skipped" }
        ])
      ],
      {
        generatedAt: "2026-08-12T10:00:00.000Z",
        reason: "failed",
        settings: {
          isolate: true,
          maxWorkers: 4
        },
        unhandledErrors: 1,
        wallMs: 180.126
      }
    );

    expect(profile.files.map((file) => file.file)).toEqual([
      "tests/slow.test.ts",
      "tests/fast.test.ts"
    ]);
    expect(profile.tests).toEqual({
      failed: 1,
      passed: 1,
      pending: 0,
      skipped: 1,
      total: 3
    });
    expect(profile.totalWorkerMs).toBe(260);
    expect(profile.wallMs).toBe(180.13);
  });

  it("formats a readable hotspot summary", () => {
    const profile = buildVitestProfile(
      [
        makeFile("tests/profile.test.ts", 1_250, [
          {
            durationMs: 1_100,
            name: "profile suite > records a slow test",
            state: "passed"
          }
        ])
      ],
      {
        generatedAt: "2026-08-12T10:00:00.000Z",
        reason: "passed",
        settings: {
          isolate: true,
          maxWorkers: 4
        },
        unhandledErrors: 0,
        wallMs: 900
      }
    );

    expect(formatVitestProfileSummary(profile)).toContain(
      "Wall: 900ms | Accumulated worker time: 1.27s | Workers: 4"
    );
    expect(formatVitestProfileSummary(profile)).toContain(
      "1. 1.27s tests/profile.test.ts"
    );
    expect(formatVitestProfileSummary(profile)).toContain(
      "1. 1.10s tests/profile.test.ts > profile suite > records a slow test"
    );
  });
});

function makeFile(
  file: string,
  testsAndHooksMs: number,
  tests: VitestProfileFileInput["tests"]
): VitestProfileFileInput {
  return {
    file,
    phases: {
      collectMs: 20,
      environmentSetupMs: 0,
      prepareMs: 5,
      setupMs: 0,
      testsAndHooksMs
    },
    tests
  };
}
