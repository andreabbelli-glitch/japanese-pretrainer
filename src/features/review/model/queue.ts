import { stripInlineMarkdown } from "@/features/study/model/inline-markdown";
import type { ReviewCardSource } from "@/features/review/model/card-contract";
import {
  groupReviewCardsBySubject,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectEntryMeta,
  type ReviewSubjectGroup,
  type ReviewSubjectStateSnapshot
} from "@/features/review/model/subject";
import type {
  ReviewOverviewSnapshot,
  ReviewQueueCard
} from "@/features/review/types";
import { resolveReviewQueueState } from "@/features/review/model/queue-state";
import type {
  ReviewQueueSubjectSnapshot,
  ReviewSubjectModel
} from "@/features/review/model/queue-types";

export {
  buildReviewFirstCandidateSelectedCardContext,
  resolveReviewPageSelection
} from "@/features/review/model/queue-selection";
export {
  buildBucketDetail,
  formatBucketLabel,
  formatShortIsoDate
} from "@/features/review/model/queue-presentation";
export type {
  ReviewQueueSubjectSnapshot,
  ReviewSubjectModel
} from "@/features/review/model/queue-types";

function createReviewSubjectVisibilityResolver(visibleMediaId?: string) {
  if (!visibleMediaId) {
    return () => true;
  }

  const visibilityBySubjectKey = new Map<string, boolean>();

  return (group: ReviewSubjectGroup) => {
    const cacheKey = group.identity.subjectKey;
    const cached = visibilityBySubjectKey.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const visible = group.cards.some((card) => card.mediaId === visibleMediaId);

    visibilityBySubjectKey.set(cacheKey, visible);
    return visible;
  };
}

