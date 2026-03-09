import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getMediaBySlug,
  getUserSettingValue,
  listGrammarEntriesByMediaId,
  listReviewCardsByMediaId,
  listTermEntriesByMediaId,
  type DatabaseClient,
  type GrammarGlossaryEntry,
  type ReviewCardListItem,
  type TermGlossaryEntry
} from "@/db";
import { getRenderSafeText } from "@/lib/render-safe-text";
import {
  mediaGlossaryEntryHref,
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
  type ReviewEntryStatusValue
} from "./review-model";
import {
  reviewSchedulerConfig,
  type ReviewState
} from "./review-scheduler";

type ReviewCardEntryKind = "term" | "grammar";

type ReviewSearchState = {
  answeredCount: number;
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
  entries: ReviewCardEntrySummary[];
  front: string;
  href: ReturnType<typeof mediaReviewCardHref>;
  id: string;
  notes?: string;
  orderIndex: number | null;
  rawReviewLabel: string;
  segmentTitle?: string;
  typeLabel: string;
};

export type ReviewQueueSnapshot = {
  cards: ReviewQueueCard[];
  dailyLimit: number;
  dueCount: number;
  manualCount: number;
  newAvailableCount: number;
  newQueuedCount: number;
  queueLabel: string;
  queueCount: number;
  suspendedCount: number;
  upcomingCount: number;
};

export type ReviewPageData = {
  media: {
    glossaryHref: ReturnType<typeof mediaStudyHref>;
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
    isQueueCard: boolean;
    position: number | null;
    remainingCount: number;
    showAnswer: boolean;
  };
  session: {
    answeredCount: number;
    notice?: string;
  };
};

