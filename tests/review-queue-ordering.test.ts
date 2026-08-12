import { forgetting_curve } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import type { ReviewCardSource } from "@/features/review/model/card-contract";
import {
  calculateReviewSubjectRetrievability,
  sortDueReviewSubjectModelsEasiestFirst
} from "@/features/review/model/queue-ordering";
import { resolveReviewQueueState } from "@/features/review/model/queue-state";
import type { ReviewSubjectModel } from "@/features/review/model/queue-types";
import { reviewSchedulerConfig } from "@/features/review/model/scheduler";
import {
  buildReviewSubjectIdentityFromCanonical,
  type ReviewSubjectStateSnapshot
} from "@/features/review/model/subject";
import {
  DEFAULT_FSRS_OPTIMIZER_CONFIG,
  type FsrsOptimizerSeedSnapshot,
  type FsrsOptimizedParameters,
  type FsrsPresetKey
} from "@/features/fsrs-optimizer/model/snapshot";

const NOW_ISO = "2026-04-10T12:00:00.000Z";

describe("review queue easiest-first ordering", () => {
  it("orders mature due reviews by descending FSRS retrievability instead of due age", () => {
    const easier = buildModel({
      dueAt: "2026-04-01T08:00:00.000Z",
      id: "easier",
      lastReviewedAt: "2026-04-09T12:00:00.000Z",
      stability: 5
    });
    const harder = buildModel({
      dueAt: "2026-04-10T10:00:00.000Z",
      id: "harder",
      lastReviewedAt: "2026-04-02T12:00:00.000Z",
      stability: 2
    });
    const easierRetrievability = calculateReviewSubjectRetrievability(
      easier,
      orderingContext()
    );
    const harderRetrievability = calculateReviewSubjectRetrievability(
      harder,
      orderingContext()
    );
    const models = [harder, easier];

    sortDueReviewSubjectModelsEasiestFirst(models, orderingContext());

    expect(easierRetrievability).not.toBeNull();
    expect(harderRetrievability).not.toBeNull();
    expect(easierRetrievability!).toBeGreaterThan(harderRetrievability!);
    expect(models.map((model) => model.card.id)).toEqual(["easier", "harder"]);
  });

  it("derives recall probability monotonically from elapsed days and stability", () => {
    const moreRecent = buildModel({
      id: "more-recent",
      lastReviewedAt: "2026-04-09T12:00:00.000Z",
      stability: 5
    });
    const moreElapsed = buildModel({
      id: "more-elapsed",
      lastReviewedAt: "2026-04-05T12:00:00.000Z",
      stability: 5
    });
    const moreStable = buildModel({
      id: "more-stable",
      lastReviewedAt: "2026-04-05T12:00:00.000Z",
      stability: 20
    });
    const lessStable = buildModel({
      id: "less-stable",
      lastReviewedAt: "2026-04-05T12:00:00.000Z",
      stability: 2
    });

    const retrievability = (model: ReviewSubjectModel) =>
      calculateReviewSubjectRetrievability(model, orderingContext())!;

    expect(retrievability(moreRecent)).toBeGreaterThan(
      retrievability(moreElapsed)
    );
    expect(retrievability(moreStable)).toBeGreaterThan(
      retrievability(lessStable)
    );
  });

  it("uses recall probability for intraday and mature due cards alike", () => {
    const matureEasy = buildModel({
      dueAt: "2026-04-01T08:00:00.000Z",
      id: "mature-easy",
      lastReviewedAt: "2026-04-10T08:00:00.000Z",
      stability: 100
    });
    const intradayLater = buildModel({
      dueAt: "2026-04-10T11:55:00.000Z",
      id: "intraday-later",
      lastReviewedAt: "2026-04-02T12:00:00.000Z",
      scheduledDays: 0,
      stability: 1,
      state: "relearning"
    });
    const intradayEarlier = buildModel({
      dueAt: "2026-04-10T11:30:00.000Z",
      id: "intraday-earlier",
      lastReviewedAt: "2026-04-05T12:00:00.000Z",
      scheduledDays: 0,
      stability: 2,
      state: "learning"
    });
    const models = [matureEasy, intradayLater, intradayEarlier];

    sortDueReviewSubjectModelsEasiestFirst(models, orderingContext());

    expect(models.map((model) => model.card.id)).toEqual([
      "mature-easy",
      "intraday-earlier",
      "intraday-later"
    ]);
  });

  it("uses the deterministic legacy due-time fallback for non-scoreable states", () => {
    const common = {
      difficulty: null,
      dueAt: "2026-04-10T10:00:00.000Z",
      lastReviewedAt: null,
      stability: null
    } as const;
    const olderDue = buildModel({
      ...common,
      dueAt: "2026-04-10T08:00:00.000Z",
      id: "older-due",
      lastInteractionAt: "2026-04-01T08:00:00.000Z",
      orderIndex: 99
    });
    const recentInteraction = buildModel({
      ...common,
      id: "recent-interaction",
      lastInteractionAt: "2026-04-10T09:00:00.000Z",
      orderIndex: 99
    });
    const lowerOrder = buildModel({
      ...common,
      id: "lower-order",
      lastInteractionAt: "2026-04-10T08:00:00.000Z",
      orderIndex: 1
    });
    const olderCreation = buildModel({
      ...common,
      createdAt: "2026-01-01T08:00:00.000Z",
      id: "older-creation",
      lastInteractionAt: "2026-04-10T08:00:00.000Z",
      orderIndex: 2
    });
    const subjectA = buildModel({
      ...common,
      createdAt: "2026-02-01T08:00:00.000Z",
      id: "subject-a",
      lastInteractionAt: "2026-04-10T08:00:00.000Z",
      orderIndex: 2
    });
    const subjectB = buildModel({
      ...common,
      createdAt: "2026-02-01T08:00:00.000Z",
      id: "subject-b",
      lastInteractionAt: "2026-04-10T08:00:00.000Z",
      orderIndex: 2
    });
    const models = [
      subjectB,
      lowerOrder,
      subjectA,
      recentInteraction,
      olderCreation,
      olderDue
    ];

    sortDueReviewSubjectModelsEasiestFirst(models, orderingContext());

    expect(models.map((model) => model.card.id)).toEqual([
      "older-due",
      "recent-interaction",
      "lower-order",
      "older-creation",
      "subject-a",
      "subject-b"
    ]);
  });

  it("uses the matching optimized weights for recognition and concept", () => {
    const recognitionWeights = [...reviewSchedulerConfig.fsrs.w];
    const conceptWeights = [...reviewSchedulerConfig.fsrs.w];
    recognitionWeights[20] = 0.1;
    conceptWeights[20] = 0.9;
    const fsrsOptimizerSnapshot: FsrsOptimizerSeedSnapshot = {
      config: DEFAULT_FSRS_OPTIMIZER_CONFIG,
      presets: {
        concept: buildPreset("concept", conceptWeights),
        recognition: buildPreset("recognition", recognitionWeights)
      }
    };
    const recognition = buildModel({
      cardType: "recognition",
      id: "recognition",
      lastReviewedAt: "2026-04-02T12:00:00.000Z",
      stability: 2
    });
    const concept = buildModel({
      cardType: "concept",
      id: "concept",
      lastReviewedAt: "2026-04-02T12:00:00.000Z",
      stability: 2
    });
    const context = orderingContext(fsrsOptimizerSnapshot);
    const recognitionRetrievability = calculateReviewSubjectRetrievability(
      recognition,
      context
    );
    const conceptRetrievability = calculateReviewSubjectRetrievability(
      concept,
      context
    );
    const models = [concept, recognition];

    sortDueReviewSubjectModelsEasiestFirst(models, context);

    expect(recognitionRetrievability).toBeCloseTo(
      forgetting_curve(recognitionWeights, 8, 2),
      8
    );
    expect(conceptRetrievability).toBeCloseTo(
      forgetting_curve(conceptWeights, 8, 2),
      8
    );
    expect(recognitionRetrievability!).toBeGreaterThan(conceptRetrievability!);
    expect(models.map((model) => model.card.id)).toEqual([
      "recognition",
      "concept"
    ]);
  });
});

