import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { importMinimalPairsCorpus } from "../src/features/pitch-accent/tooling/importer.ts";

const execFileAsync = promisify(execFile);

const DEFAULT_REPOSITORY_URL = "https://github.com/Kuuuube/minimal-pairs";
const DEFAULT_REVISION = "774a17422a6baadce5877c10069a1d40648e20a9";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repositoryUrl = args["repo-url"] ?? DEFAULT_REPOSITORY_URL;
  const revision = args.ref ?? DEFAULT_REVISION;
  const outDir = path.resolve(args["out-dir"] ?? "public/vendor/minimal-pairs");
  const dryRun = args["dry-run"] === "true";
  const allowNonVendorOutDir = args["allow-non-vendor-out-dir"] === "true";
  const tempDir = args["source-dir"]
    ? null
    : await mkdtemp(path.join(tmpdir(), "minimal-pairs-source-"));
  const sourceDir = args["source-dir"]
    ? path.resolve(args["source-dir"])
    : tempDir!;

  try {
    if (tempDir) {
      await checkoutRepository({
        repositoryUrl,
        revision,
        sourceDir
      });
    }

    const actualRevision = tempDir
      ? await gitOutput(["-C", sourceDir, "rev-parse", "HEAD"])
      : revision;
    const result = await importMinimalPairsCorpus({
      allowNonVendorOutDir,
      dryRun,
      outDir,
      repositoryUrl,
      revision: actualRevision,
      sourceDir
    });

    console.log(
      [
        `Imported ${result.pairCount} pitch-accent minimal pairs`,
        `${result.variantCount} variants`,
        `${result.audioFileCount} audio files`,
        dryRun ? "(dry run)" : `to ${outDir}`
      ].join(", ")
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function parseArgs(args: string[]) {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--dry-run") {
      parsed["dry-run"] = "true";
      continue;
    }
    if (arg === "--allow-non-vendor-out-dir") {
      parsed["allow-non-vendor-out-dir"] = "true";
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

async function checkoutRepository(input: {
  readonly repositoryUrl: string;
  readonly revision: string;
  readonly sourceDir: string;
}) {
  await execFileAsync("git", ["init", input.sourceDir]);
  await execFileAsync("git", [
    "-C",
    input.sourceDir,
    "remote",
    "add",
    "origin",
    input.repositoryUrl
  ]);
  await execFileAsync("git", [
    "-C",
    input.sourceDir,
    "fetch",
    "--depth",
    "1",
    "origin",
    input.revision
  ]);
  await execFileAsync("git", [
    "-C",
    input.sourceDir,
    "checkout",
    "--force",
    "FETCH_HEAD"
  ]);
}

async function gitOutput(args: readonly string[]) {
  const { stdout } = await execFileAsync("git", [...args]);

  return stdout.trim();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
