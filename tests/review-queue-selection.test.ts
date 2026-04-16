import { describe, expect, it } from "vitest";

import {
  resolveReviewPageSelection,
  type ReviewQueueSubjectSnapshot,
  type ReviewSubjectModel
} from "@/lib/review-queue";
import type { ReviewSubjectGroup } from "@/lib/review-subject";
import type { ReviewCardListItem } from "@/db";

function createModel(input: {
  groupCardIds: string[];
  mediaIds?: string[];
  representativeCardId?: string;
}) {
  const cards = input.groupCardIds.map((cardId, index) => ({
    id: cardId,
    mediaId: input.mediaIds?.[index] ?? "media-a"
  })) as unknown as ReviewCardListItem[];
  const representativeCard =
    (cards.find((card) => card.id === input.representativeCardId) ??
      cards[0]) as ReviewCardListItem;

  return {
    card: representativeCard,
    group: {
      cards,
      identity: {
        cardId: representativeCard.id,
        crossMediaGroupId: null,
        entryId: representativeCard.id,
        entryType: "term",
        subjectKey: `group:${representativeCard.id}`,
        subjectKind: "group"
      },
      lastInteractionAt: "2026-03-10T09:00:00.000Z",
      representativeCard,
      subjectState: null
    } satisfies Partial<ReviewSubjectGroup>,
    queueStateSnapshot: {
      bucket: "due",
      dueAt: "2026-03-10T09:00:00.000Z",
      effectiveState: "review",
      rawReviewLabel: "In review",
      reviewSeedState: {
        difficulty: null,
        dueAt: null,
        lapses: 0,
        lastReviewedAt: null,
        learningSteps: 0,
        reps: 0,
        scheduledDays: 0,
        stability: null,
        state: null
      }
    }
  } as unknown as ReviewSubjectModel;
}

function createQueueSnapshot(
  overrides: Partial<ReviewQueueSubjectSnapshot>
): ReviewQueueSubjectSnapshot {
  return {
    dailyLimit: 10,
    dueCount: 1,
    effectiveDailyLimit: 10,
    introLabel: "1 card",
    manualCount: 0,
    manualModels: [],
    newAvailableCount: 0,
    newQueuedCount: 0,
    queueCount: overrides.queueModels?.length ?? 0,
    queueModels: [],
    subjectModels: [],
    suspendedCount: 0,
    suspendedModels: [],
    tomorrowCount: 0,
    upcomingCount: 0,
    upcomingModels: [],
    visibleMediaId: undefined,
    ...overrides
  };
}

describe("resolveReviewPageSelection", () => {
  it("keeps queue position when the deep-linked card is not the representative card", () => {
    const groupedQueueModel = createModel({
      groupCardIds: ["card-a", "card-b"],
      representativeCardId: "card-a"
    });
    const queueSnapshot = createQueueSnapshot({
      queueCount: 1,
      queueModels: [groupedQueueModel],
      subjectModels: [groupedQueueModel]
    });

    const selection = resolveReviewPageSelection({
      queueSnapshot,
      searchState: {
        answeredCount: 0,
        extraNewCount: 0,
        noticeCode: null,
        segmentId: null,
        selectedCardId: "card-b",
        showAnswer: false
      }
    });

    expect(selection.selectedCardId).toBe("card-b");
    expect(selection.selectedModel).toBe(groupedQueueModel);
    expect(selection.selectedQueueModel).toBe(groupedQueueModel);
    expect(selection.queueIndex).toBe(0);
  });

  it("ignores hidden cross-media deep links for local review queues", () => {
    const localQueueModel = createModel({
      groupCardIds: ["card-a"],
      mediaIds: ["media-a"]
    });
    const crossMediaModel = createModel({
      groupCardIds: ["card-b", "card-c"],
      mediaIds: ["media-b", "media-b"],
      representativeCardId: "card-b"
    });
    const queueSnapshot = createQueueSnapshot({
      queueCount: 1,
      queueModels: [localQueueModel],
      subjectModels: [localQueueModel, crossMediaModel],
      visibleMediaId: "media-a"
    });

    const selection = resolveReviewPageSelection({
      queueSnapshot,
      searchState: {
        answeredCount: 0,
        extraNewCount: 0,
        noticeCode: null,
        segmentId: null,
        selectedCardId: "card-c",
        showAnswer: false
      }
    });

    expect(selection.selectedCardId).toBeNull();
    expect(selection.selectedModel).toBe(localQueueModel);
    expect(selection.selectedQueueModel).toBe(localQueueModel);
    expect(selection.queueIndex).toBe(0);
  });

  it("keeps explicit support-card selections out of the queue index", () => {
    const queueModel = createModel({
      groupCardIds: ["card-a"]
    });
    const manualModel = createModel({
      groupCardIds: ["card-b"]
    });
    const queueSnapshot = createQueueSnapshot({
      manualCount: 1,
      manualModels: [manualModel],
      queueCount: 1,
      queueModels: [queueModel],
      subjectModels: [queueModel, manualModel]
    });

    const selection = resolveReviewPageSelection({
      queueSnapshot,
      searchState: {
        answeredCount: 0,
        extraNewCount: 0,
        noticeCode: null,
        segmentId: null,
        selectedCardId: "card-b",
        showAnswer: false
      }
    });

    expect(selection.selectedCardId).toBe("card-b");
    expect(selection.selectedModel).toBe(manualModel);
    expect(selection.selectedQueueModel).toBeNull();
    expect(selection.queueIndex).toBe(-1);
  });
});
