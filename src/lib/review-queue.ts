import type { ReviewCardListItem } from "@/db";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import { formatReviewStateLabel } from "@/lib/study-format";

import {
  isReviewCardDue,
  isReviewCardNew,
  resolveEffectiveReviewState,
  type EffectiveReviewState
} from "./review-model";
import { type ReviewState } from "./review-scheduler";
import {
  groupReviewCardsBySubject,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectEntryMeta,
  type ReviewSubjectGroup,
  type ReviewSubjectStateSnapshot
} from "./review-subject";
import type {
  ReviewFirstCandidateSelectedCardContext,
  ReviewOverviewSnapshot,
  ReviewQueueCard
} from "./review-types";
import type { ReviewSearchState } from "./review-search-state";
import { formatLocalIsoDate } from "./local-date";

export type ReviewQueueStateSnapshot = {
  bucket: ReviewQueueCard["bucket"];
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  rawReviewLabel: string;
  reviewSeedState: ReviewQueueCard["reviewSeedState"];
};

export type ReviewSubjectModel = {
  card: ReviewCardListItem;
  group: ReviewSubjectGroup;
  queueStateSnapshot: ReviewQueueStateSnapshot;
};

export type ReviewQueueSubjectSnapshot = {
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  introLabel: string;
  manualCount: number;
  manualModels: ReviewSubjectModel[];
  newAvailableCount: number;
  newQueuedCount: number;
  queueCount: number;
  queueModels: ReviewSubjectModel[];
  subjectModels: ReviewSubjectModel[];
  suspendedCount: number;
  suspendedModels: ReviewSubjectModel[];
  tomorrowCount: number;
  upcomingCount: number;
  upcomingModels: ReviewSubjectModel[];
  visibleMediaId?: string;
};

function isReviewSubjectVisibleInMedia(
  group: ReviewSubjectGroup,
  visibleMediaId?: string
) {
  return (
    !visibleMediaId ||
    group.cards.some((card) => card.mediaId === visibleMediaId)
  );
}

export function resolveReviewQueueState(
  cardStatus: string,
  reviewState: ReviewSubjectStateSnapshot | null,
  nowIso: string
): ReviewQueueStateSnapshot {
  const effectiveState = resolveEffectiveReviewState({
    cardStatus,
    reviewState: reviewState
      ? {
          manualOverride: reviewState.manualOverride,
          suspended: reviewState.suspended,
          state: reviewState.state as ReviewState
        }
      : null
  });
  const rawReviewLabel = formatReviewStateLabel(
    reviewState?.state ?? null,
    reviewState?.manualOverride ?? false
  );
  const dueAt = reviewState?.dueAt ?? null;

  return {
    bucket: resolveCardBucket({
      asOfIso: nowIso,
      dueAt,
      effectiveState: effectiveState.state,
      reviewState: (reviewState?.state as ReviewState | null) ?? null
    }),
    dueAt,
    effectiveState: effectiveState.state,
    rawReviewLabel,
    reviewSeedState: {
      difficulty: reviewState?.difficulty ?? null,
      dueAt: reviewState?.dueAt ?? null,
      lapses: reviewState?.lapses ?? 0,
      lastReviewedAt: reviewState?.lastReviewedAt ?? null,
      learningSteps: reviewState?.learningSteps ?? 0,
      reps: reviewState?.reps ?? 0,
      scheduledDays: reviewState?.scheduledDays ?? 0,
      stability: reviewState?.stability ?? null,
      state: (reviewState?.state as ReviewState | null) ?? null
    }
  };
}