export type ReviewCardDetailData = {
  card: {
    back: string;
    bucketLabel?: string;
    dueLabel?: string;
    front: string;
    id: string;
    notes?: string;
    reviewLabel: string;
    segmentTitle?: string;
    typeLabel: string;
  };
  entries: ReviewCardEntrySummary[];
  media: {
    glossaryHref: ReturnType<typeof mediaStudyHref>;
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

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const searchState = normalizeReviewSearchState(searchParams);
  const [cards, terms, grammar, dailyLimit] = await Promise.all([
    listReviewCardsByMediaId(database, media.id),
    listTermEntriesByMediaId(database, media.id),
    listGrammarEntriesByMediaId(database, media.id),
    getReviewDailyLimit(database)
  ]);
  const queue = buildReviewQueueSnapshot({
    cards,
    dailyLimit,
    grammar,
    mediaSlug: media.slug,
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
    queue.manualCards[0] ??
    queue.suspendedCards[0] ??
    queue.upcomingCards[0] ??
    null;
  const queueIndex = selectedCard
    ? queue.cards.findIndex((card) => card.id === selectedCard.id)
    : -1;

  return {
    media: {
      glossaryHref: mediaStudyHref(media.slug, "glossary"),
      href: mediaHref(media.slug),
      reviewHref: mediaStudyHref(media.slug, "review"),
      slug: media.slug,
      title: media.title
    },
    queue,
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard?.bucket ?? null,
      isQueueCard: queueIndex >= 0,
      position: queueIndex >= 0 ? queueIndex + 1 : null,
      remainingCount: queue.cards.length,
      showAnswer: searchState.showAnswer || queueIndex < 0
    },
    session: {
      answeredCount: searchState.answeredCount,
      notice: resolveReviewNotice(searchState.noticeCode)
    }
  };
}

export async function getReviewQueueSnapshotForMedia(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<ReviewQueueSnapshot | null> {
  markDataAsLive();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const [cards, terms, grammar, dailyLimit] = await Promise.all([
    listReviewCardsByMediaId(database, media.id),
    listTermEntriesByMediaId(database, media.id),
    listGrammarEntriesByMediaId(database, media.id),
    getReviewDailyLimit(database)
  ]);
  const snapshot = buildReviewQueueSnapshot({
    cards,
    dailyLimit,
    grammar,
    mediaSlug: media.slug,
    terms
  });

  return {
    cards: snapshot.cards,
    dailyLimit: snapshot.dailyLimit,
    dueCount: snapshot.dueCount,
    manualCount: snapshot.manualCount,
    newAvailableCount: snapshot.newAvailableCount,
    newQueuedCount: snapshot.newQueuedCount,
    queueLabel: snapshot.introLabel,
    queueCount: snapshot.queueCount,
    suspendedCount: snapshot.suspendedCount,
    upcomingCount: snapshot.upcomingCount
  };
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
    listReviewCardsByMediaId(database, media.id),
    listTermEntriesByMediaId(database, media.id),
    listGrammarEntriesByMediaId(database, media.id)
  ]);
  const entryLookup = buildEntryLookup(terms, grammar, media.slug);
  const selectedCard = cards
    .map((card) => mapQueueCard(card, entryLookup, media.slug))
    .find((card) => card.id === cardId);

  if (!selectedCard) {
    return null;
  }

  return {
    card: {
      back: selectedCard.back,
      bucketLabel:
        selectedCard.bucket === "upcoming" ? undefined : selectedCard.bucketLabel,
      dueLabel: selectedCard.dueLabel,
      front: selectedCard.front,
      id: selectedCard.id,
      notes: selectedCard.notes,
      reviewLabel: selectedCard.effectiveStateLabel,
      segmentTitle: selectedCard.segmentTitle,
      typeLabel: selectedCard.typeLabel
    },
    entries: selectedCard.entries,
    media: {
      glossaryHref: mediaStudyHref(media.slug, "glossary"),
      href: mediaHref(media.slug),
      reviewHref: mediaStudyHref(media.slug, "review"),
      slug: media.slug,
      title: media.title
    }
  };
}

function buildReviewQueueSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  grammar: GrammarGlossaryEntry[];
  mediaSlug: string;
  terms: TermGlossaryEntry[];
}) {
  const entryLookup = buildEntryLookup(input.terms, input.grammar, input.mediaSlug);
  const allCards = input.cards.map((card) => mapQueueCard(card, entryLookup, input.mediaSlug));
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
  const newSlots = Math.max(input.dailyLimit - dueCards.length, 0);
  const queuedNewCards = newCards.slice(0, newSlots);
  const queueCards = [...dueCards, ...queuedNewCards];
  const introLabel = buildQueueIntroLabel({
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
    manualCount: manualCards.length,
    newQueuedCount: queuedNewCards.length,
    upcomingCount: upcomingCards.length
  });

  return {
    cards: queueCards,
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
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
      href: mediaGlossaryEntryHref(mediaSlug, "term", entry.id),
      id: entry.id,
      kind: "term",
      label: entry.lemma,
      meaning: entry.meaningIt,
      status: entry.status?.status ?? null,
      subtitle: [entry.reading, entry.romaji].filter(Boolean).join(" / ") || undefined
    });
  }

  for (const entry of grammar) {
    lookup.set(`grammar:${entry.id}`, {
      href: mediaGlossaryEntryHref(mediaSlug, "grammar", entry.id),
      id: entry.id,
      kind: "grammar",
      label: entry.pattern,
      meaning: entry.meaningIt,
      status: entry.status?.status ?? null,
      subtitle: entry.title !== entry.pattern ? entry.title : undefined
    });
  }

  return lookup;
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
  const drivingEntryStatuses = getDrivingEntryLinks(card.entryLinks)
    .map(
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
    entries,
    front: card.front,
    href: mediaReviewCardHref(mediaSlug, card.id),
    id: card.id,
    notes: getRenderSafeText(card.notesIt),
    orderIndex: card.orderIndex,
    rawReviewLabel,
    segmentTitle: card.segment?.title ?? undefined,
    typeLabel: capitalizeToken(card.cardType)
  };
}

