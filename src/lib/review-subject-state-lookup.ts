import type { DatabaseClient } from "../db/client.ts";
import {
  listGrammarCrossMediaFamiliesByEntryIds,
  listReviewCardIdsByEntryRefs,
  listReviewCardsByIds,
  listReviewSubjectStatesByKeys,
  listTermCrossMediaFamiliesByEntryIds,
  type GrammarCrossMediaFamily,
  type ReviewCardListItem,
  type ReviewSubjectEntryRef,
  type TermCrossMediaFamily
} from "../db/queries/index.ts";

import {
  getDrivingEntryLinks,
  type ReviewEntryStatusValue
} from "./review-model.ts";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  groupReviewCardsBySubject,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectGroup,
  type ReviewSubjectIdentity,
  type ReviewSubjectStateSnapshot
} from "./review-subject.ts";

type LegacyReviewSubjectFamilyLookup = {
  grammarFamilies: Map<string, GrammarCrossMediaFamily>;
  termFamilies: Map<string, TermCrossMediaFamily>;
};

export type ReviewLegacyFallbackCounts = {
  complex: number;
  inline: number;
};

export type ReviewSubjectStateLookupResult = {
  fallbackStates: ReviewSubjectStateSnapshot[];
  legacyFallbackCounts: ReviewLegacyFallbackCounts;
  subjectGroups: ReviewSubjectGroup[];
};

export async function loadReviewSubjectStateLookup(input: {
  cards: ReviewCardListItem[];
  database: DatabaseClient;
  grammar: Array<{
    crossMediaGroupId: string | null;
    id: string;
  }>;
  nowIso?: string;
  terms: Array<{
    crossMediaGroupId: string | null;
    id: string;
  }>;
}): Promise<ReviewSubjectStateLookupResult> {
  const subjectEntryLookup = buildReviewSubjectEntryLookup({
    grammar: input.grammar,
    terms: input.terms
  });
  const subjectKeys = [
    ...new Set(
      input.cards.map(
        (card) =>
          deriveReviewSubjectIdentity({
            cardId: card.id,
            entryLinks: card.entryLinks,
            entryLookup: subjectEntryLookup
          }).subjectKey
      )
    )
  ];
  const subjectStateRows = await listReviewSubjectStatesByKeys(
    input.database,
    subjectKeys
  );
  const subjectStates = new Map(
    [...subjectStateRows.entries()].map(([subjectKey, row]) => [
      subjectKey,
      row as ReviewSubjectStateSnapshot
    ])
  );
  const groupedCards = groupReviewCardsBySubject({
    cards: input.cards,
    entryLookup: subjectEntryLookup,
    nowIso: input.nowIso,
    subjectStates
  });
  const missingSubjectGroups = groupedCards.filter(
    (group) => !subjectStates.has(group.identity.subjectKey)
  );
  const simpleFallbacks: ReviewSubjectStateSnapshot[] = [];
  const complexMissing: typeof missingSubjectGroups = [];

  for (const group of missingSubjectGroups) {
    if (group.identity.subjectKind === "card") {
      simpleFallbacks.push(
        buildInlineLegacySubjectState(group.cards, group.identity, input.nowIso)
      );
    } else {
      complexMissing.push(group);
    }
  }

  const fallbackStates = [
    ...simpleFallbacks,
    ...(await buildComplexLegacySubjectFallbackStates({
      database: input.database,
      groups: complexMissing,
      nowIso: input.nowIso
    }))
  ];

  for (const fallbackState of fallbackStates) {
    subjectStates.set(fallbackState.subjectKey, fallbackState);
  }

  const subjectGroups = groupedCards.map((group) => {
    const subjectState = subjectStates.get(group.identity.subjectKey) ?? null;

    return {
      ...group,
      lastInteractionAt: subjectState
        ? subjectState.lastInteractionAt
        : group.lastInteractionAt,
      representativeCard: selectReviewSubjectRepresentativeCard(
        group.cards,
        subjectState,
        input.nowIso
      ),
      subjectState
    } satisfies ReviewSubjectGroup;
  });

  return {
    fallbackStates,
    legacyFallbackCounts: {
      complex: complexMissing.length,
      inline: simpleFallbacks.length
    },
    subjectGroups
  };
}

