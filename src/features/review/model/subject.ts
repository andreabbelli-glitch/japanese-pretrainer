import type { EntryType } from "../../../domain/content";

import type { ReviewCardSource } from "./card-contract.ts";
import { buildEntryKey } from "../../../features/study/model/entry-id.ts";
import { stripInlineMarkdown } from "../../study/model/inline-markdown.ts";
import {
  buildReviewMemoryKey,
  resolveReviewRecallTask,
  type ReviewRecallTask
} from "./recall-task.ts";

import {
  getDrivingEntryLinks,
  resolveEffectiveReviewState,
  type ReviewEntryLinkLike
} from "./state.ts";
import type { ReviewSchedulerVersion, ReviewState } from "./scheduler.ts";

export type ReviewSubjectKind = "group" | "entry" | "card";

export type ReviewSubjectEntryMeta = {
  crossMediaGroupId: string | null;
  entryId: string;
  entryType: EntryType;
  label: string;
  reading?: string | null;
};

export type ReviewSubjectIdentity = {
  cardId: string;
  canonicalSubjectKey: string;
  crossMediaGroupId: string | null;
  entryId: string | null;
  entryType: EntryType | null;
  memoryKey: string;
  recallTask: ReviewRecallTask;
  subjectKey: string;
  subjectKind: ReviewSubjectKind;
};

export type ReviewSubjectStateSnapshot = {
  cardId: string | null;
  canonicalSubjectKey?: string | null;
  crossMediaGroupId: string | null;
  createdAt: string;
  dueAt: string | null;
  entryId: string | null;
  entryType: EntryType | null;
  difficulty: number | null;
  lapses: number;
  learningSteps: number;
  lastInteractionAt: string;
  lastReviewedAt: string | null;
  manualOverride: boolean;
  reps: number;
  recallTask?: ReviewRecallTask | null;
  scheduledDays: number;
  schedulerVersion: ReviewSchedulerVersion;
  stability: number | null;
  state: ReviewState;
  subjectKey: string;
  subjectType: ReviewSubjectKind;
  suspended: boolean;
  updatedAt: string;
};

export type ReviewSubjectGroup = {
  cards: ReviewCardSource[];
  identity: ReviewSubjectIdentity;
  lastInteractionAt: string;
  representativeCard: ReviewCardSource;
  subjectState: ReviewSubjectStateSnapshot | null;
};

export function buildReviewSubjectEntryLookup(input: {
  grammar: Array<{
    crossMediaGroupId: string | null;
    id: string;
    pattern: string;
    reading?: string | null;
  }>;
  terms: Array<{
    crossMediaGroupId: string | null;
    id: string;
    lemma: string;
    reading?: string | null;
  }>;
}) {
  const lookup = new Map<string, ReviewSubjectEntryMeta>();

  const entries = [
    ...input.terms.map((entry) => ({
      entry,
      entryType: "term" as const,
      label: entry.lemma
    })),
    ...input.grammar.map((entry) => ({
      entry,
      entryType: "grammar" as const,
      label: entry.pattern
    }))
  ];

  for (const { entry, entryType, label } of entries) {
    lookup.set(buildEntryKey(entryType, entry.id), {
      crossMediaGroupId: entry.crossMediaGroupId,
      entryId: entry.id,
      entryType,
      label,
      reading: entry.reading
    });
  }

  return lookup;
}

export function deriveReviewSubjectIdentity(input: {
  cardId: string;
  cardType: string;
  front: string;
  entryLinks: ReviewEntryLinkLike[];
  entryLookup: Map<string, ReviewSubjectEntryMeta>;
}): ReviewSubjectIdentity {
  const drivingLinks = getDrivingEntryLinks(input.entryLinks);
  const hasPrimaryLink = input.entryLinks.some(
    (link) => link.relationshipType === "primary"
  );

  if (drivingLinks.length !== 1) {
    return buildReviewSubjectCardIdentity(input.cardId, input.cardType);
  }

  const drivingLink = drivingLinks[0]!;
  const drivingEntry = input.entryLookup.get(
    buildEntryKey(drivingLink.entryType, drivingLink.entryId)
  );

  if (!drivingEntry) {
    return buildReviewSubjectCardIdentity(input.cardId, input.cardType);
  }

  if (
    hasPrimaryLink &&
    input.cardType === "concept" &&
    !matchesReviewSubjectEntrySurface(input.front, drivingEntry)
  ) {
    return buildReviewSubjectCardIdentity(input.cardId, input.cardType);
  }

  if (drivingEntry?.crossMediaGroupId) {
    return buildReviewSubjectIdentityFromCanonical({
      cardType: input.cardType,
      cardId: input.cardId,
      canonicalSubjectKey: buildReviewCanonicalSubjectKey({
        crossMediaGroupId: drivingEntry.crossMediaGroupId,
        entryId: drivingEntry.entryId,
        entryType: drivingEntry.entryType,
        subjectKind: "group"
      }),
      crossMediaGroupId: drivingEntry.crossMediaGroupId,
      entryId: drivingEntry.entryId,
      entryType: drivingEntry.entryType,
      subjectKind: "group"
    });
  }

  return buildReviewSubjectIdentityFromCanonical({
    cardType: input.cardType,
    cardId: input.cardId,
    canonicalSubjectKey: buildReviewCanonicalSubjectKey({
      crossMediaGroupId: null,
      entryId: drivingLink.entryId,
      entryType: drivingLink.entryType,
      subjectKind: "entry"
    }),
    crossMediaGroupId: null,
    entryId: drivingLink.entryId,
    entryType: drivingLink.entryType,
    subjectKind: "entry"
  });
}

