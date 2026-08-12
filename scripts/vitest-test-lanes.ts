export const vitestTestLanes = [
  "all",
  "core",
  "real-bundle",
  "ios-ops"
] as const;

export type VitestTestLane = (typeof vitestTestLanes)[number];
export type PartitionedVitestTestLane = Exclude<VitestTestLane, "all">;

export const realBundleVitestTestFiles = [
  "tests/content-real-bundle-canary.test.ts",
  "tests/update-real-bundle-test-stats-cli.test.ts"
] as const;

export const iosOpsVitestTestFiles = [
  "tests/daily-kanji-audio-packager.test.ts",
  "tests/daily-kanji-export.test.ts",
  "tests/daily-kanji-ios-coredevice-recovery.test.ts",
  "tests/daily-kanji-ios-offline-contract.test.ts",
  "tests/daily-kanji-ios-renew-profile-state.test.ts",
  "tests/daily-kanji-ios-renew-launchd-reschedule.test.ts",
  "tests/daily-kanji-ios-renew-launchd.test.ts",
  "tests/daily-kanji-ios-resource-verifier.test.ts",
  "tests/daily-kanji-ios-test-script.test.ts"
] as const;

const allVitestTestPattern = "tests/**/*.test.ts";
const realBundleTestFileSet = new Set<string>(realBundleVitestTestFiles);
const iosOpsTestFileSet = new Set<string>(iosOpsVitestTestFiles);

export function resolveVitestTestLane(
  value = process.env.JCS_VITEST_LANE
): VitestTestLane {
  const normalized = value?.trim() || "all";

  if (vitestTestLanes.some((lane) => lane === normalized)) {
    return normalized as VitestTestLane;
  }

  throw new Error(
    `JCS_VITEST_LANE must be one of: ${vitestTestLanes.join(", ")}.`
  );
}

export function resolveVitestLaneFiles(lane: VitestTestLane) {
  switch (lane) {
    case "all":
      return {
        exclude: [] as string[],
        include: [allVitestTestPattern]
      };
    case "core":
      return {
        exclude: [
          ...realBundleVitestTestFiles,
          ...iosOpsVitestTestFiles
        ] as string[],
        include: [allVitestTestPattern]
      };
    case "real-bundle":
      return {
        exclude: [] as string[],
        include: [...realBundleVitestTestFiles]
      };
    case "ios-ops":
      return {
        exclude: [] as string[],
        include: [...iosOpsVitestTestFiles]
      };
  }
}

export function capVitestWorkersForLane(
  lane: VitestTestLane,
  requestedWorkers: number
) {
  if (lane === "real-bundle") {
    return 1;
  }

  if (lane === "ios-ops") {
    return Math.min(requestedWorkers, 2);
  }

  return requestedWorkers;
}

export function classifyVitestTestFile(
  filePath: string
): PartitionedVitestTestLane {
  const normalizedPath = normalizeTestFilePath(filePath);

  if (realBundleTestFileSet.has(normalizedPath)) {
    return "real-bundle";
  }

  if (iosOpsTestFileSet.has(normalizedPath)) {
    return "ios-ops";
  }

  return "core";
}

export function isVitestTestFileInLane(
  filePath: string,
  lane: PartitionedVitestTestLane
) {
  return classifyVitestTestFile(filePath) === lane;
}

function normalizeTestFilePath(filePath: string) {
  const normalizedPath = filePath.replaceAll("\\", "/").replace(/^\.\//u, "");
  const testsDirectoryIndex = normalizedPath.lastIndexOf("/tests/");

  return testsDirectoryIndex >= 0
    ? normalizedPath.slice(testsDirectoryIndex + 1)
    : normalizedPath;
}
