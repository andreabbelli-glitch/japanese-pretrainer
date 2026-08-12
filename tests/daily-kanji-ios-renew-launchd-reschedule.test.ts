import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
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
const installLaunchdScriptPath = path.join(
  iosRoot,
  "scripts",
  "install-renew-launchd.sh"
);
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

describe("Daily Kanji iOS persistent renew retry safety", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("has no asynchronous self-reschedule or child retry path", async () => {
    const source = await readFile(renewIfNeededScriptPath, "utf8");

    expect(source).not.toContain("reschedule_launchd");
    expect(source).not.toContain("install-renew-launchd.sh");
    expect(source).not.toContain("DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD");
    expect(source).not.toContain('sleep "$DAILY_KANJI');
    expect(source).not.toMatch(/\)\s*>>[^\n]+&/);
  });

  it("retries a failed due attempt on a later invocation, then becomes cheap again", async () => {
    const fixture = await createWrapperFixture("retry-cycle", tempDirs);
    const reachableFile = path.join(fixture.tempRoot, "reachable");
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "xcrun:%s\\n" "$*" >> "$CALL_LOG"',
        'if [[ "$*" == *"device info details"* ]] && [ ! -f "$REACHABLE_FILE" ]; then',
        '  echo "device temporarily offline" >&2',
        "  exit 41",
        "fi",
        "exit 0"
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(fixture.repoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "package:%s\\n" "$*" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(fixture.iosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "renew:%s\\n" "${DEVICE_ID:-}" >> "$CALL_LOG"',
        'printf "%s\\n" "$(( $(date +%s) + 604800 ))" > "$STATE_DIR/profile-expiry.epoch"'
      ].join("\n") + "\n"
    );

    const runOptions = {
      cwd: "/",
      env: {
        ...process.env,
        CALL_LOG: fixture.callLogPath,
        PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
        REACHABLE_FILE: reachableFile,
        STATE_DIR: fixture.stateDir
      }
    };

    await expect(
      execFileAsync("bash", [fixture.wrapperPath], runOptions)
    ).rejects.toMatchObject({
      code: 41,
      stderr: expect.stringContaining("CoreDevice exited 41")
    });
    await expect(
      readFile(path.join(fixture.stateDir, "last-renew-success.epoch"), "utf8")
    ).rejects.toThrow(/ENOENT/);

    await writeFile(reachableFile, "ready\n");
    await execFileAsync("bash", [fixture.wrapperPath], runOptions);
    const callsAfterSuccess = await readFile(fixture.callLogPath, "utf8");
    expect(callsAfterSuccess).toContain("package:pnpm daily-kanji:package");
    expect(callsAfterSuccess).toContain("renew:TEST_DEVICE");
    expect(
      await readFile(
        path.join(fixture.stateDir, "last-renew-success.epoch"),
        "utf8"
      )
    ).toMatch(/^\d+\n$/);

    const thirdRun = await execFileAsync(
      "bash",
      [fixture.wrapperPath],
      runOptions
    );
    expect(`${thirdRun.stdout}\n${thirdRun.stderr}`).toContain("renew not due");
    expect(await readFile(fixture.callLogPath, "utf8")).toBe(callsAfterSuccess);
  });

  it("propagates the real package exit and leaves success unmarked", async () => {
    const fixture = await createWrapperFixture("package-failure", tempDirs);
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.repoScriptsRoot, "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "package:%s\\n" "$*" >> "$CALL_LOG"',
        "exit 42"
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(fixture.iosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "renew-called\\n" >> "$CALL_LOG"'
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync("bash", [fixture.wrapperPath], {
        cwd: "/",
        env: {
          ...process.env,
          CALL_LOG: fixture.callLogPath,
          PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: fixture.stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 42,
      stderr: expect.stringContaining("resource package failed with exit 42")
    });

    expect(await readFile(fixture.callLogPath, "utf8")).not.toContain(
      "renew-called"
    );
    await expect(
      readFile(path.join(fixture.stateDir, "last-renew-success.epoch"), "utf8")
    ).rejects.toThrow(/ENOENT/);
  });

  it("refuses success when install reports zero but profile expiry did not advance", async () => {
    const fixture = await createWrapperFixture("stale-expiry", tempDirs);
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.repoScriptsRoot, "with-node.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.iosScriptsRoot, "xcode-renew.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );

    await expect(
      execFileAsync("bash", [fixture.wrapperPath], {
        cwd: "/",
        env: {
          ...process.env,
          PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: fixture.stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 70,
      stderr: expect.stringContaining("refusing false success")
    });
    await expect(
      readFile(path.join(fixture.stateDir, "last-renew-success.epoch"), "utf8")
    ).rejects.toThrow(/ENOENT/);
  });

  it("removes only the recorded app and widget profiles during a due refresh", async () => {
    const fixture = await createWrapperFixture(
      "targeted-profile-success",
      tempDirs
    );
    const profileCacheDir = path.join(fixture.tempRoot, "profile-cache");
    const appUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const widgetUuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const unrelatedUuid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await mkdir(profileCacheDir, { recursive: true });
    await writeFile(
      path.join(fixture.stateDir, "profile-state.env"),
      profileStateContents(
        Math.floor(Date.now() / 1000) - 60,
        appUuid,
        widgetUuid
      )
    );
    await writeFile(
      path.join(profileCacheDir, `${appUuid}.mobileprovision`),
      "old-app\n"
    );
    await writeFile(
      path.join(profileCacheDir, `${widgetUuid}.mobileprovision`),
      "old-widget\n"
    );
    await writeFile(
      path.join(profileCacheDir, `${unrelatedUuid}.mobileprovision`),
      "unrelated\n"
    );
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.repoScriptsRoot, "with-node.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.iosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        `for uuid in ${appUuid} ${widgetUuid}; do`,
        '  if [ -e "$PROFILE_CACHE_DIR/$uuid.mobileprovision" ]; then',
        '    echo "recorded profile still cached during renew: $uuid" >&2',
        "    exit 51",
        "  fi",
        "done",
        'renewed_expiry="$(( $(date +%s) + 604800 ))"',
        'cat > "$PROFILE_STATE_FILE" <<STATE',
        "VERSION=1",
        "EXPIRY_EPOCH=$renewed_expiry",
        "PROFILE_UUID=dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "PROFILE_UUID=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        "STATE"
      ].join("\n") + "\n"
    );

    await execFileAsync("bash", [fixture.wrapperPath], {
      cwd: "/",
      env: {
        ...process.env,
        PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
        PROFILE_CACHE_DIR: profileCacheDir,
        STATE_DIR: fixture.stateDir
      }
    });

    await expect(
      readFile(path.join(profileCacheDir, `${appUuid}.mobileprovision`), "utf8")
    ).rejects.toThrow(/ENOENT/);
    await expect(
      readFile(
        path.join(profileCacheDir, `${widgetUuid}.mobileprovision`),
        "utf8"
      )
    ).rejects.toThrow(/ENOENT/);
    expect(
      await readFile(
        path.join(profileCacheDir, `${unrelatedUuid}.mobileprovision`),
        "utf8"
      )
    ).toBe("unrelated\n");
    expect(
      (await readdir(fixture.stateDir)).filter((entry) =>
        entry.startsWith("profile-refresh-backup.")
      )
    ).toEqual([]);
    const renewedState = await readFile(
      path.join(fixture.stateDir, "profile-state.env"),
      "utf8"
    );
    const renewedExpiry = Number(
      renewedState.match(/^EXPIRY_EPOCH=(\d+)$/m)?.[1]
    );
    expect(renewedExpiry).toBeGreaterThan(
      Math.floor(Date.now() / 1000) + 172800
    );
  });

  it("restores the exact cached profiles and original exit after a failed refresh", async () => {
    const fixture = await createWrapperFixture(
      "targeted-profile-failure",
      tempDirs
    );
    const profileCacheDir = path.join(fixture.tempRoot, "profile-cache");
    const appUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const widgetUuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await mkdir(profileCacheDir, { recursive: true });
    await writeFile(
      path.join(fixture.stateDir, "profile-state.env"),
      profileStateContents(
        Math.floor(Date.now() / 1000) - 60,
        appUuid,
        widgetUuid
      )
    );
    await writeFile(
      path.join(profileCacheDir, `${appUuid}.mobileprovision`),
      "old-app\n"
    );
    await writeFile(
      path.join(profileCacheDir, `${widgetUuid}.mobileprovision`),
      "old-widget\n"
    );
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.repoScriptsRoot, "with-node.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.iosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        `for uuid in ${appUuid} ${widgetUuid}; do`,
        '  if [ -e "$PROFILE_CACHE_DIR/$uuid.mobileprovision" ]; then',
        '    echo "recorded profile still cached during renew: $uuid" >&2',
        "    exit 51",
        "  fi",
        "done",
        "exit 47"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync("bash", [fixture.wrapperPath], {
        cwd: "/",
        env: {
          ...process.env,
          PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
          PROFILE_CACHE_DIR: profileCacheDir,
          STATE_DIR: fixture.stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 47,
      stderr: expect.stringContaining(
        "Release build/install failed with exit 47"
      )
    });

    expect(
      await readFile(
        path.join(profileCacheDir, `${appUuid}.mobileprovision`),
        "utf8"
      )
    ).toBe("old-app\n");
    expect(
      await readFile(
        path.join(profileCacheDir, `${widgetUuid}.mobileprovision`),
        "utf8"
      )
    ).toBe("old-widget\n");
    expect(
      (await readdir(fixture.stateDir)).filter((entry) =>
        entry.startsWith("profile-refresh-backup.")
      )
    ).toEqual([]);
    await expect(
      readFile(path.join(fixture.stateDir, "last-renew-success.epoch"), "utf8")
    ).rejects.toThrow(/ENOENT/);
  });

  it("returns a cleanup error when a verified refresh backup cannot be discarded", async () => {
    const fixture = await createWrapperFixture(
      "discard-cleanup-failure",
      tempDirs
    );
    const profileCacheDir = path.join(fixture.tempRoot, "profile-cache");
    const appUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const widgetUuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await mkdir(profileCacheDir, { recursive: true });
    await writeFile(
      path.join(fixture.stateDir, "profile-state.env"),
      profileStateContents(
        Math.floor(Date.now() / 1000) - 60,
        appUuid,
        widgetUuid
      )
    );
    await writeFile(
      path.join(profileCacheDir, `${appUuid}.mobileprovision`),
      "old-app\n"
    );
    await writeFile(
      path.join(profileCacheDir, `${widgetUuid}.mobileprovision`),
      "old-widget\n"
    );
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.repoScriptsRoot, "with-node.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.iosScriptsRoot, "xcode-renew.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'for backup in "$STATE_DIR"/profile-refresh-backup.*; do',
        '  [ -d "$backup" ] && touch "$backup/cleanup-blocker"',
        "done",
        'renewed_expiry="$(( $(date +%s) + 604800 ))"',
        'cat > "$PROFILE_STATE_FILE" <<STATE',
        "VERSION=1",
        "EXPIRY_EPOCH=$renewed_expiry",
        "PROFILE_UUID=dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        "PROFILE_UUID=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        "STATE"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync("bash", [fixture.wrapperPath], {
        cwd: "/",
        env: {
          ...process.env,
          PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
          PROFILE_CACHE_DIR: profileCacheDir,
          STATE_DIR: fixture.stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        "could not discard targeted profile backup"
      )
    });
    expect(
      await readFile(
        path.join(fixture.stateDir, "last-renew-success.epoch"),
        "utf8"
      )
    ).toMatch(/^\d+\n$/);
  });

  it("preserves the original failure when profile restore cleanup also fails", async () => {
    const fixture = await createWrapperFixture(
      "restore-cleanup-failure",
      tempDirs
    );
    const profileCacheDir = path.join(fixture.tempRoot, "profile-cache");
    const appUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const widgetUuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await mkdir(profileCacheDir, { recursive: true });
    await writeFile(
      path.join(fixture.stateDir, "profile-state.env"),
      profileStateContents(
        Math.floor(Date.now() / 1000) - 60,
        appUuid,
        widgetUuid
      )
    );
    await writeFile(
      path.join(profileCacheDir, `${appUuid}.mobileprovision`),
      "old-app\n"
    );
    await writeFile(
      path.join(profileCacheDir, `${widgetUuid}.mobileprovision`),
      "old-widget\n"
    );
    await writeExecutable(
      path.join(fixture.binDir, "xcrun"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.binDir, "mv"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'case "${1:-}" in',
        '  "$STATE_DIR"/profile-refresh-backup.*/*.mobileprovision)',
        '    case "${2:-}" in "$PROFILE_CACHE_DIR"/*.mobileprovision) exit 55 ;; esac',
        "    ;;",
        "esac",
        'exec /bin/mv "$@"'
      ].join("\n") + "\n"
    );
    await writeExecutable(
      path.join(fixture.repoScriptsRoot, "with-node.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 0\n"
    );
    await writeExecutable(
      path.join(fixture.iosScriptsRoot, "xcode-renew.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\nexit 47\n"
    );

    await expect(
      execFileAsync("bash", [fixture.wrapperPath], {
        cwd: "/",
        env: {
          ...process.env,
          PATH: `${fixture.binDir}:${process.env.PATH ?? ""}`,
          PROFILE_CACHE_DIR: profileCacheDir,
          STATE_DIR: fixture.stateDir
        }
      })
    ).rejects.toMatchObject({
      code: 47,
      stderr: expect.stringContaining(
        "could not fully restore the targeted profile backup"
      )
    });
  });

  it("propagates launchctl bootstrap failures with their actual code", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-launchctl-failure-")
    );
    tempDirs.push(tempRoot);
    const homeDir = path.join(tempRoot, "home");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const plistPath = path.join(
      homeDir,
      "Library",
      "LaunchAgents",
      "dev.local.daily-kanji.renew.plist"
    );
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await writeExecutable(
      path.join(binDir, "plutil"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "launchctl"),
      [
        "#!/usr/bin/env bash",
        'case "${1:-}" in',
        "  enable|bootout) exit 0 ;;",
        "  bootstrap) exit 23 ;;",
        "esac",
        "exit 1"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync(
        "bash",
        [installLaunchdScriptPath, "--device-id", "TEST_DEVICE"],
        {
          env: {
            ...process.env,
            HOME: homeDir,
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            STATE_DIR: stateDir
          }
        }
      )
    ).rejects.toMatchObject({
      code: 23,
      stderr: expect.stringContaining(
        "removed the failed new LaunchAgent plist; no previous plist existed"
      )
    });
    await expect(readFile(plistPath, "utf8")).rejects.toThrow(/ENOENT/);
  });

  it("restores and re-bootstraps the previous plist when the new bootstrap fails", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-launchctl-rollback-")
    );
    tempDirs.push(tempRoot);
    const homeDir = path.join(tempRoot, "home");
    const stateDir = path.join(tempRoot, "state");
    const binDir = path.join(tempRoot, "bin");
    const launchAgentsDir = path.join(homeDir, "Library", "LaunchAgents");
    const plistPath = path.join(
      launchAgentsDir,
      "dev.local.daily-kanji.renew.plist"
    );
    const callLogPath = path.join(tempRoot, "launchctl-calls.log");
    const partialServicePath = path.join(tempRoot, "partial-service-loaded");
    const previousPlist = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<plist version="1.0">',
      "<dict>",
      "  <!-- OLD_PLIST_SENTINEL -->",
      "  <key>Label</key>",
      "  <string>dev.local.daily-kanji.renew</string>",
      "</dict>",
      "</plist>",
      ""
    ].join("\n");
    await mkdir(stateDir, { recursive: true });
    await mkdir(binDir, { recursive: true });
    await mkdir(launchAgentsDir, { recursive: true });
    await writeFile(plistPath, previousPlist);
    await writeExecutable(
      path.join(binDir, "plutil"),
      "#!/usr/bin/env bash\nexit 0\n"
    );
    await writeExecutable(
      path.join(binDir, "launchctl"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'case "${1:-}" in',
        "  enable)",
        '    echo "enable" >> "$CALL_LOG"',
        "    exit 0",
        "    ;;",
        "  bootout)",
        '    if [[ "${2:-}" == */dev.local.daily-kanji.renew ]]; then',
        '      echo "bootout:partial" >> "$CALL_LOG"',
        '      rm -f "$PARTIAL_SERVICE_FILE"',
        "    else",
        '      echo "bootout:initial" >> "$CALL_LOG"',
        "    fi",
        "    exit 0",
        "    ;;",
        "  bootstrap)",
        '    if grep -q "OLD_PLIST_SENTINEL" "${3:-}"; then',
        '      if [ -f "$PARTIAL_SERVICE_FILE" ]; then',
        '        echo "bootstrap:previous:blocked" >> "$CALL_LOG"',
        "        exit 48",
        "      fi",
        '      echo "bootstrap:previous" >> "$CALL_LOG"',
        "      exit 0",
        "    fi",
        '    echo "bootstrap:new" >> "$CALL_LOG"',
        '    touch "$PARTIAL_SERVICE_FILE"',
        "    exit 23",
        "    ;;",
        "esac",
        "exit 1"
      ].join("\n") + "\n"
    );

    await expect(
      execFileAsync(
        "bash",
        [installLaunchdScriptPath, "--device-id", "TEST_DEVICE"],
        {
          env: {
            ...process.env,
            CALL_LOG: callLogPath,
            HOME: homeDir,
            PARTIAL_SERVICE_FILE: partialServicePath,
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            STATE_DIR: stateDir
          }
        }
      )
    ).rejects.toMatchObject({
      code: 23,
      stderr: expect.stringContaining(
        "previous LaunchAgent plist restored and re-bootstrap succeeded"
      )
    });

    expect(await readFile(plistPath, "utf8")).toBe(previousPlist);
    expect(await readFile(callLogPath, "utf8")).toBe(
      [
        "enable",
        "bootout:initial",
        "bootstrap:new",
        "bootout:partial",
        "bootstrap:previous",
        ""
      ].join("\n")
    );
    await expect(readFile(partialServicePath, "utf8")).rejects.toThrow(
      /ENOENT/
    );
  });
});

async function createWrapperFixture(label: string, tempDirs: string[]) {
  const tempRoot = await mkdtemp(
    path.join(tmpdir(), `jcs-daily-kanji-${label}-`)
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
  await writeFile(wrapperPath, await readFile(renewIfNeededScriptPath, "utf8"));
  await chmod(wrapperPath, 0o755);

  return {
    binDir,
    callLogPath,
    iosScriptsRoot,
    repoScriptsRoot,
    stateDir,
    tempRoot,
    wrapperPath
  };
}

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents);
  await chmod(filePath, 0o755);
}

function profileStateContents(
  expiryEpoch: number,
  appUuid: string,
  widgetUuid: string
) {
  return [
    "VERSION=1",
    `EXPIRY_EPOCH=${expiryEpoch}`,
    `PROFILE_UUID=${appUuid}`,
    `PROFILE_UUID=${widgetUuid}`,
    ""
  ].join("\n");
}