function resolveCardBucket(input: {
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  reviewState: ReviewState | null;
}): ReviewQueueCard["bucket"] {
  if (input.effectiveState === "suspended") {
    return "suspended";
  }

  if (input.effectiveState === "known_manual" || input.effectiveState === "ignored") {
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
          ? "1 card dovuta adesso"
          : `${input.dueCount} card dovute adesso`
      );
    }

    if (input.newQueuedCount > 0) {
      segments.push(
        input.newQueuedCount === 1
          ? `1 nuova introdotta entro il limite giornaliero di ${input.dailyLimit}`
          : `${input.newQueuedCount} nuove introdotte entro il limite giornaliero di ${input.dailyLimit}`
      );
    }

    if (input.manualCount > 0) {
      segments.push(
        input.manualCount === 1
          ? "1 card resta coperta da manual mastery"
          : `${input.manualCount} card restano coperte da manual mastery`
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
      ? "La review di oggi è vuota, ma 1 card resta coperta da manual mastery."
      : `La review di oggi è vuota, ma ${input.manualCount} card restano coperte da manual mastery.`;
  }

  return "La review di oggi è vuota: il media non ha ancora card attive da mettere in coda.";
}

function buildBucketDetail(bucket: ReviewQueueCard["bucket"], dueAt: string | null) {
  if (bucket === "due") {
    return dueAt
      ? `Richiede attenzione oggi. Scadenza ${formatShortIsoDate(dueAt)}.`
      : "Richiede attenzione oggi.";
  }

  if (bucket === "new") {
    return "Pronta per entrare nella coda giornaliera senza perdere il legame col glossary.";
  }

  if (bucket === "manual") {
    return "Una entry collegata è stata marcata manualmente come nota o ignorata.";
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
    return "In rotazione";
  }

  return effectiveState === "ignored" ? "Ignorata" : "Gia nota";
}

function compareEntryLinks(
  left: ReviewCardListItem["entryLinks"][number],
  right: ReviewCardListItem["entryLinks"][number]
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

async function getReviewDailyLimit(database: DatabaseClient) {
  const row = await getUserSettingValue(database, "review_daily_limit");

  if (!row) {
    return reviewSchedulerConfig.defaultDailyLimit;
  }

  try {
    const value = JSON.parse(row.valueJson);

    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.round(value));
    }
  } catch {
    return reviewSchedulerConfig.defaultDailyLimit;
  }

  return reviewSchedulerConfig.defaultDailyLimit;
}

function normalizeReviewSearchState(
  searchParams: Record<string, string | string[] | undefined>
): ReviewSearchState {
  const answeredCount = Number.parseInt(readSearchParam(searchParams, "answered"), 10);

  return {
    answeredCount:
      Number.isFinite(answeredCount) && answeredCount > 0 ? answeredCount : 0,
    noticeCode: readSearchParam(searchParams, "notice") || null,
    selectedCardId: readSearchParam(searchParams, "card") || null,
    showAnswer: readSearchParam(searchParams, "show") === "answer"
  };
}

function resolveReviewNotice(value: string | null) {
  const notices: Record<string, string> = {
    known: "Le entry principali della card sono state segnate come gia note.",
    learning: "Le entry principali della card sono tornate in studio.",
    reset: "La card è stata riportata allo stato iniziale senza perdere lo storico.",
    resumed: "La card è tornata attiva nella review.",
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

function compareReviewCardsByDue(left: ReviewQueueCard, right: ReviewQueueCard) {
  if ((left.dueAt ?? "") !== (right.dueAt ?? "")) {
    return (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
  }

  return compareReviewCardsByOrder(left, right);
}

function compareReviewCardsByOrder(left: ReviewQueueCard, right: ReviewQueueCard) {
  if ((left.orderIndex ?? Number.MAX_SAFE_INTEGER) !== (right.orderIndex ?? Number.MAX_SAFE_INTEGER)) {
    return (left.orderIndex ?? Number.MAX_SAFE_INTEGER) - (right.orderIndex ?? Number.MAX_SAFE_INTEGER);
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
