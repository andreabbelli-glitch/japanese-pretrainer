import { asc, eq, and } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { lesson } from "../schema/index.ts";

export async function listLessonsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.lesson.findMany({
    where: and(eq(lesson.mediaId, mediaId), eq(lesson.status, "active")),
    with: {
      segment: true,
      progress: true,
      content: {
        columns: {
          excerpt: true
        }
      }
    },
    orderBy: [asc(lesson.orderIndex), asc(lesson.slug)]
  });
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
          excerpt: true,
          htmlRendered: true
        }
      }
    }
  });
}

export type LessonListItem = Awaited<
  ReturnType<typeof listLessonsByMediaId>
>[number];
