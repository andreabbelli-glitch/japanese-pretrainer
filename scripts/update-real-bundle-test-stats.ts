import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatUnexpectedRealBundleStatsError,
  runRealBundleStatsCommand
} from "../src/features/content/tooling/duel-masters-real-bundle-stats.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

try {
  const result = await runRealBundleStatsCommand({
    args: process.argv.slice(2),
    cwd: process.cwd(),
    repositoryRoot
  });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} catch (error) {
  console.error(formatUnexpectedRealBundleStatsError(error));
  process.exitCode = 1;
}