function buildInlineLegacySubjectState(
  cards: ReviewCardListItem[],
  identity: ReviewSubjectIdentity,
  nowIso?: string
): ReviewSubjectStateSnapshot {
  const representativeCard = selectReviewSubjectRepresentativeCard(
    cards,
    null,
    nowIso
  );
  const rs = representativeCard.reviewState;

  return {
    cardId: representativeCard.id,
    createdAt: rs?.createdAt ?? representativeCard.createdAt,
    crossMediaGroupId: identity.crossMediaGroupId,
    difficulty: rs?.difficulty ?? null,
    dueAt: rs?.dueAt ?? null,
    entryId: identity.entryId,
    entryType: identity.entryType,
    lapses: rs?.lapses ?? 0,
    lastInteractionAt:
      rs?.lastReviewedAt ??
      representativeCard.updatedAt ??
      representativeCard.createdAt,
    lastReviewedAt: rs?.lastReviewedAt ?? null,
    learningSteps: rs?.learningSteps ?? 0,
    manualOverride: rs?.manualOverride ?? false,
    reps: rs?.reps ?? 0,
    scheduledDays: rs?.scheduledDays ?? 0,
    stability: rs?.stability ?? null,
    state: (rs?.state as ReviewSubjectStateSnapshot["state"]) ?? "new",
    subjectKey: identity.subjectKey,
    subjectType: identity.subjectKind,
    suspended: representativeCard.status === "suspended",
    updatedAt: rs?.updatedAt ?? representativeCard.updatedAt
  };
}

async function buildComplexLegacySubjectFallbackStates(input: {
  database: DatabaseClient;
  groups: ReviewSubjectGroup[];
  nowIso?: string;
}) {
  if (input.groups.length === 0) {
    return [];
  }

  const familyLookup = await preloadLegacyReviewSubjectFamilies(
    input.database,
    input.groups.map((group) => group.identity)
  );
  const entryRefsBySubjectKey = new Map<string, ReviewSubjectEntryRef[]>();
  const allEntryRefs: ReviewSubjectEntryRef[] = [];

  for (const group of input.groups) {
    const entryRefs = resolveLegacyReviewSubjectEntryRefs({
      familyLookup,
      identity: group.identity
    });

    entryRefsBySubjectKey.set(group.identity.subjectKey, entryRefs);
    allEntryRefs.push(...entryRefs);
  }

  const memberCardIds = await listReviewCardIdsByEntryRefs(
    input.database,
    allEntryRefs
  );
  const memberCards = await listReviewCardsByIds(input.database, memberCardIds);
  const loadedMemberCardsBySubjectKey = partitionLegacyReviewSubjectMemberCards(
    {
      cards: memberCards,
      entryRefsBySubjectKey,
      groups: input.groups
    }
  );
  const finalCardsBySubjectKey = new Map<string, ReviewCardListItem[]>();
  const allFinalCards = new Map<string, ReviewCardListItem>();

  for (const group of input.groups) {
    const resolvedCards =
      loadedMemberCardsBySubjectKey.get(group.identity.subjectKey) ?? [];
    const finalCards = resolvedCards.length > 0 ? resolvedCards : group.cards;

    finalCardsBySubjectKey.set(group.identity.subjectKey, finalCards);

    for (const card of finalCards) {
      allFinalCards.set(card.id, card);
    }
  }

  const drivingEntryStatusesByCardId =
    allFinalCards.size > 0
      ? await loadLegacyReviewSubjectDrivingEntryStatuses({
          cards: [...allFinalCards.values()],
          database: input.database
        })
      : new Map<string, ReviewEntryStatusValue[]>();

  return input.groups.map((group) =>
    buildLegacyReviewSubjectState({
      cards:
        finalCardsBySubjectKey.get(group.identity.subjectKey) ?? group.cards,
      drivingEntryStatusesByCardId,
      identity: group.identity,
      nowIso: input.nowIso
    })
  );
}

