import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "../src/features/content/parser/frontmatter.ts";
import {
  formatEditorialLintResult,
  lintEditorialContent
} from "../src/features/content/tooling/editorial-lint.ts";
import {
  parseContentRoot,
  parseMediaDirectory,
  type NormalizedMediaBundle,
  type ValidationIssue
} from "../src/features/content/index.ts";

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const bundles = await loadBundles(cliOptions);
  const result = lintEditorialContent({
    bundles,
    lessonSlugs: cliOptions.lessonSlugs,
    limit: cliOptions.limit,
    paths: cliOptions.paths,
    repositoryRoot: process.cwd()
  });

  process.stdout.write(
    cliOptions.json
      ? `${JSON.stringify(result)}\n`
      : formatEditorialLintResult(result)
  );
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

type CliOptions = {
  contentRoot: string;
  json: boolean;
  lessonSlugs: string[];
  limit: number;
  mediaSlugs: string[];
  paths: string[];
};

async function loadBundles(cliOptions: CliOptions) {
  if (cliOptions.paths.length > 0) {
    const mediaSlugs = [
      ...new Set(
        cliOptions.paths
          .map((candidate) =>
            resolveMediaSlugForPath(candidate, cliOptions.contentRoot)
          )
          .filter((slug): slug is string => slug !== null)
      )
    ];

    if (mediaSlugs.length === 0) {
      return [];
    }

    const results = await Promise.all(
      mediaSlugs.map((mediaSlug) =>
        parseMediaDirectory(
          path.join(cliOptions.contentRoot, "media", mediaSlug)
        )
      )
    );

    await assertNoBlockingParseIssues(
      results.flatMap((result) => result.issues),
      cliOptions,
      results.map((result) => result.data)
    );
    return results.map((result) => result.data);
  }

  if (cliOptions.mediaSlugs.length > 0) {
    const results = await Promise.all(
      cliOptions.mediaSlugs.map((mediaSlug) =>
        parseMediaDirectory(
          path.join(cliOptions.contentRoot, "media", mediaSlug)
        )
      )
    );

    await assertNoBlockingParseIssues(
      results.flatMap((result) => result.issues),
      cliOptions,
      results.map((result) => result.data)
    );
    return results.map((result) => result.data);
  }

  const result = await parseContentRoot(cliOptions.contentRoot);
  await assertNoBlockingParseIssues(
    result.issues,
    cliOptions,
    result.data.bundles
  );
  return result.data.bundles;
}

function resolveCliOptions(args: string[]): CliOptions {
  let contentRoot = path.resolve(process.cwd(), "content");
  let json = false;
  const lessonSlugs: string[] = [];
  let limit = 100;
  const mediaSlugs: string[] = [];
  const paths: string[] = [];

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
      lessonSlugs.push(readOptionValue(args, index, "--lesson-slug"));
      index += 1;
      continue;
    }

    if (value === "--limit") {
      limit = readPositiveInteger(args, index, "--limit");
      index += 1;
      continue;
    }

    if (value === "--media-slug" || value === "-m") {
      mediaSlugs.push(readOptionValue(args, index, value));
      index += 1;
      continue;
    }

    if (value === "--path") {
      paths.push(path.resolve(readOptionValue(args, index, "--path")));
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    paths.push(path.resolve(value));
  }

  if (lessonSlugs.length > 0 && paths.length > 0) {
    throw new Error("--lesson-slug cannot be combined with --path.");
  }

  return {
    contentRoot,
    json,
    lessonSlugs,
    limit,
    mediaSlugs,
    paths
  };
}

