import { and, asc, eq, inArray } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import {
  card,
  preReviewConsolidationState,
  reviewSubjectState,
  type EntryType
} from "@/db/schema";
import {
  getLessonBySlug,
  getMediaBySlug,
  listGrammarEntryReviewSummariesByIds,
  listReviewSubjectStatesByKeys,
  type ReviewSubjectStateRecord,
  listTermEntryReviewSummariesByIds
} from "@/db/queries";

import { buildEntryKey } from "./entry-id";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  normalizeReviewSubjectSurface,
  type ReviewSubjectIdentity
} from "./review-subject";
import { consolidationLessonHref, reviewHref, type AppHref } from "./site";
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
    (candidate) => {
      const existingReviewState = existingReviewStates.get(
        candidate.identity.subjectKey
      );

      return (
        !existingConsolidationKeys.has(candidate.identity.subjectKey) &&
        (!existingReviewState ||
          isImporterSeededNewReviewSubjectState(existingReviewState))
      );
    }
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

function isImporterSeededNewReviewSubjectState(
  state: ReviewSubjectStateRecord
) {
  return (
    state.state === "new" &&
    state.reps === 0 &&
    state.learningSteps === 0 &&
    state.lapses === 0 &&
    state.scheduledDays === 0 &&
    state.lastReviewedAt === null &&
    state.dueAt === null &&
    state.stability === null &&
    state.difficulty === null &&
    !state.manualOverride &&
    !state.suspended
  );
}

export type PreReviewConsolidationStatus =
  (typeof preReviewConsolidationState.$inferSelect)["status"];

export type PreReviewConsolidationStep = "reading" | "meaning";

export type ConsolidationOptionKind = EntryType | "card";

export type ConsolidationHubLesson = {
  href: AppHref;
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  pendingCount: number;
};

export type ConsolidationHubMediaGroup = {
  lessons: ConsolidationHubLesson[];
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  pendingCount: number;
};

export type ConsolidationHubData = {
  mediaGroups: ConsolidationHubMediaGroup[];
  totalPending: number;
};

export type ConsolidationOption = {
  kind: ConsolidationOptionKind;
  label: string;
  subjectKey: string;
};

export type ConsolidationSessionStepData = {
  answerLabel: string;
  options: ConsolidationOption[];
  step: PreReviewConsolidationStep;
};

export type ConsolidationSessionSubject = {
  attemptCount: number;
  back: string;
  front: string;
  representativeCardId: string;
  steps: ConsolidationSessionStepData[];
  subjectKey: string;
};

export type ConsolidationSessionData = {
  hubHref: AppHref;
  lesson: {
    id: string;
    slug: string;
    title: string;
  };
  media: {
    id: string;
    slug: string;
    title: string;
  };
  reviewHref: AppHref;
  subjects: ConsolidationSessionSubject[];
  totalPending: number;
};

export type SubmitConsolidationAnswerInput = {
  database?: DatabaseClient;
  now?: Date;
  selectedSubjectKey: string;
  step: PreReviewConsolidationStep;
  subjectKey: string;
};

export type MarkConsolidationKnownInput = {
  database?: DatabaseClient;
  now?: Date;
  subjectKey: string;
};

export type ConsolidationAnswerResult = {
  attemptCount: number;
  completed: boolean;
  correct: boolean;
  lessonId: string;
  mediaId: string;
  nextStep: PreReviewConsolidationStep | null;
  reinsertionIndex: number | null;
  status: PreReviewConsolidationStatus;
  subjectKey: string;
};

type ConsolidationEntrySummary = {
  crossMediaGroupId: string | null;
  entryType: EntryType;
  entryId: string;
  id: string;
  label: string;
  meaning: string;
  reading: string | null;
};

type ConsolidationSubjectPresentation = {
  attemptCount: number;
  back: string;
  entryType: EntryType | null;
  front: string;
  kind: ConsolidationOptionKind;
  lessonId: string | null;
  meaning: string;
  pending: boolean;
  reading: string | null;
  representativeCardId: string;
  subjectKey: string;
};

type PendingConsolidationRow = Awaited<
  ReturnType<typeof listPendingConsolidationRowsByLessonId>
>[number];

type FallbackConsolidationCard = Awaited<
  ReturnType<typeof listSameMediaFallbackCards>
>[number];

