import { execFile } from "node:child_process";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("release check script", () => {
  let tempDirectory: string | undefined;

  afterEach(async () => {
    if (tempDirectory) {
      await rm(tempDirectory, { force: true, recursive: true });
      tempDirectory = undefined;
    }
  });

  it("uses the validating full import once and preserves the release gate order", async () => {
    tempDirectory = await mkdtemp(path.join(tmpdir(), "jcs-release-check-"));
    const scriptsDirectory = path.join(tempDirectory, "scripts");
    const releaseCheckPath = path.join(scriptsDirectory, "release-check.sh");
    const commandLogPath = path.join(tempDirectory, "commands.log");

    await mkdir(scriptsDirectory, { recursive: true });
    await cp(
      path.join(process.cwd(), "scripts", "release-check.sh"),
      releaseCheckPath
    );
    await writeExecutable(
      path.join(scriptsDirectory, "with-node.sh"),
      '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "$RELEASE_CHECK_COMMAND_LOG"\n'
    );

    const { stdout } = await execFileAsync("bash", [releaseCheckPath], {
      env: {
        ...process.env,
        RELEASE_CHECK_COMMAND_LOG: commandLogPath,
        RELEASE_CHECK_DATABASE_URL: path.join(tempDirectory, "release.sqlite")
      }
    });
    const commands = (await readFile(commandLogPath, "utf8"))
      .trim()
      .split("\n");

    expect(commands).toEqual([
      "pnpm check",
      "pnpm db:migrate",
      "pnpm content:import",
      "pnpm build",
      "pnpm pitch-accent:validate-corpus",
      "pnpm pitch-accent:validate-tofugu-pairs",
      "pnpm test:e2e:runner"
    ]);
    expect(stdout).toContain(
      "Preparazione DB SQLite + import completo validato per release"
    );
    expect(stdout).toContain(
      "content:import completo: parse e validazione di tutti i bundle prima della sync."
    );
  });
});

async function writeExecutable(filePath: string, source: string) {
  await writeFile(filePath, source);
  await chmod(filePath, 0o755);
}
