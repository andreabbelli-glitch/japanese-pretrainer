import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import {
  getCrossMediaFamilyByEntryId,
  getGlossaryEntriesByIds,
  getReviewSubjectStateByKey,
  listReviewCardIdsByEntryRefs,
  listReviewCardsByIds,
  type ReviewCardListItem
} from "@/db/queries";
import {
  card,
  preReviewConsolidationState,
  reviewSubjectLog,
  reviewSubjectState,
  type EntryType
} from "@/db/schema";
import { resolveReviewForcedContrast } from "@/features/kanji-clash/server/manual-contrast-review";

import {
  getDrivingEntryLinks,
  hasCompletedReviewLesson,
  resolveEffectiveReviewState
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
  getFsrsOptimizerSnapshot,
  resolveFsrsPresetKey
} from "./fsrs-optimizer";
import {
  scheduleReview,
  type ReviewRating,
  type ReviewState
} from "./review-scheduler";
import type {
  ReviewForcedContrastPayload,
  ReviewForcedContrastResolution,
  ReviewScope
} from "./review-types";
import { buildEntryKey } from "./entry-id";
import { enqueueReviewMistakeConsolidation } from "./consolidation";

export type ReviewMutationTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

const REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE = "Review card is out of date.";

function splitLinkIds(links: Array<{ entryType: string; entryId: string }>) {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const link of links) {
    if (link.entryType === "term") {
      termIds.add(link.entryId);
    } else {
      grammarIds.add(link.entryId);
    }
  }

  return { grammarIds: [...grammarIds], termIds: [...termIds] };
}

type LinkedEntryRef = {
  entryId: string;
  entryType: EntryType;
};

type ReviewMutationCard = Pick<
  ReviewCardListItem,
  | "cardType"
  | "createdAt"
  | "entryLinks"
  | "front"
  | "id"
  | "lesson"
  | "lessonId"
  | "mediaId"
  | "status"
  | "updatedAt"
>;

type ReviewSubjectMemberCard = Awaited<
  ReturnType<typeof listReviewCardsByIds>
>[number];

export type ReviewGradeResult = {
  cardId: string;
  consolidationQueued: boolean;
  dueAt: string;
  forcedContrast?: ReviewForcedContrastResolution;
  mediaId: string;
  newState: ReviewState;
  previousState: ReviewState;
};

export async function applyReviewGrade(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  expectedUpdatedAt?: string | null;
  forcedContrast?: ReviewForcedContrastPayload;
  forcedContrastMediaSlug?: string;
  forcedContrastScope?: ReviewScope;
  now?: Date;
  rating: ReviewRating;
  responseMs?: number | null;
}): Promise<ReviewGradeResult> {
  const database = input.database ?? db;

  return database.transaction((transaction) =>
    gradeReviewCardInTransaction({
      ...input,
      transaction
    })
  );
}