async function preloadLegacyReviewSubjectFamilies(
  database: DatabaseClient,
  identities: ReviewSubjectIdentity[]
): Promise<LegacyReviewSubjectFamilyLookup> {
  const termEntryIds = new Set<string>();
  const grammarEntryIds = new Set<string>();

  for (const identity of identities) {
    if (
      identity.subjectKind !== "group" ||
      !identity.entryId ||
      !identity.entryType
    ) {
      continue;
    }

    if (identity.entryType === "term") {
      termEntryIds.add(identity.entryId);
      continue;
    }

    grammarEntryIds.add(identity.entryId);
  }

  const [termFamilies, grammarFamilies] = await Promise.all([
    listTermCrossMediaFamiliesByEntryIds(database, [...termEntryIds]),
    listGrammarCrossMediaFamiliesByEntryIds(database, [...grammarEntryIds])
  ]);

  return {
    grammarFamilies,
    termFamilies
  };
}

function partitionLegacyReviewSubjectMemberCards(input: {
  cards: ReviewCardListItem[];
  entryRefsBySubjectKey: Map<string, ReviewSubjectEntryRef[]>;
  groups: ReviewSubjectGroup[];
}) {
  const subjectKeysByEntryRef = new Map<string, string[]>();
  const cardsBySubjectKey = new Map<string, ReviewCardListItem[]>();

  for (const group of input.groups) {
    cardsBySubjectKey.set(group.identity.subjectKey, []);
  }

  for (const [subjectKey, entryRefs] of input.entryRefsBySubjectKey.entries()) {
    for (const entryRef of entryRefs) {
      const refKey = `${entryRef.entryType}:${entryRef.entryId}`;
      const subjectKeys = subjectKeysByEntryRef.get(refKey);

      if (subjectKeys) {
        subjectKeys.push(subjectKey);
        continue;
      }

      subjectKeysByEntryRef.set(refKey, [subjectKey]);
    }
  }

  for (const card of input.cards) {
    const drivingLinks = getDrivingEntryLinks(card.entryLinks);

    if (drivingLinks.length !== 1) {
      continue;
    }

    const drivingLink = drivingLinks[0]!;

    if (
      drivingLink.entryType !== "term" &&
      drivingLink.entryType !== "grammar"
    ) {
      continue;
    }

    const subjectKeys =
      subjectKeysByEntryRef.get(
        `${drivingLink.entryType}:${drivingLink.entryId}`
      ) ?? [];

    for (const subjectKey of subjectKeys) {
      cardsBySubjectKey.get(subjectKey)?.push(card);
    }
  }

  return cardsBySubjectKey;
}

function resolveLegacyReviewSubjectEntryRefs(input: {
  familyLookup: LegacyReviewSubjectFamilyLookup;
  identity: ReviewSubjectIdentity;
}) {
  if (!input.identity.entryId || !input.identity.entryType) {
    return [];
  }

  if (input.identity.subjectKind !== "group") {
    return [
      {
        entryId: input.identity.entryId,
        entryType: input.identity.entryType
      }
    ];
  }

  if (input.identity.entryType === "term") {
    const family = input.familyLookup.termFamilies.get(input.identity.entryId);

    return dedupeReviewSubjectEntryRefs([
      {
        entryId: input.identity.entryId,
        entryType: input.identity.entryType
      },
      ...(family?.siblings ?? []).map((sibling) => ({
        entryId: sibling.entryId,
        entryType: "term" as const
      }))
    ]);
  }

  const family = input.familyLookup.grammarFamilies.get(input.identity.entryId);

  return dedupeReviewSubjectEntryRefs([
    {
      entryId: input.identity.entryId,
      entryType: input.identity.entryType
    },
    ...(family?.siblings ?? []).map((sibling) => ({
      entryId: sibling.entryId,
      entryType: "grammar" as const
    }))
  ]);
}

