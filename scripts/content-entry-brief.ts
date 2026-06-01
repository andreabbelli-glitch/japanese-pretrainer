import path from "node:path";

import {
  parseContentRoot,
  parseMediaDirectory,
  type ValidationIssue
} from "../src/features/content/index.ts";
import {
  buildContentEntryBrief,
  formatContentEntryBrief,
  type ContentEntryBriefKind
} from "../src/features/content/tooling/entry-brief.ts";

class ContentEntryBriefError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const bundles = await loadBundles(cliOptions);
  const result = buildContentEntryBrief({
    bundles,
    cardLimit: cliOptions.cardLimit,
    entryId: cliOptions.entryId ?? undefined,
    kind: cliOptions.kind ?? undefined,
    mediaSlug: cliOptions.mediaSlug ?? undefined,
    query: cliOptions.query ?? undefined,
    referenceLimit: cliOptions.referenceLimit,
    repositoryRoot: process.cwd()
  });

  process.stdout.write(
    cliOptions.json
      ? `${JSON.stringify(result)}\n`
      : formatContentEntryBrief(result)
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
  kind: ContentEntryBriefKind | null;
  mediaSlug: string | null;
  query: string | null;
  referenceLimit: number;
};

async function loadBundles(cliOptions: CliOptions) {
  if (cliOptions.mediaSlug) {
    const result = await parseMediaDirectory(
      path.join(cliOptions.contentRoot, "media", cliOptions.mediaSlug)
    );

    if (!result.ok) {
      throw new ContentEntryBriefError(
        `content:entry-brief failed: media '${cliOptions.mediaSlug}' is invalid.\n${formatIssues(result.issues)}`,
        2
      );
    }

    return [result.data];
  }

  const result = await parseContentRoot(cliOptions.contentRoot);

  if (!result.ok) {
    throw new ContentEntryBriefError(
      `content:entry-brief failed: content root is invalid.\n${formatIssues(result.issues)}`,
      2
    );
  }

  return result.data.bundles;
}

function resolveCliOptions(args: string[]): CliOptions {
  let cardLimit = 5;
  let contentRoot = path.resolve(process.cwd(), "content");
  let entryId: string | null = null;
  let json = false;
  let kind: ContentEntryBriefKind | null = null;
  let mediaSlug: string | null = null;
  let query: string | null = null;
  let referenceLimit = 5;

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

    if (value === "--reference-limit") {
      referenceLimit = readPositiveInteger(args, index, "--reference-limit");
      index += 1;
      continue;
    }

    if (value === "--surface") {
      query = readOptionValue(args, index, "--surface");
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    query = query === null ? value : `${query} ${value}`;
  }

  if (!entryId && !query) {
    throw new Error("Missing entry query or --entry-id.");
  }

  if (entryId && query) {
    throw new Error("--entry-id cannot be combined with an entry query.");
  }

  return {
    cardLimit,
    contentRoot,
    entryId,
    json,
    kind,
    mediaSlug,
    query,
    referenceLimit
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

  return "content:entry-brief failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof ContentEntryBriefError ? error.exitCode : 1;
}
