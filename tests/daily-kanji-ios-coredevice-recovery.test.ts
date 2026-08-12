import { execFile } from "node:child_process";
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

import { afterEach, describe, expect, it } from "vitest";

const iosRoot = path.join(process.cwd(), "apps", "daily-kanji-ios");
const recoveryHelperPath = path.join(
  iosRoot,
  "scripts",
  "coredevice-recovery.sh"
);
const wrapperSourcePath = path.join(
  iosRoot,
  "scripts",
  "xcode-renew-if-needed.sh"
);
const renewSourcePath = path.join(iosRoot, "scripts", "xcode-renew.sh");
const execFileAsync = promisify(execFile);

describe("Daily Kanji CoreDevice Wi-Fi tunnel recovery", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("recovers an observed RSD tunnel failure once before packaging", async () => {
    const fixture = await createWrapperFixture("recover-details", tempDirs);
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        'if [[ "$*" == *"device info details"* ]]; then',
        '  count="$(cat "$DETAILS_COUNT" 2>/dev/null || printf 0)"',
        '  count="$(( count + 1 ))"',
        '  printf "%s\\n" "$count" > "$DETAILS_COUNT"',
        '  if [ "$count" -eq 1 ]; then',
        '    echo "CoreDeviceError error 4000 (0xFA0)" >&2',
        '    echo "Failed to allocate RSD device. (com.apple.mobiledevice error -402653181 (0xE8000003))" >&2',
        "    exit 41",
        "  fi",
        "fi",
        "exit 0"
      ].join("\n") + "\n"
    );

    const result = await runWrapper(fixture);
    const calls = await readFile(fixture.callLogPath, "utf8");

    expect(result.stderr).toContain("stale CoreDevice Wi-Fi tunnel");
    expect(result.stderr).toContain("Wi-Fi tunnel recovered");
    expect(calls.match(/xcrun:devicectl device info details/g)).toHaveLength(2);
    expect(calls).toContain(
      "launchctl:kickstart -k user/777/com.apple.CoreDevice.remotepairingd"
    );
    expect(calls).toContain(
      "launchctl:kickstart -k user/777/com.apple.CoreDevice.CoreDeviceService"
    );
    expect(calls.indexOf("remotepairingd")).toBeLessThan(
      calls.indexOf("CoreDeviceService")
    );
    expect(calls).toContain("package:pnpm daily-kanji:package");
    expect(calls).toContain("renew:TEST_DEVICE:1");
  });

  it("recovers a RemotePairing timeout during DDI preflight", async () => {
    const fixture = await createWrapperFixture("recover-ddi", tempDirs);
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        'if [[ "$*" == *"device info ddiServices"* ]]; then',
        '  count="$(cat "$DDI_COUNT" 2>/dev/null || printf 0)"',
        '  count="$(( count + 1 ))"',
        '  printf "%s\\n" "$count" > "$DDI_COUNT"',
        '  if [ "$count" -eq 1 ]; then',
        '    echo "RemotePairingError error 1001 (0x3E9)" >&2',
        '    echo "Timed out while attempting to negotiate tunnel parameters" >&2',
        "    exit 43",
        "  fi",
        "fi",
        "exit 0"
      ].join("\n") + "\n"
    );

    await runWrapper(fixture);
    const calls = await readFile(fixture.callLogPath, "utf8");

    expect(calls.match(/xcrun:devicectl device info details/g)).toHaveLength(1);
    expect(
      calls.match(/xcrun:devicectl device info ddiServices/g)
    ).toHaveLength(2);
    expect(calls.match(/launchctl:kickstart/g)).toHaveLength(2);
    expect(calls).toContain("package:pnpm daily-kanji:package");
  });

  it("uses only one recovery stack and stops before packaging when retry fails", async () => {
    const fixture = await createWrapperFixture("retry-fails", tempDirs);
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        'count="$(cat "$DETAILS_COUNT" 2>/dev/null || printf 0)"',
        'count="$(( count + 1 ))"',
        'printf "%s\\n" "$count" > "$DETAILS_COUNT"',
        'echo "CoreDeviceError error 4000: Failed to allocate RSD device" >&2',
        'if [ "$count" -eq 1 ]; then exit 41; fi',
        "exit 42"
      ].join("\n") + "\n"
    );

    await expect(runWrapper(fixture)).rejects.toMatchObject({ code: 42 });
    const calls = await readFile(fixture.callLogPath, "utf8");

    expect(calls.match(/xcrun:/g)).toHaveLength(2);
    expect(calls.match(/launchctl:kickstart/g)).toHaveLength(2);
    expect(calls).not.toContain("package:");
    expect(calls).not.toContain("renew:");
  });

  it.each([
    [
      "locked mixed output",
      "kAMDMobileImageMounterDeviceLocked: The device is locked. CoreDeviceError error 4000"
    ],
    [
      "not-found mixed output",
      "CoreDeviceError error 1011: Unable to locate a device matching; Failed to allocate RSD device"
    ],
    [
      "offline mixed output",
      "device temporarily offline; CoreDeviceError error 4000"
    ],
    [
      "unpaired mixed output",
      "The device is not paired; RemotePairingError error 1001"
    ]
  ])("does not restart services for %s", async (_label, errorOutput) => {
    const fixture = await createWrapperFixture("excluded", tempDirs);
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        `printf "%s\\n" ${shellQuote(errorOutput)} >&2`,
        "exit 51"
      ].join("\n") + "\n"
    );

    await expect(runWrapper(fixture)).rejects.toMatchObject({ code: 51 });
    const calls = await readFile(fixture.callLogPath, "utf8");

    expect(calls).not.toContain("launchctl:");
    expect(calls).not.toContain("package:");
  });

  it("keeps the hourly outside-window check free of CoreDevice and recovery work", async () => {
    const fixture = await createWrapperFixture("cheap-window", tempDirs);
    await writeFile(
      path.join(fixture.stateDir, "profile-expiry.epoch"),
      `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}\n`
    );
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      '#!/usr/bin/env bash\nprintf "xcrun:%s\\n" "$*" >> "$CALL_LOG"\nexit 0\n'
    );

    const result = await runWrapper(fixture);
    expect(result.stdout).toContain("renew not due");
    await expect(readFile(fixture.callLogPath, "utf8")).rejects.toThrow(
      /ENOENT/
    );
  });

  it.each(["details", "install"])(
    "recovers the standalone %s operation without repeating the build",
    async (failureMode) => {
      const fixture = await createStandaloneFixture(
        `standalone-${failureMode}`,
        tempDirs
      );

      await execFileAsync("bash", [fixture.renewPath], {
        env: {
          ...process.env,
          CALL_LOG: fixture.callLogPath,
          CONFIG_FILE: path.join(fixture.stateDir, "renew.env"),
          COREDEVICE_LAUNCHCTL_BIN: path.join(fixture.binDir, "launchctl"),
          COREDEVICE_RECOVERY_DELAY_SECONDS: "0",
          COREDEVICE_RECOVERY_HELPER: recoveryHelperPath,
          COREDEVICE_USER_UID: "777",
          DERIVED_DATA: fixture.derivedData,
          DETAILS_COUNT: fixture.detailsCountPath,
          FAILURE_MODE: failureMode,
          INSTALL_COUNT: fixture.installCountPath,
          PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: fixture.stateDir
        }
      });

      const calls = await readFile(fixture.callLogPath, "utf8");
      expect(calls.match(/launchctl:kickstart/g)).toHaveLength(2);
      expect(calls.match(/xcodebuild:/g)).toHaveLength(1);
      expect(calls.match(/device info details/g)).toHaveLength(
        failureMode === "details" ? 2 : 1
      );
      expect(calls.match(/device install app/g)).toHaveLength(
        failureMode === "install" ? 2 : 1
      );
      expect(
        await readFile(path.join(fixture.stateDir, "profile-state.env"), "utf8")
      ).toContain("VERSION=1");
    }
  );

  it("contains no broad or privileged recovery action", async () => {
    const source = await readFile(recoveryHelperPath, "utf8");

    expect(source).toContain("com.apple.CoreDevice.remotepairingd");
    expect(source).toContain("com.apple.CoreDevice.CoreDeviceService");
    expect(source).not.toMatch(/\b(?:sudo|killall|pkill|bootout|unpair)\b/);
    expect(source).not.toContain("com.apple.remoted");
  });
});