export async function gradeReviewCardInTransaction(input: {
  cardId: string;
  expectedMediaId?: string;
  expectedUpdatedAt?: string | null;
  forcedContrast?: ReviewForcedContrastPayload;
  forcedContrastMediaSlug?: string;
  forcedContrastScope?: ReviewScope;
  now?: Date;
  rating: ReviewRating;
  responseMs?: number | null;
  transaction: ReviewMutationTransaction;
}): Promise<ReviewGradeResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const loadedCard = await loadReviewCardForMutation(
    input.transaction,
    input.cardId
  );

  if (!isActiveReviewableMutationCard(loadedCard)) {
    throw new Error("Review card not available for grading.");
  }

  assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

  const fsrsOptimizerSnapshotPromise = getFsrsOptimizerSnapshot(
    input.transaction
  );
  const subjectContextPromise = loadReviewSubjectMutationContext(
    input.transaction,
    loadedCard,
    nowIso
  );
  const [subjectContext, fsrsOptimizerSnapshot] = await Promise.all([
    subjectContextPromise,
    fsrsOptimizerSnapshotPromise
  ]);
  const expectedUpdatedAt = normalizeReviewFreshnessExpectation(
    input.expectedUpdatedAt
  );
  const currentUpdatedAt = subjectContext.subjectState?.updatedAt ?? null;

  if (
    expectedUpdatedAt !== undefined &&
    expectedUpdatedAt !== currentUpdatedAt
  ) {
    throw new Error(REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE);
  }

  const resolvedSubjectState = resolveSubjectReviewStateForValidation(
    subjectContext.subjectState
  );

  await assertSubjectNotPendingConsolidation(
    input.transaction,
    subjectContext.identity.subjectKey
  );

  const effectiveState = resolveEffectiveReviewState({
    cardStatus: subjectContext.seedCard.status,
    reviewState: resolvedSubjectState
  });

  if (effectiveState.state === "known_manual") {
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
  const presetKey = resolveFsrsPresetKey(loadedCard.cardType);
  const optimizedParameters = presetKey
    ? fsrsOptimizerSnapshot.presets[presetKey]
    : null;
  const previousState = (resolvedSubjectState?.state ?? "new") as ReviewState;
  const scheduled = scheduleReview({
    current: seedState.current,
    now,
    rating: input.rating,
    scheduler: {
      desiredRetention: fsrsOptimizerSnapshot.config.desiredRetention,
      weights: optimizedParameters?.weights ?? undefined
    }
  });
  const sourceState = resolveReviewSubjectStateSource(subjectContext, nowIso);

  const didWriteSubjectState = await writeReviewSubjectStateForGrade(
    input.transaction,
    patchReviewSubjectState(sourceState, {
      cardId: loadedCard.id,
      crossMediaGroupId: subjectContext.identity.crossMediaGroupId,
      difficulty: scheduled.difficulty,
      dueAt: scheduled.dueAt,
      entryId: subjectContext.identity.entryId,
      entryType: subjectContext.identity.entryType,
      lapses: scheduled.lapses,
      lastInteractionAt: nowIso,
      lastReviewedAt: nowIso,
      learningSteps: scheduled.learningSteps,
      manualOverride: false,
      reps: scheduled.reps,
      scheduledDays: scheduled.scheduledDays,
      schedulerVersion: scheduled.schedulerVersion,
      stability: scheduled.stability,
      state: scheduled.state,
      subjectType: subjectContext.identity.subjectKind,
      suspended: false,
      updatedAt: nowIso
    }),
    expectedUpdatedAt
  );

  if (!didWriteSubjectState) {
    throw new Error(REVIEW_CARD_OUT_OF_DATE_ERROR_MESSAGE);
  }

  const reviewLogId = `review_subject_log_${randomUUID()}`;

  await input.transaction.insert(reviewSubjectLog).values({
    id: reviewLogId,
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

  const consolidationResult = await enqueueReviewMistakeConsolidation({
    database: input.transaction,
    identity: subjectContext.identity,
    lessonId: loadedCard.lessonId!,
    mediaId: loadedCard.mediaId,
    now,
    rating: input.rating,
    representativeCardId: loadedCard.id
  });

  const forcedContrast = input.forcedContrast
    ? await resolveReviewForcedContrast({
        identity: subjectContext.identity,
        mediaId: loadedCard.mediaId,
        mediaSlug: input.forcedContrastMediaSlug,
        nowIso,
        payload: input.forcedContrast,
        scope: input.forcedContrastScope ?? "global",
        transaction: input.transaction
      })
    : undefined;

  return {
    cardId: loadedCard.id,
    consolidationQueued: consolidationResult.queued,
    dueAt: scheduled.dueAt,
    forcedContrast,
    mediaId: loadedCard.mediaId,
    newState: scheduled.state,
    previousState
  };
}

async function assertSubjectNotPendingConsolidation(
  transaction: ReviewMutationTransaction,
  subjectKey: string
) {
  const row = await transaction.query.preReviewConsolidationState.findFirst({
    columns: {
      subjectKey: true
    },
    where: and(
      eq(preReviewConsolidationState.subjectKey, subjectKey),
      eq(preReviewConsolidationState.status, "pending")
    )
  });

  if (row) {
    throw new Error("Review card is pending consolidation.");
  }
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

    const sourceState = resolveReviewSubjectStateSource(subjectContext, nowIso);

    await upsertReviewSubjectState(
      tx,
      patchReviewSubjectState(sourceState, {
        cardId: loadedCard.id,
        crossMediaGroupId: subjectContext.identity.crossMediaGroupId,
        difficulty: null,
        dueAt: nowIso,
        entryId: subjectContext.identity.entryId,
        entryType: subjectContext.identity.entryType,
        lapses: 0,
        lastInteractionAt: nowIso,
        lastReviewedAt: null,
        learningSteps: 0,
        manualOverride: false,
        reps: 0,
        scheduledDays: 0,
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "new",
        subjectType: subjectContext.identity.subjectKind,
        suspended: false,
        updatedAt: nowIso
      })
    );

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

    const sourceState = resolveReviewSubjectStateSource(subjectContext, nowIso);

    await upsertReviewSubjectState(
      tx,
      patchReviewSubjectState(sourceState, {
        lastInteractionAt: nowIso,
        schedulerVersion: "fsrs_v1",
        suspended: input.suspended,
        updatedAt: nowIso
      })
    );

    return {
      cardId: loadedCard.id,
      mediaId: loadedCard.mediaId,
      suspended: input.suspended
    };
  });
}