function buildLegacyReviewSubjectState(input: {
  cards: ReviewCardListItem[];
  drivingEntryStatusesByCardId: Map<string, ReviewEntryStatusValue[]>;
  identity: ReviewSubjectIdentity;
  nowIso?: string;
}) {
  const representativeCard = selectReviewSubjectRepresentativeCard(
    input.cards,
    null,
    input.nowIso,
    {
      drivingEntryStatusesByCardId: input.drivingEntryStatusesByCardId
    }
  );
  const reviewState = representativeCard.reviewState;

  return {
    cardId: representativeCard.id,
    createdAt: reviewState?.createdAt ?? representativeCard.createdAt,
    crossMediaGroupId: input.identity.crossMediaGroupId,
    difficulty: reviewState?.difficulty ?? null,
    dueAt: reviewState?.dueAt ?? null,
    entryId: input.identity.entryId,
    entryType: input.identity.entryType,
    lapses: reviewState?.lapses ?? 0,
    lastInteractionAt:
      reviewState?.lastReviewedAt ??
      representativeCard.updatedAt ??
      representativeCard.createdAt,
    lastReviewedAt: reviewState?.lastReviewedAt ?? null,
    learningSteps: reviewState?.learningSteps ?? 0,
    manualOverride: reviewState?.manualOverride ?? false,
    reps: reviewState?.reps ?? 0,
    scheduledDays: reviewState?.scheduledDays ?? 0,
    stability: reviewState?.stability ?? null,
    state: (reviewState?.state as ReviewSubjectStateSnapshot["state"]) ?? "new",
    subjectKey: input.identity.subjectKey,
    subjectType: input.identity.subjectKind,
    suspended: representativeCard.status === "suspended",
    updatedAt: reviewState?.updatedAt ?? representativeCard.updatedAt
  } satisfies ReviewSubjectStateSnapshot;
}

async function loadLegacyReviewSubjectDrivingEntryStatuses(input: {
  cards: ReviewCardListItem[];
  database: DatabaseClient;
}) {
  const refsByCardId = new Map<
    string,
    Array<{
      entryId: string;
      entryType: "term" | "grammar";
    }>
  >();
  const termEntryIds = new Set<string>();
  const grammarEntryIds = new Set<string>();

  for (const card of input.cards) {
    const refs = dedupeReviewSubjectEntryRefs(
      getDrivingEntryLinks(card.entryLinks).flatMap((link) =>
        link.entryType === "term" || link.entryType === "grammar"
          ? [
              {
                entryId: link.entryId,
                entryType: link.entryType
              }
            ]
          : []
      )
    );

    refsByCardId.set(card.id, refs);

    for (const ref of refs) {
      if (ref.entryType === "term") {
        termEntryIds.add(ref.entryId);
      } else {
        grammarEntryIds.add(ref.entryId);
      }
    }
  }

  if (termEntryIds.size === 0 && grammarEntryIds.size === 0) {
    return new Map<string, ReviewEntryStatusValue[]>();
  }

  const matchClauses = [
    termEntryIds.size > 0
      ? `(entry_type = 'term' AND entry_id IN (${[...termEntryIds]
          .map((value) => `'${value.replaceAll("'", "''")}'`)
          .join(", ")}))`
      : null,
    grammarEntryIds.size > 0
      ? `(entry_type = 'grammar' AND entry_id IN (${[...grammarEntryIds]
          .map((value) => `'${value.replaceAll("'", "''")}'`)
          .join(", ")}))`
      : null
  ].filter((clause): clause is string => clause !== null);

  const rows = await input.database.all<{
    entryId: string;
    entryType: "grammar" | "term";
    status: ReviewEntryStatusValue;
  }>(`
    SELECT
      entry_id AS entryId,
      entry_type AS entryType,
      status AS status
    FROM entry_status
    WHERE ${matchClauses.join(" OR ")}
  `);

  const statusByEntryKey = new Map(
    rows.map((row) => [
      `${row.entryType}:${row.entryId}`,
      row.status as ReviewEntryStatusValue
    ])
  );

  return new Map(
    [...refsByCardId.entries()].map(([cardId, refs]) => [
      cardId,
      refs.map(
        (ref) => statusByEntryKey.get(`${ref.entryType}:${ref.entryId}`) ?? null
      )
    ])
  );
}

function dedupeReviewSubjectEntryRefs(
  entryRefs: Array<{
    entryId: string;
    entryType: ReviewSubjectIdentity["entryType"];
  }>
) {
  const seen = new Set<string>();
  const deduped: Array<{
    entryId: string;
    entryType: NonNullable<ReviewSubjectIdentity["entryType"]>;
  }> = [];

  for (const entry of entryRefs) {
    if (!entry.entryType) {
      continue;
    }

    const key = `${entry.entryType}:${entry.entryId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({
      entryId: entry.entryId,
      entryType: entry.entryType
    });
  }

  return deduped;
}