export function buildReviewSubjectModels(input: {
  cards: ReviewCardListItem[];
  entryLookup: Map<string, unknown>;
  nowIso: string;
  subjectGroups?: ReviewSubjectGroup[];
  subjectStates?: Map<string, ReviewSubjectStateSnapshot>;
}) {
  const subjectGroups =
    input.subjectGroups ??
    groupReviewCardsBySubject({
      cards: input.cards,
      entryLookup: input.entryLookup as Map<string, ReviewSubjectEntryMeta>,
      nowIso: input.nowIso,
      subjectStates: input.subjectStates ?? new Map()
    });

  return subjectGroups.map((group) => {
    const selectedCard = group.representativeCard;

    return {
      card: selectedCard,
      group,
      queueStateSnapshot: resolveReviewQueueState(
        selectedCard.status,
        group.subjectState,
        input.nowIso
      )
    } satisfies ReviewSubjectModel;
  });
}

function preferReviewSubjectModelCardForMedia(
  model: ReviewSubjectModel,
  preferredMediaId: string | undefined,
  nowIso: string
) {
  if (!preferredMediaId) {
    return model;
  }

  const preferredCards = model.group.cards.filter(
    (card) => card.mediaId === preferredMediaId
  );

  if (
    preferredCards.length === 0 ||
    preferredCards.length === model.group.cards.length
  ) {
    return model;
  }

  const selectedCard = selectReviewSubjectRepresentativeCard(
    preferredCards,
    model.group.subjectState,
    nowIso
  );

  return {
    card: selectedCard,
    group: model.group,
    queueStateSnapshot: resolveReviewQueueState(
      selectedCard.status,
      model.group.subjectState,
      nowIso
    )
  } satisfies ReviewSubjectModel;
}

export function findReviewQueueSubjectModelByCardId(
  models: ReviewSubjectModel[],
  cardId: string,
  visibleMediaId?: string
) {
  return (
    models.find((model) => {
      const selectedCard =
        model.group.cards.find((card) => card.id === cardId) ?? null;

      return (
        selectedCard !== null &&
        (!visibleMediaId || selectedCard.mediaId === visibleMediaId)
      );
    }) ?? null
  );
}

export function resolveReviewPageSelection(input: {
  queueSnapshot: ReviewQueueSubjectSnapshot;
  searchState: ReviewSearchState;
}) {
  const visibleSelectionModels = [
    ...input.queueSnapshot.queueModels,
    ...input.queueSnapshot.manualModels,
    ...input.queueSnapshot.suspendedModels,
    ...input.queueSnapshot.upcomingModels
  ];
  const explicitSelectionModel = input.searchState.selectedCardId
    ? findReviewQueueSubjectModelByCardId(
        visibleSelectionModels,
        input.searchState.selectedCardId,
        input.queueSnapshot.visibleMediaId
      )
    : null;
  const fallbackSelectionModel =
    input.searchState.selectedCardId && explicitSelectionModel === null
      ? findReviewQueueSubjectModelByCardId(
          input.queueSnapshot.subjectModels,
          input.searchState.selectedCardId,
          input.queueSnapshot.visibleMediaId
        )
      : null;
  const selectedModel =
    explicitSelectionModel ??
    fallbackSelectionModel ??
    input.queueSnapshot.queueModels[0] ??
    null;
  const selectedCardId =
    explicitSelectionModel || fallbackSelectionModel
      ? input.searchState.selectedCardId
      : null;
  const selectedQueueModel = selectedModel
    ? findReviewQueueSubjectModelByCardId(
        input.queueSnapshot.queueModels,
        selectedModel.card.id
      )
    : null;
  const queueIndex = selectedQueueModel
    ? input.queueSnapshot.queueModels.indexOf(selectedQueueModel)
    : -1;

  return {
    queueIndex,
    selectedCardId,
    selectedModel,
    selectedQueueModel
  };
}

export function buildReviewFirstCandidateSelectedCardContext(input: {
  bucket: ReviewQueueCard["bucket"] | null;
  queueIndex: number;
  queueSnapshot: ReviewQueueSubjectSnapshot;
  searchState: ReviewSearchState;
}): ReviewFirstCandidateSelectedCardContext {
  return {
    bucket: input.bucket,
    isQueueCard: input.queueIndex >= 0,
    position: input.queueIndex >= 0 ? input.queueIndex + 1 : null,
    remainingCount:
      input.queueIndex >= 0
        ? input.queueSnapshot.queueCount - input.queueIndex - 1
        : 0,
    showAnswer: input.searchState.showAnswer || input.queueIndex < 0
  };
}