export async function getConsolidationHubData(
  database: Pick<DatabaseClient, "query"> = db
): Promise<ConsolidationHubData> {
  const rows = await database.query.preReviewConsolidationState.findMany({
    columns: {
      lessonId: true,
      mediaId: true
    },
    where: eq(preReviewConsolidationState.status, "pending"),
    with: {
      lesson: {
        columns: {
          slug: true,
          title: true
        }
      },
      media: {
        columns: {
          slug: true,
          title: true
        }
      }
    },
    orderBy: [
      asc(preReviewConsolidationState.mediaId),
      asc(preReviewConsolidationState.lessonId),
      asc(preReviewConsolidationState.createdAt),
      asc(preReviewConsolidationState.subjectKey)
    ]
  });
  const groups = new Map<string, ConsolidationHubMediaGroup>();

  for (const row of rows) {
    const mediaGroup =
      groups.get(row.mediaId) ??
      {
        lessons: [],
        mediaId: row.mediaId,
        mediaSlug: row.media.slug,
        mediaTitle: row.media.title,
        pendingCount: 0
      };
    const existingLesson = mediaGroup.lessons.find(
      (lessonGroup) => lessonGroup.lessonId === row.lessonId
    );
    const lessonGroup =
      existingLesson ??
      {
        href: consolidationLessonHref(row.media.slug, row.lesson.slug),
        lessonId: row.lessonId,
        lessonSlug: row.lesson.slug,
        lessonTitle: row.lesson.title,
        pendingCount: 0
      };

    lessonGroup.pendingCount += 1;
    mediaGroup.pendingCount += 1;

    if (!existingLesson) {
      mediaGroup.lessons.push(lessonGroup);
    }

    groups.set(row.mediaId, mediaGroup);
  }

  return {
    mediaGroups: [...groups.values()],
    totalPending: rows.length
  };
}

export async function getConsolidationSessionData(input: {
  database?: DatabaseClient;
  lessonSlug: string;
  mediaSlug: string;
}): Promise<ConsolidationSessionData | null> {
  const database = input.database ?? db;
  const media = await getMediaBySlug(database, input.mediaSlug);

  if (!media) {
    return null;
  }

  const lesson = await getLessonBySlug(database, media.id, input.lessonSlug);

  if (!lesson) {
    return null;
  }

  const pendingRows = await listPendingConsolidationRowsByLessonId(
    database,
    lesson.id
  );

  if (pendingRows.length === 0) {
    return {
      hubHref: "/consolidation" as AppHref,
      lesson: {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title
      },
      media: {
        id: media.id,
        slug: media.slug,
        title: media.title
      },
      reviewHref: reviewHref(),
      subjects: [],
      totalPending: 0
    };
  }

  const sortedPendingRows = [...pendingRows].sort(comparePendingRowsForSession);
  const fallbackCards = await listSameMediaFallbackCards(database, media.id);
  const presentations = await buildConsolidationPresentations({
    database,
    fallbackCards,
    pendingRows: sortedPendingRows
  });
  const pendingSubjectKeys = new Set(
    sortedPendingRows.map((row) => row.subjectKey)
  );
  const pendingPresentations = presentations.filter((presentation) =>
    pendingSubjectKeys.has(presentation.subjectKey)
  );

  return {
    hubHref: "/consolidation" as AppHref,
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title
    },
    media: {
      id: media.id,
      slug: media.slug,
      title: media.title
    },
    reviewHref: reviewHref(),
    subjects: pendingPresentations.map((presentation) => ({
      attemptCount: presentation.attemptCount,
      back: presentation.back,
      front: presentation.front,
      representativeCardId: presentation.representativeCardId,
      steps: buildSessionSteps(presentation, presentations),
      subjectKey: presentation.subjectKey
    })),
    totalPending: pendingPresentations.length
  };
}

