import path from "node:path";

import type { NormalizedMediaBundle } from "../types.ts";

export type ContentNextIdPlan = {
  content_root: string;
  conflicts: string[];
  media: {
    id: string;
    slug: string;
  };
  next: {
    cards_id: string;
    cards_slug: string;
    filename_prefix: string;
    lesson_id: string;
    lesson_slug: string;
    order: number;
    paths: {
      cards: string;
      textbook: string;
    };
  };
  schema_version: 1;
  strategy: {
    filename_prefix: {
      previous: string | null;
      step: number;
      width: number;
    };
    mode: "append";
    order: {
      previous: number | null;
      step: number;
    };
    renumbering: false;
    slug_style: {
      cards: "plain" | "prefixed";
      lesson: "plain" | "prefixed";
    };
  };
  warnings: string[];
};

export function buildContentNextIdPlan(input: {
  cardsSlug?: string;
  contentRoot: string;
  mediaBundle: NormalizedMediaBundle;
  order?: number;
  prefix?: number;
  repositoryRoot?: string;
  segmentRef?: string;
  slug: string;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const mediaId = input.mediaBundle.media?.frontmatter.id;
  const conflicts: string[] = [];
  const warnings: string[] = [];

  if (!mediaId) {
    throw new Error(
      `Media '${input.mediaBundle.mediaSlug}' is missing media.md id.`
    );
  }

  if (!isUrlSafeSlug(input.slug)) {
    throw new Error(`Invalid --slug '${input.slug}'. Use a URL-safe slug.`);
  }

  const lessonPrefixes = input.mediaBundle.lessons
    .map((lesson) => extractFilenamePrefix(lesson.sourceFile))
    .filter((prefix): prefix is FilenamePrefix => prefix !== null);
  const prefixStats = inferPrefixStats(lessonPrefixes);
  const nextPrefixNumber =
    input.prefix ?? (prefixStats.previousNumber ?? 0) + prefixStats.step;
  const filenamePrefix = String(nextPrefixNumber).padStart(
    prefixStats.width,
    "0"
  );
  const lessonSlugStyle = inferLessonSlugStyle(input.mediaBundle);
  const baseLessonSlug = stripLeadingNumericPrefix(input.slug);
  const lessonSlug =
    lessonSlugStyle === "prefixed"
      ? `${filenamePrefix}-${baseLessonSlug}`
      : input.slug;
  const baseCardsSlug = stripLeadingNumericPrefix(
    input.cardsSlug ?? baseLessonSlug
  );
  const cardsSlug =
    lessonSlugStyle === "prefixed"
      ? `${filenamePrefix}-${baseCardsSlug}`
      : (input.cardsSlug ?? lessonSlug);
  const orderStats = inferOrderStats(
    input.mediaBundle,
    input.segmentRef,
    prefixStats.step
  );
  const scopedNextOrder = (orderStats.previous ?? 0) + orderStats.step;
  const globalNextOrder = getGlobalNextOrder(
    input.mediaBundle,
    orderStats.step
  );
  const order = input.order ?? Math.max(scopedNextOrder, globalNextOrder);
  const lessonId = `lesson-${input.mediaBundle.mediaSlug}-${baseLessonSlug}`;
  const cardsId = `cards-${input.mediaBundle.mediaSlug}-${baseCardsSlug}`;
  const textbookPath = path.join(
    input.mediaBundle.mediaDirectory,
    "textbook",
    `${filenamePrefix}-${baseLessonSlug}.md`
  );
  const cardsPath = path.join(
    input.mediaBundle.mediaDirectory,
    "cards",
    `${filenamePrefix}-${baseCardsSlug}.md`
  );

  collectConflicts({
    cardsId,
    cardsPath,
    cardsSlug,
    conflicts,
    lessonId,
    lessonSlug,
    mediaBundle: input.mediaBundle,
    textbookPath
  });

  if (
    input.mediaBundle.lessons.some(
      (lesson) => lesson.frontmatter.order === order
    )
  ) {
    warnings.push(`order-collision:${order}`);
  }

  return {
    content_root: relativeSource(input.contentRoot, repositoryRoot),
    conflicts,
    media: {
      id: mediaId,
      slug: input.mediaBundle.mediaSlug
    },
    next: {
      cards_id: cardsId,
      cards_slug: cardsSlug,
      filename_prefix: filenamePrefix,
      lesson_id: lessonId,
      lesson_slug: lessonSlug,
      order,
      paths: {
        cards: relativeSource(cardsPath, repositoryRoot),
        textbook: relativeSource(textbookPath, repositoryRoot)
      }
    },
    schema_version: 1,
    strategy: {
      filename_prefix: {
        previous:
          prefixStats.previousNumber === null
            ? null
            : String(prefixStats.previousNumber).padStart(
                prefixStats.width,
                "0"
              ),
        step: prefixStats.step,
        width: prefixStats.width
      },
      mode: "append",
      order: {
        previous: orderStats.previous,
        step: orderStats.step
      },
      renumbering: false,
      slug_style: {
        cards: lessonSlugStyle,
        lesson: lessonSlugStyle
      }
    },
    warnings
  } satisfies ContentNextIdPlan;
}

export function formatContentNextIdPlan(plan: ContentNextIdPlan) {
  return (
    [
      `textbook_path: ${plan.next.paths.textbook}`,
      `cards_path: ${plan.next.paths.cards}`,
      `media_id: ${plan.media.id}`,
      `lesson_id: ${plan.next.lesson_id}`,
      `cards_id: ${plan.next.cards_id}`,
      `lesson_slug: ${plan.next.lesson_slug}`,
      `cards_slug: ${plan.next.cards_slug}`,
      `filename_prefix: ${plan.next.filename_prefix}`,
      `order: ${plan.next.order}`,
      ...plan.conflicts.map((conflict) => `CONFLICT ${conflict}`),
      ...plan.warnings.map((warning) => `WARNING ${warning}`)
    ].join("\n") + "\n"
  );
}

type FilenamePrefix = {
  number: number;
  width: number;
};

function extractFilenamePrefix(filePath: string) {
  const match = path.basename(filePath).match(/^(\d+)-.+\.md$/);

  if (!match) {
    return null;
  }

  return {
    number: Number.parseInt(match[1]!, 10),
    width: match[1]!.length
  } satisfies FilenamePrefix;
}

function inferPrefixStats(prefixes: FilenamePrefix[]) {
  if (prefixes.length === 0) {
    return {
      previousNumber: null,
      step: 1,
      width: 3
    };
  }

  const sorted = prefixes
    .map((prefix) => prefix.number)
    .sort((left, right) => left - right);
  const steps = sorted
    .slice(1)
    .map((value, index) => value - sorted[index]!)
    .filter((step) => step > 0);

  return {
    previousNumber: sorted[sorted.length - 1]!,
    step: steps.length > 0 ? Math.min(...steps) : 1,
    width: Math.max(3, ...prefixes.map((prefix) => prefix.width))
  };
}

function inferOrderStats(
  mediaBundle: NormalizedMediaBundle,
  segmentRef: string | undefined,
  fallbackStep: number
) {
  const orders = mediaBundle.lessons
    .filter(
      (lesson) => !segmentRef || lesson.frontmatter.segmentRef === segmentRef
    )
    .map((lesson) => lesson.frontmatter.order)
    .sort((left, right) => left - right);
  const steps = orders
    .slice(1)
    .map((value, index) => value - orders[index]!)
    .filter((step) => step > 0);

  return {
    previous: orders.length > 0 ? orders[orders.length - 1]! : null,
    step: steps.length > 0 ? Math.min(...steps) : fallbackStep
  };
}

function getGlobalNextOrder(
  mediaBundle: NormalizedMediaBundle,
  fallbackStep: number
) {
  const orders = mediaBundle.lessons
    .map((lesson) => lesson.frontmatter.order)
    .sort((left, right) => left - right);

  return (orders[orders.length - 1] ?? 0) + fallbackStep;
}

function inferLessonSlugStyle(mediaBundle: NormalizedMediaBundle) {
  const lessonsWithNumericSlug = mediaBundle.lessons.filter((lesson) =>
    /^\d+-/.test(lesson.frontmatter.slug)
  );

  return lessonsWithNumericSlug.length > mediaBundle.lessons.length / 2
    ? "prefixed"
    : "plain";
}

function collectConflicts(input: {
  cardsId: string;
  cardsPath: string;
  cardsSlug: string;
  conflicts: string[];
  lessonId: string;
  lessonSlug: string;
  mediaBundle: NormalizedMediaBundle;
  textbookPath: string;
}) {
  for (const lesson of input.mediaBundle.lessons) {
    if (lesson.frontmatter.id === input.lessonId) {
      input.conflicts.push(`lesson-id:${input.lessonId}`);
    }

    if (lesson.frontmatter.slug === input.lessonSlug) {
      input.conflicts.push(`lesson-slug:${input.lessonSlug}`);
    }

    if (path.resolve(lesson.sourceFile) === path.resolve(input.textbookPath)) {
      input.conflicts.push(`textbook-path:${input.textbookPath}`);
    }
  }

  for (const cardsFile of input.mediaBundle.cardFiles) {
    if (cardsFile.frontmatter.id === input.cardsId) {
      input.conflicts.push(`cards-id:${input.cardsId}`);
    }

    if (cardsFile.frontmatter.slug === input.cardsSlug) {
      input.conflicts.push(`cards-slug:${input.cardsSlug}`);
    }

    if (path.resolve(cardsFile.sourceFile) === path.resolve(input.cardsPath)) {
      input.conflicts.push(`cards-path:${input.cardsPath}`);
    }
  }
}

function stripLeadingNumericPrefix(value: string) {
  return value.replace(/^\d+-/, "");
}

function isUrlSafeSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function relativeSource(filePath: string, repositoryRoot = process.cwd()) {
  const relative = path.relative(repositoryRoot, filePath);

  return (relative.length > 0 ? relative : filePath).replaceAll("\\", "/");
}
