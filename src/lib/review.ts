import { unstable_noStore as noStore } from "next/cache";

import {
  countNewCardsIntroducedOnDayByMediaId,
  countNewCardsIntroducedOnDayByMediaIds,
  db,
  getGrammarCrossMediaFamilyByEntryId,
  listLessonLinkedReviewEntriesByMediaId,
  listLessonLinkedReviewEntriesByMediaIds,
  listReviewLaunchCandidates,
  getMediaBySlug,
  getTermCrossMediaFamilyByEntryId,
  listGrammarEntriesByMediaId,
  listGrammarEntrySummaries,
  listReviewCardsByMediaId,
  listReviewCardsByMediaIds,
  listTermEntriesByMediaId,
  listTermEntrySummaries,
  type DatabaseClient,
  type CrossMediaGrammarSibling,
  type CrossMediaTermSibling,
  type GrammarGlossaryEntry,
  type LessonLinkedReviewEntry,
  type ReviewCardListItem,
  type TermGlossaryEntry
} from "@/db";
import { getReviewDailyLimit } from "@/lib/settings";
import {
  mediaGlossaryEntryHref,
  mediaGlossaryHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref
} from "@/lib/site";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatEntryStatusLabel,
  formatReviewStateLabel
} from "@/lib/study-format";

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
  scheduleReview,
  type ReviewRating,
  type ReviewState
} from "./review-scheduler";

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
  notes?: string;
  orderIndex: number | null;
  pronunciations: ReviewCardPronunciation[];
  rawReviewLabel: string;
  reading?: string;
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
  media: {
    glossaryHref: ReturnType<typeof mediaGlossaryHref>;
    href: ReturnType<typeof mediaHref>;
    reviewHref: ReturnType<typeof mediaStudyHref>;
    slug: string;
    title: string;
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

export type ReviewGradePreview = {
  nextReviewLabel: string;
  rating: ReviewRating;
};

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

  const searchState = normalizeReviewSearchState(searchParams);
  const [cards, terms, grammar, dailyLimit, newIntroducedTodayCount] =
    await Promise.all([
      getEligibleReviewCardsByMediaId(media.id, database),
      listTermEntriesByMediaId(database, media.id),
      listGrammarEntriesByMediaId(database, media.id),
      getReviewDailyLimit(database),
      countNewCardsIntroducedOnDayByMediaId(database, media.id, now)
    ]);
  const queue = buildReviewQueueSnapshot({
    cards,
    dailyLimit,
    extraNewCount: searchState.extraNewCount,
    grammar,
    mediaSlug: media.slug,
    newIntroducedTodayCount,
    terms
  });
  const cardGroups = [
    ...queue.cards,
    ...queue.manualCards,
    ...queue.suspendedCards,
    ...queue.upcomingCards
  ];
  const selectedCard =
    (searchState.selectedCardId
      ? cardGroups.find((card) => card.id === searchState.selectedCardId)
      : null) ??
    queue.cards[0] ??
    null;
  const selectedRawCard = selectedCard
    ? (cards.find((card) => card.id === selectedCard.id) ?? null)
    : null;
  const queueIndex = selectedCard
    ? queue.cards.findIndex((card) => card.id === selectedCard.id)
    : -1;

  return {
    media: {
      glossaryHref: mediaGlossaryHref(media.slug),
      href: mediaHref(media.slug),
      reviewHref: mediaStudyHref(media.slug, "review"),
      slug: media.slug,
      title: media.title
    },
    queue,
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard?.bucket ?? null,
      gradePreviews:
        selectedRawCard && queueIndex >= 0
          ? buildReviewGradePreviews(selectedRawCard, now)
          : [],
      isQueueCard: queueIndex >= 0,
      position: queueIndex >= 0 ? queueIndex + 1 : null,
      remainingCount: queue.cards.length,
      showAnswer: searchState.showAnswer || queueIndex < 0
    },
    session: {
      answeredCount: searchState.answeredCount,
      extraNewCount: searchState.extraNewCount,
      notice: resolveReviewNotice(searchState.noticeCode)
    }
  };
}

