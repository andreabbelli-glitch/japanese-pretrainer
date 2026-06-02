import "./load-env.ts";

import { existsSync } from "node:fs";

class AppProgressBriefCliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const { resolveDatabaseLocation } = await import("../src/db/config.ts");
  const location = resolveDatabaseLocation(process.env.DATABASE_URL);

  assertReadableDatabaseLocation(location);

  const { closeDatabaseClient, createDatabaseClient } = await import(
    "../src/db/create-client.ts"
  );
  const {
    buildAppProgressBrief,
    formatAppProgressBrief
  } = await import("../src/features/progress/tooling/app-progress-brief.ts");
  const database = createDatabaseClient({
    databaseUrl: location.configuredPath
  });

  try {
    const result = await buildAppProgressBrief({
      database,
      databaseInfo: {
        configuredPath: location.configuredPath,
        isRemote: location.isRemote
      },
      limit: cliOptions.limit,
      mediaSlug: cliOptions.mediaSlug ?? undefined
    });

    process.stdout.write(
      cliOptions.json
        ? `${JSON.stringify(result)}\n`
        : formatAppProgressBrief(result)
    );
  } finally {
    closeDatabaseClient(database);
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  json: boolean;
  limit: number;
  mediaSlug: string | null;
};

type DatabaseLocation = {
  configuredPath: string;
  databasePath?: string;
  isRemote: boolean;
};

function resolveCliOptions(args: string[]): CliOptions {
  let json = false;
  let limit = 10;
  let mediaSlug: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--limit") {
      limit = readPositiveInteger(args, index, "--limit");
      index += 1;
      continue;
    }

    if (value === "--media-slug" || value === "-m") {
      mediaSlug = readSafeSlug(args, index, value);
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    throw new Error(`Unexpected positional argument: ${value}`);
  }

  return {
    json,
    limit,
    mediaSlug
  };
}

function assertReadableDatabaseLocation(location: DatabaseLocation) {
  if (location.isRemote || !location.databasePath) {
    return;
  }

  if (!existsSync(location.databasePath)) {
    throw new AppProgressBriefCliError(
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

function readSafeSlug(args: string[], index: number, flag: string) {
  const value = readOptionValue(args, index, flag);

  if (!/^[a-z0-9][a-z0-9-]*$/u.test(value)) {
    throw new Error(`${flag} must be a URL-safe slug segment.`);
  }

  return value;
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    if (isMissingSchemaError(error)) {
      return "app:progress-brief failed: database schema is not initialized. Run `./scripts/with-node.sh pnpm db:migrate` for the target DATABASE_URL.";
    }

    return error.message;
  }

  return "app:progress-brief failed with an unknown error.";
}

function isMissingSchemaError(error: Error) {
  return /no such table|SQLITE_UNKNOWN|SQLITE_ERROR/u.test(error.message);
}

function readExitCode(error: unknown) {
  return error instanceof AppProgressBriefCliError ? error.exitCode : 1;
}
