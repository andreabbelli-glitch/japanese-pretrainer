import path from "node:path";

import { validateGeneratedMinimalPairsCorpus } from "../src/features/pitch-accent/tooling/validator.ts";

async function main() {
  const outDir = path.resolve(
    parseOutDir(process.argv.slice(2)) ?? "public/vendor/minimal-pairs"
  );
  const result = await validateGeneratedMinimalPairsCorpus({ outDir });

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Minimal pairs corpus is valid: ${outDir}`);
}

function parseOutDir(args: readonly string[]) {
  if (args.length === 0) {
    return null;
  }
  if (args.length === 2 && args[0] === "--out-dir") {
    return args[1] ?? null;
  }

  throw new Error("Usage: validate-minimal-pairs-corpus [--out-dir <path>]");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
