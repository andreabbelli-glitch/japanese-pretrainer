import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { lesson, media, segment } from "../schema/index.ts";

const lessonListColumns = {
  id: true,
  slug: true,
  title: true,
  orderIndex: true,
  difficulty: true,
  summary: true
} as const;

const lessonListRelations = {
  segment: {
    columns: {
      id: true,
      title: true,
      notes: true
    }
  },
  progress: {
    columns: {
      status: true,
      completedAt: true,
      lastOpenedAt: true
    }
  },
  content: {
    columns: {
      excerpt: true
    }
  }
} as const;

const shellLessonListColumns = {
  id: true,
  mediaId: true,
  slug: true,
  title: true,
  orderIndex: true,
  difficulty: true,
  summary: true
} as const;

const shellLessonListRelations = {
  segment: lessonListRelations.segment,
  progress: {
    columns: {
      completedAt: true,
      status: true,
      lastOpenedAt: true
    }
  }
} as const;

export async function listLessonsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.lesson.findMany({
    columns: lessonListColumns,
    where: and(eq(lesson.mediaId, mediaId), eq(lesson.status, "active")),
    with: lessonListRelations,
    orderBy: [asc(lesson.orderIndex), asc(lesson.slug)]
  });
}

export async function listLessonsByMediaIds(
  database: DatabaseClient,
  mediaIds: string[]
) {
  if (mediaIds.length === 0) {
    return [];
  }

  return database.query.lesson.findMany({
    columns: lessonListColumns,
    where: and(inArray(lesson.mediaId, mediaIds), eq(lesson.status, "active")),
    with: lessonListRelations,
    orderBy: [asc(lesson.mediaId), asc(lesson.orderIndex), asc(lesson.slug)]
  });
}

export async function listLessonsByMediaIdsForShell(
  database: DatabaseClient,
  mediaIds: string[]
): Promise<ShellLessonListItem[]> {
  if (mediaIds.length === 0) {
    return [];
  }

  return database.query.lesson.findMany({
    columns: shellLessonListColumns,
    where: and(inArray(lesson.mediaId, mediaIds), eq(lesson.status, "active")),
    with: shellLessonListRelations,
    orderBy: [asc(lesson.mediaId), asc(lesson.orderIndex), asc(lesson.slug)]
  });
}

export async function listRecentLessonsForDashboard(
  database: DatabaseClient,
  limit = 3
) {
  const normalizedLimit = Math.max(0, Math.trunc(limit));

  if (normalizedLimit === 0) {
    return [];
  }

  return database
    .select({
      createdAt: lesson.createdAt,
      id: lesson.id,
      lessonSlug: lesson.slug,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      summary: lesson.summary,
      title: lesson.title
    })
    .from(lesson)
    .innerJoin(media, eq(media.id, lesson.mediaId))
    .leftJoin(segment, eq(segment.id, lesson.segmentId))
    .where(and(eq(lesson.status, "active"), eq(media.status, "active")))
    .orderBy(
      desc(lesson.createdAt),
      desc(lesson.updatedAt),
      desc(lesson.orderIndex),
      desc(lesson.slug),
      asc(media.title),
      asc(lesson.id)
    )
    .limit(normalizedLimit);
}

export async function getLessonBySlug(
  database: DatabaseClient,
  mediaId: string,
  slug: string
) {
  return database.query.lesson.findFirst({
    where: and(
      eq(lesson.mediaId, mediaId),
      eq(lesson.slug, slug),
      eq(lesson.status, "active")
    ),
    with: {
      segment: true,
      progress: true,
      content: true
    }
  });
}

export async function getLessonReaderBySlug(
  database: DatabaseClient,
  mediaId: string,
  slug: string
) {
  return database.query.lesson.findFirst({
    where: and(
      eq(lesson.mediaId, mediaId),
      eq(lesson.slug, slug),
      eq(lesson.status, "active")
    ),
    with: {
      segment: true,
      progress: true,
      content: {
        columns: {
          astJson: true,
          excerpt: true
        }
      }
    }
  });
}

export async function getLessonAstBySlug(
  database: DatabaseClient,
  mediaId: string,
  slug: string
) {
  return database.query.lesson.findFirst({
    where: and(
      eq(lesson.mediaId, mediaId),
      eq(lesson.slug, slug),
      eq(lesson.status, "active")
    ),
    columns: {
      id: true
    },
    with: {
      content: {
        columns: {
          astJson: true
        }
      }
    }
  });
}

export async function getLessonIdBySlug(
  database: DatabaseClient,
  mediaId: string,
  slug: string
) {
  return database.query.lesson.findFirst({
    where: and(
      eq(lesson.mediaId, mediaId),
      eq(lesson.slug, slug),
      eq(lesson.status, "active")
    ),
    columns: {
      id: true
    }
  });
}

export type LessonListItem = Awaited<
  ReturnType<typeof listLessonsByMediaId>
>[number];

export type ShellLessonListItem = Omit<LessonListItem, "content"> & {
  content?: LessonListItem["content"];
  mediaId: string;
};

export type DashboardRecentLessonRow = Awaited<
  ReturnType<typeof listRecentLessonsForDashboard>
>[number];
