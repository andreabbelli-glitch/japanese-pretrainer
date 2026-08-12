import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  capVitestWorkersForLane,
  classifyVitestTestFile,
  iosOpsVitestTestFiles,
  isVitestTestFileInLane,
  realBundleVitestTestFiles,
  resolveVitestLaneFiles,
  resolveVitestTestLane,
  type PartitionedVitestTestLane
} from "../scripts/vitest-test-lanes";

const partitionedLanes: PartitionedVitestTestLane[] = [
  "core",
  "real-bundle",
  "ios-ops"
];

describe("Vitest test lanes", () => {
  it("assigns every Vitest file to exactly one disjoint lane", async () => {
    const testFiles = (
      await readdir(path.resolve("tests"), { recursive: true })
    )
      .filter((filePath) => filePath.endsWith(".test.ts"))
      .map((filePath) => `tests/${filePath.replaceAll("\\", "/")}`)
      .sort();
    const explicitlyRoutedFiles = [
      ...realBundleVitestTestFiles,
      ...iosOpsVitestTestFiles
    ].sort();

    expect(testFiles.length).toBeGreaterThan(250);
    expect(new Set(explicitlyRoutedFiles).size).toBe(
      explicitlyRoutedFiles.length
    );
    expect(
      explicitlyRoutedFiles.filter((filePath) => !testFiles.includes(filePath))
    ).toEqual([]);

    for (const filePath of testFiles) {
      const matchingLanes = partitionedLanes.filter((lane) =>
        isVitestTestFileInLane(filePath, lane)
      );

      expect(matchingLanes, filePath).toEqual([
        classifyVitestTestFile(filePath)
      ]);
    }
  });

  it("routes the specialized lanes through explicit file lists", () => {
    expect(resolveVitestLaneFiles("real-bundle").include).toEqual(
      realBundleVitestTestFiles
    );
    expect(resolveVitestLaneFiles("ios-ops").include).toEqual(
      iosOpsVitestTestFiles
    );
    expect(resolveVitestLaneFiles("core").exclude.sort()).toEqual(
      [...realBundleVitestTestFiles, ...iosOpsVitestTestFiles].sort()
    );
  });

  it("caps resource-heavy lanes while preserving lower worker overrides", () => {
    expect(capVitestWorkersForLane("core", 4)).toBe(4);
    expect(capVitestWorkersForLane("all", 4)).toBe(4);
    expect(capVitestWorkersForLane("ios-ops", 4)).toBe(2);
    expect(capVitestWorkersForLane("ios-ops", 1)).toBe(1);
    expect(capVitestWorkersForLane("real-bundle", 4)).toBe(1);
  });

  it("keeps complete gates pinned to all while exposing each partial lane", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve("package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      test: expect.stringContaining("JCS_VITEST_LANE=all"),
      "test:all": expect.stringContaining("JCS_VITEST_LANE=all"),
      "test:coverage": expect.stringMatching(
        /JCS_VITEST_LANE=all.*vitest\.mjs run --coverage/u
      ),
      "test:fast": expect.stringContaining("JCS_VITEST_LANE=core"),
      "test:ios-ops": expect.stringContaining("JCS_VITEST_LANE=ios-ops"),
      "test:profile": expect.stringContaining("JCS_VITEST_LANE=all"),
      "test:real-bundle": expect.stringContaining(
        "JCS_VITEST_LANE=real-bundle"
      ),
      "test:watch": expect.stringContaining("JCS_VITEST_LANE=all")
    });
  });

  it("rejects unknown lane names", () => {
    expect(() => resolveVitestTestLane("slow-misc")).toThrow(
      "JCS_VITEST_LANE must be one of"
    );
  });
});