export async function submitConsolidationAnswer(
  input: SubmitConsolidationAnswerInput
): Promise<ConsolidationAnswerResult> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (transaction) => {
    const row = await loadPendingConsolidationRowBySubjectKey(
      transaction,
      input.subjectKey
    );

    if (!row) {
      throw new Error("Consolidation subject is not pending.");
    }

    if (input.selectedSubjectKey !== input.subjectKey) {
      const attemptCount = row.attemptCount + 1;
      const pendingCount = await countPendingRowsForLesson(
        transaction,
        row.lessonId
      );
      const nextStep = (await subjectRequiresReadingStep(transaction, row))
        ? "reading"
        : "meaning";
      const reinsertionIndex = getDeterministicIndex(
        [
          row.lessonId,
          input.subjectKey,
          input.step,
          String(attemptCount)
        ].join(":"),
        Math.max(1, pendingCount)
      );

      await transaction
        .update(preReviewConsolidationState)
        .set({
          attemptCount,
          lastAttemptAt: nowIso,
          readingPassedAt: null,
          updatedAt: nowIso
        })
        .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

      return {
        attemptCount,
        completed: false,
        correct: false,
        lessonId: row.lessonId,
        mediaId: row.mediaId,
        nextStep,
        reinsertionIndex,
        status: "pending",
        subjectKey: input.subjectKey
      };
    }

    if (input.step === "reading") {
      await transaction
        .update(preReviewConsolidationState)
        .set({
          readingPassedAt: nowIso,
          updatedAt: nowIso
        })
        .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

      return {
        attemptCount: row.attemptCount,
        completed: false,
        correct: true,
        lessonId: row.lessonId,
        mediaId: row.mediaId,
        nextStep: "meaning",
        reinsertionIndex: null,
        status: "pending",
        subjectKey: input.subjectKey
      };
    }

    if ((await subjectRequiresReadingStep(transaction, row)) && !row.readingPassedAt) {
      throw new Error("Reading step must be completed before meaning.");
    }

    const attemptCount = row.attemptCount + 1;

    await transaction
      .update(preReviewConsolidationState)
      .set({
        attemptCount,
        completedAt: nowIso,
        lastAttemptAt: nowIso,
        readingPassedAt: row.readingPassedAt,
        status: "passed",
        updatedAt: nowIso
      })
      .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

    return {
      attemptCount,
      completed: true,
      correct: true,
      lessonId: row.lessonId,
      mediaId: row.mediaId,
      nextStep: null,
      reinsertionIndex: null,
      status: "passed",
      subjectKey: input.subjectKey
    };
  });
}

export async function markConsolidationKnown(
  input: MarkConsolidationKnownInput
): Promise<ConsolidationAnswerResult> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (transaction) => {
    const row = await loadPendingConsolidationRowBySubjectKey(
      transaction,
      input.subjectKey
    );

    if (!row) {
      throw new Error("Consolidation subject is not pending.");
    }

    await transaction
      .update(preReviewConsolidationState)
      .set({
        completedAt: nowIso,
        status: "known_manual",
        updatedAt: nowIso
      })
      .where(eq(preReviewConsolidationState.subjectKey, input.subjectKey));

    await transaction
      .insert(reviewSubjectState)
      .values({
        cardId: row.representativeCardId,
        createdAt: nowIso,
        crossMediaGroupId: row.crossMediaGroupId,
        difficulty: null,
        dueAt: null,
        entryId: row.entryId,
        entryType: row.entryType,
        lapses: 0,
        lastInteractionAt: nowIso,
        lastReviewedAt: null,
        learningSteps: 0,
        manualOverride: true,
        reps: 0,
        scheduledDays: 0,
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "known_manual",
        subjectKey: row.subjectKey,
        subjectType: row.subjectType,
        suspended: false,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: reviewSubjectState.subjectKey,
        set: {
          cardId: row.representativeCardId,
          crossMediaGroupId: row.crossMediaGroupId,
          difficulty: null,
          dueAt: null,
          entryId: row.entryId,
          entryType: row.entryType,
          lapses: 0,
          lastInteractionAt: nowIso,
          lastReviewedAt: null,
          learningSteps: 0,
          manualOverride: true,
          reps: 0,
          scheduledDays: 0,
          schedulerVersion: "fsrs_v1",
          stability: null,
          state: "known_manual",
          subjectType: row.subjectType,
          suspended: false,
          updatedAt: nowIso
        }
      });

    return {
      attemptCount: row.attemptCount,
      completed: true,
      correct: true,
      lessonId: row.lessonId,
      mediaId: row.mediaId,
      nextStep: null,
      reinsertionIndex: null,
      status: "known_manual",
      subjectKey: input.subjectKey
    };
  });
}

