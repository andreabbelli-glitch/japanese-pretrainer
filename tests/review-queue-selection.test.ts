import { describe, expect, it, vi } from "vitest";

import {
  buildReviewQueueSubjectSnapshot,
  resolveReviewPageSelection,
  type ReviewQueueSubjectSnapshot,
  type ReviewSubjectModel
} from "@/features/review/model/queue";
import * as reviewSubjectModule from "@/features/review/model/subject";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";
import type { ReviewCardListItem } from "@/db/queries";

function createModel(input: {
  groupCardIds: string[];
  mediaIds?: string[];
  representativeCardId?: string;
}) {
  const cards = input.groupCardIds.map((cardId, index) => ({
    id: cardId,
    mediaId: input.mediaIds?.[index] ?? "media-a"
  })) as unknown as ReviewCardListItem[];
  const representativeCard = (cards.find(
    (card) => card.id === input.representativeCardId
  ) ?? cards[0]) as ReviewCardListItem;

  return {
    card: representativeCard,
    group: {
      cards,
      identity: reviewSubjectModule.buildReviewSubjectIdentityFromCanonical({
        cardId: representativeCard.id,
        cardType: "recognition",
        canonicalSubjectKey: `group:${representativeCard.id}`,
        crossMediaGroupId: null,
        entryId: representativeCard.id,
        entryType: "term",
        subjectKind: "group"
      }),
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
        extraNewAnchorCount: null,
        extraNewCount: 0,
        mode: "review",
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
        extraNewAnchorCount: null,
        extraNewCount: 0,
        mode: "review",
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
        extraNewAnchorCount: null,
        extraNewCount: 0,
        mode: "review",
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

  it("keeps fallback subject models raw while reusing the preferred local representative for visible buckets", () => {
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
        identity: reviewSubjectModule.buildReviewSubjectIdentityFromCanonical({
          cardId: "card-global",
          cardType: "recognition",
          canonicalSubjectKey: "group:shared",
          crossMediaGroupId: "group-shared",
          entryId: "entry-shared",
          entryType: "term",
          subjectKind: "group"
        }),
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
    const visibilitySpy = vi.spyOn(Array.prototype, "some");

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

    expect(visibilitySpy).toHaveBeenCalledTimes(1);
    expect(snapshot.queueModels[0]?.card.id).toBe("card-local");
    expect(snapshot.subjectModels[0]?.card.id).toBe("card-global");
    expect(snapshot.queueModels[0]).not.toBe(snapshot.subjectModels[0]);
    expect(representativeSpy).toHaveBeenCalledTimes(1);

    visibilitySpy.mockRestore();
    representativeSpy.mockRestore();
  });

  it("re-sorts local due cards after a cross-media representative changes bucket", () => {
    const hardCard = {
      id: "card-hard",
      mediaId: "media-a",
      status: "active",
      orderIndex: 1,
      createdAt: "2026-03-01T09:00:00.000Z"
    } as unknown as ReviewCardListItem;
    const sharedCards = [
      {
        id: "card-global-suspended",
        mediaId: "media-b",
        status: "suspended",
        orderIndex: 2,
        createdAt: "2026-03-02T09:00:00.000Z"
      },
      {
        id: "card-local-easy",
        mediaId: "media-a",
        status: "active",
        orderIndex: 3,
        createdAt: "2026-03-03T09:00:00.000Z"
      }
    ] as unknown as ReviewCardListItem[];
    const makeState = (input: {
      cardId: string;
      lastReviewedAt: string;
      stability: number;
      subjectKey: string;
    }) => ({
      cardId: input.cardId,
      createdAt: "2026-03-01T09:00:00.000Z",
      crossMediaGroupId: null,
      dueAt: "2026-03-09T09:00:00.000Z",
      difficulty: 5,
      entryId: input.subjectKey,
      entryType: "term" as const,
      lapses: 0,
      lastInteractionAt: input.lastReviewedAt,
      lastReviewedAt: input.lastReviewedAt,
      learningSteps: 0,
      manualOverride: false,
      reps: 3,
      scheduledDays: 1,
      schedulerVersion: "fsrs_v1" as const,
      stability: input.stability,
      state: "review" as const,
      subjectKey: input.subjectKey,
      subjectType: "group" as const,
      suspended: false,
      updatedAt: input.lastReviewedAt
    });
    const subjectGroups = [
      {
        cards: [hardCard],
        identity: reviewSubjectModule.buildReviewSubjectIdentityFromCanonical({
          cardId: hardCard.id,
          cardType: "recognition",
          canonicalSubjectKey: "group:hard",
          crossMediaGroupId: null,
          entryId: "entry-hard",
          entryType: "term",
          subjectKind: "group"
        }),
        lastInteractionAt: "2026-03-01T09:00:00.000Z",
        representativeCard: hardCard,
        subjectState: makeState({
          cardId: hardCard.id,
          lastReviewedAt: "2026-03-01T09:00:00.000Z",
          stability: 1,
          subjectKey: "group:hard"
        })
      },
      {
        cards: sharedCards,
        identity: reviewSubjectModule.buildReviewSubjectIdentityFromCanonical({
          cardId: sharedCards[0]!.id,
          cardType: "recognition",
          canonicalSubjectKey: "group:easy",
          crossMediaGroupId: "cross-media-easy",
          entryId: "entry-easy",
          entryType: "term",
          subjectKind: "group"
        }),
        lastInteractionAt: "2026-03-09T09:00:00.000Z",
        representativeCard: sharedCards[0]!,
        subjectState: {
          ...makeState({
            cardId: sharedCards[0]!.id,
            lastReviewedAt: "2026-03-09T09:00:00.000Z",
            stability: 100,
            subjectKey: "group:easy"
          }),
          crossMediaGroupId: "cross-media-easy"
        }
      }
    ] satisfies ReviewSubjectGroup[];

    const snapshot = buildReviewQueueSubjectSnapshot({
      cards: [hardCard, ...sharedCards],
      dailyLimit: 10,
      entryLookup: new Map(),
      extraNewCount: 0,
      newIntroducedTodayCount: 0,
      nowIso: "2026-03-10T09:00:00.000Z",
      subjectGroups,
      visibleMediaId: "media-a"
    });

    expect(snapshot.queueModels.map((model) => model.card.id)).toEqual([
      "card-local-easy",
      "card-hard"
    ]);
  });
});