function compareReviewSubjectModelsByDue(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel
) {
  if (
    (left.queueStateSnapshot.dueAt ?? "") !==
    (right.queueStateSnapshot.dueAt ?? "")
  ) {
    return (left.queueStateSnapshot.dueAt ?? "9999").localeCompare(
      right.queueStateSnapshot.dueAt ?? "9999"
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

function compareReviewSubjectModelsByOrder(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel
) {
  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  return compareReviewCardsByOrder(left.card, right.card);
}

function buildQueuedNewReviewSubjectModels(input: {
  classifiedModels: ReturnType<typeof classifyReviewSubjectModels>;
  newSlots: number;
  nowIso: string;
  visibleMediaId?: string;
}) {
  const queuedNewModels = input.classifiedModels.globalNewModels
    .slice(0, input.newSlots)
    .filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
    );

  if (!input.visibleMediaId) {
    return queuedNewModels;
  }

  return queuedNewModels
    .map((model) =>
      preferReviewSubjectModelCardForMedia(
        model,
        input.visibleMediaId,
        input.nowIso
      )
    )
    .sort(compareReviewSubjectModelsByOrder);
}

function mapReviewSubjectModelsForVisibleMedia(
  models: ReviewSubjectModel[],
  visibleMediaId: string | undefined,
  nowIso: string
) {
  return visibleMediaId
    ? models.map((model) =>
        preferReviewSubjectModelCardForMedia(model, visibleMediaId, nowIso)
      )
    : models;
}

function resolveQueuedNewSlots(input: {
  dailyLimit: number;
  extraNewCount: number;
  newIntroducedTodayCount: number;
}) {
  const baseNewSlots = Math.max(
    input.dailyLimit - input.newIntroducedTodayCount,
    0
  );

  return baseNewSlots + input.extraNewCount;
}

export function buildReviewOverviewSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, unknown>;
  extraNewCount: number;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups?: ReviewSubjectGroup[];
  subjectModels?: ReviewSubjectModel[];
  buckets?: ReturnType<typeof bucketAndSortReviewSubjectModels>;
  subjectStates?: Map<string, ReviewSubjectStateSnapshot>;
  visibleMediaId?: string;
}): ReviewOverviewSnapshot {
  const models =
    input.subjectModels ??
    buildReviewSubjectModels({
      cards: input.cards,
      entryLookup: input.entryLookup,
      nowIso: input.nowIso,
      subjectGroups: input.subjectGroups,
      subjectStates: input.subjectStates
    });
  const modelBuckets = input.buckets ?? bucketAndSortReviewSubjectModels(models);
  const classifiedModels = classifyReviewSubjectModels(
    modelBuckets,
    input.visibleMediaId
  );
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = resolveQueuedNewSlots({
    dailyLimit: input.dailyLimit,
    extraNewCount: input.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount
  });
  const queuedNewModels = buildQueuedNewReviewSubjectModels({
    classifiedModels,
    newSlots,
    nowIso: input.nowIso,
    visibleMediaId: input.visibleMediaId
  });
  const dueModelsForDisplay = mapReviewSubjectModelsForVisibleMedia(
    classifiedModels.dueModels,
    input.visibleMediaId,
    input.nowIso
  );

  const dueCount = classifiedModels.dueModels.length;
  const newQueuedCount = queuedNewModels.length;
  const manualCount = classifiedModels.manualModels.length;
  const upcomingCount = classifiedModels.upcomingModels.length;
  const queueLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount,
    manualCount,
    newQueuedCount,
    sessionTopUpNewCount: input.extraNewCount,
    upcomingCount
  });

  const firstQueueModel = dueModelsForDisplay[0] ?? queuedNewModels[0];

  return {
    activeCards: dueCount + upcomingCount,
    dailyLimit: input.dailyLimit,
    dueCount,
    effectiveDailyLimit,
    manualCount,
    newAvailableCount: classifiedModels.visibleNewModels.length,
    newQueuedCount,
    nextCardFront: firstQueueModel?.card.front
      ? stripInlineMarkdown(firstQueueModel.card.front)
      : undefined,
    queueCount: dueCount + newQueuedCount,
    queueLabel,
    suspendedCount: classifiedModels.suspendedModels.length,
    tomorrowCount: countUpcomingDueTomorrow(
      classifiedModels.upcomingModels,
      input.nowIso
    ),
    totalCards: classifiedModels.visibleModelCount,
    upcomingCount
  };
}

export function buildReviewQueueSubjectSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, unknown>;
  excludeCardIds?: string[];
  extraNewCount: number;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
}): ReviewQueueSubjectSnapshot {
  const allSubjectModels = buildReviewSubjectModels({
    cards: input.cards,
    entryLookup: input.entryLookup,
    nowIso: input.nowIso,
    subjectGroups: input.subjectGroups
  });
  const excludeSet =
    input.excludeCardIds && input.excludeCardIds.length > 0
      ? new Set(input.excludeCardIds)
      : null;
  const subjectModels = excludeSet
    ? allSubjectModels.filter(
        (model) =>
          !model.group.cards.some((card) => excludeSet.has(card.id))
      )
    : allSubjectModels;
  const visibleSubjectModels = input.visibleMediaId
    ? subjectModels.filter((model) =>
        isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
      )
    : subjectModels;
  const buckets = bucketAndSortReviewSubjectModels(subjectModels);
  const classifiedModels = classifyReviewSubjectModels(
    buckets,
    input.visibleMediaId
  );
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = resolveQueuedNewSlots({
    dailyLimit: input.dailyLimit,
    extraNewCount: input.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount
  });
  const mapModelsForDisplay = (models: ReviewSubjectModel[]) =>
    mapReviewSubjectModelsForVisibleMedia(
      models,
      input.visibleMediaId,
      input.nowIso
    );
  const queuedNewModels = buildQueuedNewReviewSubjectModels({
    classifiedModels,
    newSlots,
    nowIso: input.nowIso,
    visibleMediaId: input.visibleMediaId
  });
  const queueModels = mapModelsForDisplay([
    ...classifiedModels.dueModels,
    ...queuedNewModels
  ]);
  const introLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: classifiedModels.dueModels.length,
    manualCount: classifiedModels.manualModels.length,
    newQueuedCount: queuedNewModels.length,
    sessionTopUpNewCount: input.extraNewCount,
    upcomingCount: classifiedModels.upcomingModels.length
  });

  return {
    dailyLimit: input.dailyLimit,
    dueCount: classifiedModels.dueModels.length,
    effectiveDailyLimit,
    introLabel,
    manualCount: classifiedModels.manualModels.length,
    manualModels: mapModelsForDisplay(classifiedModels.manualModels),
    newAvailableCount: classifiedModels.visibleNewModels.length,
    newQueuedCount: queuedNewModels.length,
    queueCount: queueModels.length,
    queueModels,
    subjectModels: mapModelsForDisplay(visibleSubjectModels),
    suspendedCount: classifiedModels.suspendedModels.length,
    suspendedModels: mapModelsForDisplay(classifiedModels.suspendedModels),
    tomorrowCount: countUpcomingDueTomorrow(
      classifiedModels.upcomingModels,
      input.nowIso
    ),
    upcomingCount: classifiedModels.upcomingModels.length,
    upcomingModels: mapModelsForDisplay(classifiedModels.upcomingModels),
    visibleMediaId: input.visibleMediaId
  };
}