function orderingContext(fsrsOptimizerSnapshot?: FsrsOptimizerSeedSnapshot) {
  return {
    fsrsOptimizerSnapshot,
    nowIso: NOW_ISO
  };
}

function buildPreset(
  presetKey: FsrsPresetKey,
  weights: number[]
): FsrsOptimizedParameters {
  return {
    desiredRetention: 0.9,
    presetKey,
    trainedAt: "2026-04-01T08:00:00.000Z",
    trainingReviewCount: 500,
    weights
  };
}

function buildModel(input: {
  cardType?: string;
  createdAt?: string;
  difficulty?: number | null;
  dueAt?: string;
  id: string;
  lastInteractionAt?: string;
  lastReviewedAt?: string | null;
  orderIndex?: number;
  scheduledDays?: number;
  stability?: number | null;
  state?: ReviewSubjectStateSnapshot["state"];
}): ReviewSubjectModel {
  const cardType = input.cardType ?? "recognition";
  const createdAt = input.createdAt ?? "2026-03-01T08:00:00.000Z";
  const dueAt = input.dueAt ?? "2026-04-10T10:00:00.000Z";
  const lastInteractionAt =
    input.lastInteractionAt ?? "2026-04-09T08:00:00.000Z";
  const card: ReviewCardSource = {
    back: `back-${input.id}`,
    cardType,
    createdAt,
    entryLinks: [],
    exampleIt: null,
    exampleJp: null,
    front: `front-${input.id}`,
    id: input.id,
    lessonId: "lesson-a",
    mediaId: "media-a",
    notesIt: null,
    orderIndex: input.orderIndex ?? 0,
    segmentId: "segment-a",
    status: "active",
    updatedAt: createdAt
  };
  const identity = buildReviewSubjectIdentityFromCanonical({
    canonicalSubjectKey: `card:${input.id}`,
    cardId: input.id,
    cardType,
    crossMediaGroupId: null,
    entryId: null,
    entryType: null,
    subjectKind: "card"
  });
  const subjectState: ReviewSubjectStateSnapshot = {
    canonicalSubjectKey: identity.canonicalSubjectKey,
    cardId: input.id,
    createdAt,
    crossMediaGroupId: null,
    difficulty: input.difficulty === undefined ? 5 : input.difficulty,
    dueAt,
    entryId: null,
    entryType: null,
    lapses: 0,
    lastInteractionAt,
    lastReviewedAt:
      input.lastReviewedAt === undefined
        ? "2026-04-05T12:00:00.000Z"
        : input.lastReviewedAt,
    learningSteps: 0,
    manualOverride: false,
    recallTask: identity.recallTask,
    reps: 3,
    scheduledDays: input.scheduledDays ?? 5,
    schedulerVersion: "fsrs_v2_study_day",
    stability: input.stability === undefined ? 5 : input.stability,
    state: input.state ?? "review",
    subjectKey: identity.subjectKey,
    subjectType: "card",
    suspended: false,
    updatedAt: lastInteractionAt
  };

  return {
    card,
    group: {
      cards: [card],
      identity,
      lastInteractionAt,
      representativeCard: card,
      subjectState
    },
    queueStateSnapshot: resolveReviewQueueState(
      card.status,
      subjectState,
      NOW_ISO
    )
  };
}