export async function getReviewQueueSnapshotForMedia(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<ReviewQueueSnapshot | null> {
  markDataAsLive();
  const now = new Date();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const [cards, terms, grammar, dailyLimit, newIntroducedTodayCount] =
    await Promise.all([
      getEligibleReviewCardsByMediaId(media.id, database),
      listTermEntriesByMediaId(database, media.id),
      listGrammarEntriesByMediaId(database, media.id),
      getReviewDailyLimit(database),
      countNewCardsIntroducedOnDayByMediaId(database, media.id, now)
    ]);
  const snapshot = buildReviewQueueSnapshot({
    cards,
    dailyLimit,
    extraNewCount: 0,
    grammar,
    mediaSlug: media.slug,
    newIntroducedTodayCount,
    terms
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
  const cardsByMedia = groupCardsByMedia(cards);
  const lessonLinkedEntriesByMedia = groupLessonLinkedReviewEntriesByMedia(
    lessonLinkedEntries
  );
  const eligibleCards = new Map<string, ReviewCardListItem[]>();

  for (const mediaId of mediaIds) {
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

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const [cards, terms, grammar] = await Promise.all([
    getEligibleReviewCardsByMediaId(media.id, database),
    listTermEntriesByMediaId(database, media.id),
    listGrammarEntriesByMediaId(database, media.id)
  ]);
  const entryLookup = buildEntryLookup(terms, grammar, media.slug);
  const selectedCard = cards
    .map((card) => mapQueueCard(card, entryLookup, media.slug))
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
  const mediaIds = media.map((item) => item.id);
  const [eligibleCards, terms, grammar, dailyLimit, introducedCounts] =
    await Promise.all([
      getEligibleReviewCardsByMediaIds(mediaIds, database),
      listTermEntrySummaries(database, {
        mediaIds
      }),
      listGrammarEntrySummaries(database, {
        mediaIds
      }),
      getReviewDailyLimit(database),
      countNewCardsIntroducedOnDayByMediaIds(database, mediaIds, now)
    ]);
  const termStatusesByMedia = groupEntryStatusesByMedia(terms);
  const grammarStatusesByMedia = groupEntryStatusesByMedia(grammar);
  const introducedCountByMedia = new Map(
    introducedCounts.map((row) => [row.mediaId, row.count])
  );
  const snapshots = new Map<string, ReviewOverviewSnapshot>();

  for (const item of media) {
    const entryStatuses = buildReviewEntryStatusLookup({
      grammar: grammarStatusesByMedia.get(item.id) ?? [],
      terms: termStatusesByMedia.get(item.id) ?? []
    });

    snapshots.set(
      item.id,
      buildReviewOverviewSnapshot({
        cards: eligibleCards.get(item.id) ?? [],
        dailyLimit,
        entryStatuses,
        extraNewCount: 0,
        newIntroducedTodayCount: introducedCountByMedia.get(item.id) ?? 0
      })
    );
  }

  return snapshots;
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

export function buildReviewOverviewSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryStatuses: Map<string, ReviewEntryStatusValue>;
  extraNewCount: number;
  newIntroducedTodayCount: number;
}): ReviewOverviewSnapshot {
  const allCards = input.cards.map((card) =>
    mapReviewOverviewCard(card, input.entryStatuses)
  );
  const dueCards = allCards
    .filter((card) => card.bucket === "due")
    .sort(compareReviewCardsByDue);
  const newCards = allCards
    .filter((card) => card.bucket === "new")
    .sort(compareReviewCardsByOrder);
  const manualCards = allCards
    .filter((card) => card.bucket === "manual")
    .sort(compareReviewCardsByOrder);
  const suspendedCards = allCards
    .filter((card) => card.bucket === "suspended")
    .sort(compareReviewCardsByOrder);
  const upcomingCards = allCards
    .filter((card) => card.bucket === "upcoming")
    .sort(compareReviewCardsByDue);
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewCards = newCards.slice(0, newSlots);
  const queueCards = [...dueCards, ...queuedNewCards];
  const queueLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: dueCards.length,
    manualCount: manualCards.length,
    newQueuedCount: queuedNewCards.length,
    upcomingCount: upcomingCards.length
  });

  return {
    activeCards: input.cards.filter((card) =>
      isReviewCardActive(card.reviewState?.state ?? null)
    ).length,
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
    effectiveDailyLimit,
    manualCount: manualCards.length,
    newAvailableCount: newCards.length,
    newQueuedCount: queuedNewCards.length,
    nextCardFront: queueCards[0]?.front,
    queueCount: queueCards.length,
    queueLabel,
    suspendedCount: suspendedCards.length,
    totalCards: input.cards.length,
    upcomingCount: upcomingCards.length
  };
}

function filterReviewCardsByLessonCompletion(
  cards: ReviewCardListItem[],
  lessonLinkedEntries: LessonLinkedReviewEntry[]
) {
  const linkedEntryKeys = new Set(
    lessonLinkedEntries.map((row) => buildReviewEntryKey(row.entryType, row.entryId))
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
  "bucket" | "createdAt" | "dueAt" | "front" | "orderIndex"
>;

function buildReviewEntryKey(entryType: string, entryId: string) {
  return `${entryType}:${entryId}`;
}

function mapReviewOverviewCard(
  card: ReviewCardListItem,
  entryStatuses: Map<string, ReviewEntryStatusValue>
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
      dueAt,
      effectiveState: effectiveState.state,
      reviewState: (card.reviewState?.state as ReviewState | null) ?? null
    }),
    createdAt: card.createdAt,
    dueAt,
    front: card.front,
    orderIndex: card.orderIndex
  };
}

