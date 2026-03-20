import { randomUUID } from "node:crypto";

import { and, eq, inArray, or } from "drizzle-orm";

import {
  card,
  db,
  entryStatus,
  reviewLog,
  reviewState,
  reviewSubjectLog,
  reviewSubjectState,
  type DatabaseClient,
  type EntryType,
  type ReviewCardListItem
} from "@/db";
import {
  getGrammarEntriesByIds,
  getGrammarCrossMediaFamilyByEntryId,
  getTermEntriesByIds,
  getTermCrossMediaFamilyByEntryId,
  listReviewCardIdsByEntryRefs,
  listReviewCardsByIds,
  getReviewSubjectStateByKey
} from "@/db";

import {
  getDrivingEntryLinks,
  hasCompletedReviewLesson,
  resolveEffectiveReviewState,
  type ReviewEntryStatusValue
} from "./review-model";
import {
  buildReviewSubjectEntryLookup,
  buildReviewSubjectSeedState,
  deriveReviewSubjectIdentity,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectIdentity,
  type ReviewSubjectStateSnapshot
} from "./review-subject";
import {
  scheduleReview,
  type ReviewRating,
  type ReviewState
} from "./review-scheduler";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

type LinkedEntryRef = {
  entryId: string;
  entryType: EntryType;
};

type ReviewMutationCard = ReviewCardListItem & {
  drivingEntries: Array<
    LinkedEntryRef & { status: typeof entryStatus.$inferSelect | null }
  >;
};

type ReviewSubjectMemberCard = Awaited<
  ReturnType<typeof listReviewCardsByIds>
>[number];

export async function applyReviewGrade(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
  rating: ReviewRating;
  responseMs?: number | null;
}) {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!isActiveReviewableMutationCard(loadedCard)) {
      throw new Error("Review card not available for grading.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const subjectContext = await loadReviewSubjectMutationContext(
      tx,
      loadedCard,
      nowIso
    );
    const subjectReviewState = buildSubjectReviewStateForValidation(
      subjectContext.subjectState,
      subjectContext.seedCard
    );

    const effectiveState = resolveEffectiveReviewState({
      cardStatus: subjectContext.seedCard.status,
      drivingEntryStatuses: subjectContext.drivingEntries.map(
        (entry) => entry.status?.status ?? null
      ),
      reviewState: subjectReviewState
    });

    if (
      effectiveState.state === "known_manual" ||
      effectiveState.state === "ignored"
    ) {
      throw new Error(
        "Manual mastery cards cannot be graded until the entry is reopened."
      );
    }

    if (effectiveState.state === "suspended") {
      throw new Error("Suspended cards must be resumed before grading.");
    }

    const seedState = buildReviewSubjectSeedState(
      subjectContext.memberCards,
      subjectContext.subjectState
        ? (subjectContext.subjectState as ReviewSubjectStateSnapshot)
        : null,
      nowIso
    );
    const previousState = (subjectReviewState?.state ?? "new") as ReviewState;
    const scheduled = scheduleReview({
      current: seedState.current,
      now,
      rating: input.rating
    });

    await upsertReviewSubjectState(tx, {
      createdAt:
        subjectContext.subjectState?.createdAt ??
        subjectContext.seedCard.reviewState?.createdAt ??
        subjectContext.seedCard.createdAt,
      currentCardId: loadedCard.id,
      identity: subjectContext.identity,
      lastReviewedAt: nowIso,
      nowIso,
      scheduled,
      updatedAt: nowIso
    });

    await tx.insert(reviewSubjectLog).values({
      id: `review_subject_log_${randomUUID()}`,
      subjectKey: subjectContext.identity.subjectKey,
      cardId: loadedCard.id,
      answeredAt: nowIso,
      rating: input.rating,
      previousState,
      newState: scheduled.state,
      scheduledDueAt: scheduled.dueAt,
      elapsedDays: scheduled.elapsedDays,
      responseMs: input.responseMs ?? null,
      schedulerVersion: scheduled.schedulerVersion
    });

    await tx.insert(reviewLog).values({
      id: `review_log_${randomUUID()}`,
      cardId: loadedCard.id,
      answeredAt: nowIso,
      rating: input.rating,
      previousState,
      newState: scheduled.state,
      scheduledDueAt: scheduled.dueAt,
      elapsedDays: scheduled.elapsedDays,
      responseMs: input.responseMs ?? null,
      schedulerVersion: scheduled.schedulerVersion
    });

    await mirrorLegacyReviewStateToCards(tx, subjectContext.memberCards, {
      createdAt:
        subjectContext.subjectState?.createdAt ??
        subjectContext.seedCard.reviewState?.createdAt ??
        subjectContext.seedCard.createdAt,
      lastReviewedAt: nowIso,
      nowIso,
      scheduled
    });

    return {
      cardId: loadedCard.id,
      dueAt: scheduled.dueAt,
      mediaId: loadedCard.mediaId,
      newState: scheduled.state,
      previousState
    };
  });
}

