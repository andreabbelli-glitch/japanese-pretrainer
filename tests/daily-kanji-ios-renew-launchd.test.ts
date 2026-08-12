import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const iosRoot = path.join(process.cwd(), "apps", "daily-kanji-ios");
const renewIfNeededScriptPath = path.join(
  iosRoot,
  "scripts",
  "xcode-renew-if-needed.sh"
);
const renewScriptPath = path.join(iosRoot, "scripts", "xcode-renew.sh");
const installLaunchdScriptPath = path.join(
  iosRoot,
  "scripts",
  "install-renew-launchd.sh"
);
const iosAgentDocsPath = path.join(iosRoot, "AGENTS.md");
const coredeviceRecoveryScriptPath = path.join(
  iosRoot,
  "scripts",
  "coredevice-recovery.sh"
);
const execFileAsync = promisify(execFile);
const originalCoredeviceRecoveryHelper = process.env.COREDEVICE_RECOVERY_HELPER;

beforeAll(() => {
  process.env.COREDEVICE_RECOVERY_HELPER = coredeviceRecoveryScriptPath;
});

afterAll(() => {
  if (originalCoredeviceRecoveryHelper === undefined) {
    delete process.env.COREDEVICE_RECOVERY_HELPER;
  } else {
    process.env.COREDEVICE_RECOVERY_HELPER = originalCoredeviceRecoveryHelper;
  }
});