type ReviewEntryMutationStatus = "known_manual" | "learning" | "ignored";

export async function setLinkedEntryStatusByCard(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
  status: ReviewEntryMutationStatus;
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

    const isManualOverride = input.status === "known_manual";
    const isSuspended = input.status === "ignored";
    const sourceState = resolveReviewSubjectStateSource(
      subjectContext,
      nowIso,
      {
        initialState: input.status === "learning" ? "learning" : "new"
      }
    );
    const restoredState =
      input.status === "learning" && sourceState.state === "known_manual"
        ? "learning"
        : sourceState.state;

    await upsertReviewSubjectState(
      tx,
      patchReviewSubjectState(sourceState, {
        lastInteractionAt: nowIso,
        manualOverride: isManualOverride,
        schedulerVersion: "fsrs_v1",
        state: restoredState,
        suspended: isSuspended,
        updatedAt: nowIso
      })
    );

    return {
      cardId: loadedCard.id,
      entries: subjectContext.drivingEntries,
      mediaId: loadedCard.mediaId,
      status: input.status
    };
  });
}

async function loadReviewCardForMutation(
  transaction: ReviewMutationTransaction,
  cardId: string
) {
  const row = await transaction.query.card.findFirst({
    columns: {
      cardType: true,
      createdAt: true,
      front: true,
      id: true,
      lessonId: true,
      mediaId: true,
      status: true,
      updatedAt: true
    },
    where: eq(card.id, cardId),
    with: {
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
      },
      entryLinks: {
        columns: {
          entryId: true,
          entryType: true,
          relationshipType: true
        }
      }
    }
  });

  return row ?? null;
}

function isActiveReviewableMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card && card.status === "active" && hasCompletedReviewLesson(card)
  );
}

function isSuspensionMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card && card.status !== "archived" && hasCompletedReviewLesson(card)
  );
}

function isResettableMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card && card.status !== "archived" && hasCompletedReviewLesson(card)
  );
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

type ReviewSubjectMutationContext = {
  drivingEntries: LinkedEntryRef[];
  identity: ReviewSubjectIdentity;
  memberCards: ReviewSubjectMemberCard[];
  seedCard: ReviewSubjectMemberCard;
  subjectState: ReviewSubjectStateSnapshot | null;
};

