import {
  buildReviewSeedStateWithFsrsPreset,
  type FsrsOptimizerSeedSnapshot
} from "@/features/fsrs-optimizer/model/snapshot";
import { mediaReviewCardHref } from "@/features/navigation";
import type { ReviewCardSource } from "@/features/review/model/card-contract";
import { buildReviewQueueSubjectSnapshot } from "@/features/review/model/queue";
import {
  buildBucketDetail,
  formatBucketLabel,
  formatShortIsoDate
} from "@/features/review/model/queue-presentation";
import type { ReviewQueueStateSnapshot } from "@/features/review/model/queue-state";
import type { ReviewSubjectModel } from "@/features/review/model/queue-types";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";
import {
  capitalizeToken,
  formatReviewStateLabel
} from "@/features/study/model/format";

import {
  buildReviewCardContexts,
  buildReviewCardExampleAudio,
  buildReviewCardPronunciations,
  mapQueueCard,
  resolveReviewCardMedia,
  resolveReviewCardReading,
  type ReviewEntryLookupItem,
  type ReviewMediaLookup
} from "./card-presenters";
import type { ReviewFirstCandidateCard, ReviewQueueCard } from "../types";

type ReviewQueueCardMapInput = {
  contextCache?: Map<string, ReviewQueueCard["contexts"]>;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot: FsrsOptimizerSeedSnapshot;
  includePronunciations?: boolean;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  selectedCardId?: string | null;
  visibleMediaId?: string;
};

export function buildReviewAdvanceCardsFromQueueModels(input: {
  advanceCardModels: ReviewSubjectModel[];
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot: FsrsOptimizerSeedSnapshot;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  selectedCardId?: string | null;
  visibleMediaId?: string;
}) {
  const contextCache = new Map<string, ReviewQueueCard["contexts"]>();

  return input.advanceCardModels.map((model) =>
    mapReviewQueueSubjectModel(model, {
      contextCache,
      entryLookup: input.entryLookup,
      fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
      includePronunciations: true,
      mediaById: input.mediaById,
      nowIso: input.nowIso,
      selectedCardId: input.selectedCardId,
      visibleMediaId: input.visibleMediaId
    })
  );
}

export function mapReviewQueueSubjectCardPreview(input: {
  card: ReviewCardSource;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot: FsrsOptimizerSeedSnapshot;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  queueStateSnapshot: ReviewQueueStateSnapshot;
  schedulingKey: string;
}) {
  const cardMedia = resolveReviewCardMedia(input.card, input.mediaById);

  return {
    back: input.card.back,
    bucket: input.queueStateSnapshot.bucket,
    bucketDetail: buildBucketDetail(
      input.queueStateSnapshot.bucket,
      input.queueStateSnapshot.dueAt
    ),
    bucketLabel: formatBucketLabel(input.queueStateSnapshot.bucket),
    createdAt: input.card.createdAt,
    dueAt: input.queueStateSnapshot.dueAt,
    dueLabel: input.queueStateSnapshot.dueAt
      ? `Scadenza ${formatShortIsoDate(input.queueStateSnapshot.dueAt)}`
      : undefined,
    effectiveState: input.queueStateSnapshot.effectiveState,
    effectiveStateLabel: formatReviewStateLabel(
      input.queueStateSnapshot.effectiveState,
      input.queueStateSnapshot.effectiveState === "known_manual"
    ),
    exampleAudio: buildReviewCardExampleAudio(input.card, cardMedia.slug),
    exampleIt: input.card.exampleIt ?? undefined,
    exampleJp: input.card.exampleJp ?? undefined,
    front: input.card.front,
    href: mediaReviewCardHref(cardMedia.slug, input.card.id),
    id: input.card.id,
    mediaSlug: cardMedia.slug,
    mediaTitle: cardMedia.title,
    notes: input.card.notesIt ?? undefined,
    orderIndex: input.card.orderIndex,
    pronunciations: buildReviewCardPronunciations(
      input.card,
      input.entryLookup
    ),
    rawReviewLabel: input.queueStateSnapshot.rawReviewLabel,
    reading: resolveReviewCardReading(input.card, input.entryLookup),
    reviewSeedState: {
      ...buildReviewSeedStateWithFsrsPreset(
        input.queueStateSnapshot.reviewSeedState,
        input.card.cardType,
        input.fsrsOptimizerSnapshot
      ),
      schedulingKey: input.schedulingKey
    },
    segmentTitle: input.card.segment?.title ?? undefined,
    typeLabel: capitalizeToken(input.card.cardType)
  } satisfies ReviewFirstCandidateCard;
}