function resolveMediaSlugForPath(filePath: string, contentRoot: string) {
  const relativePath = path
    .relative(path.join(contentRoot, "media"), path.resolve(filePath))
    .replaceAll("\\", "/");

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  const [mediaSlug] = relativePath.split("/");
  return mediaSlug && mediaSlug.length > 0 ? mediaSlug : null;
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

async function assertNoBlockingParseIssues(
  issues: ValidationIssue[],
  cliOptions: CliOptions,
  bundles: NormalizedMediaBundle[]
) {
  const rawLessonScope = await collectRawLessonScope(
    bundles,
    cliOptions.lessonSlugs
  );
  const blockingIssues = issues
    .filter((issue) => !issue.code.startsWith("editorial."))
    .filter((issue) =>
      isIssueInRequestedScope(issue, cliOptions, bundles, rawLessonScope)
    );

  if (blockingIssues.length === 0) {
    return;
  }

  const issueSummary = blockingIssues
    .slice(0, 5)
    .map((issue) => `${issue.code} ${issue.location.filePath}`)
    .join("\n");

  throw new Error(
    `Content must parse before editorial lint can run.\n${issueSummary}`
  );
}

function isIssueInRequestedScope(
  issue: ValidationIssue,
  cliOptions: CliOptions,
  bundles: NormalizedMediaBundle[],
  rawLessonScope: RawLessonScope
) {
  if (cliOptions.paths.length > 0) {
    const requestedPaths = new Set(
      cliOptions.paths.map((candidate) => path.resolve(candidate))
    );
    return requestedPaths.has(path.resolve(issue.location.filePath));
  }

  if (cliOptions.lessonSlugs.length > 0) {
    if (isSelectedMediaLevelIssue(issue, cliOptions, bundles)) {
      return true;
    }

    const scopedPaths = collectLessonScopedPaths(
      bundles,
      cliOptions.lessonSlugs
    );
    const issuePath = path.resolve(issue.location.filePath);

    if (
      scopedPaths.has(issuePath) ||
      rawLessonScope.scopedPaths.has(issuePath) ||
      rawLessonScope.unknownSlugPaths.has(issuePath)
    ) {
      return true;
    }

    const issueFileName = path.basename(issuePath);
    return cliOptions.lessonSlugs.some((lessonSlug) =>
      issueFileName.includes(lessonSlug)
    );
  }

  return true;
}

function isSelectedMediaLevelIssue(
  issue: ValidationIssue,
  cliOptions: CliOptions,
  bundles: NormalizedMediaBundle[]
) {
  const selectedMediaDirectories = collectSelectedMediaDirectories(
    cliOptions,
    bundles
  );
  const issuePath = path.resolve(issue.location.filePath);

  for (const mediaDirectory of selectedMediaDirectories) {
    const relativePath = path
      .relative(mediaDirectory, issuePath)
      .replaceAll("\\", "/");

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      continue;
    }

    return (
      relativePath === "media.md" ||
      relativePath === "textbook" ||
      relativePath === "cards" ||
      (!relativePath.startsWith("textbook/") &&
        !relativePath.startsWith("cards/"))
    );
  }

  return false;
}

function collectSelectedMediaDirectories(
  cliOptions: CliOptions,
  bundles: NormalizedMediaBundle[]
) {
  if (cliOptions.mediaSlugs.length > 0) {
    return cliOptions.mediaSlugs.map((mediaSlug) =>
      path.resolve(cliOptions.contentRoot, "media", mediaSlug)
    );
  }

  return bundles.map((bundle) => path.resolve(bundle.mediaDirectory));
}

function collectLessonScopedPaths(
  bundles: NormalizedMediaBundle[],
  lessonSlugs: string[]
) {
  const lessonSlugSet = new Set(lessonSlugs);
  const scopedPaths = new Set<string>();

  for (const bundle of bundles) {
    const lessonIdToSlug = new Map(
      bundle.lessons.map((lesson) => [
        lesson.frontmatter.id,
        lesson.frontmatter.slug
      ])
    );

    for (const lesson of bundle.lessons) {
      if (lessonSlugSet.has(lesson.frontmatter.slug)) {
        scopedPaths.add(path.resolve(lesson.sourceFile));
      }
    }

    for (const cardsDocument of bundle.cardFiles) {
      if (lessonSlugSet.has(cardsDocument.frontmatter.slug)) {
        scopedPaths.add(path.resolve(cardsDocument.sourceFile));
      }
    }

    for (const card of bundle.cards) {
      const lessonSlug = lessonIdToSlug.get(card.lessonId);

      if (lessonSlug && lessonSlugSet.has(lessonSlug)) {
        scopedPaths.add(path.resolve(card.source.filePath));
      }
    }
  }

  return scopedPaths;
}

type RawLessonScope = {
  scopedPaths: Set<string>;
  unknownSlugPaths: Set<string>;
};

async function collectRawLessonScope(
  bundles: NormalizedMediaBundle[],
  lessonSlugs: string[]
) {
  const lessonSlugSet = new Set(lessonSlugs);
  const scopedPaths = new Set<string>();
  const unknownSlugPaths = new Set<string>();

  if (lessonSlugSet.size === 0) {
    return {
      scopedPaths,
      unknownSlugPaths
    };
  }

  await Promise.all(
    bundles.flatMap((bundle) =>
      ["textbook", "cards"].map(async (directoryName) => {
        const directoryPath = path.join(bundle.mediaDirectory, directoryName);
        let fileNames: string[];

        try {
          fileNames = await readdir(directoryPath);
        } catch {
          return;
        }

        await Promise.all(
          fileNames
            .filter((fileName) => fileName.endsWith(".md"))
            .map(async (fileName) => {
              const filePath = path.join(directoryPath, fileName);
              const slug = await readRawFrontmatterSlug(filePath);

              if (slug === null) {
                unknownSlugPaths.add(path.resolve(filePath));
                return;
              }

              if (lessonSlugSet.has(slug)) {
                scopedPaths.add(path.resolve(filePath));
              }
            })
        );
      })
    )
  );

  return {
    scopedPaths,
    unknownSlugPaths
  };
}

async function readRawFrontmatterSlug(filePath: string) {
  try {
    const source = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(source, filePath);
    const slug = frontmatter.data?.slug;

    return typeof slug === "string" ? slug : null;
  } catch {
    return null;
  }
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "content:editorial-lint failed with an unknown error.";
}