function isReviewCardActive(state: string | null) {
  return state !== null && state !== "known_manual" && state !== "suspended";
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

function groupEntryStatusesByMedia<
  TEntry extends {
    entryStatus: ReviewEntryStatusValue;
    id: string;
    mediaId: string;
  }
>(entries: TEntry[]) {
  const grouped = new Map<string, TEntry[]>();

  for (const entry of entries) {
    const existing = grouped.get(entry.mediaId);

    if (existing) {
      existing.push(entry);
      continue;
    }

    grouped.set(entry.mediaId, [entry]);
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

function buildReviewQueueSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  extraNewCount: number;
  grammar: GrammarGlossaryEntry[];
  mediaSlug: string;
  newIntroducedTodayCount: number;
  terms: TermGlossaryEntry[];
}) {
  const entryLookup = buildEntryLookup(
    input.terms,
    input.grammar,
    input.mediaSlug
  );
  const allCards = input.cards.map((card) =>
    mapQueueCard(card, entryLookup, input.mediaSlug)
  );
  const dueCards = allCards
    .filter((card) => card.bucket === "due")
    .sort(compareReviewCardsByDue);
  const newCards = allCards
    .filter((card) => card.bucket === "new")
    .sort(compareReviewCardsByOrder);
  const manualCards = allCards
    .filter((card) => card.bucket === "manual")
    .sort(compareReviewCardsByOrder);
  const suspendedCards = allCards
    .filter((card) => card.bucket === "suspended")
    .sort(compareReviewCardsByOrder);
  const upcomingCards = allCards
    .filter((card) => card.bucket === "upcoming")
    .sort(compareReviewCardsByDue);
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewCards = newCards.slice(0, newSlots);
  const queueCards = [...dueCards, ...queuedNewCards];
  const introLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: dueCards.length,
    manualCount: manualCards.length,
    newQueuedCount: queuedNewCards.length,
    upcomingCount: upcomingCards.length
  });

  return {
    cards: queueCards,
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
    effectiveDailyLimit,
    introLabel,
    manualCards,
    manualCount: manualCards.length,
    newAvailableCount: newCards.length,
    newQueuedCount: queuedNewCards.length,
    queueLabel: introLabel,
    queueCount: queueCards.length,
    suspendedCards,
    suspendedCount: suspendedCards.length,
    upcomingCards,
    upcomingCount: upcomingCards.length
  };
}

