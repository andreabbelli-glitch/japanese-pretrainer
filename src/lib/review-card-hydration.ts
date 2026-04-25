import { db, type DatabaseClient } from "@/db";
import {
  getCardById,
  getGlossaryEntriesByCrossMediaGroupIds,
  getGlossaryEntriesByIds,
  listEntryCardConnections,
  listCrossMediaFamiliesByEntryIds,
  listReviewCardsByIds,
  getReviewSubjectStateByKey,
  type CrossMediaFamily,
  type CrossMediaSibling,
  type GrammarEntryReviewSummaryById,
  type GrammarGlossaryEntry,
  type MediaListItem,
  type TermEntryReviewSummaryById,
  type TermGlossaryEntry
} from "@/db/queries";
import {
  buildGlossarySummaryTags,
  buildReviewSummaryTags,
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
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
  formatReviewStateLabel
} from "@/lib/study-format";
import { buildEntryKey } from "@/lib/entry-id";
import { measureWith, type ReviewProfiler } from "@/lib/review-profiler";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  matchesReviewSubjectEntrySurface,
  type ReviewSubjectIdentity
} from "./review-subject";
import { deriveInlineReading } from "./inline-markdown.ts";
import {
  getDrivingEntryLinks,
  hasCompletedReviewLesson,
  type ReviewEntryLinkLike
} from "./review-model";
import {
  buildPronunciationData,
  type PronunciationData
} from "./pronunciation-data";
import { buildReviewGradePreviews as buildSharedReviewGradePreviews } from "./review-grade-previews";
import {
  buildDefaultFsrsOptimizerSnapshot,
  buildReviewSeedStateWithFsrsPreset,
  getFsrsOptimizerRuntimeContext,
  getFsrsOptimizerRuntimeSnapshot,
  type FsrsOptimizerSnapshot
} from "./fsrs-optimizer";
import {
  type ReviewQueueStateSnapshot,
  resolveReviewQueueState
} from "./review-queue-state";
import {
  buildBucketDetail,
  formatBucketLabel,
  formatShortIsoDate
} from "./review-queue-presentation";
import type {
  ReviewCardSource,
  ReviewCardEntryLink,
  ReviewCardSegmentSource
} from "./review-card-contract";
import type {
  ReviewCardDetailData,
  ReviewCardEntryKind,
  ReviewCardEntrySummary,
  ReviewCardPronunciation,
  ReviewQueueCard
} from "./review-types";

export type ReviewEntryLookupItem = {
  href: ReturnType<typeof mediaGlossaryEntryHref>;
  id: string;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  pronunciation?: PronunciationData;
  reading?: string;
  subtitle?: string;
};

export type ReviewTermLookupEntry =
  | TermGlossaryEntry
  | TermEntryReviewSummaryById;

export type ReviewGrammarLookupEntry =
  | GrammarGlossaryEntry
  | GrammarEntryReviewSummaryById;

export type ReviewMediaLookup = Map<
  string,
  {
    slug: string;
    title: string;
  }
>;

type ReviewCardWithOptionalMedia = ReviewCardSource & {
  media?: {
    slug: string;
    title: string;
  } | null;
};

export function collectReviewLinkedEntryIds(
  cards: Array<Pick<ReviewCardSource, "entryLinks">>
) {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const card of cards) {
    for (const link of card.entryLinks) {
      if (link.entryType === "term") {
        termIds.add(link.entryId);
        continue;
      }

      if (link.entryType === "grammar") {
        grammarIds.add(link.entryId);
      }
    }
  }

  return {
    grammarIds: [...grammarIds],
    termIds: [...termIds]
  };
}

