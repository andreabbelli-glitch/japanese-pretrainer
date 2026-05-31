import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import { card, preReviewConsolidationState } from "@/db/schema";

import type { PreReviewConsolidationStatus } from "./contracts";

const ACTIVE_CONSOLIDATION_STATUSES = ["pending", "retraining"] as const;

export async function getPendingConsolidationSubjectKeys(
  database: Pick<DatabaseClient, "query"> = db,
  subjectKeys?: string[]
) {
  const where =
    subjectKeys && subjectKeys.length > 0
      ? and(
          eq(preReviewConsolidationState.status, "pending"),
          inArray(preReviewConsolidationState.subjectKey, subjectKeys)
        )
      : eq(preReviewConsolidationState.status, "pending");

  const rows = await database.query.preReviewConsolidationState.findMany({
    columns: {
      subjectKey: true
    },
    where,
    orderBy: [asc(preReviewConsolidationState.subjectKey)]
  });

  return rows.map((row) => row.subjectKey);
}

export async function getPendingConsolidationSubjectKeySet(
  database: Pick<DatabaseClient, "query">,
  subjectKeys: string[]
) {
  if (subjectKeys.length === 0) {
    return new Set<string>();
  }

  return new Set(
    await getPendingConsolidationSubjectKeys(database, [
      ...new Set(subjectKeys)
    ])
  );
}

export async function listActiveConsolidationCardsByLessonId(
  database: Pick<DatabaseClient, "query">,
  lessonId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.lessonId, lessonId), eq(card.status, "active")),
    with: {
      entryLinks: {
        columns: {
          entryId: true,
          entryType: true,
          relationshipType: true
        }
      },
      lesson: {
        columns: {
          status: true
        },
        with: {
          progress: {
            columns: {
              status: true
            }
          }
        }
      }
    },
    orderBy: (cardTable, { asc }) => [
      asc(cardTable.orderIndex),
      asc(cardTable.createdAt),
      asc(cardTable.id)
    ]
  });
}

export type ConsolidationCard = Awaited<
  ReturnType<typeof listActiveConsolidationCardsByLessonId>
>[number];

export type PendingConsolidationRow = Awaited<
  ReturnType<typeof listPendingConsolidationRowsByLessonId>
>[number];

export type FallbackConsolidationCard = Awaited<
  ReturnType<typeof listSameMediaFallbackCards>
>[number];

export async function listPendingConsolidationRowsByLessonId(
  database: Pick<DatabaseClient, "query">,
  lessonId: string
) {
  return database.query.preReviewConsolidationState.findMany({
    where: and(
      eq(preReviewConsolidationState.lessonId, lessonId),
      eq(preReviewConsolidationState.status, "pending")
    ),
    with: {
      representativeCard: {
        columns: {
          back: true,
          cardType: true,
          createdAt: true,
          front: true,
          id: true,
          lessonId: true,
          mediaId: true,
          orderIndex: true,
          status: true,
          updatedAt: true
        },
        with: {
          entryLinks: {
            columns: {
              entryId: true,
              entryType: true,
              relationshipType: true
            }
          }
        }
      }
    },
    orderBy: [
      asc(preReviewConsolidationState.createdAt),
      asc(preReviewConsolidationState.subjectKey)
    ]
  });
}

export async function listRetrainingConsolidationRows(
  database: Pick<DatabaseClient, "query">
) {
  return database.query.preReviewConsolidationState.findMany({
    where: eq(preReviewConsolidationState.status, "retraining"),
    with: {
      representativeCard: {
        columns: {
          back: true,
          cardType: true,
          createdAt: true,
          front: true,
          id: true,
          lessonId: true,
          mediaId: true,
          orderIndex: true,
          status: true,
          updatedAt: true
        },
        with: {
          entryLinks: {
            columns: {
              entryId: true,
              entryType: true,
              relationshipType: true
            }
          }
        }
      }
    },
    orderBy: [
      asc(preReviewConsolidationState.createdAt),
      asc(preReviewConsolidationState.subjectKey)
    ]
  });
}

export async function listSameMediaFallbackCards(
  database: Pick<DatabaseClient, "query">,
  mediaId: string
) {
  return listSameMediaFallbackCardsByMediaIds(database, [mediaId]);
}

export async function listSameMediaFallbackCardsByMediaIds(
  database: Pick<DatabaseClient, "query">,
  mediaIds: string[]
) {
  const uniqueMediaIds = [...new Set(mediaIds)];

  if (uniqueMediaIds.length === 0) {
    return [];
  }

  return database.query.card.findMany({
    where: and(
      inArray(card.mediaId, uniqueMediaIds),
      eq(card.status, "active")
    ),
    columns: {
      back: true,
      cardType: true,
      createdAt: true,
      front: true,
      id: true,
      lessonId: true,
      mediaId: true,
      orderIndex: true,
      status: true,
      updatedAt: true
    },
    with: {
      entryLinks: {
        columns: {
          entryId: true,
          entryType: true,
          relationshipType: true
        }
      }
    },
    orderBy: [
      asc(card.mediaId),
      asc(card.orderIndex),
      asc(card.createdAt),
      asc(card.id)
    ],
    limit: Math.min(240, uniqueMediaIds.length * 80)
  });
}

export async function loadPendingConsolidationRowBySubjectKey(
  database: Pick<DatabaseClient, "query">,
  subjectKey: string
) {
  return database.query.preReviewConsolidationState.findFirst({
    where: and(
      eq(preReviewConsolidationState.subjectKey, subjectKey),
      inArray(preReviewConsolidationState.status, ACTIVE_CONSOLIDATION_STATUSES)
    ),
    with: {
      representativeCard: {
        columns: {
          back: true,
          cardType: true,
          createdAt: true,
          front: true,
          id: true,
          lessonId: true,
          mediaId: true,
          orderIndex: true,
          status: true,
          updatedAt: true
        },
        with: {
          entryLinks: {
            columns: {
              entryId: true,
              entryType: true,
              relationshipType: true
            }
          }
        }
      }
    }
  });
}

export async function countPendingRowsForLesson(
  database: DatabaseQueryClient,
  lessonId: string
) {
  const [row] = await database
    .select({
      count: sql<number>`cast(count(*) as integer)`
    })
    .from(preReviewConsolidationState)
    .where(
      and(
        eq(preReviewConsolidationState.lessonId, lessonId),
        eq(preReviewConsolidationState.status, "pending")
      )
    );

  return Number(row?.count ?? 0);
}

export async function countRetrainingRows(database: DatabaseQueryClient) {
  return countConsolidationRowsByStatus(database, "retraining");
}

export async function countConsolidationRowsByStatus(
  database: DatabaseQueryClient,
  status: PreReviewConsolidationStatus
) {
  const [row] = await database
    .select({
      count: sql<number>`cast(count(*) as integer)`
    })
    .from(preReviewConsolidationState)
    .where(eq(preReviewConsolidationState.status, status));

  return Number(row?.count ?? 0);
}