export async function resetReviewCardProgress(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!isResettableMutationCard(loadedCard)) {
      throw new Error("Review card not available for reset.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const subjectContext = await loadReviewSubjectMutationContext(
      tx,
      loadedCard,
      nowIso
    );
    const entryStatusFilters = buildEntryStatusFilters(
      subjectContext.drivingEntries.map((entry) => ({
        entryId: entry.entryId,
        entryType: entry.entryType
      }))
    );

    await tx
      .update(card)
      .set({
        status: "active",
        updatedAt: nowIso
      })
      .where(
        inArray(
          card.id,
          subjectContext.memberCards.map((member) => member.id)
        )
      );

    await upsertReviewSubjectState(tx, {
      createdAt:
        subjectContext.subjectState?.createdAt ??
        subjectContext.seedCard.reviewState?.createdAt ??
        subjectContext.seedCard.createdAt,
      currentCardId: loadedCard.id,
      identity: subjectContext.identity,
      lastReviewedAt: null,
      nowIso,
      scheduled: {
        difficulty: null,
        dueAt: nowIso,
        elapsedDays: null,
        lapses: 0,
        learningSteps: 0,
        reps: 0,
        scheduledDays: 0,
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "new"
      },
      updatedAt: nowIso
    });

    await mirrorLegacyReviewStateToCards(tx, subjectContext.memberCards, {
      createdAt:
        subjectContext.subjectState?.createdAt ??
        subjectContext.seedCard.reviewState?.createdAt ??
        subjectContext.seedCard.createdAt,
      lastReviewedAt: null,
      nowIso,
      scheduled: {
        difficulty: null,
        dueAt: nowIso,
        elapsedDays: null,
        lapses: 0,
        learningSteps: 0,
        reps: 0,
        scheduledDays: 0,
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "new"
      }
    });

    if (entryStatusFilters.length > 0) {
      await tx
        .delete(entryStatus)
        .where(
          entryStatusFilters.length === 1
            ? entryStatusFilters[0]!
            : or(entryStatusFilters[0]!, entryStatusFilters[1]!)
        );
    }

    return {
      cardId: loadedCard.id,
      mediaId: loadedCard.mediaId
    };
  });
}

