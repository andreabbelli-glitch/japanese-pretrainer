import {
  mediaGlossaryEntryHref,
  mediaReviewCardHref
} from "@/features/navigation";
import {
  buildReviewSeedStateWithFsrsPreset,
  DEFAULT_FSRS_OPTIMIZER_SEED_SNAPSHOT,
  type FsrsOptimizerSeedSnapshot
} from "@/features/fsrs-optimizer/model/snapshot";
import {
  getDrivingEntryLinks,
  type ReviewEntryLinkLike
} from "@/features/review/model/state";
import { matchesReviewSubjectEntrySurface } from "@/features/review/model/subject";
import type {
  ReviewCardEntryLink,
  ReviewCardSegmentSource,
  ReviewCardSource
} from "@/features/review/model/card-contract";
import {
  type ReviewQueueStateSnapshot,
  resolveReviewQueueState
} from "@/features/review/model/queue-state";
import {
  buildBucketDetail,
  formatBucketLabel,
  formatShortIsoDate
} from "@/features/review/model/queue-presentation";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatReviewStateLabel
} from "@/features/study/model/format";
import { buildEntryKey } from "@/features/study/model/entry-id";
import { deriveInlineReading } from "@/features/study/model/inline-markdown.ts";
import { stripInlineMarkdown } from "@/features/study/ui/furigana";
import {
  buildPronunciationData,
  type PronunciationData
} from "@/features/pronunciation/model/data";

import type {
  ReviewCardEntryKind,
  ReviewCardEntrySummary,
  ReviewCardPronunciation,
  ReviewQueueCard
} from "../types";

type ReviewLookupMediaSource =
  | {
      media: {
        slug: string;
      };
    }
  | {
      mediaSlug: string;
    };

type ReviewLookupPronunciationFields = {
  audioAttribution?: string | null;
  audioLicense?: string | null;
  audioPageUrl?: string | null;
  audioSource?: string | null;
  audioSpeaker?: string | null;
  audioSrc?: string | null;
  pitchAccent?: number | null;
  pitchAccentPageUrl?: string | null;
  pitchAccentSource?: string | null;
};

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

export type ReviewTermLookupEntry = ReviewLookupMediaSource &
  ReviewLookupPronunciationFields & {
    crossMediaGroupId: string | null;
    id: string;
    lemma: string;
    meaningIt: string;
    reading: string | null;
    romaji?: string | null;
    sourceId: string;
  };

export type ReviewGrammarLookupEntry = ReviewLookupMediaSource &
  ReviewLookupPronunciationFields & {
    crossMediaGroupId: string | null;
    id: string;
    meaningIt: string;
    pattern: string;
    reading: string | null;
    sourceId: string;
    title: string;
  };

export type ReviewMediaLookup = Map<
  string,
  {
    slug: string;
    title: string;
  }
>;

type ReviewMediaLookupItem = {
  id: string;
  slug: string;
  title: string;
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

export function buildReviewMediaLookup(
  media: ReviewMediaLookupItem[]
): ReviewMediaLookup {
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
  media: ReviewMediaLookupItem
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
      reading: entry.reading ?? undefined,
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
  fsrsOptimizerSnapshot?: FsrsOptimizerSeedSnapshot,
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
      fsrsOptimizerSnapshot ?? DEFAULT_FSRS_OPTIMIZER_SEED_SNAPSHOT
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

export function buildReviewCardContexts(
  cards: Array<
    Pick<ReviewCardSource, "front" | "id" | "mediaId"> & {
      segment?: ReviewCardSegmentSource | null;
    }
  >,
  mediaById: ReviewMediaLookup
): ReviewQueueCard["contexts"] {
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
