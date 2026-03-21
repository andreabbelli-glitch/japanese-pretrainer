import type { ReviewCardListItem } from "../db/queries/review.ts";
import type { EntryType } from "../db/schema/enums.ts";
import { buildEntryKey } from "./entry-id.ts";
import { stripInlineMarkdown } from "./inline-markdown.ts";

import {
  getDrivingEntryLinks,
  resolveEffectiveReviewState,
  type ReviewEntryLinkLike
} from "./review-model.ts";
import type { ReviewState } from "./review-scheduler.ts";

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
  crossMediaGroupId: string | null;
  entryId: string | null;
  entryType: EntryType | null;
  subjectKey: string;
  subjectKind: ReviewSubjectKind;
};

export type ReviewSubjectStateSnapshot = {
  cardId: string | null;
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
  scheduledDays: number;
  schedulerVersion: "fsrs_v1";
  stability: number | null;
  state: ReviewState;
  subjectKey: string;
  subjectType: ReviewSubjectKind;
  suspended: boolean;
  updatedAt: string;
};

export type ReviewSubjectGroup = {
  cards: ReviewCardListItem[];
  identity: ReviewSubjectIdentity;
  lastInteractionAt: string;
  representativeCard: ReviewCardListItem;
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
    return buildReviewSubjectCardIdentity(input.cardId);
  }

  const drivingLink = drivingLinks[0]!;
  const drivingEntry = input.entryLookup.get(
    buildEntryKey(drivingLink.entryType, drivingLink.entryId)
  );

  if (!drivingEntry) {
    return buildReviewSubjectCardIdentity(input.cardId);
  }

  if (
    hasPrimaryLink &&
    input.cardType === "concept" &&
    !matchesReviewSubjectEntrySurface(input.front, drivingEntry)
  ) {
    return buildReviewSubjectCardIdentity(input.cardId);
  }

  if (drivingEntry?.crossMediaGroupId) {
    return {
      cardId: input.cardId,
      crossMediaGroupId: drivingEntry.crossMediaGroupId,
      entryId: drivingEntry.entryId,
      entryType: drivingEntry.entryType,
      subjectKey: buildReviewSubjectKey({
        crossMediaGroupId: drivingEntry.crossMediaGroupId,
        entryId: drivingEntry.entryId,
        entryType: drivingEntry.entryType,
        subjectKind: "group"
      }),
      subjectKind: "group"
    };
  }

  return {
    cardId: input.cardId,
    crossMediaGroupId: null,
    entryId: drivingLink.entryId,
    entryType: drivingLink.entryType,
    subjectKey: buildReviewSubjectKey({
      crossMediaGroupId: null,
      entryId: drivingLink.entryId,
      entryType: drivingLink.entryType,
      subjectKind: "entry"
    }),
    subjectKind: "entry"
  };
}

export function buildReviewSubjectCardIdentity(
  cardId: string
): ReviewSubjectIdentity {
  return {
    cardId,
    crossMediaGroupId: null,
    entryId: null,
    entryType: null,
    subjectKey: buildReviewSubjectKey({
      crossMediaGroupId: null,
      entryId: cardId,
      entryType: null,
      subjectKind: "card"
    }),
    subjectKind: "card"
  };
}

export function buildReviewSubjectKey(input: {
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

function normalizeReviewSubjectSurface(value: string) {
  return stripInlineMarkdown(value)
    .replace(/[～〜]/g, "〜")
    .replace(/\s+/g, " ")
    .trim();
}

export function groupReviewCardsBySubject(input: {
  cards: ReviewCardListItem[];
  entryLookup: Map<string, ReviewSubjectEntryMeta>;
  nowIso?: string;
  subjectStates: Map<string, ReviewSubjectStateSnapshot>;
}): ReviewSubjectGroup[] {
  const groups = new Map<string, ReviewSubjectGroup>();

  for (const card of input.cards) {
    const identity = deriveReviewSubjectIdentity({
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
    existing.representativeCard = selectReviewSubjectRepresentativeCard(
      existing.cards,
      existing.subjectState,
      input.nowIso
    );
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

export function selectReviewSubjectRepresentativeCard(
  cards: ReviewCardListItem[],
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

  return (
    [...cards].sort((left, right) => {
      const priorityDifference =
        getReviewCardPriority(left, subjectState, nowIso) -
        getReviewCardPriority(right, subjectState, nowIso);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      if (nowIso) {
        const recencyDifference = compareReviewCardsBySubjectRecency(
          left,
          right
        );

        if (recencyDifference !== 0) {
          return recencyDifference;
        }
      }

      return compareReviewCardsBySubjectDisplay(left, right);
    })[0] ?? cards[0]!
  );
}

export function resolveReviewSubjectLastInteractionAt(
  card: ReviewCardListItem,
  subjectState: ReviewSubjectStateSnapshot | null
) {
  if (subjectState) {
    return subjectState.lastInteractionAt;
  }

  return card.updatedAt ?? card.createdAt;
}

export function buildReviewSubjectSeedState(
  cards: ReviewCardListItem[],
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
  left: ReviewCardListItem,
  right: ReviewCardListItem
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
  left: ReviewCardListItem,
  right: ReviewCardListItem
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
  card: ReviewCardListItem,
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