export function buildReviewQueueSnapshot(input: {
  cards: ReviewCardSource[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  extraNewAnchorCount?: number | null;
  extraNewCount: number;
  fsrsOptimizerSnapshot: FsrsOptimizerSeedSnapshot;
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
    extraNewAnchorCount: input.extraNewAnchorCount,
    extraNewCount: input.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount,
    nowIso: input.nowIso,
    subjectGroups: input.subjectGroups,
    visibleMediaId: input.visibleMediaId
  });
  const mapInput: ReviewQueueCardMapInput = {
    contextCache: new Map(),
    entryLookup: input.entryLookup,
    fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
    mediaById: input.mediaById,
    nowIso: input.nowIso,
    visibleMediaId: input.visibleMediaId
  };

  return {
    advanceCards: [],
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
    nextDueAt: snapshot.nextDueAt ?? null,
    nextLearningDueAt: snapshot.nextLearningDueAt ?? null,
    queueLabel: snapshot.introLabel,
    queueCount: snapshot.queueCount,
    suspendedCards: snapshot.suspendedModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    suspendedCount: snapshot.suspendedCount,
    tomorrowCount: snapshot.tomorrowCount,
    upcomingCards: snapshot.upcomingModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    upcomingCount: snapshot.upcomingCount
  };
}

export function mapReviewQueueSubjectModel(
  model: ReviewSubjectModel,
  input: ReviewQueueCardMapInput
) {
  const selectedCard = resolveReviewSubjectSelectionCard({
    selectedCardId: input.selectedCardId,
    subjectModel: model
  });

  return mapQueueCard(
    selectedCard,
    input.entryLookup,
    model.group.cards,
    input.mediaById,
    input.nowIso,
    input.fsrsOptimizerSnapshot,
    model.queueStateSnapshot,
    resolveReviewQueueSubjectContexts(
      model.group,
      input.mediaById,
      input.contextCache,
      input.visibleMediaId
    ),
    {
      includePronunciations: input.includePronunciations,
      reviewStateUpdatedAt: model.group.subjectState?.updatedAt ?? null,
      schedulingKey: model.group.identity.subjectKey
    }
  );
}

function resolveReviewQueueSubjectContexts(
  group: ReviewSubjectGroup,
  mediaById: ReviewMediaLookup,
  contextCache?: Map<string, ReviewQueueCard["contexts"]>,
  visibleMediaId?: string
) {
  const cacheKey = `${group.identity.subjectKey}:${visibleMediaId ?? "all"}`;
  const cached = contextCache?.get(cacheKey);

  if (cached) {
    return cached;
  }

  const contexts = buildReviewCardContexts(
    visibleMediaId
      ? group.cards.filter((card) => card.mediaId === visibleMediaId)
      : group.cards,
    mediaById
  );

  contextCache?.set(cacheKey, contexts);

  return contexts;
}

export function resolveReviewSubjectSelectionCard(input: {
  selectedCardId?: string | null;
  subjectModel: ReviewSubjectModel;
}) {
  return (
    (input.selectedCardId
      ? input.subjectModel.group.cards.find(
          (card) => card.id === input.selectedCardId
        )
      : null) ?? input.subjectModel.card
  );
}
