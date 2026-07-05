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
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const iosRoot = path.join(process.cwd(), "apps", "daily-kanji-ios");
const renewIfNeededScriptPath = path.join(
  iosRoot,
  "scripts",
  "xcode-renew-if-needed.sh"
);
const execFileAsync = promisify(execFile);

describe("Daily Kanji iOS launchd reschedule safety", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("reschedules launchd even when another renew lock is active", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-active-lock-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const stateDir = path.join(tempRoot, "state");
    const lockDir = path.join(stateDir, "renew.lock");
    const callLogPath = path.join(tempRoot, "calls.log");
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(lockDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
    await writeFile(
      path.join(lockDir, "epoch"),
      `${Math.floor(Date.now() / 1000)}\n`
    );
    await writeFile(path.join(lockDir, "pid"), "12345\n");
    await writeFile(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      await readFile(renewIfNeededScriptPath, "utf8")
    );
    await chmod(
      path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh"),
      0o755
    );
    await writeExecutable(
      path.join(tempIosScriptsRoot, "install-renew-launchd.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "install-renew-launchd:%s\\n" "$*" >> "$CALL_LOG"'
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
          DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD: "1",
          DAILY_KANJI_LAUNCHD_RESCHEDULE_SYNCHRONOUS: "1",
          STATE_DIR: stateDir
        }
      }
    );

    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Daily Kanji renew already running"
    );
    expect(await readFile(callLogPath, "utf8")).toContain(
      "install-renew-launchd:--reschedule-only"
    );
    await expect(stat(lockDir)).resolves.toBeTruthy();
  });

  it("logs asynchronous launchd reschedule failures", async () => {
    const tempRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-daily-kanji-reschedule-log-")
    );
    tempDirs.push(tempRoot);
    const repoRoot = path.join(tempRoot, "repo");
    const tempIosScriptsRoot = path.join(
      repoRoot,
      "apps",
      "daily-kanji-ios",
      "scripts"
    );
    const stateDir = path.join(tempRoot, "state");
    const logDir = path.join(tempRoot, "logs");
    const nowEpoch = Math.floor(Date.now() / 1000);
    await mkdir(tempIosScriptsRoot, { recursive: true });
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "renew.env"),
      "DEVICE_ID=TEST_DEVICE\n"
    );
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
      path.join(tempIosScriptsRoot, "install-renew-launchd.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'echo "installer stdout"',
        'echo "installer stderr" >&2',
        "exit 23"
      ].join("\n") + "\n"
    );

    const result = await execFileAsync(
      "bash",
      [path.join(tempIosScriptsRoot, "xcode-renew-if-needed.sh")],
      {
        cwd: "/",
        env: {
          ...process.env,
          DAILY_KANJI_AUTO_RESCHEDULE_LAUNCHD: "1",
          DAILY_KANJI_LAUNCHD_RESCHEDULE_DELAY_SECONDS: "0",
          LOG_DIR: logDir,
          STATE_DIR: stateDir
        }
      }
    );

    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Daily Kanji renew not due"
    );
    expect(
      await waitForFileContaining(
        path.join(logDir, "xcode-renew.out.log"),
        "installer stdout"
      )
    ).toContain("installer stdout");
    expect(
      await waitForFileContaining(
        path.join(logDir, "xcode-renew.err.log"),
        "Daily Kanji LaunchAgent reschedule failed with exit 23"
      )
    ).toContain("installer stderr");
  });
});

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents);
  await chmod(filePath, 0o755);
}

async function waitForFileContaining(
  filePath: string,
  expectedText: string,
  timeoutMs = 3000
) {
  const deadline = Date.now() + timeoutMs;
  let lastContents = "";
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      lastContents = await readFile(filePath, "utf8");
      if (lastContents.includes(expectedText)) {
        return lastContents;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(50);
  }

  throw new Error(
    `Timed out waiting for ${filePath} to contain ${JSON.stringify(expectedText)}. Last contents: ${JSON.stringify(lastContents)}. Last error: ${String(lastError)}`
  );
}