export async function setReviewCardSuspended(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
  suspended: boolean;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!isSuspensionMutationCard(loadedCard)) {
      throw new Error("Review card not available for suspension changes.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const subjectContext = await loadReviewSubjectMutationContext(
      tx,
      loadedCard,
      nowIso
    );

    await tx
      .update(card)
      .set({
        status: input.suspended ? "suspended" : "active",
        updatedAt: nowIso
      })
      .where(
        inArray(
          card.id,
          subjectContext.memberCards.map((member) => member.id)
        )
      );

    const sourceSeedCard = subjectContext.seedCard;
    const sourceState = subjectContext.subjectState ?? {
      cardId: sourceSeedCard.id,
      crossMediaGroupId: subjectContext.identity.crossMediaGroupId,
      createdAt:
        sourceSeedCard.reviewState?.createdAt ?? sourceSeedCard.createdAt,
      difficulty: sourceSeedCard.reviewState?.difficulty ?? null,
      dueAt: sourceSeedCard.reviewState?.dueAt ?? null,
      entryId: subjectContext.identity.entryId,
      entryType: subjectContext.identity.entryType,
      lapses: sourceSeedCard.reviewState?.lapses ?? 0,
      lastInteractionAt:
        sourceSeedCard.reviewState?.lastReviewedAt ??
        sourceSeedCard.updatedAt ??
        sourceSeedCard.createdAt,
      lastReviewedAt: sourceSeedCard.reviewState?.lastReviewedAt ?? null,
      learningSteps: sourceSeedCard.reviewState?.learningSteps ?? 0,
      manualOverride: sourceSeedCard.reviewState?.manualOverride ?? false,
      suspended: false,
      reps: sourceSeedCard.reviewState?.reps ?? 0,
      scheduledDays: sourceSeedCard.reviewState?.scheduledDays ?? 0,
      stability: sourceSeedCard.reviewState?.stability ?? null,
      state: (sourceSeedCard.reviewState?.state ?? "new") as ReviewState,
      subjectKey: subjectContext.identity.subjectKey,
      subjectType: subjectContext.identity.subjectKind,
      updatedAt: nowIso
    };
    const schedulerVersion =
      sourceSeedCard.reviewState?.schedulerVersion ?? "fsrs_v1";

    await tx
      .insert(reviewSubjectState)
      .values({
        cardId: sourceState.cardId,
        crossMediaGroupId: sourceState.crossMediaGroupId,
        createdAt: sourceState.createdAt,
        difficulty: sourceState.difficulty,
        dueAt: sourceState.dueAt,
        entryId: sourceState.entryId,
        entryType: sourceState.entryType,
        lastInteractionAt: nowIso,
        lastReviewedAt: sourceState.lastReviewedAt,
        learningSteps: sourceState.learningSteps,
        lapses: sourceState.lapses,
        manualOverride: sourceState.manualOverride,
        reps: sourceState.reps,
        scheduledDays: sourceState.scheduledDays,
        schedulerVersion,
        stability: sourceState.stability,
        state: sourceState.state,
        subjectKey: sourceState.subjectKey,
        subjectType: sourceState.subjectType,
        suspended: input.suspended,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: reviewSubjectState.subjectKey,
        set: {
          cardId: sourceState.cardId,
          crossMediaGroupId: sourceState.crossMediaGroupId,
          difficulty: sourceState.difficulty,
          dueAt: sourceState.dueAt,
          entryId: sourceState.entryId,
          entryType: sourceState.entryType,
          lastInteractionAt: nowIso,
          lastReviewedAt: sourceState.lastReviewedAt,
          learningSteps: sourceState.learningSteps,
          lapses: sourceState.lapses,
          manualOverride: sourceState.manualOverride,
          reps: sourceState.reps,
          scheduledDays: sourceState.scheduledDays,
          schedulerVersion,
          stability: sourceState.stability,
          state: sourceState.state,
          subjectType: sourceState.subjectType,
          suspended: input.suspended,
          updatedAt: nowIso
        }
      });

    return {
      cardId: loadedCard.id,
      mediaId: loadedCard.mediaId,
      suspended: input.suspended
    };
  });
}

export async function setLinkedEntryStatusByCard(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
  status: Exclude<ReviewEntryStatusValue, null>;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!isActiveReviewableMutationCard(loadedCard)) {
      throw new Error("Linked entry status cannot be changed for this card.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const subjectContext = await loadReviewSubjectMutationContext(
      tx,
      loadedCard,
      nowIso
    );

    if (subjectContext.drivingEntries.length === 0) {
      throw new Error("This card has no canonical entry to update.");
    }

    await tx
      .insert(entryStatus)
      .values(
        subjectContext.drivingEntries.map((entry) => ({
          id: `entry_status_${entry.entryType}_${entry.entryId}`,
          entryType: entry.entryType,
          entryId: entry.entryId,
          status: input.status,
          reason: `Updated from review card ${loadedCard.id}.`,
          setAt: nowIso
        }))
      )
      .onConflictDoUpdate({
        target: [entryStatus.entryType, entryStatus.entryId],
        set: {
          status: input.status,
          reason: `Updated from review card ${loadedCard.id}.`,
          setAt: nowIso
        }
      });

    return {
      cardId: loadedCard.id,
      entries: subjectContext.drivingEntries,
      mediaId: loadedCard.mediaId,
      status: input.status
    };
  });
}

async function loadReviewCardForMutation(
  transaction: DatabaseTransaction,
  cardId: string
) {
  const row = await transaction.query.card.findFirst({
    where: eq(card.id, cardId),
    with: {
      lesson: {
        with: {
          progress: true
        }
      },
      segment: true,
      entryLinks: true,
      reviewState: true
    }
  });

  if (!row) {
    return null;
  }

  const drivingEntryRefs = getDrivingEntryLinks(row.entryLinks);
  const drivingEntries = await loadEntryStatusRows(
    transaction,
    drivingEntryRefs
  );

  return {
    ...row,
    drivingEntries
  };
}

function isActiveReviewableMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(card && card.status === "active" && hasCompletedReviewLesson(card));
}

function isSuspensionMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card &&
      card.status !== "archived" &&
      hasCompletedReviewLesson(card)
  );
}

function isResettableMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card &&
      card.status !== "archived" &&
      hasCompletedReviewLesson(card)
  );
}

async function loadEntryStatusRows(
  transaction: DatabaseTransaction,
  entryLinks: LinkedEntryRef[]
) {
  const filters = buildEntryStatusFilters(entryLinks);
  const statusRows =
    filters.length > 0
      ? await transaction.query.entryStatus.findMany({
          where:
            filters.length === 1 ? filters[0]! : or(filters[0]!, filters[1]!)
        })
      : [];
  const statusMap = new Map(
    statusRows.map((statusRow) => [
      `${statusRow.entryType}:${statusRow.entryId}`,
      statusRow
    ])
  );

  return entryLinks.map(
    (
      entry
    ): LinkedEntryRef & { status: typeof entryStatus.$inferSelect | null } => ({
      entryId: entry.entryId,
      entryType: entry.entryType,
      status: statusMap.get(`${entry.entryType}:${entry.entryId}`) ?? null
    })
  );
}

function buildEntryStatusFilters(entryLinks: LinkedEntryRef[]) {
  if (entryLinks.length === 0) {
    return [];
  }

  const termEntryIds = entryLinks
    .filter((entry) => entry.entryType === "term")
    .map((entry) => entry.entryId);
  const grammarEntryIds = entryLinks
    .filter((entry) => entry.entryType === "grammar")
    .map((entry) => entry.entryId);
  const filters = [];

  if (termEntryIds.length > 0) {
    filters.push(
      and(
        eq(entryStatus.entryType, "term"),
        inArray(entryStatus.entryId, termEntryIds)
      )
    );
  }

  if (grammarEntryIds.length > 0) {
    filters.push(
      and(
        eq(entryStatus.entryType, "grammar"),
        inArray(entryStatus.entryId, grammarEntryIds)
      )
    );
  }

  return filters;
}

function assertCardBelongsToExpectedMedia(
  mediaId: string,
  expectedMediaId: string | undefined
) {
  if (expectedMediaId && mediaId !== expectedMediaId) {
    throw new Error("Review card does not belong to the requested media.");
  }
}

type LoadedReviewCard = ReviewMutationCard;

type ReviewSubjectScheduledState = {
  difficulty: number | null;
  dueAt: string;
  elapsedDays?: number | null;
  lapses: number;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  schedulerVersion: "fsrs_v1";
  stability: number | null;
  state: ReviewState;
};

type ReviewSubjectMutationContext = {
  drivingEntries: Array<
    LinkedEntryRef & { status: typeof entryStatus.$inferSelect | null }
  >;
  identity: ReviewSubjectIdentity;
  memberCards: ReviewSubjectMemberCard[];
  seedCard: ReviewSubjectMemberCard;
  subjectState: ReviewSubjectStateSnapshot | null;
};

