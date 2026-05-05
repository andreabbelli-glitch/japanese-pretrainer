import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("with-node wrapper", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  it("puts the activated nvm Node before an existing system Node on PATH", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-with-node-"));

    const fakeHomebrewBin = path.join(tempDir, "homebrew", "bin");
    const fakeNvmDir = path.join(tempDir, ".nvm");
    const fakeNvmBin = path.join(fakeNvmDir, "versions", "node", "v22.22.1", "bin");

    await mkdir(fakeHomebrewBin, { recursive: true });
    await mkdir(fakeNvmBin, { recursive: true });

    await writeExecutable(
      path.join(fakeHomebrewBin, "node"),
      "#!/usr/bin/env bash\nprintf '%s\\n' 'v25.8.2'\n"
    );
    await writeExecutable(
      path.join(fakeNvmBin, "node"),
      "#!/usr/bin/env bash\nprintf '%s\\n' 'v22.22.1'\n"
    );
    await writeFile(
      path.join(fakeNvmDir, "nvm.sh"),
      [
        "nvm() {",
        "  if [[ \"$1\" == \"use\" ]]; then",
        "    export NVM_BIN=\"$NVM_DIR/versions/node/v22.22.1/bin\"",
        "    export PATH=\"$PATH:$NVM_BIN\"",
        "    return 0",
        "  fi",
        "  return 1",
        "}",
        ""
      ].join("\n")
    );

    const { stdout } = await execFileAsync(
      path.join(process.cwd(), "scripts", "with-node.sh"),
      ["node", "--version"],
      {
        env: {
          ...process.env,
          HOME: tempDir,
          NVM_DIR: fakeNvmDir,
          PATH: `${fakeHomebrewBin}:${process.env.PATH ?? ""}`
        }
      }
    );

    expect(stdout.trim()).toBe("v22.22.1");
  });
});

async function writeExecutable(filePath: string, source: string) {
  await writeFile(filePath, source);
  await chmod(filePath, 0o755);
}
