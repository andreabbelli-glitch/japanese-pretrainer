import { unstable_noStore as noStore } from "next/cache";

import {
  countReviewSubjectsIntroducedOnDay,
  db,
  getGrammarEntriesByIds,
  getGrammarCrossMediaFamilyByEntryId,
  listLessonLinkedReviewEntriesByMediaId,
  listLessonLinkedReviewEntriesByMediaIds,
  listGrammarEntryReviewSummaries,
  listMedia,
  listGrammarCrossMediaFamiliesByEntryIds,
  listReviewLaunchCandidates,
  getMediaBySlug,
  getTermEntriesByIds,
  getTermCrossMediaFamilyByEntryId,
  listTermCrossMediaFamiliesByEntryIds,
  listGrammarEntriesByMediaId,
  listReviewCardIdsByEntryRefs,
  listReviewCardsByIds,
  listReviewCardsByMediaId,
  listReviewCardsByMediaIds,
  listTermEntriesByMediaId,
  listTermEntryReviewSummaries,
  listReviewSubjectStatesByKeys,
  type DatabaseClient,
  type CrossMediaGrammarSibling,
  type CrossMediaTermSibling,
  type GrammarEntryReviewSummary,
  type GrammarCrossMediaFamily,
  type GrammarGlossaryEntry,
  type GrammarGlossaryEntrySummary,
  type LessonLinkedReviewEntry,
  type MediaListItem,
  type ReviewCardListItem,
  type ReviewSubjectEntryRef,
  type TermCrossMediaFamily,
  type TermEntryReviewSummary,
  type TermGlossaryEntry,
  type TermGlossaryEntrySummary
} from "@/db";
import {
  getReviewDailyLimit,
  getReviewFrontFuriganaSetting
} from "@/lib/settings";
import {
  mediaGlossaryEntryHref,
  mediaGlossaryHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref,
  reviewHref
} from "@/lib/site";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatEntryStatusLabel,
  formatReviewStateLabel
} from "@/lib/study-format";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  groupReviewCardsBySubject,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectEntryMeta,
  type ReviewSubjectIdentity,
  type ReviewSubjectGroup,
  type ReviewSubjectStateSnapshot
} from "./review-subject";

import {
  getDrivingEntryLinks,
  isReviewCardDue,
  isReviewCardNew,
  resolveEffectiveReviewState,
  type EffectiveReviewState,
  type ReviewEntryLinkLike,
  type ReviewEntryStatusValue
} from "./review-model";
import {
  buildPronunciationData,
  type PronunciationData
} from "./pronunciation";
import {
  buildReviewGradePreviews as buildSharedReviewGradePreviews,
  type ReviewGradePreview,
  type ReviewSeedState
} from "./review-grade-previews";
import { type ReviewState } from "./review-scheduler";

type ReviewCardEntryKind = "term" | "grammar";

type ReviewSearchState = {
  answeredCount: number;
  extraNewCount: number;
  noticeCode: string | null;
  selectedCardId: string | null;
  showAnswer: boolean;
};

type ReviewEntryLookupItem = {
  href: ReturnType<typeof mediaGlossaryEntryHref>;
  id: string;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  pronunciation?: PronunciationData;
  reading?: string;
  status: ReviewEntryStatusValue;
  subtitle?: string;
};

type ReviewScope = "global" | "media";
type ReviewTermLookupEntry =
  | TermGlossaryEntry
  | TermGlossaryEntrySummary
  | TermEntryReviewSummary;
type ReviewGrammarLookupEntry =
  | GrammarGlossaryEntry
  | GrammarGlossaryEntrySummary
  | GrammarEntryReviewSummary;
type ReviewMediaLookup = Map<
  string,
  {
    slug: string;
    title: string;
  }
>;

type SubjectReviewCard = ReviewCardListItem & {
  reviewState: NonNullable<ReviewCardListItem["reviewState"]> | null;
};

type LegacyReviewSubjectFamilyLookup = {
  grammarFamilies: Map<string, GrammarCrossMediaFamily>;
  termFamilies: Map<string, TermCrossMediaFamily>;
};

