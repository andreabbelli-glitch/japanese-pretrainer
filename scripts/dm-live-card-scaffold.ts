import path from "node:path";

import {
  parseMediaDirectory,
  type ValidationIssue
} from "../src/features/content/index.ts";
import {
  buildDmLiveCardScaffold,
  formatDmLiveCardScaffoldResult,
  type DmLiveCardAssetExt,
  DmLiveCardScaffoldFailure
} from "../src/features/content/tooling/dm-live-card-scaffold.ts";

const dmMediaSlug = "duel-masters-dm25";

try {
  const options = resolveCliOptions(process.argv.slice(2));
  const mediaDirectory = path.join(options.contentRoot, "media", dmMediaSlug);
  const result = await parseMediaDirectory(mediaDirectory);

  if (!result.ok) {
    throw new DmLiveCardScaffoldFailure(
      `dm:live-card-scaffold failed: media '${dmMediaSlug}' is invalid.\n${formatIssues(
        result.issues
      )}`,
      2
    );
  }

  const scaffold = await buildDmLiveCardScaffold({
    assetExt: options.assetExt ?? undefined,
    cardSlug: options.cardSlug,
    contentRoot: options.contentRoot,
    difficulty: options.difficulty ?? undefined,
    mediaBundle: result.data,
    officialId: options.officialId ?? undefined,
    repositoryRoot: process.cwd(),
    summary: options.summary ?? undefined,
    tags: options.tags,
    title: options.title,
    url: options.url ?? undefined,
    write: options.write
  });

  process.stdout.write(
    options.json
      ? `${JSON.stringify(scaffold)}\n`
      : formatDmLiveCardScaffoldResult(scaffold)
  );
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  assetExt: DmLiveCardAssetExt | null;
  cardSlug: string;
  contentRoot: string;
  difficulty: string | null;
  json: boolean;
  officialId: string | null;
  summary: string | null;
  tags: string[];
  title: string;
  url: string | null;
  write: boolean;
};

function resolveCliOptions(args: string[]): CliOptions {
  let assetExt: DmLiveCardAssetExt | null = null;
  let cardSlug: string | null = null;
  let contentRoot = path.resolve(process.cwd(), "content");
  let difficulty: string | null = null;
  let json = false;
  let officialId: string | null = null;
  let summary: string | null = null;
  const tags: string[] = [];
  let title: string | null = null;
  let url: string | null = null;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--asset-ext") {
      assetExt = readEnumOption(args, index, value, [
        "jpg",
        "png",
        "webp"
      ] as const);
      index += 1;
      continue;
    }

    if (value === "--card-slug" || value === "--slug") {
      cardSlug = readSingleStringOption(cardSlug, args, index, value);
      index += 1;
      continue;
    }

    if (value === "--content-root") {
      contentRoot = path.resolve(readOptionValue(args, index, value));
      index += 1;
      continue;
    }

    if (value === "--difficulty") {
      difficulty = readSingleStringOption(difficulty, args, index, value);
      index += 1;
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--official-id") {
      officialId = readSingleStringOption(officialId, args, index, value);
      index += 1;
      continue;
    }

    if (value === "--summary") {
      summary = readSingleStringOption(summary, args, index, value);
      index += 1;
      continue;
    }

    if (value === "--tag") {
      tags.push(readOptionValue(args, index, value));
      index += 1;
      continue;
    }

    if (value === "--title") {
      title = readSingleStringOption(title, args, index, value);
      index += 1;
      continue;
    }

    if (value === "--url") {
      url = readSingleStringOption(url, args, index, value);
      index += 1;
      continue;
    }

    if (value === "--write") {
      write = true;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    throw new Error(`Unexpected positional argument: ${value}`);
  }

  if (!cardSlug) {
    throw new Error("Missing --card-slug.");
  }

  if (!title) {
    throw new Error("Missing --title.");
  }

  return {
    assetExt,
    cardSlug,
    contentRoot,
    difficulty,
    json,
    officialId,
    summary,
    tags,
    title,
    url,
    write
  };
}

function readSingleStringOption(
  currentValue: string | null,
  args: string[],
  index: number,
  flag: string
) {
  if (currentValue !== null) {
    throw new Error(`${flag} cannot be provided more than once.`);
  }

  return readOptionValue(args, index, flag);
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

  return "dm:live-card-scaffold failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof DmLiveCardScaffoldFailure ? error.exitCode : 1;
}
