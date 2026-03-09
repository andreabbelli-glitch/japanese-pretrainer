import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { media } from "../schema/index.ts";

export async function listMedia(database: DatabaseClient) {
  return database.query.media.findMany({
    where: eq(media.status, "active"),
    with: {
      progress: true
    },
    orderBy: [asc(media.title), asc(media.slug)]
  });
}

export async function getMediaBySlug(database: DatabaseClient, slug: string) {
  return database.query.media.findFirst({
    where: and(eq(media.slug, slug), eq(media.status, "active")),
    with: {
      progress: true
    }
  });
}

export type MediaListItem = Awaited<ReturnType<typeof listMedia>>[number];
