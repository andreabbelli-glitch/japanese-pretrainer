import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { media } from "../schema/index.ts";

const mediaSummaryColumns = {
  id: true,
  slug: true,
  title: true,
  mediaType: true,
  segmentKind: true,
  description: true,
  status: true
} as const;

export async function listMedia(database: DatabaseClient) {
  return database.query.media.findMany({
    columns: mediaSummaryColumns,
    where: eq(media.status, "active"),
    orderBy: [asc(media.title), asc(media.slug)]
  });
}

export async function getMediaBySlug(database: DatabaseClient, slug: string) {
  return database.query.media.findFirst({
    columns: mediaSummaryColumns,
    where: and(eq(media.slug, slug), eq(media.status, "active"))
  });
}

export type MediaListItem = Awaited<ReturnType<typeof listMedia>>[number];
