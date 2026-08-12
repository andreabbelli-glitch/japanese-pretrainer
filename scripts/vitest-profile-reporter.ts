import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Reporter, TestModule, Vitest } from "vitest/node";

const defaultOutputPath = ".tmp/test-profile/vitest-profile.json";
const summaryLimit = 15;

export type ProfileTestState = "failed" | "passed" | "pending" | "skipped";

export type VitestProfileTest = {
  durationMs: number;
  name: string;
  state: ProfileTestState;
};

export type VitestProfilePhases = {
  collectMs: number;
  environmentSetupMs: number;
  prepareMs: number;
  setupMs: number;
  testsAndHooksMs: number;
};

export type VitestProfileFileInput = {
  file: string;
  phases: VitestProfilePhases;
  tests: VitestProfileTest[];
};

export type VitestProfileFile = VitestProfileFileInput & {
  totalWorkerMs: number;
};

export type VitestProfile = {
  files: VitestProfileFile[];
  generatedAt: string;
  reason: "failed" | "interrupted" | "passed";
  schemaVersion: 1;
  settings: {
    isolate: boolean;
    maxWorkers: number | string;
  };
  tests: {
    failed: number;
    passed: number;
    pending: number;
    skipped: number;
    total: number;
  };
  totalWorkerMs: number;
  unhandledErrors: number;
  wallMs: number;
};

type BuildVitestProfileOptions = Pick<
  VitestProfile,
  "generatedAt" | "reason" | "settings" | "unhandledErrors" | "wallMs"
>;

export function buildVitestProfile(
  fileInputs: VitestProfileFileInput[],
  options: BuildVitestProfileOptions
): VitestProfile {
  const files = fileInputs
    .map((file) => ({
      ...file,
      totalWorkerMs: sumPhaseDurations(file.phases)
    }))
    .sort(
      (left, right) =>
        right.totalWorkerMs - left.totalWorkerMs ||
        left.file.localeCompare(right.file)
    );
  const tests = files.flatMap((file) => file.tests);

  return {
    files,
    generatedAt: options.generatedAt,
    reason: options.reason,
    schemaVersion: 1,
    settings: options.settings,
    tests: {
      failed: countTestsWithState(tests, "failed"),
      passed: countTestsWithState(tests, "passed"),
      pending: countTestsWithState(tests, "pending"),
      skipped: countTestsWithState(tests, "skipped"),
      total: tests.length
    },
    totalWorkerMs: roundMilliseconds(
      files.reduce((total, file) => total + file.totalWorkerMs, 0)
    ),
    unhandledErrors: options.unhandledErrors,
    wallMs: roundMilliseconds(options.wallMs)
  };
}

export function formatVitestProfileSummary(
  profile: VitestProfile,
  limit = summaryLimit
) {
  const slowTests = profile.files
    .flatMap((file) =>
      file.tests.map((test) => ({
        ...test,
        file: file.file
      }))
    )
    .sort(
      (left, right) =>
        right.durationMs - left.durationMs ||
        left.name.localeCompare(right.name)
    )
    .slice(0, limit);
  const lines = [
    "Vitest profile",
    `  Files: ${profile.files.length} | Tests: ${profile.tests.total} (${profile.tests.passed} passed, ${profile.tests.failed} failed, ${profile.tests.skipped} skipped, ${profile.tests.pending} pending)`,
    `  Wall: ${formatDuration(profile.wallMs)} | Accumulated worker time: ${formatDuration(profile.totalWorkerMs)} | Workers: ${profile.settings.maxWorkers}`,
    "  Slowest files by accumulated worker time:"
  ];

  for (const [index, file] of profile.files.slice(0, limit).entries()) {
    lines.push(
      `    ${index + 1}. ${formatDuration(file.totalWorkerMs)} ${file.file} ` +
        `(tests/hooks ${formatDuration(file.phases.testsAndHooksMs)}, collect ${formatDuration(file.phases.collectMs)})`
    );
  }

  lines.push("  Slowest individual tests:");

  for (const [index, test] of slowTests.entries()) {
    lines.push(
      `    ${index + 1}. ${formatDuration(test.durationMs)} ${test.file} > ${test.name}`
    );
  }

  return lines.join("\n");
}

class VitestProfileReporter implements Reporter {
  private startedAt = performance.now();
  private vitest: Vitest | undefined;

  onInit(vitest: Vitest) {
    this.vitest = vitest;
  }

  onTestRunStart() {
    this.startedAt = performance.now();
  }

  async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<unknown>,
    reason: VitestProfile["reason"]
  ) {
    const vitest = this.vitest;

    if (!vitest) {
      throw new Error("Vitest profile reporter was not initialized.");
    }

    const profile = buildVitestProfile(testModules.map(toProfileFile), {
      generatedAt: new Date().toISOString(),
      reason,
      settings: {
        isolate: vitest.config.isolate,
        maxWorkers: vitest.config.maxWorkers
      },
      unhandledErrors: unhandledErrors.length,
      wallMs: performance.now() - this.startedAt
    });
    const outputPath = resolveOutputPath();

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(profile, null, 2)}\n`,
      "utf8"
    );

    vitest.logger.log(`\n${formatVitestProfileSummary(profile)}`);
    vitest.logger.log(`  JSON: ${displayOutputPath(outputPath)}`);
  }
}

function toProfileFile(testModule: TestModule): VitestProfileFileInput {
  const diagnostic = testModule.diagnostic();
  const tests = [...testModule.children.allTests()].map((test) => ({
    durationMs: roundMilliseconds(test.diagnostic()?.duration ?? 0),
    name: test.fullName,
    state: test.result().state
  }));

  return {
    file: testModule.relativeModuleId,
    phases: {
      collectMs: roundMilliseconds(diagnostic.collectDuration),
      environmentSetupMs: roundMilliseconds(
        diagnostic.environmentSetupDuration
      ),
      prepareMs: roundMilliseconds(diagnostic.prepareDuration),
      setupMs: roundMilliseconds(diagnostic.setupDuration),
      testsAndHooksMs: roundMilliseconds(diagnostic.duration)
    },
    tests
  };
}

function resolveOutputPath() {
  const configured = process.env.VITEST_PROFILE_OUTPUT?.trim();

  return path.resolve(process.cwd(), configured || defaultOutputPath);
}

function displayOutputPath(outputPath: string) {
  const relativePath = path.relative(process.cwd(), outputPath);

  return relativePath.startsWith("..") ? outputPath : relativePath;
}

function countTestsWithState(
  tests: VitestProfileTest[],
  state: ProfileTestState
) {
  return tests.filter((test) => test.state === state).length;
}

function sumPhaseDurations(phases: VitestProfilePhases) {
  return roundMilliseconds(
    phases.collectMs +
      phases.environmentSetupMs +
      phases.prepareMs +
      phases.setupMs +
      phases.testsAndHooksMs
  );
}

function roundMilliseconds(duration: number) {
  return Math.round(duration * 100) / 100;
}

function formatDuration(durationMs: number) {
  if (durationMs >= 1_000) {
    return `${(durationMs / 1_000).toFixed(2)}s`;
  }

  return `${Math.round(durationMs)}ms`;
}

export default VitestProfileReporter;
