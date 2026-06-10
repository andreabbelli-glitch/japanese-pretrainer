import "./load-env.ts";

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildDailyKanjiDataset,
  dailyKanjiDefaultExportLimit,
  dailyKanjiDefaultRecentMistakeLookbackDays
} from "../src/features/daily-kanji/server/exporter.ts";

class DailyKanjiExportCliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

const defaultOutputPath = path.join(
  process.cwd(),
  "apps",
  "daily-kanji-ios",
  "App",
  "Resources",
  "daily-kanji-cards.json"
);

try {
  const options = resolveCliOptions(process.argv.slice(2));
  const { resolveDatabaseLocation } = await import("../src/db/config.ts");
  const location = resolveDatabaseLocation(process.env.DATABASE_URL);

  assertReadableDatabaseLocation(location);

  const { closeDatabaseClient, createDatabaseClient } =
    await import("../src/db/create-client.ts");
  const database = createDatabaseClient({
    databaseUrl: location.configuredPath
  });

  try {
    const dataset = await buildDailyKanjiDataset({
      database,
      limit: options.limit,
      recentMistakeLookbackDays: options.lookbackDays
    });
    const outputPath = path.resolve(options.outputPath);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(dataset, null, 2)}\n`,
      "utf8"
    );

    process.stdout.write(
      `Wrote ${dataset.cards.length} Daily Kanji cards to ${outputPath}\n`
    );
  } finally {
    closeDatabaseClient(database);
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  limit: number;
  lookbackDays: number;
  outputPath: string;
};

type DatabaseLocation = {
  configuredPath: string;
  databasePath?: string;
  isRemote: boolean;
};

function resolveCliOptions(args: string[]): CliOptions {
  let limit = dailyKanjiDefaultExportLimit;
  let lookbackDays = dailyKanjiDefaultRecentMistakeLookbackDays;
  let outputPath = defaultOutputPath;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--limit") {
      limit = readPositiveInteger(args, index, "--limit");
      index += 1;
      continue;
    }

    if (value === "--lookback-days") {
      lookbackDays = readPositiveInteger(args, index, "--lookback-days");
      index += 1;
      continue;
    }

    if (value === "--out") {
      outputPath = readOptionValue(args, index, "--out");
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    throw new Error(`Unexpected positional argument: ${value}`);
  }

  return {
    limit,
    lookbackDays,
    outputPath
  };
}

function assertReadableDatabaseLocation(location: DatabaseLocation) {
  if (location.isRemote || !location.databasePath) {
    return;
  }

  if (!existsSync(location.databasePath)) {
    throw new DailyKanjiExportCliError(
      `Local runtime database does not exist: ${location.databasePath}`,
      2
    );
  }
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readPositiveInteger(args: string[], index: number, flag: string) {
  const value = readOptionValue(args, index, flag);

  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return Number.parseInt(value, 10);
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    if (isMissingSchemaError(error)) {
      return "daily-kanji:export failed: database schema is not initialized. Run `./scripts/with-node.sh pnpm db:migrate` for the target DATABASE_URL.";
    }

    return error.message;
  }

  return "daily-kanji:export failed with an unknown error.";
}

function isMissingSchemaError(error: Error) {
  return /no such table|SQLITE_UNKNOWN|SQLITE_ERROR/u.test(error.message);
}

function readExitCode(error: unknown) {
  return error instanceof DailyKanjiExportCliError ? error.exitCode : 1;
}
