import path from "node:path";

import {
  parseMediaDirectory,
  type ValidationIssue
} from "../src/features/content/index.ts";
import {
  buildContentLessonBrief,
  formatContentLessonBrief
} from "../src/features/content/tooling/lesson-brief.ts";

class ContentLessonBriefError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const result = await parseMediaDirectory(
    path.join(cliOptions.contentRoot, "media", cliOptions.mediaSlug)
  );

  if (!result.ok) {
    throw new ContentLessonBriefError(
      `content:lesson-brief failed: media '${cliOptions.mediaSlug}' is invalid.\n${formatIssues(result.issues)}`,
      2
    );
  }

  const brief = buildContentLessonBrief({
    contentRoot: cliOptions.contentRoot,
    lessonSlug: cliOptions.lessonSlug,
    mediaBundle: result.data,
    outlineLimit: cliOptions.outlineLimit,
    repositoryRoot: process.cwd(),
    warningLimit: cliOptions.warningLimit
  });

  process.stdout.write(
    cliOptions.json
      ? `${JSON.stringify(brief)}\n`
      : formatContentLessonBrief(brief)
  );
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
}

type CliOptions = {
  contentRoot: string;
  json: boolean;
  lessonSlug: string;
  mediaSlug: string;
  outlineLimit: number;
  warningLimit: number;
};

function resolveCliOptions(args: string[]): CliOptions {
  let contentRoot = path.resolve(process.cwd(), "content");
  let json = false;
  let lessonSlug: string | null = null;
  let mediaSlug: string | null = null;
  let outlineLimit = 10;
  let warningLimit = 5;

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

    if (value === "--lesson-slug") {
      lessonSlug = readSafeSlug(args, index, "--lesson-slug");
      index += 1;
      continue;
    }

    if (value === "--media-slug" || value === "-m") {
      mediaSlug = readSafeSlug(args, index, value);
      index += 1;
      continue;
    }

    if (value === "--outline-limit") {
      outlineLimit = readPositiveInteger(args, index, "--outline-limit");
      index += 1;
      continue;
    }

    if (value === "--warning-limit") {
      warningLimit = readPositiveInteger(args, index, "--warning-limit");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!mediaSlug) {
    throw new Error("Missing --media-slug.");
  }

  if (!lessonSlug) {
    throw new Error("Missing --lesson-slug.");
  }

  return {
    contentRoot,
    json,
    lessonSlug,
    mediaSlug,
    outlineLimit,
    warningLimit
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

  return "content:lesson-brief failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof ContentLessonBriefError ? error.exitCode : 1;
}
