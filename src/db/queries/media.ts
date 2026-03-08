import { asc, eq } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { media } from "../schema/index.ts";

export async function listMedia(database: DatabaseClient) {
  return database.query.media.findMany({
    with: {
      progress: true
    },
    orderBy: [asc(media.title), asc(media.slug)]
  });
}

export async function getMediaBySlug(database: DatabaseClient, slug: string) {
  return database.query.media.findFirst({
    where: eq(media.slug, slug),
    with: {
      progress: true
    }
  });
}

export type MediaListItem = Awaited<ReturnType<typeof listMedia>>[number];
