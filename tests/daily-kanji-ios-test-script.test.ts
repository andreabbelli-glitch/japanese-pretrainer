import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const iosRoot = path.join(repositoryRoot, "apps", "daily-kanji-ios");
const packageJsonPath = path.join(repositoryRoot, "package.json");
const testScriptPath = path.join(iosRoot, "scripts", "test.sh");

describe("daily kanji iOS test script", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("is exposed through the canonical package command", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["daily-kanji:test"]).toBe(
      "./apps/daily-kanji-ios/scripts/test.sh"
    );
  });

  it("generates the project before testing with configurable simulator settings", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-ios-test-")
    );
    const binDir = path.join(tempDir, "bin");
    const callLogPath = path.join(tempDir, "calls.log");
    const derivedDataPath = path.join(tempDir, "Derived Data");
    const markerPath = path.join(derivedDataPath, "cache-marker");

    tempDirs.push(tempDir);
    await Promise.all([
      mkdir(binDir, { recursive: true }),
      mkdir(derivedDataPath, { recursive: true })
    ]);
    await writeFile(markerPath, "keep", "utf8");
    await Promise.all([
      writeFakeCommand(binDir, "xcodegen"),
      writeFakeCommand(binDir, "xcodebuild")
    ]);

    const destination = "platform=iOS Simulator,name=iPhone Test Fixture";
    const developerDir = "/fixture/Xcode.app/Contents/Developer";
    const { stdout } = await execFileAsync(testScriptPath, [], {
      cwd: tempDir,
      env: {
        ...process.env,
        CALL_LOG: callLogPath,
        DAILY_KANJI_IOS_TEST_CONFIGURATION: "Testing",
        DAILY_KANJI_IOS_TEST_DERIVED_DATA_PATH: derivedDataPath,
        DAILY_KANJI_IOS_TEST_DESTINATION: destination,
        DEVELOPER_DIR: developerDir,
        PATH: `${binDir}:${process.env.PATH ?? ""}`
      }
    });
    const callLog = await readFile(callLogPath, "utf8");

    expect(stdout).toContain(`test destination: ${destination}`);
    expect(stdout).toContain(`DerivedData (reused): ${derivedDataPath}`);
    expect(callLog).toContain(
      `xcodegen\t${iosRoot}\t${developerDir}\tgenerate\n`
    );
    expect(callLog).toContain(
      [
        "xcodebuild",
        iosRoot,
        developerDir,
        "-project",
        path.join(iosRoot, "DailyKanji.xcodeproj"),
        "-scheme",
        "DailyKanji",
        "-configuration",
        "Testing",
        "-destination",
        destination,
        "-derivedDataPath",
        derivedDataPath,
        "test"
      ].join("\t") + "\n"
    );
    expect(callLog.indexOf("xcodegen\t")).toBeLessThan(
      callLog.indexOf("xcodebuild\t")
    );
    await expect(readFile(markerPath, "utf8")).resolves.toBe("keep");
  });

  it("defaults to the canonical simulator destination", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-ios-default-test-")
    );
    const binDir = path.join(tempDir, "bin");
    const callLogPath = path.join(tempDir, "calls.log");

    tempDirs.push(tempDir);
    await mkdir(binDir, { recursive: true });
    await Promise.all([
      writeFakeCommand(binDir, "xcodegen"),
      writeFakeCommand(binDir, "xcodebuild")
    ]);

    await execFileAsync(testScriptPath, [], {
      env: {
        ...process.env,
        CALL_LOG: callLogPath,
        DAILY_KANJI_IOS_TEST_DERIVED_DATA_PATH: path.join(
          tempDir,
          "DerivedData"
        ),
        DEVELOPER_DIR: "/fixture/Xcode.app/Contents/Developer",
        PATH: `${binDir}:${process.env.PATH ?? ""}`
      }
    });

    await expect(readFile(callLogPath, "utf8")).resolves.toContain(
      "-destination\tplatform=iOS Simulator,name=iPhone 17"
    );
  });
});

async function writeFakeCommand(binDir: string, command: string) {
  const commandPath = path.join(binDir, command);

  await writeFile(
    commandPath,
    `#!/usr/bin/env bash
set -euo pipefail

if [ "${command}" = "xcodebuild" ] && [ "\${1:-}" = "-version" ]; then
  printf "Xcode fixture\\n"
  exit 0
fi

{
  printf "%s\\t%s\\t%s" "${command}" "$PWD" "\${DEVELOPER_DIR:-}"
  for argument in "$@"; do
    printf "\\t%s" "$argument"
  done
  printf "\\n"
} >> "$CALL_LOG"
`,
    "utf8"
  );
  await chmod(commandPath, 0o755);
}