async function loadReviewSubjectMutationContext(
  transaction: DatabaseTransaction,
  loadedCard: LoadedReviewCard,
  nowIso?: string
): Promise<ReviewSubjectMutationContext> {
  const txDb = transaction as unknown as DatabaseClient;
  const drivingLinks = getDrivingEntryLinks(loadedCard.entryLinks);
  const termEntryIds = [
    ...new Set(
      drivingLinks
        .filter((entryLink) => entryLink.entryType === "term")
        .map((entryLink) => entryLink.entryId)
    )
  ];
  const grammarEntryIds = [
    ...new Set(
      drivingLinks
        .filter((entryLink) => entryLink.entryType === "grammar")
        .map((entryLink) => entryLink.entryId)
    )
  ];
  const [terms, grammar] = await Promise.all([
    getTermEntriesByIds(txDb, termEntryIds),
    getGrammarEntriesByIds(txDb, grammarEntryIds)
  ]);
  const entryLookup = buildReviewSubjectEntryLookup({ grammar, terms });
  const identity = deriveReviewSubjectIdentity({
    cardId: loadedCard.id,
    cardType: loadedCard.cardType,
    front: loadedCard.front,
    entryLinks: loadedCard.entryLinks,
    entryLookup
  });
  const subjectState = await getReviewSubjectStateByKey(
    txDb,
    identity.subjectKey
  );
  const subjectEntryRefs = await resolveReviewSubjectEntryRefs(
    transaction,
    loadedCard,
    identity
  );
  const memberCardIds =
    identity.subjectKind === "card"
      ? [loadedCard.id]
      : await listReviewCardIdsByEntryRefs(txDb, subjectEntryRefs);
  const dedupedMemberCardIds = [...new Set([loadedCard.id, ...memberCardIds])];
  const memberEntryRefTerms = [
    ...new Set(
      subjectEntryRefs
        .filter((entry) => entry.entryType === "term")
        .map((entry) => entry.entryId)
    )
  ];
  const memberEntryRefGrammar = [
    ...new Set(
      subjectEntryRefs
        .filter((entry) => entry.entryType === "grammar")
        .map((entry) => entry.entryId)
    )
  ];
  const [memberTerms, memberGrammar, loadedMemberCards] = await Promise.all([
    getTermEntriesByIds(txDb, memberEntryRefTerms),
    getGrammarEntriesByIds(txDb, memberEntryRefGrammar),
    listReviewCardsByIds(txDb, dedupedMemberCardIds)
  ]);
  const memberEntryLookup = buildReviewSubjectEntryLookup({
    grammar: memberGrammar,
    terms: memberTerms
  });
  const memberCards = loadedMemberCards.filter(
    (cardRow) =>
      hasCompletedReviewLesson(cardRow) &&
      deriveReviewSubjectIdentity({
        cardId: cardRow.id,
        cardType: cardRow.cardType,
        front: cardRow.front,
        entryLinks: cardRow.entryLinks,
        entryLookup: memberEntryLookup
      }).subjectKey === identity.subjectKey
  );
  const effectiveMemberCards =
    memberCards.length > 0 ? memberCards : [loadedCard];
  const seedCard = selectReviewSubjectRepresentativeCard(
    effectiveMemberCards,
    subjectState ? (subjectState as ReviewSubjectStateSnapshot) : null,
    nowIso
  );
  const effectiveSeedCard =
    subjectState?.suspended && seedCard.status !== "suspended"
      ? { ...seedCard, status: "suspended" as const }
      : seedCard;
  const drivingEntryRefs = effectiveMemberCards.flatMap((cardRow) =>
    getDrivingEntryLinks(cardRow.entryLinks).map((entryLink) => ({
      entryId: entryLink.entryId,
      entryType: entryLink.entryType
    }))
  );
  const drivingEntries = await loadEntryStatusRows(
    transaction,
    drivingEntryRefs
  );

  return {
    drivingEntries,
    identity,
    memberCards: effectiveMemberCards,
    seedCard: effectiveSeedCard,
    subjectState: subjectState
      ? (subjectState as ReviewSubjectStateSnapshot)
      : null
  };
}

async function resolveReviewSubjectEntryRefs(
  transaction: DatabaseTransaction,
  loadedCard: LoadedReviewCard,
  identity: ReviewSubjectIdentity
) {
  const txDb = transaction as unknown as DatabaseClient;
  const drivingLinks = getDrivingEntryLinks(loadedCard.entryLinks);

  if (identity.subjectKind === "card") {
    return drivingLinks.map((entryLink) => ({
      entryId: entryLink.entryId,
      entryType: entryLink.entryType
    }));
  }

  const drivingLink = drivingLinks[0];

  if (!drivingLink) {
    return [];
  }

  if (identity.subjectKind === "entry") {
    return [
      {
        entryId: drivingLink.entryId,
        entryType: drivingLink.entryType
      }
    ];
  }

  if (drivingLink.entryType === "term") {
    const family = await getTermCrossMediaFamilyByEntryId(
      txDb,
      drivingLink.entryId
    );

    return dedupeLinkedEntryRefs([
      {
        entryId: drivingLink.entryId,
        entryType: drivingLink.entryType
      },
      ...family.siblings.map((sibling) => ({
        entryId: sibling.entryId,
        entryType: "term" as const
      }))
    ]);
  }

  const family = await getGrammarCrossMediaFamilyByEntryId(
    txDb,
    drivingLink.entryId
  );

  return dedupeLinkedEntryRefs([
    {
      entryId: drivingLink.entryId,
      entryType: drivingLink.entryType
    },
    ...family.siblings.map((sibling) => ({
      entryId: sibling.entryId,
      entryType: "grammar" as const
    }))
  ]);
}

function buildSubjectReviewStateForValidation(
  subjectState: ReviewSubjectStateSnapshot | null,
  seedCard: ReviewSubjectMemberCard
) {
  if (subjectState) {
    return {
      manualOverride: subjectState.manualOverride,
      state: subjectState.state as ReviewState | null
    };
  }

  if (!seedCard.reviewState) {
    return null;
  }

  return {
    manualOverride: seedCard.reviewState.manualOverride,
    state: seedCard.reviewState.state as ReviewState
  };
}

