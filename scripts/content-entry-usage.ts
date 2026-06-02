import path from "node:path";

import {
  parseMediaDirectory,
  type ValidationIssue
} from "../src/features/content/index.ts";
import {
  buildContentEntryUsage,
  formatContentEntryUsage,
  type ContentEntryUsageKind
} from "../src/features/content/tooling/entry-usage.ts";

class ContentEntryUsageError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const bundle = await loadBundle(cliOptions);
  const result = buildContentEntryUsage({
    bundles: [bundle],
    cardLimit: cliOptions.cardLimit,
    entryId: cliOptions.entryId ?? undefined,
    kind: cliOptions.kind ?? undefined,
    mediaSlug: cliOptions.mediaSlug,
    repositoryRoot: process.cwd(),
    surface: cliOptions.surface ?? undefined,
    usageLimit: cliOptions.usageLimit
  });

  process.stdout.write(
    cliOptions.json
      ? `${JSON.stringify(result)}\n`
      : formatContentEntryUsage(result)
  );

  if ("error" in result) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  cardLimit: number;
  contentRoot: string;
  entryId: string | null;
  json: boolean;
  kind: ContentEntryUsageKind | null;
  mediaSlug: string;
  surface: string | null;
  usageLimit: number;
};

async function loadBundle(cliOptions: CliOptions) {
  const result = await parseMediaDirectory(
    path.join(cliOptions.contentRoot, "media", cliOptions.mediaSlug)
  );

  if (!result.ok) {
    throw new ContentEntryUsageError(
      `content:entry-usage failed: media '${cliOptions.mediaSlug}' is invalid.\n${formatIssues(result.issues)}`,
      2
    );
  }

  return result.data;
}

function resolveCliOptions(args: string[]): CliOptions {
  let cardLimit = 5;
  let contentRoot = path.resolve(process.cwd(), "content");
  let entryId: string | null = null;
  let json = false;
  let kind: ContentEntryUsageKind | null = null;
  let mediaSlug: string | null = null;
  let surface: string | null = null;
  let usageLimit = 12;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--card-limit") {
      cardLimit = readPositiveInteger(args, index, "--card-limit");
      index += 1;
      continue;
    }

    if (value === "--content-root") {
      contentRoot = path.resolve(
        readOptionValue(args, index, "--content-root")
      );
      index += 1;
      continue;
    }

    if (value === "--entry-id") {
      if (entryId !== null) {
        throw new Error("--entry-id cannot be provided more than once.");
      }

      entryId = readOptionValue(args, index, "--entry-id");
      index += 1;
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--kind" || value === "-k") {
      kind = readEnumOption(args, index, value, ["grammar", "term"] as const);
      index += 1;
      continue;
    }

    if (value === "--media-slug" || value === "-m") {
      mediaSlug = readSafeSlug(args, index, value);
      index += 1;
      continue;
    }

    if (value === "--surface") {
      if (surface !== null) {
        throw new Error("--surface cannot be provided more than once.");
      }

      surface = readOptionValue(args, index, "--surface");
      index += 1;
      continue;
    }

    if (value === "--usage-limit") {
      usageLimit = readPositiveInteger(args, index, "--usage-limit");
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    if (surface !== null) {
      throw new Error(
        "--surface cannot be combined with a positional surface."
      );
    }

    surface = surface === null ? value : `${surface} ${value}`;
  }

  if (!mediaSlug) {
    throw new Error("--media-slug is required.");
  }

  if (!entryId && !surface) {
    throw new Error("Missing --entry-id or --surface.");
  }

  if (entryId && surface) {
    throw new Error(
      "--entry-id cannot be combined with --surface or a positional surface."
    );
  }

  return {
    cardLimit,
    contentRoot,
    entryId,
    json,
    kind,
    mediaSlug,
    surface,
    usageLimit
  };
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readSafeSlug(args: string[], index: number, flag: string) {
  const value = readOptionValue(args, index, flag);

  if (!/^[a-z0-9][a-z0-9-]*$/u.test(value)) {
    throw new Error(`${flag} must be a URL-safe slug segment.`);
  }

  return value;
}

function readEnumOption<T extends readonly string[]>(
  args: string[],
  index: number,
  flag: string,
  allowed: T
): T[number] {
  const value = readOptionValue(args, index, flag);

  if (!allowed.includes(value)) {
    throw new Error(`${flag} must be one of: ${allowed.join(", ")}.`);
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

function formatIssues(issues: ValidationIssue[]) {
  return issues
    .map(
      (issue) => `${issue.code} ${issue.location.filePath}: ${issue.message}`
    )
    .join("\n");
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "content:entry-usage failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof ContentEntryUsageError ? error.exitCode : 1;
}