export function buildReviewSubjectCardIdentity(
  cardId: string,
  cardType: string
): ReviewSubjectIdentity {
  return buildReviewSubjectIdentityFromCanonical({
    cardType,
    cardId,
    canonicalSubjectKey: buildReviewCanonicalSubjectKey({
      crossMediaGroupId: null,
      entryId: cardId,
      entryType: null,
      subjectKind: "card"
    }),
    crossMediaGroupId: null,
    entryId: null,
    entryType: null,
    subjectKind: "card"
  });
}

export function buildReviewCanonicalSubjectKey(input: {
  crossMediaGroupId: string | null;
  entryId: string;
  entryType: EntryType | null;
  subjectKind: ReviewSubjectKind;
}) {
  if (input.subjectKind === "card") {
    return `card:${input.entryId}`;
  }

  if (!input.entryType) {
    return `card:${input.entryId}`;
  }

  if (input.subjectKind === "group" && input.crossMediaGroupId) {
    return `group:${input.entryType}:${input.crossMediaGroupId}`;
  }

  return `entry:${input.entryType}:${input.entryId}`;
}

export function buildReviewSubjectKey(
  input: Parameters<typeof buildReviewCanonicalSubjectKey>[0]
) {
  return buildReviewCanonicalSubjectKey(input);
}

export function buildReviewSubjectIdentityFromCanonical(input: {
  cardId: string;
  cardType: string;
  canonicalSubjectKey: string;
  crossMediaGroupId: string | null;
  entryId: string | null;
  entryType: EntryType | null;
  subjectKind: ReviewSubjectKind;
}): ReviewSubjectIdentity {
  const recallTask = resolveReviewRecallTask(input.cardType);
  const memoryKey = buildReviewMemoryKey({
    canonicalSubjectKey: input.canonicalSubjectKey,
    cardId: input.cardId,
    recallTask
  });

  return {
    cardId: input.cardId,
    canonicalSubjectKey: input.canonicalSubjectKey,
    crossMediaGroupId: input.crossMediaGroupId,
    entryId: input.entryId,
    entryType: input.entryType,
    memoryKey,
    recallTask,
    subjectKey: memoryKey,
    subjectKind: input.subjectKind
  };
}

export function matchesReviewSubjectEntrySurface(
  front: string,
  entry: Pick<ReviewSubjectEntryMeta, "label" | "reading">
) {
  const normalizedFront = normalizeReviewSubjectSurface(front);

  if (normalizedFront.length === 0) {
    return false;
  }

  return [entry.label, entry.reading ?? null]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeReviewSubjectSurface(value) === normalizedFront);
}

export function normalizeReviewSubjectSurface(value: string) {
  return stripInlineMarkdown(value)
    .replace(/[～〜]/g, "〜")
    .replace(/\s+/g, " ")
    .trim();
}

export function groupReviewCardsBySubject(input: {
  cards: ReviewCardSource[];
  entryLookup: Map<string, ReviewSubjectEntryMeta>;
  nowIso?: string;
  subjectStates: Map<string, ReviewSubjectStateSnapshot>;
  precomputedIdentities?: Map<string, ReviewSubjectIdentity>;
}): ReviewSubjectGroup[] {
  const groups = new Map<string, ReviewSubjectGroup>();

  for (const card of input.cards) {
    const identity =
      input.precomputedIdentities?.get(card.id) ??
      deriveReviewSubjectIdentity({
        cardId: card.id,
        cardType: card.cardType,
        front: card.front,
        entryLinks: card.entryLinks,
        entryLookup: input.entryLookup
      });
    const subjectState = input.subjectStates.get(identity.subjectKey) ?? null;
    const existing = groups.get(identity.subjectKey);

    if (!existing) {
      groups.set(identity.subjectKey, {
        cards: [card],
        identity,
        lastInteractionAt: resolveReviewSubjectLastInteractionAt(
          card,
          subjectState
        ),
        representativeCard: card,
        subjectState
      });
      continue;
    }

    existing.cards.push(card);
    existing.lastInteractionAt = maxIso(
      existing.lastInteractionAt,
      resolveReviewSubjectLastInteractionAt(card, subjectState)
    );
    existing.subjectState = existing.subjectState ?? subjectState;
  }

  return [...groups.values()].map((group) => ({
    ...group,
    representativeCard: selectReviewSubjectRepresentativeCard(
      group.cards,
      group.subjectState,
      input.nowIso
    )
  }));
}