async function loadReviewSubjectStateLookup(input: {
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
}) {
  const entryLookup = buildReviewSubjectEntryLookup({
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
            entryLookup
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
  const subjectGroups = groupReviewCardsBySubject({
    cards: input.cards,
    entryLookup,
    nowIso: input.nowIso,
    subjectStates
  });
  const missingSubjectGroups = subjectGroups.filter(
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

  return {
    entryLookup,
    subjectStates
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

function getReviewEntryStatus(entry: {
  entryStatus?: ReviewEntryStatusValue;
  status?: { status: ReviewEntryStatusValue } | null;
}) {
  if ("entryStatus" in entry) {
    return entry.entryStatus ?? null;
  }

  return entry.status?.status ?? null;
}

function applySubjectStateToReviewCard(
  card: ReviewCardListItem,
  subjectState: ReviewSubjectStateSnapshot | null
): SubjectReviewCard {
  if (!subjectState) {
    return {
      ...card,
      reviewState: card.reviewState ?? null
    };
  }

  return {
    ...card,
    status: subjectState.state === "suspended" ? "suspended" : card.status,
    reviewState: {
      cardId: card.id,
      createdAt: card.reviewState?.createdAt ?? subjectState.createdAt,
      difficulty: subjectState.difficulty,
      dueAt: subjectState.dueAt,
      lapses: subjectState.lapses,
      lastReviewedAt: subjectState.lastReviewedAt,
      learningSteps: subjectState.learningSteps,
      manualOverride: subjectState.manualOverride,
      reps: subjectState.reps,
      scheduledDays: subjectState.scheduledDays,
      schedulerVersion: card.reviewState?.schedulerVersion ?? "fsrs_v1",
      state: subjectState.state,
      stability: subjectState.stability,
      updatedAt: subjectState.updatedAt
    }
  };
}

export type ReviewCardEntrySummary = {
  href: ReturnType<typeof mediaGlossaryEntryHref>;
  id: string;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  relationshipLabel: string;
  statusLabel: string;
  subtitle?: string;
};

export type ReviewCardPronunciation = {
  audio: PronunciationData;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  relationshipLabel: string;
};

export type ReviewQueueCard = {
  back: string;
  bucket: "due" | "manual" | "new" | "suspended" | "upcoming";
  bucketDetail: string;
  bucketLabel: string;
  contexts: Array<{
    cardId: string;
    front: string;
    mediaSlug: string;
    mediaTitle: string;
    segmentTitle?: string;
  }>;
  createdAt: string;
  dueAt: string | null;
  dueLabel?: string;
  effectiveState: EffectiveReviewState["state"];
  effectiveStateLabel: string;
  exampleIt?: string;
  exampleJp?: string;
  entries: ReviewCardEntrySummary[];
  front: string;
  href: ReturnType<typeof mediaReviewCardHref>;
  id: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  orderIndex: number | null;
  pronunciations: ReviewCardPronunciation[];
  rawReviewLabel: string;
  reading?: string;
  gradePreviews: ReviewGradePreview[];
  reviewSeedState: ReviewSeedState;
  segmentTitle?: string;
  typeLabel: string;
};

export type ReviewQueueSnapshot = {
  cards: ReviewQueueCard[];
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  manualCount: number;
  newAvailableCount: number;
  newQueuedCount: number;
  queueLabel: string;
  queueCount: number;
  suspendedCount: number;
  upcomingCount: number;
};

export type ReviewOverviewSnapshot = {
  activeCards: number;
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  manualCount: number;
  newAvailableCount: number;
  newQueuedCount: number;
  nextCardFront?: string;
  queueCount: number;
  queueLabel: string;
  suspendedCount: number;
  totalCards: number;
  upcomingCount: number;
};

export type ReviewPageData = {
  scope: ReviewScope;
  media: {
    glossaryHref: ReturnType<typeof mediaGlossaryHref>;
    href: ReturnType<typeof mediaHref> | "/";
    reviewHref:
      | ReturnType<typeof mediaStudyHref>
      | ReturnType<typeof reviewHref>;
    slug: string;
    title: string;
  };
  settings: {
    reviewFrontFurigana: boolean;
  };
  queue: ReviewQueueSnapshot & {
    introLabel: string;
    manualCards: ReviewQueueCard[];
    suspendedCards: ReviewQueueCard[];
    upcomingCards: ReviewQueueCard[];
  };
  selectedCard: ReviewQueueCard | null;
  selectedCardContext: {
    bucket: ReviewQueueCard["bucket"] | null;
    gradePreviews: ReviewGradePreview[];
    isQueueCard: boolean;
    position: number | null;
    remainingCount: number;
    showAnswer: boolean;
  };
  session: {
    answeredCount: number;
    extraNewCount: number;
    notice?: string;
  };
};

export type GlobalReviewPageLoadResult =
  | { kind: "empty-media" }
  | { kind: "empty-cards" }
  | { kind: "ready"; data: ReviewPageData };
export type {
  ReviewGradePreview,
  ReviewSeedState
} from "./review-grade-previews";

export type ReviewCardDetailData = {
  card: {
    back: string;
    bucketLabel?: string;
    dueLabel?: string;
    exampleIt?: string;
    exampleJp?: string;
    front: string;
    id: string;
    notes?: string;
    reading?: string;
    reviewLabel: string;
    segmentTitle?: string;
    typeLabel: string;
  };
  crossMedia: Array<{
    entryId: string;
    kind: ReviewCardEntryKind;
    label: string;
    meaning: string;
    relationshipLabel: string;
    siblings: Array<{
      href: ReturnType<typeof mediaGlossaryEntryHref>;
      label: string;
      meaning: string;
      mediaSlug: string;
      mediaTitle: string;
      notes?: string;
      reading?: string;
      subtitle?: string;
    }>;
  }>;
  entries: ReviewCardEntrySummary[];
  pronunciations: ReviewCardPronunciation[];
  media: {
    glossaryHref: ReturnType<typeof mediaGlossaryHref>;
    href: ReturnType<typeof mediaHref>;
    reviewHref: ReturnType<typeof mediaStudyHref>;
    slug: string;
    title: string;
  };
};

type ReviewPageWorkspace = ReviewPageData["media"];
type ResolvedReviewQueueState = {
  bucket: ReviewQueueCard["bucket"];
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  rawReviewLabel: string;
  reviewSeedState: ReviewQueueCard["reviewSeedState"];
};

type ReviewQueueSubjectModel = {
  globalCard: ReviewCardListItem;
  group: ReviewSubjectGroup;
  resolvedState: ResolvedReviewQueueState;
};

type ReviewQueueSubjectSnapshot = {
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  introLabel: string;
  manualCount: number;
  manualModels: ReviewQueueSubjectModel[];
  newAvailableCount: number;
  newQueuedCount: number;
  queueCount: number;
  queueModels: ReviewQueueSubjectModel[];
  suspendedCount: number;
  suspendedModels: ReviewQueueSubjectModel[];
  upcomingCount: number;
  upcomingModels: ReviewQueueSubjectModel[];
};

type ReviewQueueCardMapInput = {
  contextCache?: Map<string, ReviewQueueCard["contexts"]>;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  selectedCardId?: string | null;
  visibleMediaId?: string;
};

type ReviewOverviewSubjectModel = {
  card: ReviewCardListItem;
  group: ReviewSubjectGroup;
  overviewCard: ReviewOverviewCard;
};

type LoadedGlobalReviewPageWorkspace = {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  grammar: ReviewGrammarLookupEntry[];
  mediaRows: MediaListItem[];
  newIntroducedTodayCount: number;
  now: Date;
  rawCardCount: number;
  reviewFrontFurigana: boolean;
  searchState: ReviewSearchState;
  terms: ReviewTermLookupEntry[];
};

async function buildReviewPageDataFromWorkspace(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  database: DatabaseClient;
  grammar: ReviewGrammarLookupEntry[];
  media: ReviewPageWorkspace;
  mediaById: ReviewMediaLookup;
  newIntroducedTodayCount: number;
  now: Date;
  reviewFrontFurigana: boolean;
  scope: ReviewScope;
  searchState: ReviewSearchState;
  terms: ReviewTermLookupEntry[];
  visibleMediaId?: string;
}) {
  const nowIso = input.now.toISOString();
  const mediaById = input.mediaById;

  const { subjectStates } = await loadReviewSubjectStateLookup({
    cards: input.cards,
    database: input.database,
    grammar: input.grammar,
    nowIso,
    terms: input.terms
  });
  const entryLookup = buildEntryLookup(input.terms, input.grammar);
  const subjectEntryLookup = buildReviewSubjectEntryLookup({
    grammar: input.grammar,
    terms: input.terms
  });
  const subjectGroups = groupReviewCardsBySubject({
    cards: input.cards,
    entryLookup: subjectEntryLookup,
    nowIso,
    subjectStates
  });
  const queueSnapshot = buildReviewQueueSubjectSnapshot({
    cards: input.cards,
    dailyLimit: input.dailyLimit,
    entryLookup,
    extraNewCount: input.searchState.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount,
    nowIso,
    subjectGroups,
    visibleMediaId: input.visibleMediaId
  });
  const queueCardMapInput: ReviewQueueCardMapInput = {
    contextCache: new Map(),
    entryLookup,
    mediaById,
    nowIso,
    visibleMediaId: input.visibleMediaId
  };
  const allQueueModels = [
    ...queueSnapshot.queueModels,
    ...queueSnapshot.manualModels,
    ...queueSnapshot.suspendedModels,
    ...queueSnapshot.upcomingModels
  ];
  const explicitSelection = input.searchState.selectedCardId
    ? (() => {
        const selectedModel = findReviewQueueSubjectModelByCardId(
          allQueueModels,
          input.searchState.selectedCardId
        );

        return selectedModel
          ? mapReviewQueueSubjectModel(selectedModel, {
              ...queueCardMapInput,
              selectedCardId: input.searchState.selectedCardId
            })
          : null;
      })()
    : null;
  const fallbackSelection =
    input.searchState.selectedCardId && explicitSelection === null
      ? buildExplicitReviewSelection({
          cardId: input.searchState.selectedCardId,
          contextCache: queueCardMapInput.contextCache,
          entryLookup,
          mediaById,
          nowIso,
          subjectModels: buildReviewQueueSubjectModels({
            cards: input.cards,
            entryLookup,
            nowIso,
            subjectGroups
          })
        })
      : null;
  const selectedCardBase =
    explicitSelection ??
    fallbackSelection ??
    (queueSnapshot.queueModels[0]
      ? mapReviewQueueSubjectModel(
          queueSnapshot.queueModels[0],
          queueCardMapInput
        )
      : null);
  const selectedRawCard = selectedCardBase
    ? input.cards.find((card) => card.id === selectedCardBase.id) ?? null
    : null;
  const selectedCard =
    selectedCardBase && selectedRawCard
      ? {
          ...selectedCardBase,
          pronunciations: await loadReviewCardPronunciations({
            card: selectedRawCard,
            database: input.database,
            entryLookup
          })
        }
      : selectedCardBase;
  const selectedQueueModel = selectedCard
    ? findReviewQueueSubjectModelByCardId(
        queueSnapshot.queueModels,
        selectedCard.id
      )
    : null;
  const queueIndex = selectedQueueModel
    ? queueSnapshot.queueModels.indexOf(selectedQueueModel)
    : -1;
  const selectedGradePreviews = selectedCard
    ? buildReviewGradePreviews(selectedCard.reviewSeedState, input.now)
    : [];

  return {
    scope: input.scope,
    media: input.media,
    settings: {
      reviewFrontFurigana: input.reviewFrontFurigana
    },
    queue: {
      cards: [],
      dailyLimit: queueSnapshot.dailyLimit,
      dueCount: queueSnapshot.dueCount,
      effectiveDailyLimit: queueSnapshot.effectiveDailyLimit,
      introLabel: queueSnapshot.introLabel,
      manualCards: [],
      manualCount: queueSnapshot.manualCount,
      newAvailableCount: queueSnapshot.newAvailableCount,
      newQueuedCount: queueSnapshot.newQueuedCount,
      queueCount: queueSnapshot.queueCount,
      queueLabel: queueSnapshot.introLabel,
      suspendedCards: [],
      suspendedCount: queueSnapshot.suspendedCount,
      upcomingCards: [],
      upcomingCount: queueSnapshot.upcomingCount
    },
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard?.bucket ?? null,
      gradePreviews: selectedGradePreviews,
      isQueueCard: queueIndex >= 0,
      position: queueIndex >= 0 ? queueIndex + 1 : null,
      remainingCount:
        queueIndex >= 0 ? queueSnapshot.queueCount - queueIndex - 1 : 0,
      showAnswer: input.searchState.showAnswer || queueIndex < 0
    },
    session: {
      answeredCount: input.searchState.answeredCount,
      extraNewCount: input.searchState.extraNewCount,
      notice: resolveReviewNotice(input.searchState.noticeCode)
    }
  } satisfies ReviewPageData;
}

export async function getReviewPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<ReviewPageData | null> {
  markDataAsLive();
  const now = new Date();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const mediaIds = [media.id];
  const searchState = normalizeReviewSearchState(searchParams);
  const [
    eligibleCards,
    terms,
    grammar,
    dailyLimit,
    newIntroducedTodayCount,
    reviewFrontFurigana
  ] = await Promise.all([
    getEligibleReviewCardsByMediaIds(mediaIds, database),
    listTermEntryReviewSummaries(database, {
      mediaIds
    }),
    listGrammarEntryReviewSummaries(database, {
      mediaIds
    }),
    getReviewDailyLimit(database),
    countReviewSubjectsIntroducedOnDay(database, now),
    getReviewFrontFuriganaSetting(database)
  ]);
  return buildReviewPageDataFromWorkspace({
    cards: [...eligibleCards.values()].flat(),
    dailyLimit,
    database,
    grammar,
    media: {
      glossaryHref: mediaGlossaryHref(media.slug),
      href: mediaHref(media.slug),
      reviewHref: mediaStudyHref(media.slug, "review"),
      slug: media.slug,
      title: media.title
    },
    mediaById: buildSingleMediaLookup(media),
    newIntroducedTodayCount,
    now,
    reviewFrontFurigana,
    scope: "media",
    searchState,
    terms,
    visibleMediaId: media.id
  });
}

async function loadGlobalReviewPageWorkspace(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<LoadedGlobalReviewPageWorkspace> {
  markDataAsLive();
  const now = new Date();
  const mediaRows = await listMedia(database);
  const mediaIds = mediaRows.map((item) => item.id);
  const searchState = normalizeReviewSearchState(searchParams);
  const [
    reviewCards,
    dailyLimit,
    newIntroducedTodayCount,
    reviewFrontFurigana
  ] = await Promise.all([
    listReviewCardsByMediaIds(database, mediaIds),
    getReviewDailyLimit(database),
    countReviewSubjectsIntroducedOnDay(database, now),
    getReviewFrontFuriganaSetting(database)
  ]);

  if (mediaIds.length === 0 || reviewCards.length === 0) {
    return {
      cards: [],
      dailyLimit,
      grammar: [],
      mediaRows,
      newIntroducedTodayCount,
      now,
      rawCardCount: reviewCards.length,
      reviewFrontFurigana,
      searchState,
      terms: []
    };
  }

  const [lessonLinkedEntries, terms, grammar] = await Promise.all([
    listLessonLinkedReviewEntriesByMediaIds(database, mediaIds),
    listTermEntryReviewSummaries(database, { mediaIds }),
    listGrammarEntryReviewSummaries(database, { mediaIds })
  ]);
  const eligibleCards = buildEligibleReviewCardsByMedia({
    cards: reviewCards,
    lessonLinkedEntries,
    mediaIds
  });

  return {
    cards: [...eligibleCards.values()].flat(),
    dailyLimit,
    grammar,
    mediaRows,
    newIntroducedTodayCount,
    now,
    rawCardCount: reviewCards.length,
    reviewFrontFurigana,
    searchState,
    terms
  };
}

async function buildGlobalReviewPageData(
  input: LoadedGlobalReviewPageWorkspace,
  database: DatabaseClient = db
) {
  return buildReviewPageDataFromWorkspace({
    cards: input.cards,
    dailyLimit: input.dailyLimit,
    grammar: input.grammar,
    database,
    media: {
      glossaryHref: "/glossary",
      href: "/",
      reviewHref: "/review",
      slug: "global-review",
      title: "Review globale"
    },
    mediaById: buildReviewMediaLookup(input.mediaRows),
    newIntroducedTodayCount: input.newIntroducedTodayCount,
    now: input.now,
    reviewFrontFurigana: input.reviewFrontFurigana,
    scope: "global",
    searchState: input.searchState,
    terms: input.terms
  });
}

export async function getGlobalReviewPageLoadResult(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalReviewPageLoadResult> {
  const workspace = await loadGlobalReviewPageWorkspace(searchParams, database);

  if (workspace.mediaRows.length === 0) {
    return {
      kind: "empty-media"
    };
  }

  if (workspace.rawCardCount === 0) {
    return {
      kind: "empty-cards"
    };
  }

  return {
    kind: "ready",
    data: await buildGlobalReviewPageData(workspace, database)
  };
}

export async function getGlobalReviewPageData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<ReviewPageData> {
  const workspace = await loadGlobalReviewPageWorkspace(searchParams, database);

  return buildGlobalReviewPageData(workspace, database);
}

export async function getReviewQueueSnapshotForMedia(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<ReviewQueueSnapshot | null> {
  markDataAsLive();
  const now = new Date();
  const nowIso = now.toISOString();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const mediaIds = [media.id];
  const [eligibleCards, terms, grammar, dailyLimit, newIntroducedTodayCount] =
    await Promise.all([
      getEligibleReviewCardsByMediaIds(mediaIds, database),
      listTermEntryReviewSummaries(database, { mediaIds }),
      listGrammarEntryReviewSummaries(database, { mediaIds }),
      getReviewDailyLimit(database),
      countReviewSubjectsIntroducedOnDay(database, now)
    ]);
  const cards = [...eligibleCards.values()].flat();
  const { subjectStates } = await loadReviewSubjectStateLookup({
    cards,
    database,
    grammar,
    nowIso,
    terms
  });
  const entryLookup = buildEntryLookup(terms, grammar);
  const subjectEntryLookup = buildReviewSubjectEntryLookup({
    grammar,
    terms
  });
  const subjectGroups = groupReviewCardsBySubject({
    cards,
    entryLookup: subjectEntryLookup,
    nowIso,
    subjectStates
  });
  const snapshot = buildReviewQueueSnapshot({
    cards,
    dailyLimit,
    entryLookup,
    extraNewCount: 0,
    mediaById: buildSingleMediaLookup(media),
    newIntroducedTodayCount,
    nowIso,
    subjectGroups,
    visibleMediaId: media.id
  });

  return {
    cards: snapshot.cards,
    dailyLimit: snapshot.dailyLimit,
    dueCount: snapshot.dueCount,
    effectiveDailyLimit: snapshot.effectiveDailyLimit,
    manualCount: snapshot.manualCount,
    newAvailableCount: snapshot.newAvailableCount,
    newQueuedCount: snapshot.newQueuedCount,
    queueLabel: snapshot.introLabel,
    queueCount: snapshot.queueCount,
    suspendedCount: snapshot.suspendedCount,
    upcomingCount: snapshot.upcomingCount
  };
}

export async function getEligibleReviewCardsByMediaIds(
  mediaIds: string[],
  database: DatabaseClient = db
) {
  if (mediaIds.length === 0) {
    return new Map<string, ReviewCardListItem[]>();
  }

  const [cards, lessonLinkedEntries] = await Promise.all([
    listReviewCardsByMediaIds(database, mediaIds),
    listLessonLinkedReviewEntriesByMediaIds(database, mediaIds)
  ]);

  return buildEligibleReviewCardsByMedia({
    cards,
    lessonLinkedEntries,
    mediaIds
  });
}

export async function getReviewLaunchMedia(
  database: DatabaseClient = db
): Promise<{
  slug: string;
  title: string;
} | null> {
  markDataAsLive();

  const candidates = await listReviewLaunchCandidates(database);

  return (
    [...candidates].sort((left, right) => {
      const scoreDifference =
        scoreReviewLaunchCandidate(left) - scoreReviewLaunchCandidate(right);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      if (left.dueCount !== right.dueCount) {
        return right.dueCount - left.dueCount;
      }

      if (left.activeReviewCards !== right.activeReviewCards) {
        return right.activeReviewCards - left.activeReviewCards;
      }

      if (left.cardsTotal !== right.cardsTotal) {
        return right.cardsTotal - left.cardsTotal;
      }

      return left.title.localeCompare(right.title, "it");
    })[0] ?? null
  );
}

export async function getReviewCardDetailData(
  mediaSlug: string,
  cardId: string,
  database: DatabaseClient = db
): Promise<ReviewCardDetailData | null> {
  markDataAsLive();
  const nowIso = new Date().toISOString();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const [cards, terms, grammar] = await Promise.all([
    getEligibleReviewCardsByMediaId(media.id, database),
    listTermEntriesByMediaId(database, media.id),
    listGrammarEntriesByMediaId(database, media.id)
  ]);
  const entryLookup = buildEntryLookup(terms, grammar);
  const selectedCard = cards
    .map((card) =>
      mapQueueCard(
        card,
        entryLookup,
        [card],
        new Map([[media.id, { slug: media.slug, title: media.title }]]),
        nowIso
      )
    )
    .find((card) => card.id === cardId);
  const selectedRawCard = cards.find((card) => card.id === cardId) ?? null;

  if (!selectedCard || !selectedRawCard) {
    return null;
  }

  const termById = new Map(terms.map((entry) => [entry.id, entry]));
  const grammarById = new Map(grammar.map((entry) => [entry.id, entry]));
  const crossMedia = await Promise.all(
    getDrivingEntryLinks(selectedRawCard.entryLinks).map(async (link) => {
      const localEntry =
        link.entryType === "term"
          ? termById.get(link.entryId)
          : grammarById.get(link.entryId);

      if (!localEntry) {
        return null;
      }

      const family =
        link.entryType === "term"
          ? await getTermCrossMediaFamilyByEntryId(database, link.entryId)
          : await getGrammarCrossMediaFamilyByEntryId(database, link.entryId);

      if (family.siblings.length === 0) {
        return null;
      }

      return {
        entryId: localEntry.sourceId,
        kind: link.entryType,
        label:
          link.entryType === "term"
            ? (localEntry as TermGlossaryEntry).lemma
            : (localEntry as GrammarGlossaryEntry).pattern,
        meaning: localEntry.meaningIt,
        relationshipLabel: formatCardRelationshipLabel(link.relationshipType),
        siblings:
          link.entryType === "term"
            ? (family.siblings as CrossMediaTermSibling[]).map(
                mapReviewCrossMediaTermSibling
              )
            : (family.siblings as CrossMediaGrammarSibling[]).map(
                mapReviewCrossMediaGrammarSibling
              )
      };
    })
  );
  const pronunciations = buildReviewCardPronunciations(
    selectedRawCard.entryLinks,
    entryLookup
  );

  return {
    card: {
      back: selectedCard.back,
      bucketLabel:
        selectedCard.bucket === "upcoming"
          ? undefined
          : selectedCard.bucketLabel,
      dueLabel: selectedCard.dueLabel,
      exampleIt: selectedCard.exampleIt,
      exampleJp: selectedCard.exampleJp,
      front: selectedCard.front,
      id: selectedCard.id,
      notes: selectedCard.notes,
      reading: selectedCard.reading,
      reviewLabel: selectedCard.effectiveStateLabel,
      segmentTitle: selectedCard.segmentTitle,
      typeLabel: selectedCard.typeLabel
    },
    crossMedia: crossMedia.filter(
      (value): value is NonNullable<(typeof crossMedia)[number]> =>
        value !== null
    ),
    entries: selectedCard.entries,
    pronunciations,
    media: {
      glossaryHref: mediaGlossaryHref(media.slug),
      href: mediaHref(media.slug),
      reviewHref: mediaStudyHref(media.slug, "review"),
      slug: media.slug,
      title: media.title
    }
  };
}

export async function getEligibleReviewCardsByMediaId(
  mediaId: string,
  database: DatabaseClient = db
): Promise<ReviewCardListItem[]> {
  const [cards, lessonLinkedEntries] = await Promise.all([
    listReviewCardsByMediaId(database, mediaId),
    listLessonLinkedReviewEntriesByMediaId(database, mediaId)
  ]);

  return filterReviewCardsByLessonCompletion(cards, lessonLinkedEntries);
}

export async function loadReviewOverviewSnapshots(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>
) {
  if (media.length === 0) {
    return new Map<string, ReviewOverviewSnapshot>();
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const mediaIds = media.map((item) => item.id);
  const [eligibleCards, terms, grammar, dailyLimit, introducedTodayCount] =
    await Promise.all([
      getEligibleReviewCardsByMediaIds(mediaIds, database),
      listTermEntryReviewSummaries(database, {
        mediaIds
      }),
      listGrammarEntryReviewSummaries(database, {
        mediaIds
      }),
      getReviewDailyLimit(database),
      countReviewSubjectsIntroducedOnDay(database, now)
    ]);
  const allCards = [...eligibleCards.values()].flat();
  const { subjectStates } = await loadReviewSubjectStateLookup({
    cards: allCards,
    database,
    grammar,
    nowIso,
    terms
  });
  const snapshots = new Map<string, ReviewOverviewSnapshot>();
  const entryLookup = buildReviewSubjectEntryLookup({
    grammar,
    terms
  });
  const entryStatuses = buildReviewEntryStatusLookup({
    grammar,
    terms
  });

  for (const item of media) {
    snapshots.set(
      item.id,
      buildReviewOverviewSnapshot({
        cards: allCards,
        dailyLimit,
        entryLookup,
        entryStatuses,
        extraNewCount: 0,
        newIntroducedTodayCount: introducedTodayCount,
        nowIso,
        subjectStates,
        visibleMediaId: item.id
      })
    );
  }

  return snapshots;
}

export async function loadGlobalReviewOverviewSnapshot(
  database: DatabaseClient = db
) {
  const media = await listMedia(database);

  if (media.length === 0) {
    return buildReviewOverviewSnapshot({
      cards: [],
      dailyLimit: 0,
      entryLookup: new Map(),
      entryStatuses: new Map(),
      extraNewCount: 0,
      newIntroducedTodayCount: 0,
      nowIso: new Date().toISOString(),
      subjectStates: new Map()
    });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const mediaIds = media.map((item) => item.id);
  const [eligibleCards, terms, grammar, dailyLimit, introducedTodayCount] =
    await Promise.all([
      getEligibleReviewCardsByMediaIds(mediaIds, database),
      listTermEntryReviewSummaries(database, { mediaIds }),
      listGrammarEntryReviewSummaries(database, { mediaIds }),
      getReviewDailyLimit(database),
      countReviewSubjectsIntroducedOnDay(database, now)
    ]);
  const cards = [...eligibleCards.values()].flat();
  const { subjectStates } = await loadReviewSubjectStateLookup({
    cards,
    database,
    grammar,
    nowIso,
    terms
  });
  const entryLookup = buildReviewSubjectEntryLookup({
    grammar,
    terms
  });

  return buildReviewOverviewSnapshot({
    cards,
    dailyLimit,
    entryLookup,
    entryStatuses: buildReviewEntryStatusLookup({
      grammar,
      terms
    }),
    extraNewCount: 0,
    newIntroducedTodayCount: introducedTodayCount,
    nowIso,
    subjectStates
  });
}

export function buildReviewEntryStatusLookup(input: {
  grammar: Array<{
    entryStatus: ReviewEntryStatusValue;
    id: string;
  }>;
  terms: Array<{
    entryStatus: ReviewEntryStatusValue;
    id: string;
  }>;
}) {
  const statuses = new Map<string, ReviewEntryStatusValue>();

  for (const entry of input.terms) {
    statuses.set(`term:${entry.id}`, entry.entryStatus);
  }

  for (const entry of input.grammar) {
    statuses.set(`grammar:${entry.id}`, entry.entryStatus);
  }

  return statuses;
}

function isReviewSubjectVisibleInMedia(
  group: ReviewSubjectGroup,
  visibleMediaId?: string
) {
  return (
    !visibleMediaId ||
    group.cards.some((card) => card.mediaId === visibleMediaId)
  );
}

function filterReviewSubjectModelsByMedia<
  T extends { group: ReviewSubjectGroup }
>(models: T[], visibleMediaId?: string) {
  return models.filter((model) =>
    isReviewSubjectVisibleInMedia(model.group, visibleMediaId)
  );
}

function getReviewBucketPriority(bucket: ReviewQueueCard["bucket"]) {
  const priorities: Record<ReviewQueueCard["bucket"], number> = {
    due: 0,
    new: 1,
    upcoming: 2,
    manual: 3,
    suspended: 4
  };

  return priorities[bucket];
}

function resolveReviewQueueState(
  card: ReviewCardListItem,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  nowIso: string
): ResolvedReviewQueueState {
  const drivingEntryStatuses = getDrivingEntryLinks(card.entryLinks).map(
    (entryLink) =>
      (entryLookup.get(`${entryLink.entryType}:${entryLink.entryId}`)?.status ??
        null) as ReviewEntryStatusValue
  );
  const effectiveState = resolveEffectiveReviewState({
    cardStatus: card.status,
    drivingEntryStatuses,
    reviewState: card.reviewState
      ? {
          manualOverride: card.reviewState.manualOverride,
          state: card.reviewState.state as ReviewState
        }
      : null
  });
  const rawReviewLabel = formatReviewStateLabel(
    card.reviewState?.state ?? null,
    card.reviewState?.manualOverride ?? false
  );
  const dueAt = card.reviewState?.dueAt ?? null;

  return {
    bucket: resolveCardBucket({
      asOfIso: nowIso,
      dueAt,
      effectiveState: effectiveState.state,
      reviewState: (card.reviewState?.state as ReviewState | null) ?? null
    }),
    dueAt,
    effectiveState: effectiveState.state,
    rawReviewLabel,
    reviewSeedState: {
      difficulty: card.reviewState?.difficulty ?? null,
      dueAt: card.reviewState?.dueAt ?? null,
      lapses: card.reviewState?.lapses ?? 0,
      lastReviewedAt: card.reviewState?.lastReviewedAt ?? null,
      learningSteps: card.reviewState?.learningSteps ?? 0,
      reps: card.reviewState?.reps ?? 0,
      scheduledDays: card.reviewState?.scheduledDays ?? 0,
      stability: card.reviewState?.stability ?? null,
      state: (card.reviewState?.state as ReviewState | null) ?? null
    }
  };
}

function selectReviewQueueSubjectCard(input: {
  cards: ReviewCardListItem[];
  entryLookup: Map<string, ReviewEntryLookupItem>;
  nowIso: string;
  preferredMediaId?: string;
  subjectState: ReviewSubjectStateSnapshot | null;
}) {
  const preferredCards = input.preferredMediaId
    ? input.cards.filter((card) => card.mediaId === input.preferredMediaId)
    : [];
  const candidates = preferredCards.length > 0 ? preferredCards : input.cards;
  let bestPriority = Number.MAX_SAFE_INTEGER;
  let bestCards: ReviewCardListItem[] = [];

  for (const candidate of candidates) {
    const resolved = resolveReviewQueueState(
      applySubjectStateToReviewCard(candidate, input.subjectState),
      input.entryLookup,
      input.nowIso
    );
    const priority = getReviewBucketPriority(resolved.bucket);

    if (priority < bestPriority) {
      bestPriority = priority;
      bestCards = [candidate];
      continue;
    }

    if (priority === bestPriority) {
      bestCards.push(candidate);
    }
  }

  return selectReviewSubjectRepresentativeCard(
    bestCards.length > 0 ? bestCards : candidates,
    input.subjectState,
    input.nowIso
  );
}

function buildReviewQueueSubjectModels(input: {
  cards: ReviewCardListItem[];
  entryLookup: Map<string, ReviewEntryLookupItem>;
  nowIso: string;
  subjectGroups: ReviewSubjectGroup[];
}) {
  return input.subjectGroups.map((group) => {
    const globalCard = selectReviewQueueSubjectCard({
      cards: group.cards,
      entryLookup: input.entryLookup,
      nowIso: input.nowIso,
      subjectState: group.subjectState
    });

    return {
      globalCard,
      group,
      resolvedState: resolveReviewQueueState(
        applySubjectStateToReviewCard(globalCard, group.subjectState),
        input.entryLookup,
        input.nowIso
      )
    } satisfies ReviewQueueSubjectModel;
  });
}

function findReviewQueueSubjectModelByCardId(
  models: ReviewQueueSubjectModel[],
  cardId: string
) {
  return (
    models.find((model) =>
      model.group.cards.some((card) => card.id === cardId)
    ) ?? null
  );
}

function mapReviewQueueSubjectModel(
  model: ReviewQueueSubjectModel,
  input: ReviewQueueCardMapInput
) {
  const selectedCard =
    (input.selectedCardId
      ? model.group.cards.find((card) => card.id === input.selectedCardId)
      : null) ??
    selectReviewQueueSubjectCard({
      cards: model.group.cards,
      entryLookup: input.entryLookup,
      nowIso: input.nowIso,
      preferredMediaId: input.visibleMediaId,
      subjectState: model.group.subjectState
    });

  return mapQueueCard(
    applySubjectStateToReviewCard(selectedCard, model.group.subjectState),
    input.entryLookup,
    model.group.cards,
    input.mediaById,
    input.nowIso,
    model.resolvedState,
    resolveReviewQueueSubjectContexts(
      model.group,
      input.mediaById,
      input.contextCache
    )
  );
}

function compareReviewQueueSubjectModelsByDue(
  left: ReviewQueueSubjectModel,
  right: ReviewQueueSubjectModel
) {
  if ((left.resolvedState.dueAt ?? "") !== (right.resolvedState.dueAt ?? "")) {
    return (left.resolvedState.dueAt ?? "9999").localeCompare(
      right.resolvedState.dueAt ?? "9999"
    );
  }

  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  return compareReviewCardsByOrder(left.globalCard, right.globalCard);
}

function compareReviewQueueSubjectModelsByOrder(
  left: ReviewQueueSubjectModel,
  right: ReviewQueueSubjectModel
) {
  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  return compareReviewCardsByOrder(left.globalCard, right.globalCard);
}

function selectReviewOverviewSubjectCard(input: {
  cards: ReviewCardListItem[];
  entryStatuses: Map<string, ReviewEntryStatusValue>;
  nowIso: string;
  subjectState: ReviewSubjectStateSnapshot | null;
}) {
  let bestPriority = Number.MAX_SAFE_INTEGER;
  let bestCards: ReviewCardListItem[] = [];

  for (const candidate of input.cards) {
    const overviewCard = mapReviewOverviewCard(
      applySubjectStateToReviewCard(candidate, input.subjectState),
      input.entryStatuses,
      input.nowIso
    );
    const priority = getReviewBucketPriority(overviewCard.bucket);

    if (priority < bestPriority) {
      bestPriority = priority;
      bestCards = [candidate];
      continue;
    }

    if (priority === bestPriority) {
      bestCards.push(candidate);
    }
  }

  return selectReviewSubjectRepresentativeCard(
    bestCards.length > 0 ? bestCards : input.cards,
    input.subjectState,
    input.nowIso
  );
}

function buildReviewOverviewSubjectModels(input: {
  cards: ReviewCardListItem[];
  entryLookup: Map<string, ReviewSubjectEntryMeta>;
  entryStatuses: Map<string, ReviewEntryStatusValue>;
  nowIso: string;
  subjectStates: Map<string, ReviewSubjectStateSnapshot>;
}) {
  const subjectGroups = groupReviewCardsBySubject({
    cards: input.cards,
    entryLookup: input.entryLookup,
    nowIso: input.nowIso,
    subjectStates: input.subjectStates
  });

  return subjectGroups.map((group) => {
    const card = selectReviewOverviewSubjectCard({
      cards: group.cards,
      entryStatuses: input.entryStatuses,
      nowIso: input.nowIso,
      subjectState: group.subjectState
    });

    return {
      card,
      group,
      overviewCard: mapReviewOverviewCard(
        applySubjectStateToReviewCard(card, group.subjectState),
        input.entryStatuses,
        input.nowIso
      )
    } satisfies ReviewOverviewSubjectModel;
  });
}

function compareReviewOverviewSubjectModelsByDue(
  left: ReviewOverviewSubjectModel,
  right: ReviewOverviewSubjectModel
) {
  if ((left.overviewCard.dueAt ?? "") !== (right.overviewCard.dueAt ?? "")) {
    return (left.overviewCard.dueAt ?? "9999").localeCompare(
      right.overviewCard.dueAt ?? "9999"
    );
  }

  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  return compareReviewCardsByOrder(left.card, right.card);
}

function compareReviewOverviewSubjectModelsByOrder(
  left: ReviewOverviewSubjectModel,
  right: ReviewOverviewSubjectModel
) {
  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  return compareReviewCardsByOrder(left.card, right.card);
}

export function buildReviewOverviewSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewSubjectEntryMeta>;
  entryStatuses: Map<string, ReviewEntryStatusValue>;
  extraNewCount: number;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectStates: Map<string, ReviewSubjectStateSnapshot>;
  visibleMediaId?: string;
}): ReviewOverviewSnapshot {
  const models = buildReviewOverviewSubjectModels({
    cards: input.cards,
    entryLookup: input.entryLookup,
    entryStatuses: input.entryStatuses,
    nowIso: input.nowIso,
    subjectStates: input.subjectStates
  });
  const relevantModels = filterReviewSubjectModelsByMedia(
    models,
    input.visibleMediaId
  );
  const dueCards = relevantModels
    .filter((model) => model.overviewCard.bucket === "due")
    .sort(compareReviewOverviewSubjectModelsByDue)
    .map((model) => model.overviewCard);
  const globalNewCards = models
    .filter((model) => model.overviewCard.bucket === "new")
    .sort(compareReviewOverviewSubjectModelsByOrder);
  const newCards = globalNewCards
    .filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
    )
    .map((model) => model.overviewCard);
  const manualCards = relevantModels
    .filter((model) => model.overviewCard.bucket === "manual")
    .sort(compareReviewOverviewSubjectModelsByOrder)
    .map((model) => model.overviewCard);
  const suspendedCards = relevantModels
    .filter((model) => model.overviewCard.bucket === "suspended")
    .sort(compareReviewOverviewSubjectModelsByOrder)
    .map((model) => model.overviewCard);
  const upcomingCards = relevantModels
    .filter((model) => model.overviewCard.bucket === "upcoming")
    .sort(compareReviewOverviewSubjectModelsByDue)
    .map((model) => model.overviewCard);
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewCards = globalNewCards
    .slice(0, newSlots)
    .filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
    )
    .map((model) => model.overviewCard);
  const queueCards = [...dueCards, ...queuedNewCards];
  const queueLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: dueCards.length,
    manualCount: manualCards.length,
    newQueuedCount: queuedNewCards.length,
    upcomingCount: upcomingCards.length
  });
  const activeCards = dueCards.length + upcomingCards.length;

  return {
    activeCards,
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
    effectiveDailyLimit,
    manualCount: manualCards.length,
    newAvailableCount: newCards.length,
    newQueuedCount: queuedNewCards.length,
    nextCardFront: queueCards[0]?.front
      ? stripInlineMarkdown(queueCards[0].front)
      : undefined,
    queueCount: queueCards.length,
    queueLabel,
    suspendedCount: suspendedCards.length,
    totalCards: relevantModels.length,
    upcomingCount: upcomingCards.length
  };
}

function filterReviewCardsByLessonCompletion(
  cards: ReviewCardListItem[],
  lessonLinkedEntries: LessonLinkedReviewEntry[]
) {
  const linkedEntryKeys = new Set(
    lessonLinkedEntries.map((row) =>
      buildReviewEntryKey(row.entryType, row.entryId)
    )
  );
  const completedEntryKeys = new Set(
    lessonLinkedEntries
      .filter((row) => row.lessonStatus === "completed")
      .map((row) => buildReviewEntryKey(row.entryType, row.entryId))
  );

  return cards.filter((card) => {
    const drivingLinks = getDrivingEntryLinks(card.entryLinks);

    if (drivingLinks.length === 0) {
      return true;
    }

    const drivingEntryKeys = drivingLinks.map((link) =>
      buildReviewEntryKey(link.entryType, link.entryId)
    );
    const hasLessonLinkedPrimary = drivingEntryKeys.some((key) =>
      linkedEntryKeys.has(key)
    );

    if (!hasLessonLinkedPrimary) {
      return true;
    }

    return drivingEntryKeys.some((key) => completedEntryKeys.has(key));
  });
}

type ReviewOverviewCard = Pick<
  ReviewQueueCard,
  "bucket" | "createdAt" | "dueAt" | "front" | "id" | "orderIndex"
>;

function buildReviewEntryKey(entryType: string, entryId: string) {
  return `${entryType}:${entryId}`;
}

function mapReviewOverviewCard(
  card: ReviewCardListItem,
  entryStatuses: Map<string, ReviewEntryStatusValue>,
  nowIso: string
): ReviewOverviewCard {
  const drivingEntryStatuses = getDrivingEntryLinks(card.entryLinks).map(
    (entryLink) =>
      entryStatuses.get(`${entryLink.entryType}:${entryLink.entryId}`) ?? null
  );
  const effectiveState = resolveEffectiveReviewState({
    cardStatus: card.status,
    drivingEntryStatuses,
    reviewState: card.reviewState
      ? {
          manualOverride: card.reviewState.manualOverride,
          state: card.reviewState.state as ReviewState
        }
      : null
  });
  const dueAt = card.reviewState?.dueAt ?? null;

  return {
    bucket: resolveCardBucket({
      asOfIso: nowIso,
      dueAt,
      effectiveState: effectiveState.state,
      reviewState: (card.reviewState?.state as ReviewState | null) ?? null
    }),
    createdAt: card.createdAt,
    dueAt,
    front: card.front,
    id: card.id,
    orderIndex: card.orderIndex
  };
}

function scoreReviewLaunchCandidate(candidate: {
  activeReviewCards: number;
  cardsTotal: number;
  dueCount: number;
}) {
  if (candidate.dueCount > 0) {
    return 0;
  }

  if (candidate.activeReviewCards > 0) {
    return 1;
  }

  if (candidate.cardsTotal > 0) {
    return 2;
  }

  return 3;
}

function groupCardsByMedia(cards: ReviewCardListItem[]) {
  const grouped = new Map<string, ReviewCardListItem[]>();

  for (const card of cards) {
    const existing = grouped.get(card.mediaId);

    if (existing) {
      existing.push(card);
      continue;
    }

    grouped.set(card.mediaId, [card]);
  }

  return grouped;
}

function buildEligibleReviewCardsByMedia(input: {
  cards: ReviewCardListItem[];
  lessonLinkedEntries: Array<LessonLinkedReviewEntry & { mediaId: string }>;
  mediaIds: string[];
}) {
  const cardsByMedia = groupCardsByMedia(input.cards);
  const lessonLinkedEntriesByMedia = groupLessonLinkedReviewEntriesByMedia(
    input.lessonLinkedEntries
  );
  const eligibleCards = new Map<string, ReviewCardListItem[]>();

  for (const mediaId of input.mediaIds) {
    eligibleCards.set(
      mediaId,
      filterReviewCardsByLessonCompletion(
        cardsByMedia.get(mediaId) ?? [],
        lessonLinkedEntriesByMedia.get(mediaId) ?? []
      )
    );
  }

  return eligibleCards;
}

function buildReviewMediaLookup(media: MediaListItem[]) {
  return new Map(
    media.map((item) => [
      item.id,
      {
        slug: item.slug,
        title: item.title
      }
    ])
  );
}

function buildSingleMediaLookup(
  media: Pick<MediaListItem, "id" | "slug" | "title">
): ReviewMediaLookup {
  return new Map([
    [
      media.id,
      {
        slug: media.slug,
        title: media.title
      }
    ]
  ]);
}

function groupLessonLinkedReviewEntriesByMedia(
  rows: Array<LessonLinkedReviewEntry & { mediaId: string }>
) {
  const grouped = new Map<string, LessonLinkedReviewEntry[]>();

  for (const row of rows) {
    const existing = grouped.get(row.mediaId);

    if (existing) {
      existing.push(row);
      continue;
    }

    grouped.set(row.mediaId, [
      {
        entryId: row.entryId,
        entryType: row.entryType,
        lessonStatus: row.lessonStatus
      }
    ]);
  }

  return grouped;
}

function mapReviewCrossMediaTermSibling(sibling: CrossMediaTermSibling) {
  return {
    href: mediaGlossaryEntryHref(sibling.mediaSlug, "term", sibling.sourceId),
    label: sibling.lemma,
    meaning: sibling.meaningIt,
    mediaSlug: sibling.mediaSlug,
    mediaTitle: sibling.mediaTitle,
    notes: buildReviewCrossMediaNotesPreview(sibling.notesIt),
    reading: sibling.reading,
    subtitle:
      [sibling.reading, sibling.romaji].filter(Boolean).join(" / ") || undefined
  };
}

function mapReviewCrossMediaGrammarSibling(sibling: CrossMediaGrammarSibling) {
  return {
    href: mediaGlossaryEntryHref(
      sibling.mediaSlug,
      "grammar",
      sibling.sourceId
    ),
    label: sibling.pattern,
    meaning: sibling.meaningIt,
    mediaSlug: sibling.mediaSlug,
    mediaTitle: sibling.mediaTitle,
    notes: buildReviewCrossMediaNotesPreview(sibling.notesIt),
    reading: sibling.reading ?? undefined,
    subtitle: sibling.title !== sibling.pattern ? sibling.title : undefined
  };
}

function buildReviewCardPronunciations(
  entryLinks: ReviewEntryLinkLike[],
  entryLookup: Map<string, ReviewEntryLookupItem>
): ReviewCardPronunciation[] {
  return getDrivingEntryLinks(entryLinks)
    .slice()
    .sort(compareEntryLinks)
    .flatMap((link) => {
      const entry = entryLookup.get(`${link.entryType}:${link.entryId}`);

      if (!entry?.pronunciation) {
        return [];
      }

      return [
        {
          audio: entry.pronunciation,
          kind: entry.kind,
          label: entry.label,
          meaning: entry.meaning,
          relationshipLabel: formatCardRelationshipLabel(link.relationshipType)
        }
      ];
    });
}

async function loadReviewCardPronunciations(input: {
  card: Pick<ReviewCardListItem, "entryLinks">;
  database: DatabaseClient;
  entryLookup: Map<string, ReviewEntryLookupItem>;
}) {
  const drivingLinks = getDrivingEntryLinks(input.card.entryLinks);
  const missingTermIds = new Set<string>();
  const missingGrammarIds = new Set<string>();

  for (const link of drivingLinks) {
    const entry = input.entryLookup.get(`${link.entryType}:${link.entryId}`);

    if (entry?.pronunciation) {
      continue;
    }

    if (link.entryType === "term") {
      missingTermIds.add(link.entryId);
      continue;
    }

    missingGrammarIds.add(link.entryId);
  }

  if (missingTermIds.size === 0 && missingGrammarIds.size === 0) {
    return buildReviewCardPronunciations(input.card.entryLinks, input.entryLookup);
  }

  const [terms, grammar] = await Promise.all([
    getTermEntriesByIds(input.database, [...missingTermIds]),
    getGrammarEntriesByIds(input.database, [...missingGrammarIds])
  ]);
  const resolvedEntryLookup = new Map(input.entryLookup);

  for (const [key, value] of buildEntryLookup(terms, grammar)) {
    resolvedEntryLookup.set(key, value);
  }

  return buildReviewCardPronunciations(
    input.card.entryLinks,
    resolvedEntryLookup
  );
}

function buildReviewQueueSubjectSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  extraNewCount: number;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
}): ReviewQueueSubjectSnapshot {
  const subjectModels = buildReviewQueueSubjectModels({
    cards: input.cards,
    entryLookup: input.entryLookup,
    nowIso: input.nowIso,
    subjectGroups: input.subjectGroups
  });
  const relevantModels = filterReviewSubjectModelsByMedia(
    subjectModels,
    input.visibleMediaId
  );
  const dueCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "due")
    .sort(compareReviewQueueSubjectModelsByDue);
  const globalNewCards = subjectModels
    .filter((model) => model.resolvedState.bucket === "new")
    .sort(compareReviewQueueSubjectModelsByOrder);
  const newCards = globalNewCards.filter((model) =>
    isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
  );
  const manualCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "manual")
    .sort(compareReviewQueueSubjectModelsByOrder);
  const suspendedCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "suspended")
    .sort(compareReviewQueueSubjectModelsByOrder);
  const upcomingCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "upcoming")
    .sort(compareReviewQueueSubjectModelsByDue);
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewCards = globalNewCards
    .slice(0, newSlots)
    .filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
    );
  const queueModels = [...dueCards, ...queuedNewCards];
  const introLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: dueCards.length,
    manualCount: manualCards.length,
    newQueuedCount: queuedNewCards.length,
    upcomingCount: upcomingCards.length
  });

  return {
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
    effectiveDailyLimit,
    introLabel,
    manualCount: manualCards.length,
    manualModels: manualCards,
    newAvailableCount: newCards.length,
    newQueuedCount: queuedNewCards.length,
    queueCount: queueModels.length,
    queueModels,
    suspendedCount: suspendedCards.length,
    suspendedModels: suspendedCards,
    upcomingCount: upcomingCards.length,
    upcomingModels: upcomingCards
  };
}

function buildReviewQueueSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  extraNewCount: number;
  mediaById: ReviewMediaLookup;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
}) {
  const snapshot = buildReviewQueueSubjectSnapshot({
    cards: input.cards,
    dailyLimit: input.dailyLimit,
    entryLookup: input.entryLookup,
    extraNewCount: input.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount,
    nowIso: input.nowIso,
    subjectGroups: input.subjectGroups,
    visibleMediaId: input.visibleMediaId
  });
  const mapInput: ReviewQueueCardMapInput = {
    contextCache: new Map(),
    entryLookup: input.entryLookup,
    mediaById: input.mediaById,
    nowIso: input.nowIso,
    visibleMediaId: input.visibleMediaId
  };

  return {
    cards: snapshot.queueModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    dailyLimit: snapshot.dailyLimit,
    dueCount: snapshot.dueCount,
    effectiveDailyLimit: snapshot.effectiveDailyLimit,
    introLabel: snapshot.introLabel,
    manualCards: snapshot.manualModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    manualCount: snapshot.manualCount,
    newAvailableCount: snapshot.newAvailableCount,
    newQueuedCount: snapshot.newQueuedCount,
    queueLabel: snapshot.introLabel,
    queueCount: snapshot.queueCount,
    suspendedCards: snapshot.suspendedModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    suspendedCount: snapshot.suspendedCount,
    upcomingCards: snapshot.upcomingModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    upcomingCount: snapshot.upcomingCount
  };
}