export function buildReviewSubjectModels(input: {
  cards: ReviewCardSource[];
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
  const activePreferredCards = preferredCards.filter(
    (card) => card.status !== "suspended"
  );
  const displayCards =
    activePreferredCards.length > 0 ? activePreferredCards : preferredCards;

  if (
    displayCards.length === 0 ||
    displayCards.length === model.group.cards.length
  ) {
    return model;
  }

  const selectedCard = selectReviewSubjectRepresentativeCard(
    displayCards,
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
  isVisibleInMedia: (group: ReviewSubjectGroup) => boolean;
  newSlots: number;
  resolveModelForDisplay: (model: ReviewSubjectModel) => ReviewSubjectModel;
  visibleMediaId?: string;
}) {
  const queuedNewModels = input.classifiedModels.globalNewModels
    .slice(0, input.newSlots)
    .filter((model) => input.isVisibleInMedia(model.group));

  if (!input.visibleMediaId) {
    return queuedNewModels;
  }

  return queuedNewModels
    .map(input.resolveModelForDisplay)
    .filter((model) => model.queueStateSnapshot.bucket === "new")
    .sort(compareReviewSubjectModelsByOrder);
}

function mapReviewSubjectModelsForVisibleMedia(
  models: ReviewSubjectModel[],
  resolveModelForDisplay: (model: ReviewSubjectModel) => ReviewSubjectModel,
  visibleMediaId: string | undefined
) {
  return visibleMediaId ? models.map(resolveModelForDisplay) : models;
}

function createReviewSubjectDisplayResolver(input: {
  nowIso: string;
  visibleMediaId?: string;
}) {
  if (!input.visibleMediaId) {
    return (model: ReviewSubjectModel) => model;
  }

  const resolvedModels = new Map<string, ReviewSubjectModel>();

  return (model: ReviewSubjectModel) => {
    const cacheKey = model.group.identity.subjectKey;
    const cached = resolvedModels.get(cacheKey);

    if (cached) {
      return cached;
    }

    const resolved = preferReviewSubjectModelCardForMedia(
      model,
      input.visibleMediaId,
      input.nowIso
    );

    resolvedModels.set(cacheKey, resolved);
    return resolved;
  };
}

function resolveQueuedNewSlots(input: {
  dailyLimit: number;
  extraNewAnchorCount?: number | null;
  extraNewCount: number;
  newIntroducedTodayCount: number;
}) {
  const baseNewSlots = Math.max(
    input.dailyLimit - input.newIntroducedTodayCount,
    0
  );
  const extraNewCount = Math.max(input.extraNewCount, 0);

  if (extraNewCount === 0) {
    return baseNewSlots;
  }

  const extraNewAnchorCount =
    input.extraNewAnchorCount ?? input.newIntroducedTodayCount;
  const extraNewBaseline = Math.max(input.dailyLimit, extraNewAnchorCount);
  const extraNewConsumedCount = Math.max(
    input.newIntroducedTodayCount - extraNewBaseline,
    0
  );
  const remainingExtraNewSlots = Math.max(
    extraNewCount - extraNewConsumedCount,
    0
  );

  return baseNewSlots + remainingExtraNewSlots;
}

export function buildReviewOverviewSnapshot(input: {
  cards: ReviewCardSource[];
  dailyLimit: number;
  entryLookup: Map<string, unknown>;
  extraNewAnchorCount?: number | null;
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
  const modelBuckets =
    input.buckets ?? bucketAndSortReviewSubjectModels(models);
  const isVisibleInMedia = createReviewSubjectVisibilityResolver(
    input.visibleMediaId
  );
  const resolveModelForDisplay = createReviewSubjectDisplayResolver({
    nowIso: input.nowIso,
    visibleMediaId: input.visibleMediaId
  });
  const classifiedModels = classifyReviewSubjectModels(
    modelBuckets,
    isVisibleInMedia,
    resolveModelForDisplay,
    input.visibleMediaId
  );
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = resolveQueuedNewSlots({
    dailyLimit: input.dailyLimit,
    extraNewAnchorCount: input.extraNewAnchorCount,
    extraNewCount: input.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount
  });
  const queuedNewModels = buildQueuedNewReviewSubjectModels({
    classifiedModels,
    isVisibleInMedia,
    newSlots,
    resolveModelForDisplay,
    visibleMediaId: input.visibleMediaId
  });
  const dueModelsForDisplay = mapReviewSubjectModelsForVisibleMedia(
    classifiedModels.dueModels,
    resolveModelForDisplay,
    input.visibleMediaId
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
  cards: ReviewCardSource[];
  dailyLimit: number;
  entryLookup: Map<string, unknown>;
  excludeCardIds?: string[];
  extraNewAnchorCount?: number | null;
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
        (model) => !model.group.cards.some((card) => excludeSet.has(card.id))
      )
    : allSubjectModels;
  const isVisibleInMedia = createReviewSubjectVisibilityResolver(
    input.visibleMediaId
  );
  const visibleSubjectModels = input.visibleMediaId
    ? subjectModels.filter((model) => isVisibleInMedia(model.group))
    : subjectModels;
  const buckets = bucketAndSortReviewSubjectModels(subjectModels);
  const resolveModelForDisplay = createReviewSubjectDisplayResolver({
    nowIso: input.nowIso,
    visibleMediaId: input.visibleMediaId
  });
  const classifiedModels = classifyReviewSubjectModels(
    buckets,
    isVisibleInMedia,
    resolveModelForDisplay,
    input.visibleMediaId
  );
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = resolveQueuedNewSlots({
    dailyLimit: input.dailyLimit,
    extraNewAnchorCount: input.extraNewAnchorCount,
    extraNewCount: input.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount
  });
  const mapModelsForDisplay = (models: ReviewSubjectModel[]) =>
    mapReviewSubjectModelsForVisibleMedia(
      models,
      resolveModelForDisplay,
      input.visibleMediaId
    );
  const queuedNewModels = buildQueuedNewReviewSubjectModels({
    classifiedModels,
    isVisibleInMedia,
    newSlots,
    resolveModelForDisplay,
    visibleMediaId: input.visibleMediaId
  });
  const mappedManualModels = mapModelsForDisplay(classifiedModels.manualModels);
  const mappedSuspendedModels = mapModelsForDisplay(
    classifiedModels.suspendedModels
  );
  const mappedUpcomingModels = mapModelsForDisplay(
    classifiedModels.upcomingModels
  );
  const mappedDueModels = mapModelsForDisplay(classifiedModels.dueModels);

  // queuedNewModels are already resolved for display inside buildQueuedNewReviewSubjectModels if visibleMediaId is provided.
  const queueModels = [...mappedDueModels, ...queuedNewModels];
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
    manualModels: mappedManualModels,
    newAvailableCount: classifiedModels.visibleNewModels.length,
    newQueuedCount: queuedNewModels.length,
    queueCount: queueModels.length,
    queueModels,
    subjectModels: visibleSubjectModels,
    suspendedCount: classifiedModels.suspendedModels.length,
    suspendedModels: mappedSuspendedModels,
    tomorrowCount: countUpcomingDueTomorrow(
      classifiedModels.upcomingModels,
      input.nowIso
    ),
    upcomingCount: classifiedModels.upcomingModels.length,
    upcomingModels: mappedUpcomingModels,
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
  isVisibleInMedia: (group: ReviewSubjectGroup) => boolean,
  resolveModelForDisplay: (model: ReviewSubjectModel) => ReviewSubjectModel,
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

  const dueModels: ReviewSubjectModel[] = [];
  const visibleNewModels: ReviewSubjectModel[] = [];
  const manualModels: ReviewSubjectModel[] = [];
  const suspendedModels: ReviewSubjectModel[] = [];
  const upcomingModels: ReviewSubjectModel[] = [];
  const reclassifyVisibleModels = (models: ReviewSubjectModel[]) => {
    for (const model of models) {
      if (!isVisibleInMedia(model.group)) {
        continue;
      }

      const displayModel = resolveModelForDisplay(model);

      switch (displayModel.queueStateSnapshot.bucket) {
        case "due":
          dueModels.push(displayModel);
          break;
        case "new":
          visibleNewModels.push(displayModel);
          break;
        case "manual":
          manualModels.push(displayModel);
          break;
        case "suspended":
          suspendedModels.push(displayModel);
          break;
        case "upcoming":
          upcomingModels.push(displayModel);
          break;
      }
    }
  };

  reclassifyVisibleModels(buckets.dueModels);
  reclassifyVisibleModels(buckets.newModels);
  reclassifyVisibleModels(buckets.manualModels);
  reclassifyVisibleModels(buckets.suspendedModels);
  reclassifyVisibleModels(buckets.upcomingModels);

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

export function buildQueueIntroLabel(input: {
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
