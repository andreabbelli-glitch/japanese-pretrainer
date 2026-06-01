import path from "node:path";

import {
  parseMediaDirectory,
  type ValidationIssue
} from "../src/features/content/index.ts";
import {
  buildContentNextIdPlan,
  formatContentNextIdPlan
} from "../src/features/content/tooling/next-id.ts";

class ContentNextIdError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const mediaDirectory = path.join(
    cliOptions.contentRoot,
    "media",
    cliOptions.mediaSlug
  );
  const result = await parseMediaDirectory(mediaDirectory);

  if (!result.ok) {
    throw new ContentNextIdError(
      `content:next-id failed: media '${cliOptions.mediaSlug}' is invalid.\n${formatIssues(result.issues)}`,
      2
    );
  }

  const plan = buildContentNextIdPlan({
    cardsSlug: cliOptions.cardsSlug ?? undefined,
    contentRoot: cliOptions.contentRoot,
    mediaBundle: result.data,
    order: cliOptions.order ?? undefined,
    prefix: cliOptions.prefix ?? undefined,
    repositoryRoot: process.cwd(),
    segmentRef: cliOptions.segmentRef ?? undefined,
    slug: cliOptions.slug
  });

  process.stdout.write(
    cliOptions.json
      ? `${JSON.stringify(plan)}\n`
      : formatContentNextIdPlan(plan)
  );

  if (plan.conflicts.length > 0) {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  cardsSlug: string | null;
  contentRoot: string;
  json: boolean;
  mediaSlug: string;
  order: number | null;
  prefix: number | null;
  segmentRef: string | null;
  slug: string;
};

function resolveCliOptions(args: string[]): CliOptions {
  let cardsSlug: string | null = null;
  let contentRoot = path.resolve(process.cwd(), "content");
  let json = false;
  let mediaSlug: string | null = null;
  let order: number | null = null;
  let prefix: number | null = null;
  let segmentRef: string | null = null;
  let slug: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--cards-slug") {
      cardsSlug = readOptionValue(args, index, "--cards-slug");
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

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--media-slug") {
      mediaSlug = readOptionValue(args, index, "--media-slug");
      index += 1;
      continue;
    }

    if (value === "--order") {
      order = readPositiveInteger(args, index, "--order");
      index += 1;
      continue;
    }

    if (value === "--prefix") {
      prefix = readPositiveInteger(args, index, "--prefix");
      index += 1;
      continue;
    }

    if (value === "--segment-ref") {
      segmentRef = readOptionValue(args, index, "--segment-ref");
      index += 1;
      continue;
    }

    if (value === "--slug") {
      slug = readOptionValue(args, index, "--slug");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!mediaSlug) {
    throw new Error("Missing --media-slug.");
  }

  if (!slug) {
    throw new Error("Missing --slug.");
  }

  return {
    cardsSlug,
    contentRoot,
    json,
    mediaSlug,
    order,
    prefix,
    segmentRef,
    slug
  };
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

  return "content:next-id failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof ContentNextIdError ? error.exitCode : 1;
}