function buildEntryLookup(
  terms: ReviewTermLookupEntry[],
  grammar: ReviewGrammarLookupEntry[]
) {
  const lookup = new Map<string, ReviewEntryLookupItem>();

  for (const entry of terms) {
    const mediaSlug = getEntryMediaSlug(entry);

    lookup.set(`term:${entry.id}`, {
      href: mediaGlossaryEntryHref(mediaSlug, "term", entry.sourceId),
      id: entry.sourceId,
      kind: "term",
      label: entry.lemma,
      meaning: entry.meaningIt,
      pronunciation: buildReviewEntryPronunciation(
        mediaSlug,
        entry,
        entry.reading
      ),
      reading: entry.reading,
      status: getReviewEntryStatus(entry),
      subtitle:
        [entry.reading, entry.romaji].filter(Boolean).join(" / ") || undefined
    });
  }

  for (const entry of grammar) {
    const mediaSlug = getEntryMediaSlug(entry);

    lookup.set(`grammar:${entry.id}`, {
      href: mediaGlossaryEntryHref(mediaSlug, "grammar", entry.sourceId),
      id: entry.sourceId,
      kind: "grammar",
      label: entry.pattern,
      meaning: entry.meaningIt,
      pronunciation: buildReviewEntryPronunciation(
        mediaSlug,
        entry,
        entry.reading ?? entry.pattern
      ),
      reading: entry.reading ?? deriveKanaReading(entry.pattern),
      status: getReviewEntryStatus(entry),
      subtitle: entry.title !== entry.pattern ? entry.title : undefined
    });
  }

  return lookup;
}

