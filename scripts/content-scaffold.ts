import path from "node:path";

import {
  parseMediaDirectory,
  type ValidationIssue
} from "../src/features/content/index.ts";
import { buildContentNextIdPlan } from "../src/features/content/tooling/next-id.ts";
import {
  buildContentScaffoldPlan,
  formatContentScaffoldResult,
  renderTextbookScaffold,
  writeContentScaffold
} from "../src/features/content/tooling/scaffold.ts";

class ContentScaffoldError extends Error {
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
    throw new ContentScaffoldError(
      `content:scaffold failed: media '${cliOptions.mediaSlug}' is invalid.\n${formatIssues(result.issues)}`,
      2
    );
  }

  const mediaId = result.data.media?.frontmatter.id;

  if (!mediaId) {
    throw new ContentScaffoldError(
      `content:scaffold failed: media '${cliOptions.mediaSlug}' is missing media.md id.`,
      2
    );
  }

  const nextIdPlan = buildContentNextIdPlan({
    cardsSlug: cliOptions.cardsSlug ?? undefined,
    contentRoot: cliOptions.contentRoot,
    mediaBundle: result.data,
    order: cliOptions.order ?? undefined,
    prefix: cliOptions.prefix ?? undefined,
    repositoryRoot: process.cwd(),
    segmentRef: cliOptions.segmentRef ?? undefined,
    slug: cliOptions.slug
  });

  if (nextIdPlan.conflicts.length > 0) {
    throw new ContentScaffoldError(
      `content:scaffold refused to write because the next-id plan has conflicts:\n${nextIdPlan.conflicts.join("\n")}`,
      2
    );
  }

  const blockingWarnings = cliOptions.print
    ? []
    : nextIdPlan.warnings.filter((warning) =>
        warning.startsWith("order-collision:")
      );

  if (blockingWarnings.length > 0) {
    throw new ContentScaffoldError(
      `content:scaffold refused to write because the next-id plan has blocking warnings:\n${blockingWarnings.join("\n")}`,
      2
    );
  }

  const scaffoldPlan = buildContentScaffoldPlan({
    difficulty: cliOptions.difficulty ?? undefined,
    nextIdPlan,
    summary: cliOptions.summary ?? undefined,
    tags: cliOptions.tags,
    title: cliOptions.title
  });
  const textbookSource = renderTextbookScaffold({
    difficulty: cliOptions.difficulty ?? undefined,
    mediaId,
    nextIdPlan,
    summary: cliOptions.summary ?? undefined,
    tags: cliOptions.tags,
    title: cliOptions.title
  });
  const output = cliOptions.print
    ? scaffoldPlan
    : await writeContentScaffold({
        plan: scaffoldPlan,
        repositoryRoot: process.cwd(),
        textbookSource
      });

  process.stdout.write(
    cliOptions.json
      ? `${JSON.stringify(output)}\n`
      : formatContentScaffoldResult(output)
  );
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  cardsSlug: string | null;
  contentRoot: string;
  difficulty: string | null;
  json: boolean;
  mediaSlug: string;
  order: number | null;
  prefix: number | null;
  print: boolean;
  segmentRef: string | null;
  slug: string;
  summary: string | null;
  tags: string[];
  title: string;
};

function resolveCliOptions(args: string[]): CliOptions {
  let cardsSlug: string | null = null;
  let contentRoot = path.resolve(process.cwd(), "content");
  let difficulty: string | null = null;
  let json = false;
  let mediaSlug: string | null = null;
  let order: number | null = null;
  let prefix: number | null = null;
  let print = false;
  let segmentRef: string | null = null;
  let slug: string | null = null;
  let summary: string | null = null;
  const tags: string[] = [];
  let title: string | null = null;

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

    if (value === "--difficulty") {
      difficulty = readOptionValue(args, index, "--difficulty");
      index += 1;
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--media-slug" || value === "-m") {
      mediaSlug = readOptionValue(args, index, value);
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

    if (value === "--print") {
      print = true;
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

    if (value === "--summary") {
      summary = readOptionValue(args, index, "--summary");
      index += 1;
      continue;
    }

    if (value === "--tag") {
      tags.push(readOptionValue(args, index, "--tag"));
      index += 1;
      continue;
    }

    if (value === "--title") {
      title = readOptionValue(args, index, "--title");
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

  if (!title) {
    throw new Error("Missing --title.");
  }

  return {
    cardsSlug,
    contentRoot,
    difficulty,
    json,
    mediaSlug,
    order,
    prefix,
    print,
    segmentRef,
    slug,
    summary,
    tags,
    title
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

  return "content:scaffold failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof ContentScaffoldError ? error.exitCode : 1;
}
