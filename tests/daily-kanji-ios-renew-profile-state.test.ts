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
const renewScriptPath = path.join(iosRoot, "scripts", "xcode-renew.sh");
const recoveryHelperPath = path.join(
  iosRoot,
  "scripts",
  "coredevice-recovery.sh"
);
const execFileAsync = promisify(execFile);

describe("Daily Kanji standalone provisioning profile state", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
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
        '  if [ "$1" = "-i" ]; then',
        "    shift",
        '    input="${1:-}"',
        "  fi",
        "  shift || true",
        "done",
        'expiry="2026-07-12T08:00:00Z"',
        'uuid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"',
        'case "$input" in',
        '  *".appex/embedded.mobileprovision")',
        '    expiry="2026-07-10T08:00:00Z"',
        '    uuid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"',
        "    ;;",
        "esac",
        "cat <<PLIST",
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
        '<plist version="1.0">',
        "<dict>",
        "  <key>ExpirationDate</key>",
        "  <date>$expiry</date>",
        "  <key>UUID</key>",
        "  <string>$uuid</string>",
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
          COREDEVICE_RECOVERY_HELPER: recoveryHelperPath,
          DERIVED_DATA: derivedData,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          STATE_DIR: stateDir
        }
      }
    );

    expect(
      await readFile(path.join(stateDir, "profile-state.env"), "utf8")
    ).toBe(
      [
        "VERSION=1",
        `EXPIRY_EPOCH=${expectedMinExpiry}`,
        "PROFILE_UUID=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "PROFILE_UUID=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ""
      ].join("\n")
    );
  });
});

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents);
  await chmod(filePath, 0o755);
}