describe("Daily Kanji iOS launchd renew automation", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("keeps the scheduled renew check cheap until a renewal is actually due", async () => {
    const source = await readFile(renewIfNeededScriptPath, "utf8");

    expect(source).toContain(
      'RENEW_BEFORE_EXPIRY_SECONDS="${RENEW_BEFORE_EXPIRY_SECONDS:-172800}"'
    );
    expect(source).toContain(
      'RENEW_CHECK_INTERVAL_SECONDS="${RENEW_CHECK_INTERVAL_SECONDS:-3600}"'
    );
    expect(source).toContain(
      'LOCK_MAX_AGE_SECONDS="${LOCK_MAX_AGE_SECONDS:-21600}"'
    );
    expect(source).toContain(
      'CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"'
    );
    expect(source).toContain('mkdir "$LOCK_DIR"');
    expect(source).toContain("should_renew");
    expect(source).toContain("lock_owner_active");
    expect(source).toContain("recover_stale_lock_if_needed");
    expect(source).toContain("validate_refreshed_expiry");
    expect(source).toContain("refusing false success");
    expect(source).toContain("launchd will retry at the next interval");
    expect(source).not.toContain("xcodebuild");
    expect(source).not.toContain("reschedule_launchd");
    expect(source).not.toContain("DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD");
    expect(source).not.toContain("D584E119");
  });

  it("installs a persistent low-priority user LaunchAgent", async () => {
    const source = await readFile(installLaunchdScriptPath, "utf8");

    expect(source).toContain("dev.local.daily-kanji.renew");
    expect(source).toContain("<key>StartInterval</key>");
    expect(source).toContain(
      "<integer>$RENEW_CHECK_INTERVAL_SECONDS</integer>"
    );
    expect(source).toContain("<key>RunAtLoad</key>");
    expect(source).toContain("PROFILE_EXPIRY_FILE");
    expect(source).toContain("PROFILE_STATE_FILE");
    expect(source).toContain("PROFILE_CACHE_DIR");
    expect(source).toContain("RENEW_BEFORE_EXPIRY_SECONDS");
    expect(source).toContain("RENEW_CHECK_INTERVAL_SECONDS");
    expect(source).toContain("--reschedule-only");
    expect(source).not.toContain("<key>StartCalendarInterval</key>");
    expect(source).not.toContain("DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD");
    expect(source).toContain("--device-id");
    expect(source).toContain(
      'CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"'
    );
    expect(source).toContain("DEVICE_ID is required for install");
    expect(source).toContain("write_config_value DEVICE_ID");
    expect(source).toContain("<key>LowPriorityIO</key>");
    expect(source).toContain("<key>ProcessType</key>");
    expect(source).toContain("<string>Background</string>");
    expect(source).toContain("<key>Nice</key>");
    expect(source).toContain("<string>Release</string>");
    expect(source.indexOf('launchctl enable "$service_target"')).toBeLessThan(
      source.indexOf('launchctl bootstrap "$domain" "$PLIST"')
    );
    expect(source).toContain("launchctl bootstrap");
    expect(source).not.toContain("D584E119");
  });

  it("writes the configured persistent interval independently of the recorded expiry", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-calendar-")
    );
    tempDirs.push(tempRoot);
    const homeDir = path.join(tempRoot, "home");
    const stateDir = path.join(tempRoot, "state");
    const logDir = path.join(tempRoot, "logs");
    const binDir = path.join(tempRoot, "bin");
    const expiryEpoch = Math.floor(Date.now() / 1000) + 6 * 24 * 60 * 60 + 31;
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "profile-expiry.epoch"),
      `${expiryEpoch}\n`
    );
    await writeExecutable(
      path.join(binDir, "launchctl"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "plutil"),
      "#!/usr/bin/env bash\nexit 0\n"
    );

    const result = await execFileAsync(
      "bash",
      [installLaunchdScriptPath, "--device-id", "NEW_DEVICE"],
      {
        env: {
          ...process.env,
          HOME: homeDir,
          LOG_DIR: logDir,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          RENEW_CHECK_INTERVAL_SECONDS: "7200",
          STATE_DIR: stateDir
        }
      }
    );

    const plist = await readFile(
      path.join(
        homeDir,
        "Library",
        "LaunchAgents",
        "dev.local.daily-kanji.renew.plist"
      ),
      "utf8"
    );
    expect(plist).toContain("<key>StartInterval</key>");
    expect(plist).toContain("<integer>7200</integer>");
    expect(plist).toContain("<key>RunAtLoad</key>\n  <true/>");
    expect(plist).not.toContain("<key>StartCalendarInterval</key>");
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Check/retry interval: 7200s"
    );
  });

  it("migrates the legacy reschedule option to the persistent interval job", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-reschedule-overdue-")
    );
    tempDirs.push(tempRoot);
    const homeDir = path.join(tempRoot, "home");
    const stateDir = path.join(tempRoot, "state");
    const logDir = path.join(tempRoot, "logs");
    const binDir = path.join(tempRoot, "bin");
    const nowEpoch = Math.floor(Date.now() / 1000);
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(path.join(stateDir, "renew.env"), "DEVICE_ID=NEW_DEVICE\n");
    await writeFile(
      path.join(stateDir, "profile-expiry.epoch"),
      `${nowEpoch - 3600}\n`
    );
    await writeExecutable(
      path.join(binDir, "launchctl"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "plutil"),
      "#!/usr/bin/env bash\nexit 0\n"
    );

    const result = await execFileAsync(
      "bash",
      [installLaunchdScriptPath, "--reschedule-only"],
      {
        env: {
          ...process.env,
          HOME: homeDir,
          LOG_DIR: logDir,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    const plist = await readFile(
      path.join(
        homeDir,
        "Library",
        "LaunchAgents",
        "dev.local.daily-kanji.renew.plist"
      ),
      "utf8"
    );
    expect(plist).toContain("<key>StartInterval</key>");
    expect(plist).toContain("<integer>3600</integer>");
    expect(plist).toContain("<key>RunAtLoad</key>\n  <true/>");
    expect(`${result.stdout}\n${result.stderr}`).toContain("deprecated");
  });

  it("updates only DEVICE_ID in renew.env when reinstalling the LaunchAgent", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-renew-")
    );
    tempDirs.push(tempRoot);
    const homeDir = path.join(tempRoot, "home");
    const stateDir = path.join(tempRoot, "state");
    const logDir = path.join(tempRoot, "logs");
    const binDir = path.join(tempRoot, "bin");
    const configFile = path.join(stateDir, "renew.env");
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(path.join(stateDir, "last-renew-success.epoch"), "1\n");
    await writeExecutable(
      path.join(binDir, "launchctl"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "plutil"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeFile(
      configFile,
      [
        "# existing sync config",
        "DAILY_KANJI_IOS_SYNC_ENDPOINT=https://example.test/api",
        "DEVICE_ID=OLD_DEVICE",
        "UNKNOWN_KEY=keep-me",
        "",
        "DAILY_KANJI_IOS_SYNC_TOKEN=secret-token",
        "DEVICE_ID=OLDER_DEVICE",
        "# trailing comment"
      ].join("\n") + "\n",
      { mode: 0o600 }
    );

    await execFileAsync(
      "bash",
      [installLaunchdScriptPath, "--device-id", "NEW_DEVICE"],
      {
        env: {
          ...process.env,
          CONFIG_FILE: configFile,
          HOME: homeDir,
          LOG_DIR: logDir,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    const updatedConfig = await readFile(configFile, "utf8");
    expect(updatedConfig.split("\n")).toEqual([
      "# existing sync config",
      "DAILY_KANJI_IOS_SYNC_ENDPOINT=https://example.test/api",
      "DEVICE_ID=NEW_DEVICE",
      "UNKNOWN_KEY=keep-me",
      "",
      "DAILY_KANJI_IOS_SYNC_TOKEN=secret-token",
      "# trailing comment",
      ""
    ]);
    expect(updatedConfig.match(/^DEVICE_ID=/gm)).toHaveLength(1);
    expect(updatedConfig).not.toContain("OLD_DEVICE");
    expect(updatedConfig).not.toContain("OLDER_DEVICE");
    expect((await stat(configFile)).mode & 0o777).toBe(0o600);
  });

  it("does not create a fake success marker for the legacy mark-success-now option", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-install-marker-")
    );
    tempDirs.push(tempRoot);
    const homeDir = path.join(tempRoot, "home");
    const stateDir = path.join(tempRoot, "state");
    const logDir = path.join(tempRoot, "logs");
    const binDir = path.join(tempRoot, "bin");
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeExecutable(
      path.join(binDir, "launchctl"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "plutil"),
      "#!/usr/bin/env bash\nexit 0\n"
    );

    await execFileAsync(
      "bash",
      [
        installLaunchdScriptPath,
        "--device-id",
        "NEW_DEVICE",
        "--mark-success-now"
      ],
      {
        env: {
          ...process.env,
          HOME: homeDir,
          LOG_DIR: logDir,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    await expect(
      readFile(path.join(stateDir, "last-renew-success.epoch"), "utf8")
    ).rejects.toThrow(/ENOENT/);
  });

  it("runs due launchd renew work from the repository root even when started elsewhere", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-daily-kanji-cwd-"));
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(path.join(stateDir, "last-renew-success.epoch"), "1\n");
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'if [ "$PWD" != "$EXPECTED_REPO_ROOT" ]; then',
        '  echo "with-node cwd=$PWD" >&2',
        "  exit 43",
        "fi",
        'printf "with-node:%s:%s\\n" "$PWD" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'if [ "$PWD" != "$EXPECTED_REPO_ROOT" ]; then',
        '  echo "xcode-renew cwd=$PWD" >&2',
        "  exit 44",
        "fi",
        'printf "xcode-renew:%s:%s\\n" "$PWD" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      "#!/usr/bin/env bash\nexit 0\n"
    );

    await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
      {
        cwd: "/",
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          EXPECTED_REPO_ROOT: repoRoot,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    expect(await readFile(callLogPath, "utf8")).toBe(
      [
        `with-node:${repoRoot}:pnpm daily-kanji:package`,
        `xcode-renew:${repoRoot}:TEST_DEVICE`,
        ""
      ].join("\n")
    );
  });

  it("fails a due attempt before packaging when the iPhone is locked for DDI mount", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-daily-kanji-ddi-"));
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    const lastSuccessPath = path.join(stateDir, "last-renew-success.epoch");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(lastSuccessPath, "1\n");
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        'case "$*" in',
        '  *"device info details"*) exit 0 ;;',
        '  *"device info ddiServices"*)',
        '    echo "kAMDMobileImageMounterDeviceLocked: The device is locked." >&2',
        "    exit 1",
        "    ;;",
        "esac",
        "exit 1"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync(
        "bash",
        [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
        {
          cwd: "/",
          env: {
            ...process.env,
            CALL_LOG: callLogPath,
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            STATE_DIR: stateDir
          }
        }
      )
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("iPhone bloccato")
    });

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("xcrun:devicectl device info details");
    expect(callLog).toContain("xcrun:devicectl device info ddiServices");
    expect(callLog).not.toContain("with-node:");
    expect(callLog).not.toContain("xcode-renew:");
    expect(await readFile(lastSuccessPath, "utf8")).toBe("1\n");
  });

  it("treats a missing success marker as due instead of skipping forever", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-missing-marker-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    const lastSuccessPath = path.join(stateDir, "last-renew-success.epoch");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        "exit 0"
      ].join("\n") + "\n"
    );

    await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
      {
        cwd: "/",
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("xcrun:devicectl device info details");
    expect(callLog).toContain("xcrun:devicectl device info ddiServices");
    expect(callLog).toContain("with-node:pnpm daily-kanji:package");
    expect(callLog).toContain("xcode-renew:TEST_DEVICE");
    expect(await readFile(lastSuccessPath, "utf8")).toMatch(/^\d+\n$/);
  });

  it("force runs even when the last success marker is fresh", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-force-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(
      path.join(stateDir, "last-renew-success.epoch"),
      `${Math.floor(Date.now() / 1000)}\n`
    );
    await writeFile(
      path.join(stateDir, "profile-expiry.epoch"),
      `${Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60}\n`
    );
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        "exit 0"
      ].join("\n") + "\n"
    );

    await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"), "--force"],
      {
        cwd: "/",
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("xcrun:devicectl device info details");
    expect(callLog).toContain("xcrun:devicectl device info ddiServices");
    expect(callLog).toContain("with-node:pnpm daily-kanji:package");
    expect(callLog).toContain("xcode-renew:TEST_DEVICE");
  });

  it("runs after the recorded embedded profile expiry even when the success marker is fresh", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-expired-profile-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    const nowEpoch = Math.floor(Date.now() / 1000);
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(
      path.join(stateDir, "last-renew-success.epoch"),
      `${nowEpoch}\n`
    );
    await writeFile(
      path.join(stateDir, "profile-expiry.epoch"),
      `${nowEpoch - 180}\n`
    );
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        "exit 0"
      ].join("\n") + "\n"
    );

    await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
      {
        cwd: "/",
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("xcrun:devicectl device info details");
    expect(callLog).toContain("xcrun:devicectl device info ddiServices");
    expect(callLog).toContain("with-node:pnpm daily-kanji:package");
    expect(callLog).toContain("xcode-renew:TEST_DEVICE");
  });

  it("records verified success without self-rescheduling launchd", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-reschedule-success-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    const nowEpoch = Math.floor(Date.now() / 1000);
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(
      path.join(stateDir, "profile-expiry.epoch"),
      `${nowEpoch - 180}\n`
    );
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        "exit 0"
      ].join("\n") + "\n"
    );

    await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
      {
        cwd: "/",
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("with-node:pnpm daily-kanji:package");
    expect(callLog).toContain("xcode-renew:TEST_DEVICE");
    expect(callLog).not.toContain("install-renew-launchd:");
    expect(
      await readFile(path.join(stateDir, "last-renew-success.epoch"), "utf8")
    ).toMatch(/^\d+\n$/);
  });

  it("skips before the recorded embedded profile expiry even when the success marker is old", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-future-profile-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    const nowEpoch = Math.floor(Date.now() / 1000);
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(path.join(stateDir, "last-renew-success.epoch"), "1\n");
    await writeFile(
      path.join(stateDir, "profile-expiry.epoch"),
      `${nowEpoch + 3 * 24 * 60 * 60}\n`
    );
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        "exit 0"
      ].join("\n") + "\n"
    );

    const result = await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
      {
        cwd: "/",
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Daily Kanji renew not due"
    );
    await expect(readFile(callLogPath, "utf8")).rejects.toThrow(/ENOENT/);
  });

  it("preserves the previous atomic profile state when its rename fails", async () => {
    const fixture = await createStandaloneRenewFixture(
      "profile-state-rename-failure",
      tempDirs
    );
    const profileStatePath = path.join(fixture.stateDir, "profile-state.env");
    const previousState = [
      "VERSION=1",
      "EXPIRY_EPOCH=1111111111",
      "PROFILE_UUID=11111111-1111-4111-8111-111111111111",
      "PROFILE_UUID=22222222-2222-4222-8222-222222222222",
      ""
    ].join("\n");
    await writeFile(profileStatePath, previousState, { mode: 0o600 });
    await writeExecutable(
      path.join(fixture.binDir, "mv"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'if [ "${2:-}" = "$PROFILE_STATE_FILE" ]; then',
        "  exit 46",
        "fi",
        'exec /bin/mv "$@"'
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync("bash", [fixture.renewPath], {
        env: {
          ...process.env,
          CALL_LOG: fixture.callLogPath,
          CONFIG_FILE: path.join(fixture.stateDir, "renew.env"),
          DERIVED_DATA: fixture.derivedData,
          PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
          PROFILE_STATE_FILE: profileStatePath,
          STATE_DIR: fixture.stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 46,
      stderr: expect.stringContaining(
        "Impossibile registrare atomicamente lo stato profili"
      )
    });

    expect(await readFile(profileStatePath, "utf8")).toBe(previousState);
  });

  it("documents install, status, and force-run commands for the agent", async () => {
    const docs = await readFile(iosAgentDocsPath, "utf8");

    expect(docs).toContain(
      "DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh"
    );
    expect(docs).toContain("./scripts/xcode-renew-if-needed.sh --status");
    expect(docs).toContain("./scripts/xcode-renew-if-needed.sh --force");
    expect(docs).toContain("renew.env");
    expect(docs).toContain("DAILY_KANJI_ENABLE_APNS=1");
  });

  it("lets the private sync endpoint and token flow into local Xcode installs", async () => {
    const source = await readFile(renewScriptPath, "utf8");

    expect(source).toContain(
      'CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"'
    );
    expect(source).toContain("config_value DAILY_KANJI_IOS_SYNC_ENDPOINT");
    expect(source).toContain("config_value DAILY_KANJI_IOS_SYNC_TOKEN");
    expect(source).toContain("DAILY_KANJI_IOS_SYNC_ENDPOINT=");
    expect(source).toContain("DAILY_KANJI_IOS_SYNC_TOKEN=");
    expect(source).toContain("MOBILE_API_ENDPOINT=");
    expect(source).toContain("MOBILE_API_TOKEN=");
    expect(source).toContain("DAILY_KANJI_ENABLE_APNS");
    expect(source).toContain("DailyKanjiPush.entitlements");
    expect(source).toContain("mktemp");
    expect(source).toContain("daily-kanji-runtime.XXXXXX");
    expect(source).toContain("chmod 600");
    expect(source).toContain("-quiet");
    expect(source).toContain("-xcconfig");
    expect(source).toContain("cleanup_runtime_xcconfig");
    expect(source).not.toContain('"${sync_build_settings[@]}"');
    expect(source).not.toContain("XXXXXX.xcconfig");
    expect(source).not.toContain("https://");
    expect(source).not.toContain("daily-kanji-secret");
  });

  it("requires an explicit configured device for standalone Xcode renews", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-renew-device-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosRoot = path.join(repoRoot, "apps", "daily-kanji-ios");
    const tempIosScriptsRoot = path.join(tempIosRoot, "scripts");
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      await readFile(renewScriptPath, "utf8")
    );
    await chmod(path.join(tempIosScriptsRoot, "xcode-renew.sh"), 0o755);
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcodebuild"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcodebuild:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcodegen"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcodegen:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync("bash", [path.join(tempIosScriptsRoot, "xcode-renew.sh")], {
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          CONFIG_FILE: path.join(stateDir, "missing-renew.env"),
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 2,
      stderr: expect.stringContaining("DEVICE_ID")
    });

    await expect(readFile(callLogPath, "utf8")).rejects.toThrow(/ENOENT/);
  });

  it("skips standalone renew before Xcode work when the iPhone is locked for DDI mount", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-renew-ddi-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosRoot = path.join(repoRoot, "apps", "daily-kanji-ios");
    const tempIosScriptsRoot = path.join(tempIosRoot, "scripts");
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      await readFile(renewScriptPath, "utf8")
    );
    await chmod(path.join(tempIosScriptsRoot, "xcode-renew.sh"), 0o755);
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcodegen"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcodegen:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcodebuild"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcodebuild:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        'case "$*" in',
        '  *"device info details"*)',
        '    printf "    • transportType: localNetwork\\n"',
        "    exit 0",
        "    ;;",
        '  *"device info ddiServices"*)',
        '    echo "kAMDMobileImageMounterDeviceLocked: The device is locked." >&2',
        "    exit 1",
        "    ;;",
        "esac",
        "exit 1"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync("bash", [path.join(tempIosScriptsRoot, "xcode-renew.sh")], {
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          CONFIG_FILE: path.join(stateDir, "renew.env"),
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("iPhone bloccato")
    });

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("xcrun:devicectl device info details");
    expect(callLog).toContain("xcrun:devicectl device info ddiServices");
    expect(callLog).not.toContain("with-node:");
    expect(callLog).not.toContain("xcodegen:");
    expect(callLog).not.toContain("xcodebuild:");
  });

  it("does not mark success when standalone renew loses DDI readiness after the wrapper preflight", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-ddi-race-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const callLogPath = path.join(tempRoot, "calls.log");
    const lastSuccessPath = path.join(stateDir, "last-renew-success.epoch");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(lastSuccessPath, "1\n");
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "with-node:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'echo "Daily Kanji iPhone bloccato: sblocca l\'iPhone e lascialo acceso, poi rilancia il rinnovo."',
        "exit 75"
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        "exit 0"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync(
        "bash",
        [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
        {
          cwd: "/",
          env: {
            ...process.env,
            CALL_LOG: callLogPath,
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            STATE_DIR: stateDir
          }
        }
      )
    ).rejects.toMatchObject({
      code: 75
    });

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("with-node:pnpm daily-kanji:package");
    expect(callLog).toContain("xcode-renew:TEST_DEVICE");
    expect(await readFile(lastSuccessPath, "utf8")).toBe("1\n");
  });

  it("explains Xcode signing and provisioning failures during standalone renews", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-signing-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosRoot = path.join(repoRoot, "apps", "daily-kanji-ios");
    const tempIosScriptsRoot = path.join(tempIosRoot, "scripts");
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(tempRepoScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew.sh"),
      await readFile(renewScriptPath, "utf8")
    );
    await chmod(path.join(tempIosScriptsRoot, "xcode-renew.sh"), 0o755);
    await writeExecutable(
      path.join(tempRepoScriptsRoot, "with-node.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "xcodegen"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'case "$*" in',
        '  *"device info details"*)',
        '    printf "    • transportType: localNetwork\\n"',
        "    exit 0",
        "    ;;",
        '  *"device info ddiServices"*) exit 0 ;;',
        "esac",
        "exit 1"
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcodebuild"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "cat >&2 <<'XCODEBUILD_ERROR'",
        "DailyKanji.xcodeproj: error: No Accounts: Add a new account in Accounts settings. (in target 'DailyKanjiWidgetExtension' from project 'DailyKanji')",
        "DailyKanji.xcodeproj: error: No profiles for 'dev.local.daily-kanji.widget' were found: Xcode couldn't find any iOS App Development provisioning profiles matching 'dev.local.daily-kanji.widget'.",
        "DailyKanji.xcodeproj: error: No profiles for 'dev.local.daily-kanji' were found: Xcode couldn't find any iOS App Development provisioning profiles matching 'dev.local.daily-kanji'.",
        "XCODEBUILD_ERROR",
        "exit 65"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync("bash", [path.join(tempIosScriptsRoot, "xcode-renew.sh")], {
        env: {
          ...process.env,
          CONFIG_FILE: path.join(stateDir, "renew.env"),
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 65,
      stderr: expect.stringContaining("Daily Kanji signing/provisioning")
    });

    await expect(
      execFileAsync("bash", [path.join(tempIosScriptsRoot, "xcode-renew.sh")], {
        env: {
          ...process.env,
          CONFIG_FILE: path.join(stateDir, "renew.env"),
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Xcode Settings > Accounts")
    });
  });

  it("uses the full Xcode developer directory before checking CoreDevice reachability", async () => {
    const source = await readFile(renewIfNeededScriptPath, "utf8");
    const developerDirIndex = source.indexOf(
      "export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer"
    );
    const devicectlIndex = source.indexOf(
      "xcrun devicectl device info details"
    );

    expect(developerDirIndex).toBeGreaterThanOrEqual(0);
    expect(devicectlIndex).toBeGreaterThanOrEqual(0);
    expect(developerDirIndex).toBeLessThan(devicectlIndex);
  });
});

async function createStandaloneRenewFixture(label: string, tempDirs: string[]) {
  const tempRoot = await mkdtemp(
    path.join(tmpdir(), `jcs-daily-kanji-${label}-`)
  );
  const repoRoot = path.join(tempRoot, "repo");
  const iosRoot = path.join(repoRoot, "apps", "daily-kanji-ios");
  const iosScriptsRoot = path.join(iosRoot, "scripts");
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
  await writeFile(renewPath, await readFile(renewScriptPath, "utf8"));
  await chmod(renewPath, 0o755);
  await writeExecutable(
    path.join(repoScriptsRoot, "with-node.sh"),
    "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
  );
  await writeExecutable(
    path.join(binDir, "xcodegen"),
    "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
  );
  await writeExecutable(
    path.join(binDir, "xcrun"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'case "$*" in',
      '  *"device info details"*) printf "    • transportType: localNetwork\\n"; exit 0 ;;',
      '  *"device info ddiServices"*|*"device install app"*) exit 0 ;;',
      "esac",
      "exit 1"
    ].join("\n") + "\n"
  );
  await writeExecutable(
    path.join(binDir, "xcodebuild"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
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
      "set -euo pipefail",
      'input=""',
      'while [ "$#" -gt 0 ]; do',
      '  if [ "$1" = "-i" ]; then shift; input="${1:-}"; fi',
      "  shift || true",
      "done",
      'uuid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"',
      'case "$input" in *.appex/embedded.mobileprovision) uuid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" ;; esac',
      "cat <<PLIST",
      '<?xml version="1.0" encoding="UTF-8"?>',
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
    renewPath,
    stateDir
  };
}

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents);
  await chmod(filePath, 0o755);
}
