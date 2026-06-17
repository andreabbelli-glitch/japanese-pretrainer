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

  it("keeps the periodic renew check cheap until a renewal is actually due", async () => {
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
    expect(source).toContain('CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"');
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

  it("installs a low-priority user LaunchAgent with infrequent checks", async () => {
    const source = await readFile(installLaunchdScriptPath, "utf8");

    expect(source).toContain("dev.local.daily-kanji.renew");
    expect(source).toContain("<key>StartInterval</key>");
    expect(source).toContain("${START_INTERVAL_SECONDS:-21600}");
    expect(source).toContain("--device-id");
    expect(source).toContain('CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"');
    expect(source).toContain("DEVICE_ID is required for install");
    expect(source).toContain("write_config_value DEVICE_ID");
    expect(source).toContain("<key>RunAtLoad</key>");
    expect(source).toContain("<key>LowPriorityIO</key>");
    expect(source).toContain("<key>ProcessType</key>");
    expect(source).toContain("<string>Background</string>");
    expect(source).toContain("<key>Nice</key>");
    expect(source).toContain("launchctl bootstrap");
    expect(source).not.toContain("D584E119");
  });

  it("updates only DEVICE_ID in renew.env when reinstalling the LaunchAgent", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-daily-kanji-renew-"));
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

  it("documents install, status, and force-run commands for the agent", async () => {
    const docs = await readFile(iosAgentDocsPath, "utf8");

    expect(docs).toContain(
      "DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh"
    );
    expect(docs).toContain("./scripts/xcode-renew-if-needed.sh --status");
    expect(docs).toContain("./scripts/xcode-renew-if-needed.sh --force");
    expect(docs).toContain("renew.env");
  });

  it("lets the private sync endpoint and token flow into local Xcode installs", async () => {
    const source = await readFile(renewScriptPath, "utf8");

    expect(source).toContain('CONFIG_FILE="${CONFIG_FILE:-$STATE_DIR/renew.env}"');
    expect(source).toContain("config_value DAILY_KANJI_IOS_SYNC_ENDPOINT");
    expect(source).toContain("config_value DAILY_KANJI_IOS_SYNC_TOKEN");
    expect(source).toContain("DAILY_KANJI_IOS_SYNC_ENDPOINT=");
    expect(source).toContain("DAILY_KANJI_IOS_SYNC_TOKEN=");
    expect(source).toContain("mktemp");
    expect(source).toContain("daily-kanji-sync.XXXXXX");
    expect(source).toContain("chmod 600");
    expect(source).toContain("-quiet");
    expect(source).toContain("-xcconfig");
    expect(source).toContain("cleanup_sync_xcconfig");
    expect(source).not.toContain('"${sync_build_settings[@]}"');
    expect(source).not.toContain("XXXXXX.xcconfig");
    expect(source).not.toContain("https://");
    expect(source).not.toContain("daily-kanji-secret");
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
