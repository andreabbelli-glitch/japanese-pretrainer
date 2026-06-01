import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "../parser/frontmatter.ts";
import { parseMediaDirectory } from "../validator.ts";
import type { NormalizedMediaBundle } from "../types.ts";

export type ContentScopeChangeStatus =
  | "added"
  | "deleted"
  | "modified"
  | "renamed";

export type ContentScopeChange = {
  path: string;
  status: ContentScopeChangeStatus;
};

export type ContentScopeMode =
  | "full"
  | "lesson"
  | "media"
  | "mixed"
  | "no-import"
  | "none";

export type ContentScopeMediaPlan = {
  importCommand: string | null;
  lessonSlugs: string[];
  mediaSlug: string;
  mode: "full" | "lesson" | "media" | "no-import";
  reasons: string[];
  validateCommand: string | null;
  warnings: string[];
};

export type ContentScopePlan = {
  ignoredPaths: string[];
  media: ContentScopeMediaPlan[];
  mode: ContentScopeMode;
  schema_version: 1;
  warnings: string[];
};

type ClassifiedChange = ContentScopeChange & {
  absolutePath: string;
  mediaSlug: string;
  relativeInsideMedia: string;
};

type MutableMediaPlan = {
  importFull: boolean;
  importMedia: boolean;
  lessonSlugs: Set<string>;
  noImport: boolean;
  reasons: Set<string>;
  validateMedia: boolean;
  warnings: Set<string>;
};