function buildReviewEntryPronunciation(
  mediaSlug: string,
  entry: ReviewTermLookupEntry | ReviewGrammarLookupEntry,
  reading: string | null | undefined
) {
  if (!("audioSrc" in entry || "pitchAccent" in entry)) {
    return undefined;
  }

  const pronunciationSource = entry as Record<string, unknown>;

  return (
    buildPronunciationData(mediaSlug, {
      audioAttribution: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioAttribution"
      ),
      audioLicense: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioLicense"
      ),
      audioPageUrl: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioPageUrl"
      ),
      audioSource: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioSource"
      ),
      audioSpeaker: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioSpeaker"
      ),
      audioSrc: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioSrc"
      ),
      pitchAccent: getOptionalPronunciationNumberField(
        pronunciationSource,
        "pitchAccent"
      ),
      pitchAccentPageUrl: getOptionalPronunciationStringField(
        pronunciationSource,
        "pitchAccentPageUrl"
      ),
      pitchAccentSource: getOptionalPronunciationStringField(
        pronunciationSource,
        "pitchAccentSource"
      ),
      reading
    }) ?? undefined
  );
}

function getOptionalPronunciationStringField(
  entry: Record<string, unknown>,
  key:
    | "audioAttribution"
    | "audioLicense"
    | "audioPageUrl"
    | "audioSource"
    | "audioSpeaker"
    | "audioSrc"
    | "pitchAccentPageUrl"
    | "pitchAccentSource"
) {
  const value = entry[key];

  return typeof value === "string" || value === null ? value : undefined;
}