export function bucketAndSortReviewSubjectModels(models: ReviewSubjectModel[]) {
  const dueModels: ReviewSubjectModel[] = [];
  const newModels: ReviewSubjectModel[] = [];
  const manualModels: ReviewSubjectModel[] = [];
  const suspendedModels: ReviewSubjectModel[] = [];
  const upcomingModels: ReviewSubjectModel[] = [];

  for (const model of models) {
    switch (model.queueStateSnapshot.bucket) {
      case "due":
        dueModels.push(model);
        break;
      case "new":
        newModels.push(model);
        break;
      case "manual":
        manualModels.push(model);
        break;
      case "suspended":
        suspendedModels.push(model);
        break;
      case "upcoming":
        upcomingModels.push(model);
        break;
    }
  }

  dueModels.sort(compareReviewSubjectModelsByDue);
  upcomingModels.sort(compareReviewSubjectModelsByDue);
  newModels.sort(compareReviewSubjectModelsByOrder);
  manualModels.sort(compareReviewSubjectModelsByOrder);
  suspendedModels.sort(compareReviewSubjectModelsByOrder);

  return {
    dueModels,
    newModels,
    manualModels,
    suspendedModels,
    upcomingModels
  };
}

function classifyReviewSubjectModels(
  buckets: ReturnType<typeof bucketAndSortReviewSubjectModels>,
  visibleMediaId?: string
) {
  if (!visibleMediaId) {
    return {
      dueModels: buckets.dueModels,
      globalNewModels: buckets.newModels,
      manualModels: buckets.manualModels,
      suspendedModels: buckets.suspendedModels,
      upcomingModels: buckets.upcomingModels,
      visibleModelCount:
        buckets.dueModels.length +
        buckets.newModels.length +
        buckets.manualModels.length +
        buckets.suspendedModels.length +
        buckets.upcomingModels.length,
      visibleNewModels: buckets.newModels
    };
  }

  const filterVisible = (models: ReviewSubjectModel[]) =>
    models.filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, visibleMediaId)
    );

  const dueModels = filterVisible(buckets.dueModels);
  const visibleNewModels = filterVisible(buckets.newModels);
  const manualModels = filterVisible(buckets.manualModels);
  const suspendedModels = filterVisible(buckets.suspendedModels);
  const upcomingModels = filterVisible(buckets.upcomingModels);

  return {
    dueModels,
    globalNewModels: buckets.newModels,
    manualModels,
    suspendedModels,
    upcomingModels,
    visibleModelCount:
      dueModels.length +
      visibleNewModels.length +
      manualModels.length +
      suspendedModels.length +
      upcomingModels.length,
    visibleNewModels
  };
}

function countUpcomingDueTomorrow(
  upcomingModels: ReviewSubjectModel[],
  nowIso: string
): number {
  const now = new Date(nowIso);
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  const tomorrowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2
  );
  const tomorrowStartIso = tomorrowStart.toISOString();
  const tomorrowEndIso = tomorrowEnd.toISOString();

  return upcomingModels.filter((model) => {
    const dueAt = model.queueStateSnapshot.dueAt;
    return dueAt != null && dueAt >= tomorrowStartIso && dueAt < tomorrowEndIso;
  }).length;
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

  if (input.effectiveState === "known_manual") {
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
  sessionTopUpNewCount: number;
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
        input.sessionTopUpNewCount > 0
          ? input.newQueuedCount === 1
            ? "1 nuova è nella rotazione attuale di questa sessione"
            : `${input.newQueuedCount} nuove sono nella rotazione attuale di questa sessione`
          : input.newQueuedCount === 1
            ? "1 nuova prevista nella rotazione di oggi"
            : `${input.newQueuedCount} nuove previste nella rotazione di oggi`
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

export function buildBucketDetail(
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
    return "Una voce collegata è stata impostata manualmente come già nota.";
  }

  if (bucket === "suspended") {
    return "La card è stata messa in pausa e non entra nella sessione finché non la riattivi.";
  }

  return dueAt
    ? `Resta in rotazione. Prossima scadenza ${formatShortIsoDate(dueAt)}.`
    : "Resta in rotazione ma oggi non richiede un passaggio.";
}

export function formatBucketLabel(bucket: ReviewQueueCard["bucket"]) {
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

  return "Già nota";
}

export function formatShortIsoDate(value: string) {
  return formatLocalIsoDate(value);
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