async function loadReviewSubjectMutationContext(
  transaction: ReviewMutationTransaction,
  loadedCard: LoadedReviewCard,
  nowIso?: string
): Promise<ReviewSubjectMutationContext> {
  const txDb: DatabaseQueryClient = transaction;
  const drivingLinks = getDrivingEntryLinks(loadedCard.entryLinks);
  const { termIds: termEntryIds, grammarIds: grammarEntryIds } =
    splitLinkIds(drivingLinks);
  const [terms, grammar] = await Promise.all([
    getGlossaryEntriesByIds(txDb, "term", termEntryIds),
    getGlossaryEntriesByIds(txDb, "grammar", grammarEntryIds)
  ]);
  const entryLookup = buildReviewSubjectEntryLookup({ grammar, terms });
  const identity = deriveReviewSubjectIdentity({
    cardId: loadedCard.id,
    cardType: loadedCard.cardType,
    front: loadedCard.front,
    entryLinks: loadedCard.entryLinks,
    entryLookup
  });
  const subjectStatePromise = getReviewSubjectStateByKey(
    txDb,
    identity.subjectKey
  );
  const subjectEntryRefsPromise = resolveReviewSubjectEntryRefs(
    transaction,
    loadedCard,
    identity
  );
  const memberCardIdsPromise =
    identity.subjectKind === "card"
      ? Promise.resolve([loadedCard.id])
      : subjectEntryRefsPromise.then((subjectEntryRefs) =>
          listReviewCardIdsByEntryRefs(txDb, subjectEntryRefs)
        );
  const [subjectState, subjectEntryRefs, memberCardIds] = await Promise.all([
    subjectStatePromise,
    subjectEntryRefsPromise,
    memberCardIdsPromise
  ]);
  const dedupedMemberCardIds = [...new Set([loadedCard.id, ...memberCardIds])];
  const { termIds: memberEntryRefTerms, grammarIds: memberEntryRefGrammar } =
    splitLinkIds(subjectEntryRefs);
  const termIdsAlreadyLoaded = new Set(termEntryIds);
  const grammarIdsAlreadyLoaded = new Set(grammarEntryIds);
  const extraTermIds = memberEntryRefTerms.filter(
    (id) => !termIdsAlreadyLoaded.has(id)
  );
  const extraGrammarIds = memberEntryRefGrammar.filter(
    (id) => !grammarIdsAlreadyLoaded.has(id)
  );
  const [extraTerms, extraGrammar, loadedMemberCards] = await Promise.all([
    extraTermIds.length > 0
      ? getGlossaryEntriesByIds(txDb, "term", extraTermIds)
      : Promise.resolve([]),
    extraGrammarIds.length > 0
      ? getGlossaryEntriesByIds(txDb, "grammar", extraGrammarIds)
      : Promise.resolve([]),
    listReviewCardsByIds(txDb, dedupedMemberCardIds)
  ]);
  const memberEntryLookup = buildReviewSubjectEntryLookup({
    grammar: [...grammar, ...extraGrammar],
    terms: [...terms, ...extraTerms]
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
  const fallbackMemberCard =
    loadedMemberCards.find((cardRow) => cardRow.id === loadedCard.id) ??
    loadedMemberCards[0] ??
    null;
  const effectiveMemberCards =
    memberCards.length > 0
      ? memberCards
      : fallbackMemberCard
        ? [fallbackMemberCard]
        : [];
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

  return {
    drivingEntries: drivingEntryRefs,
    identity,
    memberCards: effectiveMemberCards,
    seedCard: effectiveSeedCard,
    subjectState: subjectState
      ? (subjectState as ReviewSubjectStateSnapshot)
      : null
  };
}

async function resolveReviewSubjectEntryRefs(
  transaction: ReviewMutationTransaction,
  loadedCard: LoadedReviewCard,
  identity: ReviewSubjectIdentity
) {
  const txDb: DatabaseQueryClient = transaction;
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
    const family = await getCrossMediaFamilyByEntryId(
      txDb,
      "term",
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

  const family = await getCrossMediaFamilyByEntryId(
    txDb,
    "grammar",
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

function resolveSubjectReviewStateForValidation(
  subjectState: ReviewSubjectStateSnapshot | null
) {
  if (subjectState) {
    return {
      manualOverride: subjectState.manualOverride,
      suspended: subjectState.suspended,
      state: subjectState.state as ReviewState | null
    };
  }

  return null;
}

type ReviewSubjectStateInsert = typeof reviewSubjectState.$inferInsert;
type ReviewSubjectStatePatch = Partial<
  Omit<ReviewSubjectStateInsert, "createdAt" | "subjectKey">
>;
type ReviewFreshnessExpectation = string | null | undefined;

function resolveReviewSubjectStateSource(
  context: ReviewSubjectMutationContext,
  nowIso: string,
  options: { initialState?: ReviewState } = {}
): ReviewSubjectStateInsert {
  if (context.subjectState) {
    return normalizeReviewSubjectStateSource(context.subjectState);
  }

  return buildInitialReviewSubjectStateSource({
    context,
    nowIso,
    state: options.initialState ?? "new"
  });
}

function normalizeReviewSubjectStateSource(
  subjectState: ReviewSubjectStateSnapshot
): ReviewSubjectStateInsert {
  return {
    cardId: subjectState.cardId,
    createdAt: subjectState.createdAt,
    crossMediaGroupId: subjectState.crossMediaGroupId,
    difficulty: subjectState.difficulty,
    dueAt: subjectState.dueAt,
    entryId: subjectState.entryId,
    entryType: subjectState.entryType,
    lapses: subjectState.lapses,
    lastInteractionAt: subjectState.lastInteractionAt,
    lastReviewedAt: subjectState.lastReviewedAt,
    learningSteps: subjectState.learningSteps,
    manualOverride: subjectState.manualOverride,
    reps: subjectState.reps,
    scheduledDays: subjectState.scheduledDays,
    schedulerVersion: subjectState.schedulerVersion,
    stability: subjectState.stability,
    state: subjectState.state,
    subjectKey: subjectState.subjectKey,
    subjectType: subjectState.subjectType,
    suspended: subjectState.suspended,
    updatedAt: subjectState.updatedAt
  };
}

function buildInitialReviewSubjectStateSource(input: {
  context: ReviewSubjectMutationContext;
  nowIso: string;
  state: ReviewState;
}): ReviewSubjectStateInsert {
  const { context, nowIso, state } = input;
  const sourceSeedCard = context.seedCard;

  return {
    cardId: sourceSeedCard.id,
    createdAt: sourceSeedCard.createdAt,
    crossMediaGroupId: context.identity.crossMediaGroupId,
    difficulty: null,
    dueAt: null,
    entryId: context.identity.entryId,
    entryType: context.identity.entryType,
    lapses: 0,
    lastInteractionAt: sourceSeedCard.updatedAt ?? sourceSeedCard.createdAt,
    lastReviewedAt: null,
    learningSteps: 0,
    manualOverride: false,
    reps: 0,
    scheduledDays: 0,
    schedulerVersion: "fsrs_v1",
    stability: null,
    state,
    subjectKey: context.identity.subjectKey,
    subjectType: context.identity.subjectKind,
    suspended: false,
    updatedAt: nowIso
  };
}

function patchReviewSubjectState(
  sourceState: ReviewSubjectStateInsert,
  patch: ReviewSubjectStatePatch
): ReviewSubjectStateInsert {
  return {
    ...sourceState,
    ...patch
  };
}

async function upsertReviewSubjectState(
  transaction: ReviewMutationTransaction,
  state: ReviewSubjectStateInsert
) {
  await transaction
    .insert(reviewSubjectState)
    .values(state)
    .onConflictDoUpdate({
      target: reviewSubjectState.subjectKey,
      set: getReviewSubjectStateMutationSet(state)
    });
}

async function writeReviewSubjectStateForGrade(
  transaction: ReviewMutationTransaction,
  state: ReviewSubjectStateInsert,
  expectedUpdatedAt: ReviewFreshnessExpectation
) {
  if (expectedUpdatedAt === undefined) {
    await upsertReviewSubjectState(transaction, state);
    return true;
  }

  if (expectedUpdatedAt === null) {
    return insertReviewSubjectStateIfAbsent(transaction, state);
  }

  return updateReviewSubjectStateIfCurrent(
    transaction,
    state,
    expectedUpdatedAt
  );
}

async function insertReviewSubjectStateIfAbsent(
  transaction: ReviewMutationTransaction,
  state: ReviewSubjectStateInsert
) {
  const [insertedRow] = await transaction
    .insert(reviewSubjectState)
    .values(state)
    .onConflictDoNothing({
      target: reviewSubjectState.subjectKey
    })
    .returning({
      subjectKey: reviewSubjectState.subjectKey
    });

  return Boolean(insertedRow);
}

async function updateReviewSubjectStateIfCurrent(
  transaction: ReviewMutationTransaction,
  state: ReviewSubjectStateInsert,
  expectedUpdatedAt: string
) {
  const [updatedRow] = await transaction
    .update(reviewSubjectState)
    .set(getReviewSubjectStateMutationSet(state))
    .where(
      and(
        eq(reviewSubjectState.subjectKey, state.subjectKey),
        eq(reviewSubjectState.updatedAt, expectedUpdatedAt)
      )
    )
    .returning({
      subjectKey: reviewSubjectState.subjectKey
    });

  return Boolean(updatedRow);
}

function getReviewSubjectStateMutationSet(state: ReviewSubjectStateInsert) {
  return {
    cardId: state.cardId,
    crossMediaGroupId: state.crossMediaGroupId,
    difficulty: state.difficulty,
    dueAt: state.dueAt,
    entryId: state.entryId,
    entryType: state.entryType,
    lastInteractionAt: state.lastInteractionAt,
    lastReviewedAt: state.lastReviewedAt,
    learningSteps: state.learningSteps,
    lapses: state.lapses,
    manualOverride: state.manualOverride,
    reps: state.reps,
    scheduledDays: state.scheduledDays,
    schedulerVersion: state.schedulerVersion,
    suspended: state.suspended,
    stability: state.stability,
    state: state.state,
    subjectType: state.subjectType,
    updatedAt: state.updatedAt
  };
}

function dedupeLinkedEntryRefs(entryRefs: LinkedEntryRef[]) {
  const seen = new Set<string>();
  const deduped: LinkedEntryRef[] = [];

  for (const entry of entryRefs) {
    const key = buildEntryKey(entry.entryType, entry.entryId);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function normalizeReviewFreshnessExpectation(
  value?: string | null
): ReviewFreshnessExpectation {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized ? normalized : null;
}