function getOptionalPronunciationNumberField(
  entry: Record<string, unknown>,
  key: "pitchAccent"
) {
  const value = entry[key];

  return typeof value === "number" || value === null ? value : undefined;
}

function getEntryMediaSlug(
  entry: ReviewTermLookupEntry | ReviewGrammarLookupEntry
) {
  if ("mediaSlug" in entry) {
    return entry.mediaSlug;
  }

  return entry.media.slug;
}

function resolveReviewCardMedia(
  card: ReviewCardListItem,
  mediaById: ReviewMediaLookup
) {
  return (
    mediaById.get(card.mediaId) ?? {
      slug: "unknown-media",
      title: "Media"
    }
  );
}

function buildReviewCardContexts(
  cards: ReviewCardListItem[],
  mediaById: ReviewMediaLookup
) {
  return cards
    .map((item) => {
      const media = resolveReviewCardMedia(item, mediaById);

      return {
        cardId: item.id,
        front: stripInlineMarkdown(item.front),
        mediaSlug: media.slug,
        mediaTitle: media.title,
        segmentTitle: item.segment?.title ?? undefined
      };
    })
    .sort((left, right) => {
      if (left.mediaTitle !== right.mediaTitle) {
        return left.mediaTitle.localeCompare(right.mediaTitle, "it");
      }

      if ((left.segmentTitle ?? "") !== (right.segmentTitle ?? "")) {
        return (left.segmentTitle ?? "").localeCompare(
          right.segmentTitle ?? "",
          "it"
        );
      }

      return left.front.localeCompare(right.front, "it");
    });
}

