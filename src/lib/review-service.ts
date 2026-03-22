import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import {
  card,
  db,
  getCrossMediaFamilyByEntryId,
  getGlossaryEntriesByIds,
  getReviewSubjectStateByKey,
  listReviewCardIdsByEntryRefs,
  listReviewCardsByIds,
  reviewSubjectLog,
  reviewSubjectState,
  type DatabaseClient,
  type EntryType,
  type ReviewCardListItem
} from "@/db";

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
  scheduleReview,
  type ReviewRating,
  type ReviewState
} from "./review-scheduler";
import { buildEntryKey } from "./entry-id";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

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

type ReviewMutationCard = ReviewCardListItem & {
  drivingEntries: LinkedEntryRef[];
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
      subjectContext.subjectState
    );

    const effectiveState = resolveEffectiveReviewState({
      cardStatus: subjectContext.seedCard.status,
      reviewState: subjectReviewState
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
    const previousState = (subjectReviewState?.state ?? "new") as ReviewState;
    const scheduled = scheduleReview({
      current: seedState.current,
      now,
      rating: input.rating
    });

    await upsertReviewSubjectState(tx, {
      cardId: loadedCard.id,
      createdAt:
        subjectContext.subjectState?.createdAt ??
        subjectContext.seedCard.createdAt,
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
      subjectKey: subjectContext.identity.subjectKey,
      subjectType: subjectContext.identity.subjectKind,
      suspended: false,
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
      cardId: loadedCard.id,
      createdAt:
        subjectContext.subjectState?.createdAt ??
        subjectContext.seedCard.createdAt,
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
      subjectKey: subjectContext.identity.subjectKey,
      subjectType: subjectContext.identity.subjectKind,
      suspended: false,
      updatedAt: nowIso
    });

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
      createdAt: sourceSeedCard.createdAt,
      difficulty: null,
      dueAt: null,
      entryId: subjectContext.identity.entryId,
      entryType: subjectContext.identity.entryType,
      lapses: 0,
      lastInteractionAt: sourceSeedCard.updatedAt ?? sourceSeedCard.createdAt,
      lastReviewedAt: null,
      learningSteps: 0,
      manualOverride: false,
      suspended: false,
      reps: 0,
      scheduledDays: 0,
      stability: null,
      state: "new" as ReviewState,
      subjectKey: subjectContext.identity.subjectKey,
      subjectType: subjectContext.identity.subjectKind,
      updatedAt: nowIso
    };
    const schedulerVersion = "fsrs_v1";

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
    const sourceSeedCard = subjectContext.seedCard;
    const sourceState = subjectContext.subjectState ?? {
      cardId: sourceSeedCard.id,
      crossMediaGroupId: subjectContext.identity.crossMediaGroupId,
      createdAt: sourceSeedCard.createdAt,
      difficulty: null,
      dueAt: null,
      entryId: subjectContext.identity.entryId,
      entryType: subjectContext.identity.entryType,
      lapses: 0,
      lastInteractionAt: sourceSeedCard.updatedAt ?? sourceSeedCard.createdAt,
      lastReviewedAt: null,
      learningSteps: 0,
      manualOverride: false,
      suspended: false,
      reps: 0,
      scheduledDays: 0,
      stability: null,
      state: (input.status === "learning" ? "learning" : "new") as ReviewState,
      subjectKey: subjectContext.identity.subjectKey,
      subjectType: subjectContext.identity.subjectKind,
      updatedAt: nowIso
    };
    await upsertReviewSubjectState(tx, {
      cardId: sourceState.cardId,
      createdAt: sourceState.createdAt,
      crossMediaGroupId: sourceState.crossMediaGroupId,
      difficulty: sourceState.difficulty,
      dueAt: sourceState.dueAt,
      entryId: sourceState.entryId,
      entryType: sourceState.entryType,
      lapses: sourceState.lapses,
      lastInteractionAt: nowIso,
      lastReviewedAt: sourceState.lastReviewedAt,
      learningSteps: sourceState.learningSteps,
      manualOverride: isManualOverride,
      reps: sourceState.reps,
      scheduledDays: sourceState.scheduledDays,
      schedulerVersion: "fsrs_v1",
      stability: sourceState.stability,
      state: sourceState.state,
      subjectKey: sourceState.subjectKey,
      subjectType: sourceState.subjectType,
      suspended: isSuspended,
      updatedAt: nowIso
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
      entryLinks: true
    }
  });

  if (!row) {
    return null;
  }

  const drivingEntryRefs = getDrivingEntryLinks(row.entryLinks);
  const drivingEntries = drivingEntryRefs.map((entry) => ({
    entryId: entry.entryId,
    entryType: entry.entryType
  }));

  return {
    ...row,
    drivingEntries
  };
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
  transaction: DatabaseTransaction,
  loadedCard: LoadedReviewCard,
  nowIso?: string
): Promise<ReviewSubjectMutationContext> {
  const txDb = transaction as unknown as DatabaseClient;
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
  const { termIds: memberEntryRefTerms, grammarIds: memberEntryRefGrammar } =
    splitLinkIds(subjectEntryRefs);
  const [memberTerms, memberGrammar, loadedMemberCards] = await Promise.all([
    getGlossaryEntriesByIds(txDb, "term", memberEntryRefTerms),
    getGlossaryEntriesByIds(txDb, "grammar", memberEntryRefGrammar),
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

function buildSubjectReviewStateForValidation(
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

async function upsertReviewSubjectState(
  transaction: DatabaseTransaction,
  state: typeof reviewSubjectState.$inferInsert
) {
  await transaction
    .insert(reviewSubjectState)
    .values(state)
    .onConflictDoUpdate({
      target: reviewSubjectState.subjectKey,
      set: {
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
      }
    });
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
