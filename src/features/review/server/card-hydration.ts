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
  type GrammarGlossaryEntry,
  type TermGlossaryEntry
} from "@/db/queries";
import {
  buildReviewCardStateTags,
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_CARD_CONTENT_TAG
} from "@/features/cache/server/data-cache";
import {
  mediaGlossaryEntryHref,
  mediaGlossaryHref,
  mediaHref,
  mediaStudyHref
} from "@/features/navigation";
import { formatCardRelationshipLabel } from "@/features/study/model/format";
import { buildEntryKey } from "@/features/study/model/entry-id";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  type ReviewSubjectIdentity
} from "@/features/review/model/subject";
import {
  getDrivingEntryLinks,
  hasCompletedReviewLesson
} from "@/features/review/model/state";
import { buildServerReviewGradePreviews } from "@/features/review/server/grade-previews";
import {
  getFsrsOptimizerRuntimeContext,
  getFsrsOptimizerRuntimeSnapshot,
  type FsrsOptimizerSnapshot
} from "@/features/fsrs-optimizer/server";
import { resolveReviewQueueState } from "@/features/review/model/queue-state";
import { getPendingConsolidationSubjectKeySet } from "@/features/consolidation/server";
import {
  buildEntryLookup,
  buildReviewCardContexts,
  buildReviewCardPronunciations,
  buildReviewMediaLookup,
  buildSingleMediaLookup,
  canExposeReviewEntryMedia,
  collectReviewLinkedEntryIds,
  mapQueueCard,
  type ReviewEntryLookupItem,
  type ReviewGrammarLookupEntry,
  type ReviewTermLookupEntry
} from "./card-presenters";
import type { ReviewCardSource } from "@/features/review/model/card-contract";
import type {
  ReviewCardDetailData,
  ReviewQueueCard
} from "@/features/review/types";

export {
  buildEntryLookup,
  buildReviewCardPronunciations,
  buildReviewMediaLookup,
  buildSingleMediaLookup,
  canExposeReviewEntryMedia,
  collectReviewLinkedEntryIds,
  mapQueueCard,
  resolveReviewCardMedia,
  resolveReviewCardReading
} from "./card-presenters";
export type {
  ReviewEntryLookupItem,
  ReviewGrammarLookupEntry,
  ReviewMediaLookup,
  ReviewTermLookupEntry
} from "./card-presenters";

type ReviewCardWithOptionalMedia = ReviewCardSource & {
  media?: {
    slug: string;
    title: string;
  } | null;
};

type ReviewCardStaticHydrationData = {
  grammar: ReviewGrammarLookupEntry[];
  groupGrammar: ReviewGrammarLookupEntry[];
  groupTerms: ReviewTermLookupEntry[];
  mediaRows: Awaited<ReturnType<typeof listMediaCached>>;
  subjectCards: ReviewCardSource[];
  subjectIdentity: ReviewSubjectIdentity;
  terms: ReviewTermLookupEntry[];
};