function resolveReviewQueueSubjectContexts(
  group: ReviewSubjectGroup,
  mediaById: ReviewMediaLookup,
  contextCache?: Map<string, ReviewQueueCard["contexts"]>
) {
  const cached = contextCache?.get(group.identity.subjectKey);

  if (cached) {
    return cached;
  }

  const contexts = buildReviewCardContexts(group.cards, mediaById);

  contextCache?.set(group.identity.subjectKey, contexts);

  return contexts;
}

function buildExplicitReviewSelection(input: {
  cardId: string;
  contextCache?: Map<string, ReviewQueueCard["contexts"]>;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  subjectModels: ReviewQueueSubjectModel[];
}) {
  const matchingModel = input.subjectModels.find((model) =>
    model.group.cards.some((card) => card.id === input.cardId)
  );

  if (!matchingModel) {
    return null;
  }

  const selectedMember =
    matchingModel.group.cards.find((card) => card.id === input.cardId) ??
    matchingModel.globalCard;

  return mapQueueCard(
    applySubjectStateToReviewCard(
      selectedMember,
      matchingModel.group.subjectState
    ),
    input.entryLookup,
    matchingModel.group.cards,
    input.mediaById,
    input.nowIso,
    matchingModel.resolvedState,
    resolveReviewQueueSubjectContexts(
      matchingModel.group,
      input.mediaById,
      input.contextCache
    )
  );
}

