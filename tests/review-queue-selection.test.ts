import { describe, expect, it, vi } from "vitest";

import {
  buildReviewQueueSubjectSnapshot,
  resolveReviewPageSelection,
  type ReviewQueueSubjectSnapshot,
  type ReviewSubjectModel
} from "@/lib/review-queue";
import * as reviewSubjectModule from "@/lib/review-subject";
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

  it("reuses the preferred local representative card for the same subject within one snapshot build", () => {
    const sharedCards = [
      {
        id: "card-global",
        mediaId: "media-b",
        status: "active",
        orderIndex: 2,
        createdAt: "2026-03-10T09:00:00.000Z"
      },
      {
        id: "card-local",
        mediaId: "media-a",
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T08:00:00.000Z"
      }
    ] as unknown as ReviewCardListItem[];
    const subjectGroups = [
      {
        cards: sharedCards,
        identity: {
          cardId: "card-global",
          crossMediaGroupId: "group-shared",
          entryId: "entry-shared",
          entryType: "term",
          subjectKey: "group:shared",
          subjectKind: "group"
        },
        lastInteractionAt: "2026-03-10T09:00:00.000Z",
        representativeCard: sharedCards[0]!,
        subjectState: {
          cardId: "card-global",
          createdAt: "2026-03-10T09:00:00.000Z",
          crossMediaGroupId: "group-shared",
          dueAt: "2026-03-10T09:00:00.000Z",
          difficulty: 2.5,
          entryId: "entry-shared",
          entryType: "term",
          lapses: 0,
          lastInteractionAt: "2026-03-10T09:00:00.000Z",
          lastReviewedAt: "2026-03-10T09:00:00.000Z",
          learningSteps: 0,
          manualOverride: false,
          reps: 1,
          scheduledDays: 1,
          schedulerVersion: "fsrs_v1",
          stability: 3,
          state: "review",
          subjectKey: "group:shared",
          subjectType: "group",
          suspended: false,
          updatedAt: "2026-03-10T09:00:00.000Z"
        }
      } satisfies ReviewSubjectGroup
    ];
    const representativeSpy = vi.spyOn(
      reviewSubjectModule,
      "selectReviewSubjectRepresentativeCard"
    );

    const snapshot = buildReviewQueueSubjectSnapshot({
      cards: sharedCards,
      dailyLimit: 10,
      entryLookup: new Map(),
      extraNewCount: 0,
      newIntroducedTodayCount: 0,
      nowIso: "2026-03-10T09:00:00.000Z",
      subjectGroups,
      visibleMediaId: "media-a"
    });

    expect(snapshot.queueModels[0]?.card.id).toBe("card-local");
    expect(snapshot.subjectModels[0]?.card.id).toBe("card-local");
    expect(snapshot.queueModels[0]).toBe(snapshot.subjectModels[0]);
    expect(representativeSpy).toHaveBeenCalledTimes(1);

    representativeSpy.mockRestore();
  });
});
