import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { closeDatabaseClient, createDatabaseClient } from "../src/db/client.ts";
import { runMigrations } from "../src/db/migrate.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  grammarAlias,
  grammarPattern,
  term,
  termAlias
} from "../src/db/schema/index.ts";
import { importContentWorkspace } from "../src/features/content/importer.ts";
import { parseMediaDirectory } from "../src/features/content/validator.ts";
import {
  duelMastersRealBundleStatsPath,
  type DuelMastersRealBundleStats
} from "../tests/helpers/duel-masters-real-bundle-stats.ts";

const duelMastersMediaSlug = "duel-masters-dm25";

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  let nextStats: DuelMastersRealBundleStats;

  try {
    nextStats = await collectDuelMastersRealBundleStats(
      cliOptions.contentRoot
    );
  } catch (error) {
    if (cliOptions.acceptFailure) {
      console.error(`Accepted real bundle stats failure: ${formatError(error)}`);
    } else {
      throw error;
    }

    process.exit(0);
  }

  const formattedStats = `${JSON.stringify(nextStats, null, 2)}\n`;

  if (cliOptions.diff) {
    const previousStats = await readRequiredStats(cliOptions.expectedStatsPath);
    const diffLines = formatStatsDiff(previousStats, nextStats);
    const relativeStatsPath = path.relative(
      process.cwd(),
      cliOptions.expectedStatsPath
    );

    if (diffLines.length === 0) {
      console.info(`CONTENT_CANARY_DIFF clean ${relativeStatsPath}`);
    } else {
      console.info(`CONTENT_CANARY_DIFF changed ${relativeStatsPath}`);

      for (const line of diffLines) {
        console.info(line);
      }

      console.info(
        "COMMAND ./scripts/with-node.sh pnpm content:test-stats -- --write"
      );
      process.exitCode = 1;
    }
  } else if (!cliOptions.write) {
    process.stdout.write(formattedStats);
  } else {
    const previousStats = await readExistingStats();

    await writeFile(duelMastersRealBundleStatsPath, formattedStats, "utf8");

    const status =
      previousStats === null
        ? "Created"
        : previousStats === formattedStats
          ? "Verified"
          : "Updated";

    console.info(
      `${status} ${path.relative(process.cwd(), duelMastersRealBundleStatsPath)}.`
    );
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

async function collectDuelMastersRealBundleStats(contentRoot: string) {
  const mediaDirectory = path.join(contentRoot, "media", duelMastersMediaSlug);
  const parseResult = await parseMediaDirectory(mediaDirectory);

  if (!parseResult.ok) {
    throw new Error(
      `Could not parse '${duelMastersMediaSlug}': ${parseResult.issues.length} validation issue(s).`
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-real-bundle-stats-"));
  const database = createDatabaseClient({
    databaseUrl: path.join(tempDir, "real-bundle-stats.sqlite")
  });

  try {
    await runMigrations(database);

    const importResult = await importContentWorkspace({
      contentRoot,
      mediaSlugs: [duelMastersMediaSlug],
      database
    });

    if (importResult.status === "failed") {
      throw new Error(
        `Could not import '${duelMastersMediaSlug}': ${importResult.issues.length} validation issue(s).`
      );
    }

    const [
      termCount,
      termAliasCount,
      grammarPatternCount,
      grammarAliasCount,
      entryLinkCount,
      cardCount,
      cardEntryLinkCount
    ] = await Promise.all([
      database.$count(term),
      database.$count(termAlias),
      database.$count(grammarPattern),
      database.$count(grammarAlias),
      database.$count(entryLink),
      database.$count(card),
      database.$count(cardEntryLink)
    ]);

    return {
      parser: {
        lessons: parseResult.data.lessons.length,
        cardFiles: parseResult.data.cardFiles.length,
        terms: parseResult.data.terms.length,
        grammarPatterns: parseResult.data.grammarPatterns.length,
        cards: parseResult.data.cards.length,
        references: parseResult.data.references.length
      },
      importer: {
        term: termCount,
        termAlias: termAliasCount,
        grammarPattern: grammarPatternCount,
        grammarAlias: grammarAliasCount,
        entryLink: entryLinkCount,
        card: cardCount,
        cardEntryLink: cardEntryLinkCount
      }
    } satisfies DuelMastersRealBundleStats;
  } finally {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  }
}

function resolveCliOptions(args: string[]) {
  let acceptFailure = false;
  let contentRoot = path.resolve(process.cwd(), "content");
  let diff = false;
  let expectedStatsPath = duelMastersRealBundleStatsPath;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      const nextValue = args[index + 1];

      if (!nextValue || nextValue.startsWith("--")) {
        throw new Error("Missing value for --content-root.");
      }

      contentRoot = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (value === "--write") {
      write = true;
      continue;
    }

    if (value === "--diff") {
      diff = true;
      continue;
    }

    if (value === "--expected-stats-file") {
      const nextValue = args[index + 1];

      if (!nextValue || nextValue.startsWith("--")) {
        throw new Error("Missing value for --expected-stats-file.");
      }

      expectedStatsPath = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (value === "--accept-failure") {
      acceptFailure = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (acceptFailure && write) {
    throw new Error("--accept-failure cannot be combined with --write.");
  }

  if (diff && write) {
    throw new Error("--diff cannot be combined with --write.");
  }

  if (diff && acceptFailure) {
    throw new Error("--diff cannot be combined with --accept-failure.");
  }

  if (!diff && expectedStatsPath !== duelMastersRealBundleStatsPath) {
    throw new Error("--expected-stats-file can only be used with --diff.");
  }

  return {
    acceptFailure,
    contentRoot,
    diff,
    expectedStatsPath,
    write
  };
}

async function readExistingStats(statsPath = duelMastersRealBundleStatsPath) {
  try {
    return await readFile(statsPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

async function readRequiredStats(statsPath: string) {
  const source = await readExistingStats(statsPath);

  if (source === null) {
    throw new Error(`Expected stats file not found: ${statsPath}`);
  }

  return JSON.parse(source) as DuelMastersRealBundleStats;
}

function formatStatsDiff(
  previousStats: DuelMastersRealBundleStats,
  nextStats: DuelMastersRealBundleStats
) {
  const previousByKey = flattenStats(previousStats);
  const nextByKey = flattenStats(nextStats);
  const keys = [...new Set([...previousByKey.keys(), ...nextByKey.keys()])];
  const lines: string[] = [];

  for (const key of keys) {
    const previousValue = previousByKey.get(key);
    const nextValue = nextByKey.get(key);

    if (previousValue === nextValue) {
      continue;
    }

    lines.push(
      `${key}: ${previousValue ?? "missing"} -> ${nextValue ?? "missing"}`
    );
  }

  return lines;
}

function flattenStats(stats: DuelMastersRealBundleStats) {
  const entries: Array<[string, number]> = [];

  for (const section of ["parser", "importer"] as const) {
    const values = stats[section] as Record<string, number>;

    for (const [key, value] of Object.entries(values)) {
      entries.push([`${section}.${key}`, value]);
    }
  }

  return new Map(entries);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "ENOENT"
  );
}

function formatUnexpectedError(error: unknown) {
  return `Failed to compute real bundle stats: ${formatError(error)}`;
}

function formatError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "unknown error";
}
