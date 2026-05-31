import { and, eq } from "drizzle-orm";

import { type DatabaseClient, type DatabaseQueryClient } from "@/db";
import {
  getCrossMediaFamilyByEntryId,
  getGlossaryEntriesByIds,
  getReviewSubjectStateByKey,
  listReviewCardIdsByEntryRefs,
  listReviewCardsByIds,
  type ReviewCardListItem
} from "@/db/queries";
import { card, reviewSubjectState, type EntryType } from "@/db/schema";
import {
  getDrivingEntryLinks,
  hasCompletedReviewLesson
} from "@/features/review/model/state";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectIdentity,
  type ReviewSubjectStateSnapshot
} from "@/features/review/model/subject";
import type { ReviewState } from "@/features/review/model/scheduler";
import { buildEntryKey } from "@/features/study/model/entry-id";

export type ReviewMutationTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

export type LinkedEntryRef = {
  entryId: string;
  entryType: EntryType;
};

export type ReviewMutationCard = Pick<
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

export type ReviewSubjectMemberCard = Awaited<
  ReturnType<typeof listReviewCardsByIds>
>[number];

export type LoadedReviewCard = ReviewMutationCard;

export type ReviewSubjectMutationContext = {
  drivingEntries: LinkedEntryRef[];
  identity: ReviewSubjectIdentity;
  memberCards: ReviewSubjectMemberCard[];
  seedCard: ReviewSubjectMemberCard;
  subjectState: ReviewSubjectStateSnapshot | null;
};

export type ReviewSubjectStateInsert = typeof reviewSubjectState.$inferInsert;
export type ReviewSubjectStatePatch = Partial<
  Omit<ReviewSubjectStateInsert, "createdAt" | "subjectKey">
>;
export type ReviewFreshnessExpectation = string | null | undefined;

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

export async function loadReviewCardForMutation(
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

export function isActiveReviewableMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card && card.status === "active" && hasCompletedReviewLesson(card)
  );
}

export function isSuspensionMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card && card.status !== "archived" && hasCompletedReviewLesson(card)
  );
}

export function isResettableMutationCard(
  card: ReviewMutationCard | null
): card is ReviewMutationCard {
  return Boolean(
    card && card.status !== "archived" && hasCompletedReviewLesson(card)
  );
}

export function assertCardBelongsToExpectedMedia(
  mediaId: string,
  expectedMediaId: string | undefined
) {
  if (expectedMediaId && mediaId !== expectedMediaId) {
    throw new Error("Review card does not belong to the requested media.");
  }
}

export async function loadReviewSubjectMutationContext(
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

export function resolveSubjectReviewStateForValidation(
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

export function resolveReviewSubjectStateSource(
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

export function patchReviewSubjectState(
  sourceState: ReviewSubjectStateInsert,
  patch: ReviewSubjectStatePatch
): ReviewSubjectStateInsert {
  return {
    ...sourceState,
    ...patch
  };
}

export async function upsertReviewSubjectState(
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

export async function writeReviewSubjectStateForGrade(
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

export function normalizeReviewFreshnessExpectation(
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
