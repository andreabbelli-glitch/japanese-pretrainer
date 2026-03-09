import { and, asc, eq, isNotNull, lte, ne } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { card, reviewState } from "../schema/index.ts";

export async function listCardsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), eq(card.status, "active")),
    with: {
      segment: true,
      reviewState: true,
      entryLinks: true
    },
    orderBy: [asc(card.orderIndex), asc(card.createdAt)]
  });
}

export async function getCardById(database: DatabaseClient, cardId: string) {
  return database.query.card.findFirst({
    where: eq(card.id, cardId),
    with: {
      segment: true,
      reviewState: true,
      entryLinks: true
    }
  });
}

export type DueCardItem = typeof card.$inferSelect & {
  reviewState: typeof reviewState.$inferSelect;
};

export async function listDueCardsByMediaId(
  database: DatabaseClient,
  mediaId: string,
  asOf = new Date().toISOString()
): Promise<DueCardItem[]> {
  const rows = await database
    .select({
      card,
      reviewState
    })
    .from(card)
    .innerJoin(reviewState, eq(reviewState.cardId, card.id))
      .where(
        and(
          eq(card.mediaId, mediaId),
          eq(card.status, "active"),
          isNotNull(reviewState.dueAt),
          lte(reviewState.dueAt, asOf),
          ne(reviewState.state, "suspended"),
          ne(reviewState.state, "known_manual")
        )
      )
    .orderBy(asc(reviewState.dueAt), asc(card.orderIndex));

  return rows.map((row) => ({
    ...row.card,
    reviewState: row.reviewState
  }));
}

export type CardListItem = Awaited<
  ReturnType<typeof listCardsByMediaId>
>[number];
