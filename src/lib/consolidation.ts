import { and, asc, eq, inArray } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import {
  card,
  preReviewConsolidationState,
  type EntryType
} from "@/db/schema";
import {
  listGrammarEntryReviewSummariesByIds,
  listReviewSubjectStatesByKeys,
  listTermEntryReviewSummariesByIds
} from "@/db/queries";

import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  type ReviewSubjectIdentity
} from "./review-subject";
import { setLessonCompletionState } from "./textbook-progress";

type EnqueueLessonConsolidationInput = {
  database?: ConsolidationMutationClient;
  lessonId: string;
  now?: Date;
};

type SetLessonCompletionWithConsolidationInput = {
  completed: boolean;
  database?: DatabaseClient;
  lessonId: string;
  now?: Date;
};

type ConsolidationCandidate = {
  identity: ReviewSubjectIdentity;
  representativeCardId: string;
  lessonId: string;
  mediaId: string;
};

type ConsolidationCard = Awaited<
  ReturnType<typeof listActiveConsolidationCardsByLessonId>
>[number];

type ConsolidationMutationClient = DatabaseQueryClient &
  Pick<DatabaseClient, "insert">;

export async function enqueueLessonConsolidation(
  input: EnqueueLessonConsolidationInput
) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();
  const candidates = await buildLessonConsolidationCandidates(
    database,
    input.lessonId
  );

  if (candidates.length === 0) {
    return {
      createdCount: 0,
      subjectKeys: [] as string[]
    };
  }

  const subjectKeys = candidates.map((candidate) => candidate.identity.subjectKey);
  const [existingReviewStates, existingConsolidationRows] = await Promise.all([
    listReviewSubjectStatesByKeys(database, subjectKeys),
    database.query.preReviewConsolidationState.findMany({
      where: inArray(preReviewConsolidationState.subjectKey, subjectKeys)
    })
  ]);
  const existingConsolidationKeys = new Set(
    existingConsolidationRows.map((row) => row.subjectKey)
  );
  const rowsToInsert = candidates.filter(
    (candidate) =>
      !existingReviewStates.has(candidate.identity.subjectKey) &&
      !existingConsolidationKeys.has(candidate.identity.subjectKey)
  );

  if (rowsToInsert.length === 0) {
    return {
      createdCount: 0,
      subjectKeys: [] as string[]
    };
  }

  await database
    .insert(preReviewConsolidationState)
    .values(
      rowsToInsert.map((candidate) => ({
        subjectKey: candidate.identity.subjectKey,
        subjectType: candidate.identity.subjectKind,
        entryType: candidate.identity.entryType,
        crossMediaGroupId: candidate.identity.crossMediaGroupId,
        entryId: candidate.identity.entryId,
        representativeCardId: candidate.representativeCardId,
        lessonId: candidate.lessonId,
        mediaId: candidate.mediaId,
        status: "pending" as const,
        attemptCount: 0,
        lastAttemptAt: null,
        completedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      }))
    )
    .onConflictDoNothing({
      target: preReviewConsolidationState.subjectKey
    });

  return {
    createdCount: rowsToInsert.length,
    subjectKeys: rowsToInsert.map((candidate) => candidate.identity.subjectKey)
  };
}

export async function setLessonCompletionWithConsolidation(
  input: SetLessonCompletionWithConsolidationInput
) {
  const database = input.database ?? db;

  return database.transaction(async (transaction) => {
    const completion = await setLessonCompletionState(
      input.lessonId,
      input.completed,
      transaction
    );
    const consolidation =
      input.completed && completion.completedNow
        ? await enqueueLessonConsolidation({
            database: transaction,
            lessonId: input.lessonId,
            now: input.now
          })
        : {
            createdCount: 0,
            subjectKeys: [] as string[]
          };

    return {
      ...completion,
      consolidation
    };
  });
}

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
    await getPendingConsolidationSubjectKeys(database, [...new Set(subjectKeys)])
  );
}

async function buildLessonConsolidationCandidates(
  database: ConsolidationMutationClient,
  lessonId: string
): Promise<ConsolidationCandidate[]> {
  const cards = await listActiveConsolidationCardsByLessonId(database, lessonId);

  if (cards.length === 0) {
    return [];
  }

  const entryLookup = await buildConsolidationEntryLookup(database, cards);
  const candidatesBySubjectKey = new Map<string, ConsolidationCandidate>();

  for (const candidateCard of cards) {
    if (!isCardFromCompletedActiveLesson(candidateCard)) {
      continue;
    }

    const identity = deriveReviewSubjectIdentity({
      cardId: candidateCard.id,
      cardType: candidateCard.cardType,
      entryLinks: candidateCard.entryLinks,
      entryLookup,
      front: candidateCard.front
    });

    if (!candidatesBySubjectKey.has(identity.subjectKey)) {
      candidatesBySubjectKey.set(identity.subjectKey, {
        identity,
        lessonId: candidateCard.lessonId!,
        mediaId: candidateCard.mediaId,
        representativeCardId: candidateCard.id
      });
    }
  }

  return [...candidatesBySubjectKey.values()];
}

async function listActiveConsolidationCardsByLessonId(
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

async function buildConsolidationEntryLookup(
  database: DatabaseQueryClient,
  cards: ConsolidationCard[]
) {
  const { grammarIds, termIds } = collectConsolidationLinkedEntryIds(cards);
  const [terms, grammar] = await Promise.all([
    listTermEntryReviewSummariesByIds(database, termIds),
    listGrammarEntryReviewSummariesByIds(database, grammarIds)
  ]);

  return buildReviewSubjectEntryLookup({
    grammar,
    terms
  });
}

function collectConsolidationLinkedEntryIds(
  cards: Array<Pick<ConsolidationCard, "entryLinks">>
) {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const cardItem of cards) {
    for (const link of cardItem.entryLinks) {
      if (link.entryType === "term") {
        termIds.add(link.entryId);
        continue;
      }

      if (link.entryType === "grammar") {
        grammarIds.add(link.entryId);
      }
    }
  }

  return {
    grammarIds: [...grammarIds],
    termIds: [...termIds]
  };
}

function isCardFromCompletedActiveLesson(
  candidateCard: Pick<ConsolidationCard, "lesson" | "lessonId">
) {
  return (
    Boolean(candidateCard.lessonId) &&
    candidateCard.lesson?.status === "active" &&
    candidateCard.lesson.progress?.status === "completed"
  );
}

export type PreReviewConsolidationStatus =
  (typeof preReviewConsolidationState.$inferSelect)["status"];

export type PreReviewConsolidationStep = "reading" | "meaning";

export type ConsolidationOptionKind = EntryType | "card";
