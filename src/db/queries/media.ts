import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { media } from "../schema/index.ts";

export async function listMedia(database: DatabaseClient) {
  return database.query.media.findMany({
    where: eq(media.status, "active"),
    orderBy: [asc(media.title), asc(media.slug)]
  });
}

export async function listActiveMediaIds(database: DatabaseClient) {
  const rows = await database.query.media.findMany({
    columns: {
      id: true
    },
    where: eq(media.status, "active"),
    orderBy: [asc(media.id)]
  });

  return rows.map((row) => row.id);
}

export async function getMediaBySlug(database: DatabaseClient, slug: string) {
  return database.query.media.findFirst({
    where: and(eq(media.slug, slug), eq(media.status, "active"))
  });
}

export async function getMediaById(database: DatabaseClient, mediaId: string) {
  return database.query.media.findFirst({
    where: and(eq(media.id, mediaId), eq(media.status, "active"))
  });
}

export type MediaListItem = Awaited<ReturnType<typeof listMedia>>[number];