async function createWrapperFixture(label: string, tempDirs: string[]) {
  const tempRoot = await mkdtemp(
    path.join(tmpdir(), `jcs-coredevice-${label}-`)
  );
  const repoRoot = path.join(tempRoot, "repo");
  const iosScriptsRoot = path.join(
    repoRoot,
    "apps",
    "daily-kanji-ios",
    "scripts"
  );
  const repoScriptsRoot = path.join(repoRoot, "scripts");
  const stateDir = path.join(tempRoot, "state");
  const binDir = path.join(tempRoot, "bin");
  const callLogPath = path.join(tempRoot, "calls.log");
  const wrapperPath = path.join(iosScriptsRoot, "xcode-renew-if-needed.sh");

  tempDirs.push(tempRoot);
  await mkdir(iosScriptsRoot, { recursive: true });
  await mkdir(repoScriptsRoot, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(path.join(stateDir, "renew.env"), "DEVICE_ID=TEST_DEVICE\n");
  await writeFile(
    path.join(stateDir, "profile-expiry.epoch"),
    `${Math.floor(Date.now() / 1000) - 60}\n`
  );
  await writeFile(wrapperPath, await readFile(wrapperSourcePath, "utf8"));
  await chmod(wrapperPath, 0o755);
  await writeExecutable(
    path.join(binDir, "launchctl"),
    '#!/usr/bin/env bash\nprintf "launchctl:%s\\n" "$*" >> "$CALL_LOG"\nexit 0\n'
  );
  await writeExecutable(
    path.join(repoScriptsRoot, "with-node.sh"),
    '#!/usr/bin/env bash\nprintf "package:%s\\n" "$*" >> "$CALL_LOG"\nexit 0\n'
  );
  await writeExecutable(
    path.join(iosScriptsRoot, "xcode-renew.sh"),
    [
      "#!/usr/bin/env bash",
      'printf "renew:%s:%s\\n" "${DEVICE_ID:-}" "${DAILY_KANJI_COREDEVICE_RECOVERY_USED:-}" >> "$CALL_LOG"',
      'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
    ].join("\n") + "\n"
  );

  return {
    binDir,
    callLogPath,
    detailsCountPath: path.join(tempRoot, "details-count"),
    ddiCountPath: path.join(tempRoot, "ddi-count"),
    stateDir,
    wrapperPath
  };
}

async function runWrapper(
  fixture: Awaited<ReturnType<typeof createWrapperFixture>>
) {
  return execFileAsync("bash", [fixture.wrapperPath], {
    cwd: "/",
    env: {
      ...process.env,
      CALL_LOG: fixture.callLogPath,
      COREDEVICE_LAUNCHCTL_BIN: path.join(fixture.binDir, "launchctl"),
      COREDEVICE_RECOVERY_DELAY_SECONDS: "0",
      COREDEVICE_RECOVERY_HELPER: recoveryHelperPath,
      COREDEVICE_USER_UID: "777",
      DDI_COUNT: fixture.ddiCountPath,
      DETAILS_COUNT: fixture.detailsCountPath,
      PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
      STATE_DIR: fixture.stateDir
    }
  });
}

async function createStandaloneFixture(label: string, tempDirs: string[]) {
  const tempRoot = await mkdtemp(
    path.join(tmpdir(), `jcs-coredevice-${label}-`)
  );
  const repoRoot = path.join(tempRoot, "repo");
  const iosScriptsRoot = path.join(
    repoRoot,
    "apps",
    "daily-kanji-ios",
    "scripts"
  );
  const repoScriptsRoot = path.join(repoRoot, "scripts");
  const stateDir = path.join(tempRoot, "state");
  const binDir = path.join(tempRoot, "bin");
  const derivedData = path.join(tempRoot, "DerivedData");
  const callLogPath = path.join(tempRoot, "calls.log");
  const renewPath = path.join(iosScriptsRoot, "xcode-renew.sh");

  tempDirs.push(tempRoot);
  await mkdir(iosScriptsRoot, { recursive: true });
  await mkdir(repoScriptsRoot, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(path.join(stateDir, "renew.env"), "DEVICE_ID=TEST_DEVICE\n");
  await writeFile(renewPath, await readFile(renewSourcePath, "utf8"));
  await chmod(renewPath, 0o755);
  await writeExecutable(
    path.join(repoScriptsRoot, "with-node.sh"),
    "#!/usr/bin/env bash\nexit 0\n"
  );
  await writeExecutable(
    path.join(binDir, "xcodegen"),
    "#!/usr/bin/env bash\nexit 0\n"
  );
  await writeExecutable(
    path.join(binDir, "launchctl"),
    '#!/usr/bin/env bash\nprintf "launchctl:%s\\n" "$*" >> "$CALL_LOG"\nexit 0\n'
  );
  await writeExecutable(
    path.join(binDir, "xcrun"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
      'case "$*" in',
      '  *"device info details"*)',
      '    count="$(cat "$DETAILS_COUNT" 2>/dev/null || printf 0)"',
      '    count="$(( count + 1 ))"; printf "%s\\n" "$count" > "$DETAILS_COUNT"',
      '    if [ "$FAILURE_MODE" = details ] && [ "$count" -eq 1 ]; then',
      '      echo "CoreDeviceError error 4000: Failed to allocate RSD device" >&2; exit 41',
      "    fi",
      '    printf "    • transportType: localNetwork\\n"; exit 0',
      "    ;;",
      '  *"device info ddiServices"*) exit 0 ;;',
      '  *"device install app"*)',
      '    count="$(cat "$INSTALL_COUNT" 2>/dev/null || printf 0)"',
      '    count="$(( count + 1 ))"; printf "%s\\n" "$count" > "$INSTALL_COUNT"',
      '    if [ "$FAILURE_MODE" = install ] && [ "$count" -eq 1 ]; then',
      '      echo "RemotePairingError error 1001: Timed out while attempting to negotiate tunnel parameters" >&2; exit 43',
      "    fi",
      "    exit 0",
      "    ;;",
      "esac",
      "exit 1"
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "xcodebuild"),
    [
      "#!/usr/bin/env bash",
      'printf "xcodebuild:%s\\n" "$*" >> "$CALL_LOG"',
      'app="$DERIVED_DATA/Build/Products/Release-iphoneos/Daily Kanji.app"',
      'mkdir -p "$app/PlugIns/Daily Kanji Widget.appex"',
      'touch "$app/embedded.mobileprovision"',
      'touch "$app/PlugIns/Daily Kanji Widget.appex/embedded.mobileprovision"'
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "security"),
    [
      "#!/usr/bin/env bash",
      'input=""',
      'while [ "$#" -gt 0 ]; do if [ "$1" = -i ]; then shift; input="${1:-}"; fi; shift || true; done',
      'uuid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"',
      'case "$input" in *.appex/embedded.mobileprovision) uuid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" ;; esac',
      "cat <<PLIST",
      '<plist version="1.0"><dict>',
      "<key>ExpirationDate</key><date>2026-12-10T08:00:00Z</date>",
      "<key>UUID</key><string>$uuid</string>",
      "</dict></plist>",
      "PLIST"
    ].join("\n") + "\n"
  );

  return {
    binDir,
    callLogPath,
    derivedData,
    detailsCountPath: path.join(tempRoot, "details-count"),
    installCountPath: path.join(tempRoot, "install-count"),
    renewPath,
    stateDir
  };
}

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents);
  await chmod(filePath, 0o755);
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