async function listPendingConsolidationRowsByLessonId(
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

async function listSameMediaFallbackCards(
  database: Pick<DatabaseClient, "query">,
  mediaId: string
) {
  return database.query.card.findMany({
    where: and(eq(card.mediaId, mediaId), eq(card.status, "active")),
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
    orderBy: [asc(card.orderIndex), asc(card.createdAt), asc(card.id)],
    limit: 80
  });
}

async function loadPendingConsolidationRowBySubjectKey(
  database: Pick<DatabaseClient, "query">,
  subjectKey: string
) {
  return database.query.preReviewConsolidationState.findFirst({
    where: and(
      eq(preReviewConsolidationState.subjectKey, subjectKey),
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
    }
  });
}

async function countPendingRowsForLesson(
  database: Pick<DatabaseClient, "query">,
  lessonId: string
) {
  const rows = await database.query.preReviewConsolidationState.findMany({
    columns: {
      subjectKey: true
    },
    where: and(
      eq(preReviewConsolidationState.lessonId, lessonId),
      eq(preReviewConsolidationState.status, "pending")
    )
  });

  return rows.length;
}

async function buildConsolidationPresentations(input: {
  database: DatabaseQueryClient;
  fallbackCards: FallbackConsolidationCard[];
  pendingRows: PendingConsolidationRow[];
}) {
  const cardLikes = [
    ...input.pendingRows.map((row) => row.representativeCard),
    ...input.fallbackCards
  ];
  const entryLookup = await buildConsolidationEntrySummaryLookup(
    input.database,
    cardLikes
  );
  const presentations = new Map<string, ConsolidationSubjectPresentation>();

  for (const row of input.pendingRows) {
    presentations.set(
      row.subjectKey,
      buildPendingRowPresentation(row, entryLookup)
    );
  }

  for (const fallbackCard of input.fallbackCards) {
    const identity = deriveReviewSubjectIdentity({
      cardId: fallbackCard.id,
      cardType: fallbackCard.cardType,
      entryLinks: fallbackCard.entryLinks,
      entryLookup,
      front: fallbackCard.front
    });

    if (presentations.has(identity.subjectKey)) {
      continue;
    }

    presentations.set(
      identity.subjectKey,
      buildCardPresentation({
        attemptCount: 0,
        cardItem: fallbackCard,
        identity,
        entryLookup
      })
    );
  }

  return [...presentations.values()];
}

function buildPendingRowPresentation(
  row: PendingConsolidationRow,
  entryLookup: Map<string, ConsolidationEntrySummary>
): ConsolidationSubjectPresentation {
  return buildCardPresentation({
    attemptCount: row.attemptCount,
    cardItem: row.representativeCard,
    entryLookup,
    identity: {
      cardId: row.representativeCardId,
      crossMediaGroupId: row.crossMediaGroupId,
      entryId: row.entryId,
      entryType: row.entryType,
      subjectKey: row.subjectKey,
      subjectKind: row.subjectType
      },
    lessonId: row.lessonId,
    pending: true
  });
}

function buildCardPresentation(input: {
  attemptCount: number;
  cardItem: PendingConsolidationRow["representativeCard"] | FallbackConsolidationCard;
  entryLookup: Map<string, ConsolidationEntrySummary>;
  identity: ReviewSubjectIdentity;
  lessonId?: string | null;
  pending?: boolean;
}): ConsolidationSubjectPresentation {
  const entry =
    input.identity.entryType && input.identity.entryId
      ? input.entryLookup.get(
          buildEntryKey(input.identity.entryType, input.identity.entryId)
        ) ?? null
      : null;

  return {
    attemptCount: input.attemptCount,
    back: input.cardItem.back,
    entryType: input.identity.entryType,
    front: input.cardItem.front,
    kind: input.identity.entryType ?? "card",
    lessonId: input.lessonId ?? input.cardItem.lessonId,
    meaning: entry?.meaning ?? input.cardItem.back,
    pending: input.pending ?? false,
    reading: entry?.reading?.trim() || null,
    representativeCardId: input.cardItem.id,
    subjectKey: input.identity.subjectKey
  };
}

async function buildConsolidationEntrySummaryLookup(
  database: DatabaseQueryClient,
  cards: Array<Pick<ConsolidationCard, "entryLinks">>
) {
  const { grammarIds, termIds } = collectConsolidationLinkedEntryIds(cards);
  const [terms, grammar] = await Promise.all([
    listTermEntryReviewSummariesByIds(database, termIds),
    listGrammarEntryReviewSummariesByIds(database, grammarIds)
  ]);
  const lookup = new Map<string, ConsolidationEntrySummary>();

  for (const entry of terms) {
    lookup.set(buildEntryKey("term", entry.id), {
      crossMediaGroupId: entry.crossMediaGroupId,
      entryType: "term",
      entryId: entry.id,
      id: entry.id,
      label: entry.lemma,
      meaning: entry.meaningIt,
      reading: entry.reading
    });
  }

  for (const entry of grammar) {
    lookup.set(buildEntryKey("grammar", entry.id), {
      crossMediaGroupId: entry.crossMediaGroupId,
      entryType: "grammar",
      entryId: entry.id,
      id: entry.id,
      label: entry.pattern,
      meaning: entry.meaningIt,
      reading: entry.reading ?? null
    });
  }

  return lookup;
}

function buildSessionSteps(
  target: ConsolidationSubjectPresentation,
  pool: ConsolidationSubjectPresentation[]
): ConsolidationSessionStepData[] {
  const steps: ConsolidationSessionStepData[] = [];

  if (target.reading && readingAddsRetrievalValue(target.front, target.reading)) {
    steps.push({
      answerLabel: target.reading,
      options: buildStepOptions(target, pool, "reading"),
      step: "reading"
    });
  }

  steps.push({
    answerLabel: target.meaning,
    options: buildStepOptions(target, pool, "meaning"),
    step: "meaning"
  });

  return steps;
}

function buildStepOptions(
  target: ConsolidationSubjectPresentation,
  pool: ConsolidationSubjectPresentation[],
  step: PreReviewConsolidationStep
): ConsolidationOption[] {
  const seed = [
    target.lessonId ?? "media",
    target.subjectKey,
    step,
    String(target.attemptCount)
  ].join(":");
  const currentLessonPendingCandidates = deterministicShuffle(
    pool.filter(
      (candidate) =>
        candidate.subjectKey !== target.subjectKey &&
        candidate.pending &&
        Boolean(target.lessonId) &&
        candidate.lessonId === target.lessonId
    ),
    `${seed}:pending`
  );
  const pendingCandidateKeys = new Set(
    currentLessonPendingCandidates.map((candidate) => candidate.subjectKey)
  );
  const fallbackCandidates = deterministicShuffle(
    pool.filter(
      (candidate) =>
        candidate.subjectKey !== target.subjectKey &&
        !pendingCandidateKeys.has(candidate.subjectKey)
    ),
    `${seed}:fallback`
  );
  const options = new Map<string, ConsolidationOption>();

  addOption(options, target, step);

  for (const candidate of [
    ...currentLessonPendingCandidates,
    ...fallbackCandidates
  ]) {
    addOption(options, candidate, step);

    if (options.size >= 4) {
      break;
    }
  }

  return deterministicShuffle([...options.values()], `${seed}:options`);
}

function addOption(
  options: Map<string, ConsolidationOption>,
  presentation: ConsolidationSubjectPresentation,
  step: PreReviewConsolidationStep
) {
  const label = getStepAnswerLabel(presentation, step);
  const normalizedLabel = normalizeOptionLabel(label);

  if (!label || options.has(normalizedLabel)) {
    return;
  }

  options.set(normalizedLabel, {
    kind: presentation.kind,
    label,
    subjectKey: presentation.subjectKey
  });
}

function getStepAnswerLabel(
  presentation: ConsolidationSubjectPresentation,
  step: PreReviewConsolidationStep
) {
  return step === "reading"
    ? presentation.reading?.trim() ?? ""
    : presentation.meaning.trim();
}

function readingAddsRetrievalValue(front: string, reading: string) {
  return normalizeReviewSubjectSurface(front) !== normalizeReviewSubjectSurface(reading);
}

async function subjectRequiresReadingStep(
  database: DatabaseQueryClient,
  row: PendingConsolidationRow
) {
  if (!row.entryType || !row.entryId) {
    return false;
  }

  const entryLookup = await buildConsolidationEntrySummaryLookup(database, [
    row.representativeCard
  ]);
  const entry = entryLookup.get(buildEntryKey(row.entryType, row.entryId));
  const front = row.representativeCard.front;
  const reading = entry?.reading?.trim() || null;

  return reading ? readingAddsRetrievalValue(front, reading) : false;
}

function normalizeOptionLabel(label: string) {
  return label.replace(/\s+/g, " ").trim().toLocaleLowerCase("it-IT");
}

function comparePendingRowsForSession(
  left: PendingConsolidationRow,
  right: PendingConsolidationRow
) {
  return (
    (left.representativeCard.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.representativeCard.orderIndex ?? Number.MAX_SAFE_INTEGER) ||
    left.representativeCard.createdAt.localeCompare(
      right.representativeCard.createdAt
    ) ||
    left.subjectKey.localeCompare(right.subjectKey)
  );
}

function deterministicShuffle<T>(items: T[], seed: string) {
  return [...items]
    .map((item, index) => ({
      item,
      rank: hashString(`${seed}:${index}`)
    }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ item }) => item);
}

function getDeterministicIndex(seed: string, modulo: number) {
  if (modulo <= 1) {
    return 0;
  }

  return hashString(seed) % modulo;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