export async function hydrateReviewCard(input: {
  bypassCache?: boolean;
  cardId: string;
  database?: DatabaseClient;
  now?: Date;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewQueueCard | null> {
  const database = input.database ?? db;
  const cacheEligible = !input.bypassCache && canUseDataCache(database);

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
          REVIEW_CARD_CONTENT_TAG,
          ...buildReviewCardStateTags([input.cardId])
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

  const [fsrsOptimizerSnapshot, staticHydrationData] = await Promise.all([
    fsrsOptimizerSnapshotPromise,
    loadReviewCardStaticHydrationData({
      card,
      database,
      profiler: input.profiler
    })
  ]);
  const subjectIdentity = staticHydrationData.subjectIdentity;
  const pendingConsolidationSubjectKeys =
    await getPendingConsolidationSubjectKeySet(database, [
      subjectIdentity.subjectKey
    ]);

  if (pendingConsolidationSubjectKeys.has(subjectIdentity.subjectKey)) {
    return null;
  }

  const subjectState = await measureWith(
    input.profiler,
    "getReviewSubjectStateByKey",
    () => getReviewSubjectStateByKey(database, subjectIdentity.subjectKey)
  );
  const subjectContext = await measureWith(
    input.profiler,
    "buildReviewSubjectCardContext",
    () =>
      buildReviewSubjectCardContext({
        card,
        staticHydrationData
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
        buildReviewCardContexts(
          subjectContext.contextCards,
          subjectContext.mediaById
        ),
        {
          reviewStateUpdatedAt: subjectState?.updatedAt ?? null,
          schedulingKey: subjectIdentity.subjectKey
        }
      ),
    { cardId: card.id }
  );

  return {
    ...queueCard,
    gradePreviews: await buildServerReviewGradePreviews({
      database,
      excludeSubjectKey: subjectIdentity.subjectKey,
      now,
      recallTask: subjectIdentity.recallTask,
      reviewSeedState: queueCard.reviewSeedState
    })
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
    buildReviewCardContexts(
      subjectContext.contextCards,
      subjectContext.mediaById
    ),
    {
      reviewStateUpdatedAt: subjectState?.updatedAt ?? null,
      schedulingKey: subjectIdentity.subjectKey
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
      exampleAudio: selectedCard.exampleAudio,
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

async function loadReviewCardStaticHydrationData(input: {
  card: ReviewCardWithOptionalMedia;
  database: DatabaseClient;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewCardStaticHydrationData> {
  return measureWith(input.profiler, "reviewCardStaticHydration.cached", () =>
    runWithTaggedCache({
      enabled: canUseDataCache(input.database),
      keyParts: ["review", "card-content", input.card.id],
      loader: () => loadReviewCardStaticHydrationDataUncached(input),
      tags: [REVIEW_CARD_CONTENT_TAG]
    })
  );
}

async function loadReviewCardStaticHydrationDataUncached(input: {
  card: ReviewCardWithOptionalMedia;
  database: DatabaseClient;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewCardStaticHydrationData> {
  const { termIds, grammarIds } = collectReviewLinkedEntryIds([input.card]);
  const [terms, grammar] = await Promise.all([
    measureWith(input.profiler, "getGlossaryEntriesByIds.term", () =>
      getGlossaryEntriesByIds(input.database, "term", termIds)
    ),
    measureWith(input.profiler, "getGlossaryEntriesByIds.grammar", () =>
      getGlossaryEntriesByIds(input.database, "grammar", grammarIds)
    )
  ]);
  const subjectIdentity = deriveReviewSubjectIdentity({
    cardId: input.card.id,
    cardType: input.card.cardType,
    front: input.card.front,
    entryLinks: input.card.entryLinks,
    entryLookup: buildReviewSubjectEntryLookup({ grammar, terms })
  });

  if (
    subjectIdentity.subjectKind !== "group" ||
    !subjectIdentity.crossMediaGroupId ||
    !subjectIdentity.entryType
  ) {
    return {
      grammar,
      groupGrammar: [],
      groupTerms: [],
      mediaRows: [],
      subjectCards: [],
      subjectIdentity,
      terms
    };
  }

  const mediaRowsPromise = listMediaCached(input.database);
  const groupEntries =
    subjectIdentity.entryType === "term"
      ? await getGlossaryEntriesByCrossMediaGroupIds(input.database, "term", [
          subjectIdentity.crossMediaGroupId
        ])
      : await getGlossaryEntriesByCrossMediaGroupIds(
          input.database,
          "grammar",
          [subjectIdentity.crossMediaGroupId]
        );
  const cardConnections = await listEntryCardConnections(
    input.database,
    groupEntries.map((entry) => ({
      entryId: entry.id,
      entryType: subjectIdentity.entryType!
    }))
  );
  const subjectCardIds = dedupeStable(
    cardConnections.map((connection) => connection.cardId)
  );
  const [subjectCards, mediaRows] = await Promise.all([
    subjectCardIds.length > 0
      ? listReviewCardsByIds(input.database, subjectCardIds)
      : Promise.resolve([]),
    mediaRowsPromise
  ]);

  return {
    grammar,
    groupGrammar:
      subjectIdentity.entryType === "grammar"
        ? (groupEntries as ReviewGrammarLookupEntry[])
        : [],
    groupTerms:
      subjectIdentity.entryType === "term"
        ? (groupEntries as ReviewTermLookupEntry[])
        : [],
    mediaRows,
    subjectCards,
    subjectIdentity,
    terms
  };
}

function buildReviewSubjectCardContext(input: {
  card: ReviewCardWithOptionalMedia;
  staticHydrationData: ReviewCardStaticHydrationData;
}) {
  const { staticHydrationData } = input;
  const { subjectIdentity } = staticHydrationData;

  if (
    subjectIdentity.subjectKind !== "group" ||
    !subjectIdentity.crossMediaGroupId ||
    !subjectIdentity.entryType
  ) {
    return buildSingleReviewSubjectCardContext({
      card: input.card,
      grammar: staticHydrationData.grammar,
      terms: staticHydrationData.terms
    });
  }

  const subjectCards = mergeReviewSubjectCards(
    [...staticHydrationData.subjectCards, input.card].filter(
      hasCompletedReviewLesson
    )
  );
  const mediaById = buildReviewMediaLookup(staticHydrationData.mediaRows);
  const mergedTerms = mergeGlossaryEntries(
    staticHydrationData.terms,
    staticHydrationData.groupTerms
  );
  const mergedGrammar = mergeGlossaryEntries(
    staticHydrationData.grammar,
    staticHydrationData.groupGrammar
  );
  const subjectEntryLookup = buildReviewSubjectEntryLookup({
    grammar: mergedGrammar,
    terms: mergedTerms
  });
  const subjectGroupCards = subjectCards.filter((card) => {
    const identity = deriveReviewSubjectIdentity({
      cardId: card.id,
      cardType: card.cardType,
      front: card.front,
      entryLinks: card.entryLinks,
      entryLookup: subjectEntryLookup
    });

    return identity.subjectKey === subjectIdentity.subjectKey;
  });

  return {
    contextCards: subjectCards,
    entryLookup: buildEntryLookup(mergedTerms, mergedGrammar),
    mediaById,
    subjectCards: subjectGroupCards
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
      : await getGlossaryEntriesByCrossMediaGroupIds(
          input.database,
          "grammar",
          [input.subjectIdentity.crossMediaGroupId]
        );
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
  const mediaById = buildReviewMediaLookup(
    await listMediaCached(input.database)
  );

  const mergedTerms =
    input.subjectIdentity.entryType === "term"
      ? (mergeGlossaryEntries(
          input.terms,
          groupEntries as ReviewTermLookupEntry[]
        ) as ReviewTermLookupEntry[])
      : input.terms;
  const mergedGrammar =
    input.subjectIdentity.entryType === "grammar"
      ? (mergeGlossaryEntries(
          input.grammar,
          groupEntries as ReviewGrammarLookupEntry[]
        ) as ReviewGrammarLookupEntry[])
      : input.grammar;

  const subjectEntryLookup = buildReviewSubjectEntryLookup({
    grammar: mergedGrammar,
    terms: mergedTerms
  });

  const subjectGroupCards = subjectCards.filter((card) => {
    const identity = deriveReviewSubjectIdentity({
      cardId: card.id,
      cardType: card.cardType,
      front: card.front,
      entryLinks: card.entryLinks,
      entryLookup: subjectEntryLookup
    });

    return identity.subjectKey === input.subjectIdentity.subjectKey;
  });

  return {
    contextCards: subjectCards,
    entryLookup: buildEntryLookup(mergedTerms, mergedGrammar),
    mediaById,
    subjectCards: subjectGroupCards
  };
}

function buildSingleReviewSubjectCardContext(input: {
  card: ReviewCardWithOptionalMedia;
  grammar: ReviewGrammarLookupEntry[];
  terms: ReviewTermLookupEntry[];
}) {
  return {
    contextCards: [input.card],
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