function buildReviewCrossMediaNotesPreview(notes?: string | null) {
  if (!notes) {
    return undefined;
  }

  const plainText = notes
    .replace(/[`*_~[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length === 0) {
    return undefined;
  }

  if (plainText.length <= 160) {
    return plainText;
  }

  return `${plainText.slice(0, 157).trimEnd()}...`;
}

function mapQueueCard(
  card: ReviewCardListItem,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  subjectCards: ReviewCardListItem[],
  mediaById: ReviewMediaLookup,
  nowIso: string,
  resolvedState?: ResolvedReviewQueueState,
  contexts?: ReviewQueueCard["contexts"]
): ReviewQueueCard {
  const cardMedia = resolveReviewCardMedia(card, mediaById);
  const entries = card.entryLinks
    .slice()
    .sort(compareEntryLinks)
    .flatMap((link) => {
      const entry = entryLookup.get(`${link.entryType}:${link.entryId}`);

      if (!entry) {
        return [];
      }

      return [
        {
          href: entry.href,
          id: entry.id,
          kind: entry.kind,
          label: entry.label,
          meaning: entry.meaning,
          relationshipLabel: formatCardRelationshipLabel(link.relationshipType),
          statusLabel: formatEntryStatusLabel(entry.status),
          subtitle: entry.subtitle
        } satisfies ReviewCardEntrySummary
      ];
    });
  const resolved =
    resolvedState ??
    resolveReviewQueueState(
      applySubjectStateToReviewCard(card, null),
      entryLookup,
      nowIso
    );
  const pronunciations = buildReviewCardPronunciations(
    card.entryLinks,
    entryLookup
  );
  const reading = resolveReviewCardReading(card, entryLookup);

  return {
    back: card.back,
    bucket: resolved.bucket,
    bucketDetail: buildBucketDetail(resolved.bucket, resolved.dueAt),
    bucketLabel: formatBucketLabel(resolved.bucket, resolved.effectiveState),
    contexts: contexts ?? buildReviewCardContexts(subjectCards, mediaById),
    createdAt: card.createdAt,
    dueAt: resolved.dueAt,
    dueLabel: resolved.dueAt
      ? `Scadenza ${formatShortIsoDate(resolved.dueAt)}`
      : undefined,
    effectiveState: resolved.effectiveState,
    effectiveStateLabel:
      resolved.effectiveState === "ignored"
        ? "Ignorata"
        : formatReviewStateLabel(
            resolved.effectiveState,
            resolved.effectiveState === "known_manual"
          ),
    exampleIt: card.exampleIt ?? undefined,
    exampleJp: card.exampleJp ?? undefined,
    entries,
    front: card.front,
    gradePreviews: [],
    href: mediaReviewCardHref(cardMedia.slug, card.id),
    id: card.id,
    mediaSlug: cardMedia.slug,
    mediaTitle: cardMedia.title,
    notes: card.notesIt ?? undefined,
    orderIndex: card.orderIndex,
    pronunciations,
    rawReviewLabel: resolved.rawReviewLabel,
    reading,
    reviewSeedState: resolved.reviewSeedState,
    segmentTitle: card.segment?.title ?? undefined,
    typeLabel: capitalizeToken(card.cardType)
  };
}

function resolveReviewCardReading(
  card: ReviewCardListItem,
  entryLookup: Map<string, ReviewEntryLookupItem>
) {
  const drivingLinks = getDrivingEntryLinks(card.entryLinks)
    .slice()
    .sort(compareEntryLinks);

  for (const link of drivingLinks) {
    const reading = entryLookup.get(
      `${link.entryType}:${link.entryId}`
    )?.reading;

    if (reading) {
      return reading;
    }
  }

  for (const link of card.entryLinks.slice().sort(compareEntryLinks)) {
    const reading = entryLookup.get(
      `${link.entryType}:${link.entryId}`
    )?.reading;

    if (reading) {
      return reading;
    }
  }

  return deriveKanaReading(card.front);
}

function deriveKanaReading(value: string) {
  const hasKana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
  const hasHan = /\p{Script=Han}/u.test(value);

  if (hasKana && !hasHan) {
    return value;
  }

  return undefined;
}

function resolveCardBucket(input: {
  asOfIso: string;
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  reviewState: ReviewState | null;
}): ReviewQueueCard["bucket"] {
  if (input.effectiveState === "suspended") {
    return "suspended";
  }

  if (
    input.effectiveState === "known_manual" ||
    input.effectiveState === "ignored"
  ) {
    return "manual";
  }

  if (
    isReviewCardDue({
      asOfIso: input.asOfIso,
      dueAt: input.dueAt,
      effectiveState: input.effectiveState,
      reviewState: input.reviewState
    })
  ) {
    return "due";
  }

  if (isReviewCardNew(input.reviewState)) {
    return "new";
  }

  return "upcoming";
}

function buildQueueIntroLabel(input: {
  dailyLimit: number;
  dueCount: number;
  manualCount: number;
  newQueuedCount: number;
  upcomingCount: number;
}) {
  if (input.dueCount > 0 || input.newQueuedCount > 0) {
    const segments = [];

    if (input.dueCount > 0) {
      segments.push(
        input.dueCount === 1
          ? "1 card da ripassare adesso"
          : `${input.dueCount} card da ripassare adesso`
      );
    }

    if (input.newQueuedCount > 0) {
      segments.push(
        input.newQueuedCount === 1
          ? `1 nuova prevista entro il limite giornaliero di ${input.dailyLimit}`
          : `${input.newQueuedCount} nuove previste entro il limite giornaliero di ${input.dailyLimit}`
      );
    }

    if (input.manualCount > 0) {
      segments.push(
        input.manualCount === 1
          ? "1 card è esclusa manualmente"
          : `${input.manualCount} card sono escluse manualmente`
      );
    }

    return `${segments.join(". ")}.`;
  }

  if (input.upcomingCount > 0) {
    return input.upcomingCount === 1
      ? "Oggi la coda è in pari. Rimane 1 card già in rotazione."
      : `Oggi la coda è in pari. Rimangono ${input.upcomingCount} card già in rotazione.`;
  }

  if (input.manualCount > 0) {
    return input.manualCount === 1
      ? "La Review di oggi è vuota, ma 1 card è esclusa manualmente."
      : `La Review di oggi è vuota, ma ${input.manualCount} card sono escluse manualmente.`;
  }

  return "La Review di oggi è vuota: il media non ha ancora card attive da mettere in coda.";
}

function buildBucketDetail(
  bucket: ReviewQueueCard["bucket"],
  dueAt: string | null
) {
  if (bucket === "due") {
    return dueAt
      ? `Richiede attenzione oggi. Scadenza ${formatShortIsoDate(dueAt)}.`
      : "Richiede attenzione oggi.";
  }

  if (bucket === "new") {
    return "Pronta per entrare nella coda giornaliera senza perdere il legame con il Glossary.";
  }

  if (bucket === "manual") {
    return "Una voce collegata è stata impostata manualmente come già nota o ignorata.";
  }

  if (bucket === "suspended") {
    return "La card è stata messa in pausa e non entra nella sessione finché non la riattivi.";
  }

  return dueAt
    ? `Resta in rotazione. Prossima scadenza ${formatShortIsoDate(dueAt)}.`
    : "Resta in rotazione ma oggi non richiede un passaggio.";
}

function formatBucketLabel(
  bucket: ReviewQueueCard["bucket"],
  effectiveState: EffectiveReviewState["state"]
) {
  if (bucket === "due") {
    return "Dovuta";
  }

  if (bucket === "new") {
    return "Nuova";
  }

  if (bucket === "suspended") {
    return "Sospesa";
  }

  if (bucket === "upcoming") {
    return "Da ripassare nei prossimi giorni";
  }

  return effectiveState === "ignored" ? "Ignorata" : "Già nota";
}

function compareEntryLinks(
  left: ReviewEntryLinkLike,
  right: ReviewEntryLinkLike
) {
  const leftRank = getRelationshipRank(left.relationshipType);
  const rightRank = getRelationshipRank(right.relationshipType);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (left.entryType !== right.entryType) {
    return left.entryType.localeCompare(right.entryType);
  }

  return left.entryId.localeCompare(right.entryId);
}

function normalizeReviewSearchState(
  searchParams: Record<string, string | string[] | undefined>
): ReviewSearchState {
  const answeredCount = Number.parseInt(
    readSearchParam(searchParams, "answered"),
    10
  );
  const extraNewCount = Number.parseInt(
    readSearchParam(searchParams, "extraNew"),
    10
  );

  return {
    answeredCount:
      Number.isFinite(answeredCount) && answeredCount > 0 ? answeredCount : 0,
    extraNewCount:
      Number.isFinite(extraNewCount) && extraNewCount > 0 ? extraNewCount : 0,
    noticeCode: readSearchParam(searchParams, "notice") || null,
    selectedCardId: readSearchParam(searchParams, "card") || null,
    showAnswer: readSearchParam(searchParams, "show") === "answer"
  };
}

function resolveReviewNotice(value: string | null) {
  const notices: Record<string, string> = {
    known: "Le voci principali della card sono state segnate come già note.",
    learning: "Le voci principali della card sono tornate in studio.",
    reset:
      "La card è stata riportata allo stato iniziale senza perdere lo storico.",
    resumed: "La card è tornata attiva nella Review.",
    suspended: "La card è stata messa in pausa e rimossa dalla coda di oggi."
  };

  if (!value) {
    return undefined;
  }

  return notices[value];
}

function getRelationshipRank(value: string) {
  const ranks: Record<string, number> = {
    primary: 0,
    secondary: 1,
    context: 2
  };

  return ranks[value] ?? 99;
}

function formatShortIsoDate(value: string) {
  return value.slice(0, 10);
}

function buildReviewGradePreviews(
  reviewSeedState: ReviewQueueCard["reviewSeedState"],
  now: Date
): ReviewGradePreview[] {
  return buildSharedReviewGradePreviews(reviewSeedState, now);
}

function compareReviewCardsByOrder<
  TCard extends Pick<ReviewQueueCard, "createdAt" | "orderIndex">
>(left: TCard, right: TCard) {
  if (
    (left.orderIndex ?? Number.MAX_SAFE_INTEGER) !==
    (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
  ) {
    return (
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
    );
  }

  return left.createdAt.localeCompare(right.createdAt);
}
function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Rendering hint only.
  }
}