export function selectReviewSubjectRepresentativeCard<
  TCard extends ReviewCardSource
>(
  cards: TCard[],
  subjectState: ReviewSubjectStateSnapshot | null,
  nowIso?: string
) {
  if (cards.length === 0) {
    throw new Error(
      "Cannot select a representative review card for an empty subject."
    );
  }

  if (subjectState?.cardId) {
    const pinnedCard = cards.find((card) => card.id === subjectState.cardId);

    if (pinnedCard) {
      return pinnedCard;
    }
  }

  let bestCard = cards[0]!;
  let bestPriority = getReviewCardPriority(bestCard, subjectState, nowIso);

  for (let index = 1; index < cards.length; index++) {
    const candidate = cards[index]!;
    const candidatePriority = getReviewCardPriority(
      candidate,
      subjectState,
      nowIso
    );

    if (candidatePriority < bestPriority) {
      bestCard = candidate;
      bestPriority = candidatePriority;
      continue;
    }

    if (candidatePriority > bestPriority) {
      continue;
    }

    if (nowIso) {
      const recencyDifference = compareReviewCardsBySubjectRecency(
        candidate,
        bestCard
      );

      if (recencyDifference < 0) {
        bestCard = candidate;
        continue;
      }

      if (recencyDifference > 0) {
        continue;
      }
    }

    if (compareReviewCardsBySubjectDisplay(candidate, bestCard) < 0) {
      bestCard = candidate;
    }
  }

  return bestCard;
}

export function resolveReviewSubjectLastInteractionAt(
  card: ReviewCardSource,
  subjectState: ReviewSubjectStateSnapshot | null
) {
  if (subjectState) {
    return subjectState.lastInteractionAt;
  }

  return card.updatedAt ?? card.createdAt;
}

export function buildReviewSubjectSeedState(
  cards: ReviewCardSource[],
  subjectState: ReviewSubjectStateSnapshot | null,
  nowIso?: string
): {
  current: {
    difficulty: number | null;
    dueAt: string | null;
    lapses: number;
    lastReviewedAt: string | null;
    learningSteps: number;
    reps: number;
    scheduledDays: number;
    stability: number | null;
    state: ReviewState | null;
  };
  seedCardId: string;
} {
  const seedCard = selectReviewSubjectRepresentativeCard(
    cards,
    subjectState,
    nowIso
  );

  if (subjectState) {
    return {
      current: {
        difficulty: subjectState.difficulty,
        dueAt: subjectState.dueAt,
        lapses: subjectState.lapses,
        lastReviewedAt: subjectState.lastReviewedAt,
        learningSteps: subjectState.learningSteps,
        reps: subjectState.reps,
        scheduledDays: subjectState.scheduledDays,
        stability: subjectState.stability,
        state: subjectState.state
      },
      seedCardId: seedCard.id
    };
  }

  return {
    current: {
      difficulty: null,
      dueAt: null,
      lapses: 0,
      lastReviewedAt: null,
      learningSteps: 0,
      reps: 0,
      scheduledDays: 0,
      stability: null,
      state: null
    },
    seedCardId: seedCard.id
  };
}

function compareReviewCardsBySubjectRecency(
  left: ReviewCardSource,
  right: ReviewCardSource
) {
  const interactionDifference =
    toTime(right.updatedAt ?? right.createdAt) -
    toTime(left.updatedAt ?? left.createdAt);

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  if (left.orderIndex !== right.orderIndex) {
    return (
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
    );
  }

  return left.id.localeCompare(right.id);
}

function compareReviewCardsBySubjectDisplay(
  left: ReviewCardSource,
  right: ReviewCardSource
) {
  if (left.status !== right.status) {
    return left.status === "active" ? -1 : 1;
  }

  if (left.orderIndex !== right.orderIndex) {
    return (
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
    );
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function maxIso(left: string, right: string) {
  return toTime(left) >= toTime(right) ? left : right;
}

function toTime(value: string) {
  return new Date(value).getTime();
}

function getReviewCardPriority(
  card: ReviewCardSource,
  subjectState: ReviewSubjectStateSnapshot | null,
  nowIso?: string
) {
  const effectiveState = resolveEffectiveReviewState({
    cardStatus: card.status,
    reviewState: subjectState
      ? {
          manualOverride: subjectState.manualOverride,
          suspended: subjectState.suspended,
          state: subjectState.state as ReviewState
        }
      : null
  });

  if (effectiveState.state === "suspended") {
    return 4;
  }

  if (effectiveState.state === "known_manual") {
    return 3;
  }

  if (!subjectState || subjectState.state === "new") {
    return 2;
  }

  if (!nowIso || !subjectState.dueAt || subjectState.dueAt <= nowIso) {
    return 0;
  }

  return 1;
}