export async function buildContentScopePlan(input: {
  changes: ContentScopeChange[];
  contentRoot: string;
  repositoryRoot?: string;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const contentRoot = path.resolve(repositoryRoot, input.contentRoot);
  const classifiedChanges: ClassifiedChange[] = [];
  const ignoredPaths: string[] = [];

  for (const change of input.changes) {
    const classified = classifyContentMediaPath({
      change,
      contentRoot,
      repositoryRoot
    });

    if (!classified) {
      ignoredPaths.push(formatPath(change.path, repositoryRoot));
      continue;
    }

    classifiedChanges.push(classified);
  }

  const changesByMedia = groupByMedia(classifiedChanges);
  const mediaPlans: ContentScopeMediaPlan[] = [];
  const warnings = new Set<string>();

  for (const [mediaSlug, mediaChanges] of changesByMedia) {
    const mutablePlan: MutableMediaPlan = {
      importFull: false,
      importMedia: false,
      lessonSlugs: new Set(),
      noImport: false,
      reasons: new Set(),
      validateMedia: false,
      warnings: new Set()
    };
    const mediaBundle = await loadMediaBundle(
      path.join(contentRoot, "media", mediaSlug),
      mutablePlan.warnings
    );

    for (const change of mediaChanges) {
      await applyChangeToPlan({
        change,
        mediaBundle,
        mutablePlan,
        repositoryRoot
      });
    }

    mediaPlans.push(
      finalizeMediaPlan({
        contentRoot,
        mediaSlug,
        mutablePlan,
        repositoryRoot
      })
    );
  }

  if (ignoredPaths.length > 0) {
    warnings.add(`ignored-non-content-media-paths:${ignoredPaths.length}`);
  }

  return {
    ignoredPaths,
    media: mediaPlans.sort((left, right) =>
      left.mediaSlug.localeCompare(right.mediaSlug)
    ),
    mode: resolveOverallMode(mediaPlans),
    schema_version: 1,
    warnings: [...warnings]
  } satisfies ContentScopePlan;
}

export function formatContentScopePlan(plan: ContentScopePlan) {
  const lines = [`SCOPE ${plan.mode}`];

  if (plan.media.length === 0) {
    lines.push("VALIDATE none", "IMPORT none");
  }

  for (const mediaPlan of plan.media) {
    lines.push(`MEDIA ${mediaPlan.mediaSlug}`, `MODE ${mediaPlan.mode}`);

    if (mediaPlan.lessonSlugs.length > 0) {
      lines.push(`LESSONS ${mediaPlan.lessonSlugs.join(",")}`);
    }

    lines.push(`VALIDATE ${mediaPlan.validateCommand ?? "none"}`);
    lines.push(`IMPORT ${mediaPlan.importCommand ?? "none"}`);

    for (const reason of mediaPlan.reasons) {
      lines.push(`REASON ${reason}`);
    }

    for (const warning of mediaPlan.warnings) {
      lines.push(`WARNING ${warning}`);
    }
  }

  for (const warning of plan.warnings) {
    lines.push(`WARNING ${warning}`);
  }

  for (const ignoredPath of plan.ignoredPaths.slice(0, 5)) {
    lines.push(`IGNORED ${ignoredPath}`);
  }

  return `${lines.join("\n")}\n`;
}

async function applyChangeToPlan(input: {
  change: ClassifiedChange;
  mediaBundle: NormalizedMediaBundle | null;
  mutablePlan: MutableMediaPlan;
  repositoryRoot: string;
}) {
  const { change, mutablePlan } = input;
  const parts = change.relativeInsideMedia.split(path.sep);
  const topLevel = parts[0];
  const fileName = parts.at(-1) ?? "";

  if (change.relativeInsideMedia === "media.md") {
    if (change.status === "deleted") {
      mutablePlan.importFull = true;
      mutablePlan.warnings.add(
        "media.md deleted; full import is required to archive removed media, or validation will fail if deletion was accidental."
      );
      mutablePlan.reasons.add("media descriptor deleted");
      return;
    }

    mutablePlan.importMedia = true;
    mutablePlan.reasons.add("media descriptor changed");
    return;
  }

  if (change.relativeInsideMedia === "pronunciations.json") {
    mutablePlan.importMedia = true;
    mutablePlan.reasons.add("pronunciation manifest changed");
    return;
  }

  if (topLevel === "textbook" && fileName.endsWith(".md")) {
    if (change.status === "deleted") {
      mutablePlan.importMedia = true;
      mutablePlan.reasons.add(
        "textbook file deleted; archive/prune needs media scope"
      );
      return;
    }

    const lessonSlug = await readFrontmatterString(change.absolutePath, "slug");

    if (lessonSlug) {
      mutablePlan.lessonSlugs.add(lessonSlug);
      mutablePlan.reasons.add("textbook lesson changed");
      return;
    }

    mutablePlan.importMedia = true;
    mutablePlan.warnings.add(
      `could not read lesson slug from ${formatPath(change.path, input.repositoryRoot)}`
    );
    mutablePlan.reasons.add("textbook lesson changed without readable slug");
    return;
  }

  if (topLevel === "cards" && fileName.endsWith(".md")) {
    if (change.status === "deleted") {
      mutablePlan.importMedia = true;
      mutablePlan.reasons.add(
        "cards file deleted; archive/prune needs media scope"
      );
      return;
    }

    const lessonSlugs = resolveLessonSlugsForCardsFile({
      cardsFilePath: change.absolutePath,
      mediaBundle: input.mediaBundle
    });

    if (lessonSlugs.length > 0) {
      for (const lessonSlug of lessonSlugs) {
        mutablePlan.lessonSlugs.add(lessonSlug);
      }

      mutablePlan.reasons.add("cards file maps to lesson scope");
      return;
    }

    const frontmatterSlug = await readFrontmatterString(
      change.absolutePath,
      "slug"
    );

    if (
      frontmatterSlug &&
      input.mediaBundle &&
      hasLessonSlug(input.mediaBundle, frontmatterSlug)
    ) {
      mutablePlan.lessonSlugs.add(frontmatterSlug);
      mutablePlan.warnings.add(
        `using cards frontmatter slug for ${formatPath(change.path, input.repositoryRoot)}`
      );
      mutablePlan.reasons.add("cards file changed with fallback slug");
      return;
    }

    mutablePlan.importMedia = true;
    mutablePlan.warnings.add(
      frontmatterSlug
        ? `cards slug is not a textbook lesson slug: ${frontmatterSlug}`
        : `could not map cards file to lesson slug: ${formatPath(change.path, input.repositoryRoot)}`
    );
    mutablePlan.reasons.add("cards file changed without lesson mapping");
    return;
  }

  if (topLevel === "assets") {
    mutablePlan.noImport = true;
    mutablePlan.validateMedia = true;
    mutablePlan.reasons.add("assets file changed");
    return;
  }

  if (topLevel === "workflow") {
    mutablePlan.noImport = true;
    mutablePlan.reasons.add("workflow file changed");
    return;
  }

  mutablePlan.importMedia = true;
  mutablePlan.reasons.add("media content file changed outside textbook/cards");
}

function finalizeMediaPlan(input: {
  contentRoot: string;
  mediaSlug: string;
  mutablePlan: MutableMediaPlan;
  repositoryRoot: string;
}) {
  const lessonSlugs = [...input.mutablePlan.lessonSlugs].sort();
  const mode = input.mutablePlan.importFull
    ? "full"
    : input.mutablePlan.importMedia
      ? "media"
      : lessonSlugs.length > 0
        ? "lesson"
        : "no-import";
  const validateCommand =
    mode === "no-import" &&
    lessonSlugs.length === 0 &&
    !input.mutablePlan.validateMedia
      ? null
      : mode === "full"
        ? buildFullValidateCommand({
            contentRoot: input.contentRoot,
            repositoryRoot: input.repositoryRoot
          })
        : buildValidateCommand({
            contentRoot: input.contentRoot,
            mediaSlug: input.mediaSlug,
            repositoryRoot: input.repositoryRoot
          });
  const importCommand =
    mode === "full"
      ? buildFullImportCommand({
          contentRoot: input.contentRoot,
          repositoryRoot: input.repositoryRoot
        })
      : mode === "media"
        ? buildImportCommand({
            contentRoot: input.contentRoot,
            mediaSlug: input.mediaSlug,
            repositoryRoot: input.repositoryRoot
          })
        : mode === "lesson"
          ? buildImportCommand({
              contentRoot: input.contentRoot,
              lessonSlugs,
              mediaSlug: input.mediaSlug,
              repositoryRoot: input.repositoryRoot
            })
          : null;

  return {
    importCommand,
    lessonSlugs,
    mediaSlug: input.mediaSlug,
    mode,
    reasons: [...input.mutablePlan.reasons].sort(),
    validateCommand,
    warnings: [...input.mutablePlan.warnings].sort()
  } satisfies ContentScopeMediaPlan;
}

function classifyContentMediaPath(input: {
  change: ContentScopeChange;
  contentRoot: string;
  repositoryRoot: string;
}) {
  const absolutePath = path.resolve(input.repositoryRoot, input.change.path);
  const relativeToContentRoot = path.relative(input.contentRoot, absolutePath);
  const parts = relativeToContentRoot.split(path.sep);

  if (
    relativeToContentRoot.startsWith("..") ||
    path.isAbsolute(relativeToContentRoot) ||
    parts[0] !== "media" ||
    !parts[1]
  ) {
    return null;
  }

  return {
    ...input.change,
    absolutePath,
    mediaSlug: parts[1],
    relativeInsideMedia: parts.slice(2).join(path.sep)
  } satisfies ClassifiedChange;
}

function groupByMedia(changes: ClassifiedChange[]) {
  const grouped = new Map<string, ClassifiedChange[]>();

  for (const change of changes) {
    const existing = grouped.get(change.mediaSlug) ?? [];

    existing.push(change);
    grouped.set(change.mediaSlug, existing);
  }

  return grouped;
}

async function loadMediaBundle(mediaDirectory: string, warnings: Set<string>) {
  const result = await parseMediaDirectory(mediaDirectory);

  if (!result.ok) {
    warnings.add("media parse has validation issues; scope is best-effort");
  }

  return result.data;
}

function resolveLessonSlugsForCardsFile(input: {
  cardsFilePath: string;
  mediaBundle: NormalizedMediaBundle | null;
}) {
  if (!input.mediaBundle) {
    return [];
  }

  const lessonSlugById = new Map(
    input.mediaBundle.lessons.map((lesson) => [
      lesson.frontmatter.id,
      lesson.frontmatter.slug
    ])
  );
  const lessonSlugs = new Set<string>();

  for (const card of input.mediaBundle.cards) {
    if (!samePath(card.source.filePath, input.cardsFilePath)) {
      continue;
    }

    const lessonSlug = lessonSlugById.get(card.lessonId);

    if (lessonSlug) {
      lessonSlugs.add(lessonSlug);
    }
  }

  return [...lessonSlugs].sort();
}

function hasLessonSlug(mediaBundle: NormalizedMediaBundle, lessonSlug: string) {
  return mediaBundle.lessons.some(
    (lesson) => lesson.frontmatter.slug === lessonSlug
  );
}

async function readFrontmatterString(filePath: string, field: string) {
  try {
    const source = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(source, filePath);
    const value = frontmatter.data?.[field];

    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  } catch {
    return null;
  }
}

function buildValidateCommand(input: {
  contentRoot: string;
  mediaSlug: string;
  repositoryRoot: string;
}) {
  return [
    "./scripts/with-node.sh pnpm content:validate --",
    ...buildContentRootArgs(input.contentRoot, input.repositoryRoot),
    "--media-slug",
    input.mediaSlug
  ].join(" ");
}

function buildFullValidateCommand(input: {
  contentRoot: string;
  repositoryRoot: string;
}) {
  return [
    "./scripts/with-node.sh pnpm content:validate --",
    ...buildContentRootArgs(input.contentRoot, input.repositoryRoot)
  ].join(" ");
}

function buildImportCommand(input: {
  contentRoot: string;
  lessonSlugs?: string[];
  mediaSlug: string;
  repositoryRoot: string;
}) {
  return [
    "./scripts/with-node.sh pnpm content:import --",
    ...buildContentRootArgs(input.contentRoot, input.repositoryRoot),
    "--media-slug",
    input.mediaSlug,
    ...(input.lessonSlugs ?? []).flatMap((lessonSlug) => [
      "--lesson-slug",
      lessonSlug
    ])
  ].join(" ");
}

function buildFullImportCommand(input: {
  contentRoot: string;
  repositoryRoot: string;
}) {
  return [
    "./scripts/with-node.sh pnpm content:import --",
    ...buildContentRootArgs(input.contentRoot, input.repositoryRoot)
  ].join(" ");
}

function buildContentRootArgs(contentRoot: string, repositoryRoot: string) {
  const relativeContentRoot = formatPath(contentRoot, repositoryRoot);

  return relativeContentRoot === "content"
    ? []
    : ["--content-root", relativeContentRoot];
}

function resolveOverallMode(mediaPlans: ContentScopeMediaPlan[]) {
  if (mediaPlans.length === 0) {
    return "none";
  }

  const modes = new Set(mediaPlans.map((plan) => plan.mode));

  if (modes.size === 1) {
    return mediaPlans[0]!.mode;
  }

  return "mixed";
}

function samePath(left: string, right: string) {
  return path.resolve(left) === path.resolve(right);
}

function formatPath(filePath: string, repositoryRoot: string) {
  const relativePath = path.relative(repositoryRoot, path.resolve(filePath));

  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? filePath
    : relativePath;
}
