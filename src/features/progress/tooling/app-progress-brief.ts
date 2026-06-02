import { and, asc, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../../../db/create-client.ts";
import { lesson, media } from "../../../db/schema/index.ts";
import {
  mediaHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "../../navigation/index.ts";
import {
  calculatePercent,
  compareIsoDates,
  formatLessonProgressStatusLabel
} from "../../study/model/format.ts";

export type AppProgressBriefDatabaseInfo = {
  configuredPath: string;
  isRemote: boolean;
};

export type AppProgressBriefResult = {
  activeLesson: AppProgressBriefLessonTarget | null;
  database: AppProgressBriefDatabaseInfo;
  inProgressLessons: AppProgressBriefLessonTarget[];
  latestCompletedLesson: AppProgressBriefLessonTarget | null;
  latestOpenedLesson: AppProgressBriefLessonTarget | null;
  media: AppProgressBriefMediaSummary[];
  resumeLesson: AppProgressBriefLessonTarget | null;
  schemaVersion: 1;
  scope: {
    mediaSlug: string | null;
  };
  source: "runtime-db";
  summary: AppProgressBriefSummary;
  truncated: {
    inProgressLessons: boolean;
  };
};

export type AppProgressBriefSummary = {
  completedLessons: number;
  inProgressLessons: number;
  lessonsTotal: number;
  mediaCount: number;
  notStartedLessons: number;
  progressPercent: number | null;
};

export type AppProgressBriefMediaSummary = {
  completedLessons: number;
  href: string;
  inProgressLessons: number;
  lessonsTotal: number;
  notStartedLessons: number;
  progressPercent: number | null;
  slug: string;
  title: string;
};

export type AppProgressBriefLessonTarget = {
  completedAt: string | null;
  href: string;
  lastOpenedAt: string | null;
  mediaSlug: string;
  mediaTitle: string;
  orderIndex: number;
  slug: string;
  sourceFile: string;
  status: "completed" | "in_progress" | "not_started";
  statusLabel: string;
  title: string;
};

type RuntimeMediaRow = {
  id: string;
  slug: string;
  title: string;
};

type RuntimeLessonRow = Awaited<ReturnType<typeof loadActiveLessons>>[number];

export async function buildAppProgressBrief(input: {
  database: DatabaseClient;
  databaseInfo: AppProgressBriefDatabaseInfo;
  limit?: number;
  mediaSlug?: string;
}): Promise<AppProgressBriefResult> {
  const limit = clampLimit(input.limit ?? 10);
  const mediaRows = await loadActiveMedia(input.database, input.mediaSlug);

  if (input.mediaSlug && mediaRows.length === 0) {
    throw new Error(`Media '${input.mediaSlug}' was not found.`);
  }

  const lessons = await loadActiveLessons(
    input.database,
    mediaRows.map((mediaRow) => mediaRow.id)
  );
  const mediaById = new Map(mediaRows.map((mediaRow) => [mediaRow.id, mediaRow]));
  const targets = lessons.map((lessonRow) =>
    buildLessonTarget(lessonRow, mediaById.get(lessonRow.mediaId)!)
  );
  const scopedMedia = mediaRows.map((mediaRow) =>
    buildMediaSummary(
      mediaRow,
      targets.filter((target) => target.mediaSlug === mediaRow.slug)
    )
  );
  const inProgressLessons = targets
    .filter((target) => target.status === "in_progress")
    .sort(compareTargetsByLastOpenedDesc);
  const latestCompletedLesson = targets
    .filter((target) => target.status === "completed")
    .sort(compareTargetsByCompletedDesc)[0] ?? null;
  const latestOpenedLesson = targets
    .filter((target) => target.lastOpenedAt !== null)
    .sort(compareTargetsByLastOpenedDesc)[0] ?? null;
  const activeLesson = inProgressLessons[0] ?? null;
  const resumeLesson =
    mediaRows.length === 1
      ? selectResumeLesson(
          targets
            .filter((target) => target.mediaSlug === mediaRows[0]!.slug)
            .sort(compareTargetsByCurriculumOrder)
        )
      : null;

  return {
    activeLesson,
    database: {
      configuredPath: sanitizeDatabaseDisplayPath(
        input.databaseInfo.configuredPath
      ),
      isRemote: input.databaseInfo.isRemote
    },
    inProgressLessons: inProgressLessons.slice(0, limit),
    latestCompletedLesson,
    latestOpenedLesson,
    media: scopedMedia,
    resumeLesson,
    schemaVersion: 1,
    scope: {
      mediaSlug: input.mediaSlug ?? null
    },
    source: "runtime-db",
    summary: buildSummary(scopedMedia),
    truncated: {
      inProgressLessons: inProgressLessons.length > limit
    }
  };
}

export function formatAppProgressBrief(result: AppProgressBriefResult) {
  const scope = result.scope.mediaSlug ? `media:${result.scope.mediaSlug}` : "all";
  const lines = [
    [
      "APP_PROGRESS_BRIEF",
      "source=runtime-db",
      `remote=${result.database.isRemote}`,
      `db=${quoteForLine(result.database.configuredPath)}`,
      `scope=${scope}`,
      `schema=${result.schemaVersion}`
    ].join(" "),
    "NOTE runtime_state=true content_source_of_truth=false",
    formatSummaryLine(result)
  ];

  if (!result.scope.mediaSlug) {
    for (const mediaSummary of result.media) {
      lines.push(formatMediaLine(mediaSummary));
    }
  }

  lines.push(formatTargetLine("RESUME_LESSON", result.resumeLesson));
  lines.push(formatTargetLine("ACTIVE_LESSON", result.activeLesson));
  lines.push(
    formatTargetLine("LAST_OPENED_LESSON", result.latestOpenedLesson)
  );
  lines.push(
    formatTargetLine("LATEST_COMPLETED_LESSON", result.latestCompletedLesson)
  );
  lines.push(
    `IN_PROGRESS total=${result.summary.inProgressLessons} shown=${result.inProgressLessons.length}${result.truncated.inProgressLessons ? " truncated=true" : ""}`
  );

  for (const lessonTarget of result.inProgressLessons) {
    lines.push(formatTargetLine("IN_PROGRESS_LESSON", lessonTarget));
  }

  return `${lines.join("\n")}\n`;
}

async function loadActiveMedia(
  database: DatabaseClient,
  mediaSlug?: string
): Promise<RuntimeMediaRow[]> {
  return database.query.media.findMany({
    columns: {
      id: true,
      slug: true,
      title: true
    },
    orderBy: [asc(media.title), asc(media.slug)],
    where: mediaSlug
      ? and(eq(media.status, "active"), eq(media.slug, mediaSlug))
      : eq(media.status, "active")
  });
}

async function loadActiveLessons(database: DatabaseClient, mediaIds: string[]) {
  if (mediaIds.length === 0) {
    return [];
  }

  return database.query.lesson.findMany({
    columns: {
      id: true,
      mediaId: true,
      orderIndex: true,
      slug: true,
      sourceFile: true,
      title: true
    },
    orderBy: [asc(lesson.mediaId), asc(lesson.orderIndex), asc(lesson.slug)],
    where: and(inArray(lesson.mediaId, mediaIds), eq(lesson.status, "active")),
    with: {
      progress: {
        columns: {
          completedAt: true,
          lastOpenedAt: true,
          status: true
        }
      }
    }
  });
}

function buildLessonTarget(
  lessonRow: RuntimeLessonRow,
  mediaRow: RuntimeMediaRow
): AppProgressBriefLessonTarget {
  const status = normalizeStatus(lessonRow.progress?.status ?? null);

  return {
    completedAt: lessonRow.progress?.completedAt ?? null,
    href: mediaTextbookLessonHref(mediaRow.slug, lessonRow.slug),
    lastOpenedAt: lessonRow.progress?.lastOpenedAt ?? null,
    mediaSlug: mediaRow.slug,
    mediaTitle: mediaRow.title,
    orderIndex: lessonRow.orderIndex,
    slug: lessonRow.slug,
    sourceFile: lessonRow.sourceFile,
    status,
    statusLabel: formatLessonProgressStatusLabel(status),
    title: lessonRow.title
  };
}

function buildMediaSummary(
  mediaRow: RuntimeMediaRow,
  lessons: AppProgressBriefLessonTarget[]
): AppProgressBriefMediaSummary {
  const completedLessons = lessons.filter(
    (lessonTarget) => lessonTarget.status === "completed"
  ).length;
  const inProgressLessons = lessons.filter(
    (lessonTarget) => lessonTarget.status === "in_progress"
  ).length;

  return {
    completedLessons,
    href: mediaHref(mediaRow.slug),
    inProgressLessons,
    lessonsTotal: lessons.length,
    notStartedLessons: lessons.length - completedLessons - inProgressLessons,
    progressPercent: calculatePercent(completedLessons, lessons.length),
    slug: mediaRow.slug,
    title: mediaRow.title
  };
}

function buildSummary(
  mediaSummaries: AppProgressBriefMediaSummary[]
): AppProgressBriefSummary {
  const completedLessons = sum(mediaSummaries, "completedLessons");
  const inProgressLessons = sum(mediaSummaries, "inProgressLessons");
  const lessonsTotal = sum(mediaSummaries, "lessonsTotal");

  return {
    completedLessons,
    inProgressLessons,
    lessonsTotal,
    mediaCount: mediaSummaries.length,
    notStartedLessons: sum(mediaSummaries, "notStartedLessons"),
    progressPercent: calculatePercent(completedLessons, lessonsTotal)
  };
}

function selectResumeLesson(
  lessons: AppProgressBriefLessonTarget[]
): AppProgressBriefLessonTarget | null {
  return (
    lessons.find((lessonTarget) => lessonTarget.status !== "completed") ??
    lessons[0] ??
    null
  );
}

function normalizeStatus(
  value: string | null
): AppProgressBriefLessonTarget["status"] {
  if (value === "completed" || value === "in_progress") {
    return value;
  }

  return "not_started";
}

function compareTargetsByCurriculumOrder(
  left: AppProgressBriefLessonTarget,
  right: AppProgressBriefLessonTarget
) {
  return (
    left.orderIndex - right.orderIndex ||
    left.slug.localeCompare(right.slug) ||
    left.mediaSlug.localeCompare(right.mediaSlug)
  );
}

function compareTargetsByLastOpenedDesc(
  left: AppProgressBriefLessonTarget,
  right: AppProgressBriefLessonTarget
) {
  return (
    compareIsoDates(right.lastOpenedAt, left.lastOpenedAt) ||
    left.mediaTitle.localeCompare(right.mediaTitle) ||
    compareTargetsByCurriculumOrder(left, right)
  );
}

function compareTargetsByCompletedDesc(
  left: AppProgressBriefLessonTarget,
  right: AppProgressBriefLessonTarget
) {
  const leftDate = left.completedAt ?? left.lastOpenedAt;
  const rightDate = right.completedAt ?? right.lastOpenedAt;

  return (
    compareIsoDates(rightDate, leftDate) ||
    left.mediaTitle.localeCompare(right.mediaTitle) ||
    right.orderIndex - left.orderIndex ||
    left.slug.localeCompare(right.slug)
  );
}

function formatSummaryLine(result: AppProgressBriefResult) {
  if (result.scope.mediaSlug && result.media.length === 1) {
    const mediaSummary = result.media[0]!;

    return [
      "SUMMARY",
      `media=${mediaSummary.slug}`,
      `title=${quoteForLine(mediaSummary.title)}`,
      `lessons=${mediaSummary.lessonsTotal}`,
      `completed=${mediaSummary.completedLessons}`,
      `in_progress=${mediaSummary.inProgressLessons}`,
      `not_started=${mediaSummary.notStartedLessons}`,
      `progress=${formatPercent(mediaSummary.progressPercent)}`
    ].join(" ");
  }

  return [
    "SUMMARY",
    `media=${result.summary.mediaCount}`,
    `lessons=${result.summary.lessonsTotal}`,
    `completed=${result.summary.completedLessons}`,
    `in_progress=${result.summary.inProgressLessons}`,
    `not_started=${result.summary.notStartedLessons}`,
    `progress=${formatPercent(result.summary.progressPercent)}`
  ].join(" ");
}

function formatMediaLine(mediaSummary: AppProgressBriefMediaSummary) {
  return [
    "MEDIA",
    `slug=${mediaSummary.slug}`,
    `title=${quoteForLine(mediaSummary.title)}`,
    `href=${mediaSummary.href}`,
    `lessons=${mediaSummary.lessonsTotal}`,
    `completed=${mediaSummary.completedLessons}`,
    `in_progress=${mediaSummary.inProgressLessons}`,
    `not_started=${mediaSummary.notStartedLessons}`,
    `progress=${formatPercent(mediaSummary.progressPercent)}`
  ].join(" ");
}

function formatTargetLine(
  label: string,
  target: AppProgressBriefLessonTarget | null
) {
  if (!target) {
    return `${label} none`;
  }

  return [
    label,
    `media=${target.mediaSlug}`,
    `slug=${target.slug}`,
    `status=${target.status}`,
    `route=${target.href}`,
    `title=${quoteForLine(target.title)}`,
    target.completedAt ? `completed_at=${target.completedAt}` : null,
    target.lastOpenedAt ? `last_opened_at=${target.lastOpenedAt}` : null,
    `source_file=${target.sourceFile}`
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${value}%`;
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

export function sanitizeDatabaseDisplayPath(value: string) {
  try {
    const url = new URL(value);

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return value;
  }
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 10;
  }

  return Math.max(1, Math.min(50, Math.trunc(limit)));
}

function sum(
  mediaSummaries: AppProgressBriefMediaSummary[],
  key: keyof Pick<
    AppProgressBriefMediaSummary,
    "completedLessons" | "inProgressLessons" | "lessonsTotal" | "notStartedLessons"
  >
) {
  return mediaSummaries.reduce((total, item) => total + item[key], 0);
}

export function buildMediaTextbookHref(mediaSlug: string) {
  return mediaStudyHref(mediaSlug, "textbook");
}