async function upsertReviewSubjectState(
  transaction: DatabaseTransaction,
  input: {
    createdAt: string;
    lastReviewedAt: string | null;
    currentCardId: string;
    identity: ReviewSubjectIdentity;
    nowIso: string;
    scheduled: ReviewSubjectScheduledState;
    updatedAt: string;
  }
) {
  const values = {
    cardId: input.currentCardId,
    crossMediaGroupId: input.identity.crossMediaGroupId,
    createdAt: input.createdAt,
    difficulty: input.scheduled.difficulty,
    dueAt: input.scheduled.dueAt,
    entryId: input.identity.entryId,
    entryType: input.identity.entryType,
    lastInteractionAt: input.nowIso,
    lastReviewedAt: input.lastReviewedAt,
    learningSteps: input.scheduled.learningSteps,
    lapses: input.scheduled.lapses,
    manualOverride: false,
    reps: input.scheduled.reps,
    scheduledDays: input.scheduled.scheduledDays,
    schedulerVersion: input.scheduled.schedulerVersion,
    suspended: false,
    stability: input.scheduled.stability,
    state: input.scheduled.state,
    subjectKey: input.identity.subjectKey,
    subjectType: input.identity.subjectKind,
    updatedAt: input.updatedAt
  };

  await transaction
    .insert(reviewSubjectState)
    .values(values)
    .onConflictDoUpdate({
      target: reviewSubjectState.subjectKey,
      set: {
        cardId: input.currentCardId,
        crossMediaGroupId: input.identity.crossMediaGroupId,
        difficulty: input.scheduled.difficulty,
        dueAt: input.scheduled.dueAt,
        entryId: input.identity.entryId,
        entryType: input.identity.entryType,
        lastInteractionAt: input.nowIso,
        lastReviewedAt: input.lastReviewedAt,
        learningSteps: input.scheduled.learningSteps,
        lapses: input.scheduled.lapses,
        manualOverride: false,
        reps: input.scheduled.reps,
        scheduledDays: input.scheduled.scheduledDays,
        schedulerVersion: input.scheduled.schedulerVersion,
        suspended: false,
        stability: input.scheduled.stability,
        state: input.scheduled.state,
        subjectType: input.identity.subjectKind,
        updatedAt: input.updatedAt
      }
    });
}

async function mirrorLegacyReviewStateToCards(
  transaction: DatabaseTransaction,
  cards: ReviewSubjectMemberCard[],
  input: {
    createdAt: string;
    lastReviewedAt: string | null;
    nowIso: string;
    scheduled: ReviewSubjectScheduledState;
  }
) {
  await transaction
    .insert(reviewState)
    .values(
      cards.map((legacyCard) => ({
        cardId: legacyCard.id,
        state: input.scheduled.state,
        stability: input.scheduled.stability,
        difficulty: input.scheduled.difficulty,
        dueAt: input.scheduled.dueAt,
        lastReviewedAt: input.lastReviewedAt,
        scheduledDays: input.scheduled.scheduledDays,
        learningSteps: input.scheduled.learningSteps,
        lapses: input.scheduled.lapses,
        reps: input.scheduled.reps,
        schedulerVersion: input.scheduled.schedulerVersion,
        manualOverride: false,
        createdAt: legacyCard.reviewState?.createdAt ?? input.createdAt,
        updatedAt: input.nowIso
      }))
    )
    .onConflictDoUpdate({
      target: reviewState.cardId,
      set: {
        state: input.scheduled.state,
        stability: input.scheduled.stability,
        difficulty: input.scheduled.difficulty,
        dueAt: input.scheduled.dueAt,
        lastReviewedAt: input.lastReviewedAt,
        scheduledDays: input.scheduled.scheduledDays,
        learningSteps: input.scheduled.learningSteps,
        lapses: input.scheduled.lapses,
        reps: input.scheduled.reps,
        schedulerVersion: input.scheduled.schedulerVersion,
        manualOverride: false,
        updatedAt: input.nowIso
      }
    });
}

function dedupeLinkedEntryRefs(entryRefs: LinkedEntryRef[]) {
  const seen = new Set<string>();
  const deduped: LinkedEntryRef[] = [];

  for (const entry of entryRefs) {
    const key = `${entry.entryType}:${entry.entryId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}