export async function hydrateReviewCard(input: {
  cardId: string;
  database?: DatabaseClient;
  now?: Date;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewQueueCard | null> {
  const database = input.database ?? db;
  const cacheEligible = canUseDataCache(database);

  if (!cacheEligible) {
    return hydrateReviewCardUncached(input);
  }

  const fsrsRuntimeContext = await getFsrsOptimizerRuntimeContext(database);

  return measureWith(
    input.profiler,
    "hydrateReviewCard.cached",
    () =>
      runWithTaggedCache({
        enabled: cacheEligible,
        keyParts: [
          "review",
          "hydrated-card",
          input.cardId,
          `fsrs:${fsrsRuntimeContext.cacheKeyPart}`
        ],
        loader: () =>
          hydrateReviewCardUncached({
            ...input,
            fsrsOptimizerSnapshot: fsrsRuntimeContext.snapshot
          }),
        tags: [
          ...buildReviewSummaryTags(),
          ...buildGlossarySummaryTags(),
          REVIEW_FIRST_CANDIDATE_TAG
        ]
      }),
    { cacheEligible, cardId: input.cardId }
  );
}

export async function hydrateReviewCardUncached(input: {
  cardId: string;
  database?: DatabaseClient;
  fsrsOptimizerSnapshot?: FsrsOptimizerSnapshot;
  now?: Date;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewQueueCard | null> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const fsrsOptimizerSnapshotPromise = input.fsrsOptimizerSnapshot
    ? Promise.resolve(input.fsrsOptimizerSnapshot)
    : getFsrsOptimizerRuntimeSnapshot(database);
  const card = await measureWith(input.profiler, "getCardById", () =>
    getCardById(database, input.cardId)
  );

  if (!card || card.status === "archived") {
    return null;
  }

  if (!hasCompletedReviewLesson(card)) {
    return null;
  }

  const { termIds, grammarIds } = collectReviewLinkedEntryIds([card]);
  const [fsrsOptimizerSnapshot, terms, grammar] = await Promise.all([
    fsrsOptimizerSnapshotPromise,
    measureWith(input.profiler, "getGlossaryEntriesByIds.term", () =>
      getGlossaryEntriesByIds(database, "term", termIds)
    ),
    measureWith(input.profiler, "getGlossaryEntriesByIds.grammar", () =>
      getGlossaryEntriesByIds(database, "grammar", grammarIds)
    )
  ]);
  const subjectIdentity = deriveReviewSubjectIdentity({
    cardId: card.id,
    cardType: card.cardType,
    front: card.front,
    entryLinks: card.entryLinks,
    entryLookup: buildReviewSubjectEntryLookup({ grammar, terms })
  });
  const subjectState = await measureWith(
    input.profiler,
    "getReviewSubjectStateByKey",
    () => getReviewSubjectStateByKey(database, subjectIdentity.subjectKey)
  );
  const subjectContext = await measureWith(
    input.profiler,
    "loadReviewSubjectCardContext",
    () =>
      loadReviewSubjectCardContext({
        card,
        database,
        grammar,
        subjectIdentity,
        terms
      })
  );
  const queueStateSnapshot = resolveReviewQueueState(
    card.status,
    subjectState,
    nowIso
  );
  const queueCard = await measureWith(
    input.profiler,
    "mapQueueCard",
    () =>
      mapQueueCard(
        card,
        subjectContext.entryLookup,
        subjectContext.subjectCards,
        subjectContext.mediaById,
        nowIso,
        fsrsOptimizerSnapshot,
        queueStateSnapshot,
        undefined,
        {
          reviewStateUpdatedAt: subjectState?.updatedAt ?? null
        }
      ),
    { cardId: card.id }
  );

  return {
    ...queueCard,
    gradePreviews: buildSharedReviewGradePreviews(
      queueCard.reviewSeedState,
      now
    )
  };
}

export async function getReviewCardDetailData(
  mediaSlug: string,
  cardId: string,
  database: DatabaseClient = db
): Promise<ReviewCardDetailData | null> {
  const nowIso = new Date().toISOString();
  const selectedRawCard = await getCardById(database, cardId);
  const cardMedia = selectedRawCard?.media;

  if (
    !selectedRawCard ||
    !cardMedia ||
    cardMedia.slug !== mediaSlug ||
    cardMedia.status !== "active" ||
    selectedRawCard.status === "archived" ||
    !hasCompletedReviewLesson(selectedRawCard)
  ) {
    return null;
  }

  const drivingLinks = getDrivingEntryLinks(selectedRawCard.entryLinks);
  const termEntryIds = [
    ...new Set(
      drivingLinks
        .filter((link) => link.entryType === "term")
        .map((link) => link.entryId)
    )
  ];
  const grammarEntryIds = [
    ...new Set(
      drivingLinks
        .filter((link) => link.entryType === "grammar")
        .map((link) => link.entryId)
    )
  ];
  const termFamiliesPromise =
    termEntryIds.length > 0
      ? listCrossMediaFamiliesByEntryIds(database, "term", termEntryIds)
      : Promise.resolve(new Map<string, CrossMediaFamily>());
  const grammarFamiliesPromise =
    grammarEntryIds.length > 0
      ? listCrossMediaFamiliesByEntryIds(database, "grammar", grammarEntryIds)
      : Promise.resolve(new Map<string, CrossMediaFamily>());
  const { termIds, grammarIds } = collectReviewLinkedEntryIds([
    selectedRawCard
  ]);
  const [terms, grammar] = await Promise.all([
    getGlossaryEntriesByIds(database, "term", termIds),
    getGlossaryEntriesByIds(database, "grammar", grammarIds)
  ]);
  const subjectIdentity = deriveReviewSubjectIdentity({
    cardId: selectedRawCard.id,
    cardType: selectedRawCard.cardType,
    front: selectedRawCard.front,
    entryLinks: selectedRawCard.entryLinks,
    entryLookup: buildReviewSubjectEntryLookup({ grammar, terms })
  });
  const subjectStatePromise = getReviewSubjectStateByKey(
    database,
    subjectIdentity.subjectKey
  );

  const termById = new Map(terms.map((entry) => [entry.id, entry]));
  const grammarById = new Map(grammar.map((entry) => [entry.id, entry]));
  const [subjectState, subjectContext, termFamilies, grammarFamilies] =
    await Promise.all([
    subjectStatePromise,
    loadReviewSubjectCardContext({
      card: selectedRawCard,
      database,
      grammar,
      subjectIdentity,
      terms
    }),
    termFamiliesPromise,
    grammarFamiliesPromise
    ]);
  const queueStateSnapshot = resolveReviewQueueState(
    selectedRawCard.status,
    subjectState,
    nowIso
  );
  const selectedCard = mapQueueCard(
    selectedRawCard,
    subjectContext.entryLookup,
    subjectContext.subjectCards,
    subjectContext.mediaById,
    nowIso,
    undefined,
    queueStateSnapshot,
    undefined,
    {
      reviewStateUpdatedAt: subjectState?.updatedAt ?? null
    }
  );
  const crossMedia = drivingLinks.map((link) => {
    const localEntry =
      link.entryType === "term"
        ? termById.get(link.entryId)
        : grammarById.get(link.entryId);

    if (!localEntry) {
      return null;
    }

    const family =
      link.entryType === "term"
        ? termFamilies.get(link.entryId)
        : grammarFamilies.get(link.entryId);

    if (!family || family.siblings.length === 0) {
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
      siblings: family.siblings.map(mapReviewCrossMediaSibling)
    };
  });
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
    pronunciations: selectedCard.pronunciations,
    media: {
      glossaryHref: mediaGlossaryHref(cardMedia.slug),
      href: mediaHref(cardMedia.slug),
      reviewHref: mediaStudyHref(cardMedia.slug, "review"),
      slug: cardMedia.slug,
      title: cardMedia.title
    }
  };
}

async function loadReviewSubjectCardContext(input: {
  card: ReviewCardWithOptionalMedia;
  database: DatabaseClient;
  grammar: ReviewGrammarLookupEntry[];
  subjectIdentity: ReviewSubjectIdentity;
  terms: ReviewTermLookupEntry[];
}) {
  if (
    input.subjectIdentity.subjectKind !== "group" ||
    !input.subjectIdentity.crossMediaGroupId ||
    !input.subjectIdentity.entryType
  ) {
    return buildSingleReviewSubjectCardContext(input);
  }

  const groupEntries =
    input.subjectIdentity.entryType === "term"
      ? await getGlossaryEntriesByCrossMediaGroupIds(input.database, "term", [
          input.subjectIdentity.crossMediaGroupId
        ])
      : await getGlossaryEntriesByCrossMediaGroupIds(input.database, "grammar", [
          input.subjectIdentity.crossMediaGroupId
        ]);
  const cardConnections = await listEntryCardConnections(
    input.database,
    groupEntries.map((entry) => ({
      entryId: entry.id,
      entryType: input.subjectIdentity.entryType!
    }))
  );
  const subjectCardIds = dedupeStable(
    cardConnections.map((connection) => connection.cardId)
  );
  const loadedSubjectCards =
    subjectCardIds.length > 0
      ? await listReviewCardsByIds(input.database, subjectCardIds)
      : [];
  const subjectCards = mergeReviewSubjectCards(
    [input.card, ...loadedSubjectCards].filter(hasCompletedReviewLesson)
  );
  const mediaById = buildReviewMediaLookup(await listMediaCached(input.database));

  if (input.subjectIdentity.entryType === "term") {
    return {
      entryLookup: buildEntryLookup(
        mergeGlossaryEntries(input.terms, groupEntries as ReviewTermLookupEntry[]),
        input.grammar
      ),
      mediaById,
      subjectCards
    };
  }

  return {
    entryLookup: buildEntryLookup(
      input.terms,
      mergeGlossaryEntries(
        input.grammar,
        groupEntries as ReviewGrammarLookupEntry[]
      )
    ),
    mediaById,
    subjectCards
  };
}

function buildSingleReviewSubjectCardContext(input: {
  card: ReviewCardWithOptionalMedia;
  grammar: ReviewGrammarLookupEntry[];
  terms: ReviewTermLookupEntry[];
}) {
  return {
    entryLookup: buildEntryLookup(input.terms, input.grammar),
    mediaById: buildSingleMediaLookup({
      id: input.card.mediaId,
      slug: input.card.media?.slug ?? "unknown-media",
      title: input.card.media?.title ?? "Media"
    }),
    subjectCards: [input.card]
  };
}

function mergeGlossaryEntries<TEntry extends { id: string }>(
  baseEntries: TEntry[],
  additionalEntries: TEntry[]
) {
  const entriesById = new Map(baseEntries.map((entry) => [entry.id, entry]));

  for (const entry of additionalEntries) {
    entriesById.set(entry.id, entry);
  }

  return [...entriesById.values()];
}

function mergeReviewSubjectCards(cards: ReviewCardSource[]) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return [...cardsById.values()].sort((left, right) => {
    if (left.mediaId !== right.mediaId) {
      return left.mediaId.localeCompare(right.mediaId);
    }

    if (left.orderIndex !== right.orderIndex) {
      return (
        (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
        (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return left.id.localeCompare(right.id);
  });
}

function dedupeStable(values: string[]) {
  return [...new Set(values)];
}

export function buildReviewMediaLookup(media: MediaListItem[]) {
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

export function buildSingleMediaLookup(
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

export function buildEntryLookup(
  terms: ReviewTermLookupEntry[],
  grammar: ReviewGrammarLookupEntry[]
) {
  const lookup = new Map<string, ReviewEntryLookupItem>();

  for (const entry of terms) {
    const mediaSlug = getEntryMediaSlug(entry);

    lookup.set(buildEntryKey("term", entry.id), {
      href: mediaGlossaryEntryHref(mediaSlug, "term", entry.lemma, {
        sourceId: entry.sourceId
      }),
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
      subtitle:
        [entry.reading, entry.romaji].filter(Boolean).join(" / ") || undefined
    });
  }

  for (const entry of grammar) {
    const mediaSlug = getEntryMediaSlug(entry);

    lookup.set(buildEntryKey("grammar", entry.id), {
      href: mediaGlossaryEntryHref(mediaSlug, "grammar", entry.pattern, {
        sourceId: entry.sourceId
      }),
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
      subtitle: entry.title !== entry.pattern ? entry.title : undefined
    });
  }

  return lookup;
}

export function buildReviewCardPronunciations(
  card: Pick<ReviewCardSource, "cardType" | "entryLinks" | "front">,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  sortedEntryLinks?: ReviewEntryLinkLike[]
): ReviewCardPronunciation[] {
  const links =
    sortedEntryLinks ?? card.entryLinks.slice().sort(compareEntryLinks);

  if (!canExposeReviewEntryMedia(card, entryLookup, links)) {
    return [];
  }

  return getDrivingEntryLinks(links).flatMap((link) => {
    const entry = entryLookup.get(buildEntryKey(link.entryType, link.entryId));

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

export async function loadReviewCardPronunciations(input: {
  card: Pick<ReviewCardSource, "cardType" | "entryLinks" | "front">;
  database: DatabaseClient;
  entryLookup: Map<string, ReviewEntryLookupItem>;
}) {
  if (!canExposeReviewEntryMedia(input.card, input.entryLookup)) {
    return [];
  }

  const drivingLinks = getDrivingEntryLinks(input.card.entryLinks);
  const missingTermIds = new Set<string>();
  const missingGrammarIds = new Set<string>();

  for (const link of drivingLinks) {
    const entry = input.entryLookup.get(
      buildEntryKey(link.entryType, link.entryId)
    );

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
    return buildReviewCardPronunciations(input.card, input.entryLookup);
  }

  const [terms, grammar] = await Promise.all([
    getGlossaryEntriesByIds(input.database, "term", [...missingTermIds]),
    getGlossaryEntriesByIds(input.database, "grammar", [...missingGrammarIds])
  ]);
  const resolvedEntryLookup = new Map(input.entryLookup);

  for (const [key, value] of buildEntryLookup(terms, grammar)) {
    resolvedEntryLookup.set(key, value);
  }

  return buildReviewCardPronunciations(input.card, resolvedEntryLookup);
}

export function resolveReviewCardMedia(
  card: Pick<ReviewCardSource, "mediaId">,
  mediaById: ReviewMediaLookup
) {
  return (
    mediaById.get(card.mediaId) ?? {
      slug: "unknown-media",
      title: "Media"
    }
  );
}

export function mapQueueCard(
  card: ReviewCardSource,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  subjectCards: ReviewCardSource[],
  mediaById: ReviewMediaLookup,
  nowIso: string,
  fsrsOptimizerSnapshot?: FsrsOptimizerSnapshot,
  queueStateSnapshot?: ReviewQueueStateSnapshot,
  contexts?: ReviewQueueCard["contexts"],
  options: {
    includePronunciations?: boolean;
    reviewStateUpdatedAt?: string | null;
  } = {}
): ReviewQueueCard {
  const cardMedia = resolveReviewCardMedia(card, mediaById);
  const sortedEntryLinks = card.entryLinks.slice().sort(compareEntryLinks);
  const entries = sortedEntryLinks.flatMap((link) => {
    const entry = entryLookup.get(buildEntryKey(link.entryType, link.entryId));

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
        statusLabel: "Disponibile",
        subtitle: entry.subtitle
      } satisfies ReviewCardEntrySummary
    ];
  });
  const resolved =
    queueStateSnapshot ?? resolveReviewQueueState(card.status, null, nowIso);
  const pronunciations =
    options.includePronunciations === false
      ? []
      : buildReviewCardPronunciations(card, entryLookup, sortedEntryLinks);
  const reading = resolveReviewCardReading(card, entryLookup, sortedEntryLinks);

  return {
    back: buildAggregatedReviewBack(card, subjectCards, mediaById),
    bucket: resolved.bucket,
    bucketDetail: buildBucketDetail(resolved.bucket, resolved.dueAt),
    bucketLabel: formatBucketLabel(resolved.bucket),
    contexts: contexts ?? buildReviewCardContexts(subjectCards, mediaById),
    createdAt: card.createdAt,
    dueAt: resolved.dueAt,
    dueLabel: resolved.dueAt
      ? `Scadenza ${formatShortIsoDate(resolved.dueAt)}`
      : undefined,
    effectiveState: resolved.effectiveState,
    effectiveStateLabel: formatReviewStateLabel(
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
    reviewSeedState: buildReviewSeedStateWithFsrsPreset(
      resolved.reviewSeedState,
      card.cardType,
      fsrsOptimizerSnapshot ?? buildDefaultFsrsOptimizerSnapshot()
    ),
    reviewStateUpdatedAt: options.reviewStateUpdatedAt ?? null,
    segmentTitle: card.segment?.title ?? undefined,
    typeLabel: capitalizeToken(card.cardType)
  };
}

function buildAggregatedReviewBack(
  representativeCard: ReviewCardSource,
  subjectCards: ReviewCardSource[],
  mediaById: ReviewMediaLookup
) {
  const uniqueBacks = new Map<string, ReviewCardSource>();

  for (const subjectCard of subjectCards) {
    const normalizedBack = subjectCard.back.trim();

    if (!normalizedBack || uniqueBacks.has(normalizedBack)) {
      continue;
    }

    uniqueBacks.set(normalizedBack, subjectCard);
  }

  if (uniqueBacks.size <= 1) {
    return representativeCard.back;
  }

  return [...uniqueBacks.entries()]
    .map(([back, subjectCard]) => {
      const media = resolveReviewCardMedia(subjectCard, mediaById);

      return `${media.title}\n${back}`;
    })
    .join("\n\n");
}

export function resolveReviewCardReading(
  card: Pick<ReviewCardSource, "cardType" | "entryLinks" | "front">,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  sortedEntryLinks?: ReviewEntryLinkLike[]
) {
  const links =
    sortedEntryLinks ?? card.entryLinks.slice().sort(compareEntryLinks);

  if (!canExposeReviewEntryMedia(card, entryLookup, links)) {
    return undefined;
  }

  const drivingLinks = getDrivingEntryLinks(links);

  for (const link of drivingLinks) {
    const reading = entryLookup.get(
      buildEntryKey(link.entryType, link.entryId)
    )?.reading;

    if (reading) {
      return reading;
    }
  }

  for (const link of links) {
    const reading = entryLookup.get(
      buildEntryKey(link.entryType, link.entryId)
    )?.reading;

    if (reading) {
      return reading;
    }
  }

  return deriveInlineReading(card.front) ?? deriveKanaReading(card.front);
}

export function canExposeReviewEntryMedia(
  card: Pick<ReviewCardSource, "cardType" | "entryLinks" | "front">,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  sortedEntryLinks?: ReviewEntryLinkLike[]
) {
  const links = sortedEntryLinks ?? card.entryLinks;
  const drivingLinks = getDrivingEntryLinks(links);
  const hasPrimaryLink = links.some(
    (link) => link.relationshipType === "primary"
  );

  if (drivingLinks.length !== 1) {
    return false;
  }

  const drivingLink = drivingLinks[0]!;
  const drivingEntry = entryLookup.get(
    buildEntryKey(drivingLink.entryType, drivingLink.entryId)
  );

  if (!drivingEntry) {
    return false;
  }

  if (!hasPrimaryLink) {
    return true;
  }

  if (card.cardType !== "concept") {
    return true;
  }

  return matchesReviewSubjectEntrySurface(card.front, {
    label: drivingEntry.label,
    reading: drivingEntry.reading
  });
}

function mapReviewCrossMediaSibling(sibling: CrossMediaSibling) {
  return {
    href: mediaGlossaryEntryHref(
      sibling.mediaSlug,
      sibling.kind,
      sibling.label,
      {
        sourceId: sibling.sourceId
      }
    ),
    label: sibling.label,
    meaning: sibling.meaningIt,
    mediaSlug: sibling.mediaSlug,
    mediaTitle: sibling.mediaTitle,
    notes: buildReviewCrossMediaNotesPreview(sibling.notesIt),
    reading: sibling.reading ?? undefined,
    subtitle:
      sibling.kind === "term"
        ? [sibling.reading, sibling.romaji].filter(Boolean).join(" / ") ||
          undefined
        : sibling.title && sibling.title !== sibling.label
          ? sibling.title
          : undefined
  };
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

function buildReviewCardContexts(
  cards: Array<
    Pick<ReviewCardSource, "front" | "id" | "mediaId"> & {
      segment?: ReviewCardSegmentSource | null;
    }
  >,
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

function deriveKanaReading(value: string) {
  const hasKana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
  const hasHan = /\p{Script=Han}/u.test(value);

  if (hasKana && !hasHan) {
    return value;
  }

  return undefined;
}

function compareEntryLinks(
  left: ReviewCardEntryLink,
  right: ReviewCardEntryLink
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

function getRelationshipRank(value: string) {
  const ranks: Record<string, number> = {
    primary: 0,
    secondary: 1,
    context: 2
  };

  return ranks[value] ?? 99;
}
