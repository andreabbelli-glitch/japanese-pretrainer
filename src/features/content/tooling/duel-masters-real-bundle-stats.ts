import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  closeDatabaseClient,
  createDatabaseClient
} from "../../../db/create-client.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  grammarAlias,
  grammarPattern,
  term,
  termAlias
} from "../../../db/schema/index.ts";
import { parseMediaDirectory } from "../validator.ts";

const duelMastersMediaSlug = "duel-masters-dm25";

export interface DuelMastersRealBundleStats {
  parser: {
    lessons: number;
    cardFiles: number;
    terms: number;
    grammarPatterns: number;
    cards: number;
    references: number;
  };
  importer: {
    term: number;
    termAlias: number;
    grammarPattern: number;
    grammarAlias: number;
    entryLink: number;
    card: number;
    cardEntryLink: number;
  };
}

export type RealBundleStatsCliOptions = {
  acceptFailure: boolean;
  contentRoot: string;
  diff: boolean;
  expectedStatsPath: string;
  write: boolean;
};

export type RealBundleStatsCommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type RealBundleStatsCommandDependencies = {
  collectStats: (contentRoot: string) => Promise<DuelMastersRealBundleStats>;
  readExistingStats: (statsPath: string) => Promise<string | null>;
  readRequiredStats: (statsPath: string) => Promise<DuelMastersRealBundleStats>;
  writeStatsFile: (statsPath: string, source: string) => Promise<void>;
};

export function getDuelMastersRealBundleStatsPath(repositoryRoot: string) {
  return path.join(
    repositoryRoot,
    "tests",
    "fixtures",
    "content",
    "duel-masters-real-bundle-stats.json"
  );
}

export function resolveRealBundleStatsCliOptions(
  args: string[],
  options: {
    cwd: string;
    defaultExpectedStatsPath: string;
  }
): RealBundleStatsCliOptions {
  let acceptFailure = false;
  let contentRoot = path.resolve(options.cwd, "content");
  let diff = false;
  let expectedStatsPath = options.defaultExpectedStatsPath;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      const nextValue = readOptionValue(args, index, value);

      contentRoot = path.resolve(options.cwd, nextValue);
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
      const nextValue = readOptionValue(args, index, value);

      expectedStatsPath = path.resolve(options.cwd, nextValue);
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

  if (!diff && expectedStatsPath !== options.defaultExpectedStatsPath) {
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

export async function runRealBundleStatsCommand(input: {
  args: string[];
  cwd: string;
  dependencies?: Partial<RealBundleStatsCommandDependencies>;
  repositoryRoot: string;
}): Promise<RealBundleStatsCommandResult> {
  const dependencies: RealBundleStatsCommandDependencies = {
    collectStats: collectDuelMastersRealBundleStats,
    readExistingStats,
    readRequiredStats,
    writeStatsFile: async (statsPath, source) => {
      await writeFile(statsPath, source, "utf8");
    },
    ...input.dependencies
  };
  const defaultExpectedStatsPath = getDuelMastersRealBundleStatsPath(
    input.repositoryRoot
  );
  const cliOptions = resolveRealBundleStatsCliOptions(input.args, {
    cwd: input.cwd,
    defaultExpectedStatsPath
  });
  let nextStats: DuelMastersRealBundleStats;

  try {
    nextStats = await dependencies.collectStats(cliOptions.contentRoot);
  } catch (error) {
    if (!cliOptions.acceptFailure) {
      throw error;
    }

    return {
      exitCode: 0,
      stderr: `Accepted real bundle stats failure: ${formatError(error)}\n`,
      stdout: ""
    };
  }

  const formattedStats = `${JSON.stringify(nextStats, null, 2)}\n`;

  if (cliOptions.diff) {
    const previousStats = await dependencies.readRequiredStats(
      cliOptions.expectedStatsPath
    );
    const diffLines = formatStatsDiff(previousStats, nextStats);
    const relativeStatsPath = path.relative(
      input.cwd,
      cliOptions.expectedStatsPath
    );

    if (diffLines.length === 0) {
      return {
        exitCode: 0,
        stderr: "",
        stdout: `CONTENT_CANARY_DIFF clean ${relativeStatsPath}\n`
      };
    }

    return {
      exitCode: 1,
      stderr: "",
      stdout: [
        `CONTENT_CANARY_DIFF changed ${relativeStatsPath}`,
        ...diffLines,
        "COMMAND ./scripts/with-node.sh pnpm content:test-stats -- --write",
        ""
      ].join("\n")
    };
  }

  if (!cliOptions.write) {
    return {
      exitCode: 0,
      stderr: "",
      stdout: formattedStats
    };
  }

  const previousStats = await dependencies.readExistingStats(
    defaultExpectedStatsPath
  );

  await dependencies.writeStatsFile(defaultExpectedStatsPath, formattedStats);

  const status =
    previousStats === null
      ? "Created"
      : previousStats === formattedStats
        ? "Verified"
        : "Updated";

  return {
    exitCode: 0,
    stderr: "",
    stdout: `${status} ${path.relative(input.cwd, defaultExpectedStatsPath)}.\n`
  };
}

export async function collectDuelMastersRealBundleStats(
  contentRoot: string
): Promise<DuelMastersRealBundleStats> {
  const [{ runMigrations }, { importContentWorkspace }] = await Promise.all([
    import("../../../db/migrate.ts"),
    import("../importer.ts")
  ]);
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
    };
  } finally {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function formatStatsDiff(
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

export function formatUnexpectedRealBundleStatsError(error: unknown) {
  return `Failed to compute real bundle stats: ${formatError(error)}`;
}

function readOptionValue(args: string[], index: number, option: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}.`);
  }

  return value;
}

async function readExistingStats(statsPath: string) {
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

function formatError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "unknown error";
}