function buildEntryLookup(
  terms: TermGlossaryEntry[],
  grammar: GrammarGlossaryEntry[],
  mediaSlug: string
) {
  const lookup = new Map<string, ReviewEntryLookupItem>();

  for (const entry of terms) {
    lookup.set(`term:${entry.id}`, {
      href: mediaGlossaryEntryHref(mediaSlug, "term", entry.sourceId),
      id: entry.sourceId,
      kind: "term",
      label: entry.lemma,
      meaning: entry.meaningIt,
      pronunciation:
        buildPronunciationData(mediaSlug, {
          ...entry,
          reading: entry.reading
        }) ?? undefined,
      reading: entry.reading,
      status: entry.status?.status ?? null,
      subtitle:
        [entry.reading, entry.romaji].filter(Boolean).join(" / ") || undefined
    });
  }

  for (const entry of grammar) {
    lookup.set(`grammar:${entry.id}`, {
      href: mediaGlossaryEntryHref(mediaSlug, "grammar", entry.sourceId),
      id: entry.sourceId,
      kind: "grammar",
      label: entry.pattern,
      meaning: entry.meaningIt,
      pronunciation:
        buildPronunciationData(mediaSlug, {
          ...entry,
          reading: entry.reading ?? entry.pattern
        }) ?? undefined,
      reading: entry.reading ?? deriveKanaReading(entry.pattern),
      status: entry.status?.status ?? null,
      subtitle: entry.title !== entry.pattern ? entry.title : undefined
    });
  }

  return lookup;
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
  mediaSlug: string
): ReviewQueueCard {
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
  const bucket = resolveCardBucket({
    dueAt,
    effectiveState: effectiveState.state,
    reviewState: (card.reviewState?.state as ReviewState | null) ?? null
  });
  const pronunciations = buildReviewCardPronunciations(
    card.entryLinks,
    entryLookup
  );
  const reading = resolveReviewCardReading(card, entryLookup);

  return {
    back: card.back,
    bucket,
    bucketDetail: buildBucketDetail(bucket, dueAt),
    bucketLabel: formatBucketLabel(bucket, effectiveState.state),
    createdAt: card.createdAt,
    dueAt,
    dueLabel: dueAt ? `Scadenza ${formatShortIsoDate(dueAt)}` : undefined,
    effectiveState: effectiveState.state,
    effectiveStateLabel:
      effectiveState.state === "ignored"
        ? "Ignorata"
        : formatReviewStateLabel(
            effectiveState.state,
            effectiveState.state === "known_manual"
          ),
    exampleIt: card.exampleIt ?? undefined,
    exampleJp: card.exampleJp ?? undefined,
    entries,
    front: card.front,
    href: mediaReviewCardHref(mediaSlug, card.id),
    id: card.id,
    notes: card.notesIt ?? undefined,
    orderIndex: card.orderIndex,
    pronunciations,
    rawReviewLabel,
    reading,
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
      asOfIso: new Date().toISOString(),
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
  card: ReviewCardListItem,
  now: Date
): ReviewGradePreview[] {
  const ratings: ReviewRating[] = ["again", "hard", "good", "easy"];

  return ratings.map((rating) => {
    const scheduled = scheduleReview({
      current: {
        difficulty: card.reviewState?.difficulty ?? null,
        dueAt: card.reviewState?.dueAt ?? null,
        lapses: card.reviewState?.lapses ?? 0,
        lastReviewedAt: card.reviewState?.lastReviewedAt ?? null,
        reps: card.reviewState?.reps ?? 0,
        stability: card.reviewState?.stability ?? null,
        state: card.reviewState?.state as ReviewState | null
      },
      now,
      rating
    });

    return {
      nextReviewLabel: formatScheduledReviewPreview(scheduled.dueAt, now),
      rating
    };
  });
}

function formatScheduledReviewPreview(dueAt: string, now: Date) {
  const dueDate = new Date(dueAt);
  const diffMs = dueDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (!Number.isFinite(diffMs) || diffMinutes <= 5) {
    return "Subito";
  }

  if (diffMinutes < 60) {
    return `Tra ${diffMinutes} min`;
  }

  if (isSameLocalDate(dueDate, now)) {
    return `Oggi alle ${formatShortTime(dueDate)}`;
  }

  if (isNextLocalDate(dueDate, now)) {
    return `Domani alle ${formatShortTime(dueDate)}`;
  }

  const dayDiff = Math.round(
    (startOfLocalDay(dueDate).getTime() - startOfLocalDay(now).getTime()) /
      86_400_000
  );

  if (dayDiff > 1 && dayDiff <= 6) {
    return `Tra ${dayDiff} giorni`;
  }

  return `Il ${formatShortIsoDate(dueAt)}`;
}

function formatShortTime(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isNextLocalDate(left: Date, right: Date) {
  return (
    (startOfLocalDay(left).getTime() - startOfLocalDay(right).getTime()) /
      86_400_000 ===
    1
  );
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function compareReviewCardsByDue<
  TCard extends Pick<ReviewQueueCard, "createdAt" | "dueAt" | "orderIndex">
>(
  left: TCard,
  right: TCard
) {
  if ((left.dueAt ?? "") !== (right.dueAt ?? "")) {
    return (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
  }

  return compareReviewCardsByOrder(left, right);
}

function compareReviewCardsByOrder<
  TCard extends Pick<ReviewQueueCard, "createdAt" | "orderIndex">
>(
  left: TCard,
  right: TCard
) {
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
