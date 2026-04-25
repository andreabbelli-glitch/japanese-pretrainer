import path from "node:path";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const wrapperPath = path.join(
  repoRoot,
  ".agents",
  "skills",
  "forvo-pronunciations",
  "scripts",
  "run_forvo_fetch.sh"
);

describe("forvo pronunciations skill wrapper", () => {
  let tempRepo = "";
  let capturedArgsPath = "";

  beforeEach(async () => {
    tempRepo = await mkdtemp(path.join(tmpdir(), "jcs-forvo-wrapper-"));
    capturedArgsPath = path.join(tempRepo, "captured-args.txt");
    await mkdir(path.join(tempRepo, "scripts"), { recursive: true });
    await writeFile(path.join(tempRepo, "package.json"), "{}\n");
    await writeFile(
      path.join(tempRepo, "scripts", "with-node.sh"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "printf '%s\\n' \"$@\" > \"$CAPTURED_ARGS_PATH\""
      ].join("\n")
    );
    await chmod(path.join(tempRepo, "scripts", "with-node.sh"), 0o755);
  });

  afterEach(async () => {
    await rm(tempRepo, { force: true, recursive: true });
  });

  it("routes mode runs through the resolver and defaults to a ten item batch", async () => {
    await runWrapper("--mode", "review");

    await expectCapturedArgs([
      "pnpm",
      "pronunciations:resolve",
      "--",
      "--mode",
      "review",
      "--limit",
      "10"
    ]);
  });

  it("routes targeted fallback runs through manual Forvo with the same default batch limit", async () => {
    await runWrapper("--media", "sample-game", "--entry", "term-yomu");

    await expectCapturedArgs([
      "pnpm",
      "pronunciations:forvo",
      "--",
      "--manual",
      "--media",
      "sample-game",
      "--entry",
      "term-yomu",
      "--limit",
      "10"
    ]);
  });

  it("preserves an explicit limit and accepts equals-form mode arguments", async () => {
    await runWrapper("--mode=review", "--limit", "3");

    await expectCapturedArgs([
      "pnpm",
      "pronunciations:resolve",
      "--",
      "--mode=review",
      "--limit",
      "3"
    ]);
  });

  async function runWrapper(...args: string[]) {
    await execFileAsync(wrapperPath, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        CAPTURED_ARGS_PATH: capturedArgsPath,
        JAPANESE_CUSTOM_STUDY_ROOT: tempRepo
      }
    });
  }

  async function expectCapturedArgs(expected: string[]) {
    const captured = await readFile(capturedArgsPath, "utf8");

    expect(captured.trimEnd().split("\n")).toEqual(expected);
  }
});
