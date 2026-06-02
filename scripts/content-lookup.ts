import path from "node:path";

import {
  formatLookupBatchResult,
  formatListResult,
  formatLookupResult,
  listContent,
  lookupContentBatch,
  lookupContent,
  type ContentLookupBatchQuery,
  type ContentLookupKind,
  type ContentLookupListKind
} from "../src/features/content/tooling/lookup.ts";
import {
  parseContentRoot,
  parseMediaDirectory,
  type ValidationIssue
} from "../src/features/content/index.ts";

class ContentLookupError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const bundles = await loadBundles(cliOptions);

  if (cliOptions.list) {
    const result = listContent({
      bundles,
      kind: cliOptions.list,
      limit: cliOptions.limit,
      repositoryRoot: process.cwd()
    });

    process.stdout.write(
      cliOptions.json ? `${JSON.stringify(result)}\n` : formatListResult(result)
    );
  } else if (cliOptions.queries.length > 0) {
    const result = lookupContentBatch({
      bundles,
      defaultKind: cliOptions.kind,
      limit: cliOptions.limit,
      queries: cliOptions.queries,
      repositoryRoot: process.cwd()
    });

    process.stdout.write(
      cliOptions.json
        ? `${JSON.stringify(result)}\n`
        : formatLookupBatchResult(result)
    );
  } else {
    if (!cliOptions.query) {
      throw new Error("Missing lookup query.");
    }

    const result = lookupContent({
      bundles,
      kind: cliOptions.kind,
      limit: cliOptions.limit,
      query: cliOptions.query,
      repositoryRoot: process.cwd()
    });

    process.stdout.write(
      cliOptions.json
        ? `${JSON.stringify(result)}\n`
        : formatLookupResult(result)
    );
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

async function loadBundles(cliOptions: CliOptions) {
  if (cliOptions.mediaSlug) {
    const result = await parseMediaDirectory(
      path.join(cliOptions.contentRoot, "media", cliOptions.mediaSlug)
    );

    if (!result.ok) {
      throw new ContentLookupError(
        `Content lookup failed: media '${cliOptions.mediaSlug}' is invalid.\n${formatIssues(result.issues)}`,
        2
      );
    }

    return [result.data];
  }

  const result = await parseContentRoot(cliOptions.contentRoot);

  if (!result.ok) {
    throw new ContentLookupError(
      `Content lookup failed: content root is invalid.\n${formatIssues(result.issues)}`,
      2
    );
  }

  return result.data.bundles;
}

type CliOptions = {
  contentRoot: string;
  json: boolean;
  kind: ContentLookupKind;
  limit: number;
  list: ContentLookupListKind | null;
  mediaSlug: string | null;
  queries: ContentLookupBatchQuery[];
  query: string | null;
};

function resolveCliOptions(args: string[]): CliOptions {
  let contentRoot = path.resolve(process.cwd(), "content");
  let json = false;
  let kind: ContentLookupKind = "all";
  let limit = 5;
  let list: ContentLookupListKind | null = null;
  let mediaSlug: string | null = null;
  const queries: ContentLookupBatchQuery[] = [];
  let query: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      contentRoot = path.resolve(
        readOptionValue(args, index, "--content-root")
      );
      index += 1;
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--kind" || value === "-k") {
      kind = readEnumOption(args, index, value, [
        "all",
        "card",
        "grammar",
        "term"
      ] as const);
      index += 1;
      continue;
    }

    if (value === "--query" || value === "--q") {
      queries.push({
        query: readOptionValue(args, index, value)
      });
      index += 1;
      continue;
    }

    if (value === "--term") {
      queries.push({
        kind: "term",
        query: readOptionValue(args, index, value)
      });
      index += 1;
      continue;
    }

    if (value === "--grammar") {
      queries.push({
        kind: "grammar",
        query: readOptionValue(args, index, value)
      });
      index += 1;
      continue;
    }

    if (value === "--card") {
      queries.push({
        kind: "card",
        query: readOptionValue(args, index, value)
      });
      index += 1;
      continue;
    }

    if (value === "--limit") {
      limit = readPositiveInteger(args, index, "--limit");
      index += 1;
      continue;
    }

    if (value === "--list") {
      list = readEnumOption(args, index, "--list", [
        "cards",
        "entries",
        "lessons",
        "media"
      ] as const);
      index += 1;
      continue;
    }

    if (value === "--media-slug" || value === "-m") {
      mediaSlug = readOptionValue(args, index, value);
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    query = query === null ? value : `${query} ${value}`;
  }

  if (queries.length > 0 && query !== null) {
    throw new Error("--query cannot be combined with a positional lookup query.");
  }

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    contentRoot,
    json,
    kind,
    limit,
    list,
    mediaSlug,
    queries,
    query
  };
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
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

  if (!/^[1-9]\d*$/.test(value)) {
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

  return "Content lookup failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof ContentLookupError ? error.exitCode : 1;
}
