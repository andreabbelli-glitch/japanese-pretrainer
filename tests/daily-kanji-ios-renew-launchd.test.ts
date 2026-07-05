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

import { afterEach, describe, expect, it } from "vitest";

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
const execFileAsync = promisify(execFile);

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
    const reachabilityIndex = source.indexOf(
      "xcrun devicectl device info details"
    );
    const packageIndex = source.indexOf("pnpm daily-kanji:package");
    const heavyRenewIndex = source.indexOf('"$ROOT/scripts/xcode-renew.sh"');

    expect(source).toContain(
      'RENEW_MIN_AGE_SECONDS="${RENEW_MIN_AGE_SECONDS:-432000}"'
    );
    expect(source).toContain(
      'LOCK_MAX_AGE_SECONDS="${LOCK_MAX_AGE_SECONDS:-21600}"'
    );
    expect(source).toContain(
      'CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"'
    );
    expect(source).toContain('mkdir "$LOCK_DIR"');
    expect(source).toContain("--mark-success-now");
    expect(source).toContain("should_renew");
    expect(source).toContain("lock_owner_active");
    expect(source).toContain("recover_stale_lock_if_needed");
    expect(source).toContain("return 1");
    expect(source).not.toContain("xcodebuild");
    expect(source).not.toContain("D584E119");
    expect(reachabilityIndex).toBeGreaterThanOrEqual(0);
    expect(packageIndex).toBeGreaterThanOrEqual(0);
    expect(heavyRenewIndex).toBeGreaterThanOrEqual(0);
    expect(reachabilityIndex).toBeLessThan(packageIndex);
    expect(packageIndex).toBeLessThan(heavyRenewIndex);
    expect(reachabilityIndex).toBeLessThan(heavyRenewIndex);
  });

  it("installs a low-priority user LaunchAgent scheduled from the recorded expiry", async () => {
    const source = await readFile(installLaunchdScriptPath, "utf8");

    expect(source).toContain("dev.local.daily-kanji.renew");
    expect(source).toContain("<key>StartCalendarInterval</key>");
    expect(source).toContain("<key>Month</key>");
    expect(source).toContain("<key>Day</key>");
    expect(source).toContain("<key>Hour</key>");
    expect(source).toContain("<key>Minute</key>");
    expect(source).toContain("PROFILE_EXPIRY_FILE");
    expect(source).toContain("RENEW_RETRY_DELAY_SECONDS");
    expect(source).toContain("RENEW_AFTER_EXPIRY_GRACE_SECONDS");
    expect(source).toContain("embedded provisioning profile expiry");
    expect(source).toContain("--reschedule-only");
    expect(source).not.toContain("<key>StartInterval</key>");
    expect(source).not.toContain("START_INTERVAL_SECONDS");
    expect(source).not.toContain("${START_INTERVAL_SECONDS:-900}");
    expect(source).not.toContain("since the last success");
    expect(source).toContain("--device-id");
    expect(source).toContain(
      'CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"'
    );
    expect(source).toContain("DEVICE_ID is required for install");
    expect(source).toContain("write_config_value DEVICE_ID");
    expect(source).toContain("<key>RunAtLoad</key>");
    expect(source).toContain("<key>LowPriorityIO</key>");
    expect(source).toContain("<key>ProcessType</key>");
    expect(source).toContain("<string>Background</string>");
    expect(source).toContain("<key>Nice</key>");
    expect(source).toContain("DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD");
    expect(source).toContain("launchctl bootstrap");
    expect(source).not.toContain("D584E119");
  });

  it("writes a calendar schedule at the recorded profile expiry instead of polling", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-calendar-")
    );
    tempDirs.push(tempRoot);
    const homeDir = path.join(tempRoot, "home");
    const stateDir = path.join(tempRoot, "state");
    const logDir = path.join(tempRoot, "logs");
    const binDir = path.join(tempRoot, "bin");
    const expiryEpoch = Math.floor(Date.now() / 1000) + 6 * 24 * 60 * 60 + 31;
    const scheduledEpoch = ceilToNextMinute(expiryEpoch + 120);
    const scheduledDate = new Date(scheduledEpoch * 1000);
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
    expect(plist).toContain("<key>StartCalendarInterval</key>");
    expect(plist).not.toContain("<key>StartInterval</key>");
    expect(plist).not.toContain("<key>RunAtLoad</key>");
    expect(plist).toContain(
      `<key>Month</key>\n    <integer>${scheduledDate.getMonth() + 1}</integer>`
    );
    expect(plist).toContain(
      `<key>Day</key>\n    <integer>${scheduledDate.getDate()}</integer>`
    );
    expect(plist).toContain(
      `<key>Hour</key>\n    <integer>${scheduledDate.getHours()}</integer>`
    );
    expect(plist).toContain(
      `<key>Minute</key>\n    <integer>${scheduledDate.getMinutes()}</integer>`
    );
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Next scheduled run"
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(
      "Check interval"
    );
  });

  it("schedules a retry without immediate RunAtLoad when rescheduling an overdue profile", async () => {
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
          RENEW_RETRY_DELAY_SECONDS: "1800",
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
    expect(plist).toContain("<key>StartCalendarInterval</key>");
    expect(plist).not.toContain("<key>RunAtLoad</key>");
    expect(`${result.stdout}\n${result.stderr}`).toContain("Run at load: no");
    expect(`${result.stdout}\n${result.stderr}`).toContain("overdue");
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

  it("does not create a fake success marker when installing launchd without mark-success-now", async () => {
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
      [installLaunchdScriptPath, "--device-id", "NEW_DEVICE"],
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
        'printf "xcode-renew:%s:%s\\n" "$PWD" "${DEVICE_ID:-}" >> "$CALL_LOG"'
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

  it("skips due renew before packaging when the iPhone is locked for DDI mount", async () => {
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
        'printf "xcode-renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"'
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

    const output = `${result.stdout}\n${result.stderr}`;
    const callLog = await readFile(callLogPath, "utf8");
    expect(output).toContain("iPhone bloccato");
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

  it("reschedules launchd after an automatic renew records the next profile expiry", async () => {
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
      path.join(tempIosScriptsRoot, "install-renew-launchd.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "install-renew-launchd:%s\\n" "$*" >> "$CALL_LOG"'
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
          DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD: "1",
          DAILY_KANJI_LAUNCHD_RESCHEDULE_SYNCHRONOUS: "1",
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    const callLog = await readFile(callLogPath, "utf8");
    expect(callLog).toContain("with-node:pnpm daily-kanji:package");
    expect(callLog).toContain("xcode-renew:TEST_DEVICE");
    expect(callLog).toContain("install-renew-launchd:--reschedule-only");
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
      `${nowEpoch + 3600}\n`
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

  it("records the minimum embedded profile expiry after a standalone renew install", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-profile-record-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosRoot = path.join(repoRoot, "apps", "daily-kanji-ios");
    const tempIosScriptsRoot = path.join(tempIosRoot, "scripts");
    const tempRepoScriptsRoot = path.join(repoRoot, "scripts");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const derivedData = path.join(tempRoot, "DerivedData");
    const callLogPath = path.join(tempRoot, "calls.log");
    const expectedMinExpiry = Math.floor(
      Date.parse("2026-07-10T08:00:00Z") / 1000
    );
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
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        'case "$*" in',
        '  *"device info details"*)',
        '    printf "    • transportType: localNetwork\\n"',
        "    exit 0",
        "    ;;",
        '  *"device info ddiServices"*) exit 0 ;;',
        '  *"device install app"*) exit 0 ;;',
        "esac",
        "exit 1"
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(binDir, "xcodebuild"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'app="$DERIVED_DATA/Build/Products/Debug-iphoneos/Daily Kanji.app"',
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
        '  if [ "$1" = "-i" ]; then',
        "    shift",
        '    input="${1:-}"',
        "  fi",
        "  shift || true",
        "done",
        'expiry="2026-07-12T08:00:00Z"',
        'case "$input" in',
        '  *".appex/embedded.mobileprovision") expiry="2026-07-10T08:00:00Z" ;;',
        "esac",
        "cat <<PLIST",
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        "<dict>",
        "  <key>ExpirationDate</key>",
        "  <date>$expiry</date>",
        "</dict>",
        "</plist>",
        "PLIST"
      ].join("\n") + "\n"
    );

    await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew.sh")],
      {
        env: {
          ...process.env,
          CALL_LOG: callLogPath,
          CONFIG_FILE: path.join(stateDir, "renew.env"),
          DERIVED_DATA: derivedData,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    expect(
      await readFile(path.join(stateDir, "profile-expiry.epoch"), "utf8")
    ).toBe(`${expectedMinExpiry}\n`);
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
      code: 75,
      stdout: expect.stringContaining("iPhone bloccato")
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

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents);
  await chmod(filePath, 0o755);
}

function ceilToNextMinute(epochSeconds: number) {
  const remainder = epochSeconds % 60;
  if (remainder === 0) {
    return epochSeconds;
  }

  return epochSeconds + 60 - remainder;
}
