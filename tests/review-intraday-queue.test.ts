import { describe, expect, it } from "vitest";

import type { ReviewCardListItem } from "@/db/queries";
import {
  buildReviewQueueSubjectSnapshot,
  DEFAULT_REVIEW_LEARN_AHEAD_MINUTES
} from "@/features/review/model/queue";
import {
  buildReviewSubjectIdentityFromCanonical,
  type ReviewSubjectGroup,
  type ReviewSubjectStateSnapshot
} from "@/features/review/model/subject";

const NOW_ISO = "2026-04-02T10:00:00.000Z";

describe("review intraday queue", () => {
  it("orders mature reviews before due intraday repetitions and then new cards", () => {
    const intraday = buildSubjectGroup({
      cardId: "intraday",
      dueAt: "2026-04-02T09:59:00.000Z",
      scheduledDays: 0,
      state: "learning"
    });
    const matureReview = buildSubjectGroup({
      cardId: "review",
      dueAt: "2026-04-02T09:00:00.000Z",
      scheduledDays: 3,
      state: "review"
    });
    const newCard = buildSubjectGroup({ cardId: "new" });

    const snapshot = buildSnapshot([matureReview, newCard, intraday]);

    expect(snapshot.queueModels.map((model) => model.card.id)).toEqual([
      "review",
      "intraday",
      "new"
    ]);
    expect(snapshot.dueCount).toBe(2);
    expect(snapshot.newQueuedCount).toBe(1);
  });

  it("offers an intraday repetition inside the 20 minute learn-ahead window only when the regular queue is empty", () => {
    const learningDueSoon = buildSubjectGroup({
      cardId: "learning-soon",
      dueAt: "2026-04-02T10:20:00.000Z",
      scheduledDays: 0,
      state: "relearning"
    });
    const matureReviewDueSoon = buildSubjectGroup({
      cardId: "review-soon",
      dueAt: "2026-04-02T10:05:00.000Z",
      scheduledDays: 1,
      state: "review"
    });

    const emptyQueueSnapshot = buildSnapshot([
      matureReviewDueSoon,
      learningDueSoon
    ]);

    expect(DEFAULT_REVIEW_LEARN_AHEAD_MINUTES).toBe(20);
    expect(
      emptyQueueSnapshot.queueModels.map((model) => model.card.id)
    ).toEqual(["learning-soon"]);
    expect(emptyQueueSnapshot.queueModels[0]?.queueStateSnapshot.bucket).toBe(
      "upcoming"
    );
    expect(emptyQueueSnapshot.queueCount).toBe(1);
    expect(emptyQueueSnapshot.nextLearningDueAt).toBe(
      "2026-04-02T10:20:00.000Z"
    );

    const withNewCard = buildSnapshot([
      learningDueSoon,
      buildSubjectGroup({ cardId: "new" })
    ]);

    expect(withNewCard.queueModels.map((model) => model.card.id)).toEqual([
      "new"
    ]);
  });

  it("does not pull an intraday repetition forward beyond the learn-ahead window", () => {
    const snapshot = buildSnapshot([
      buildSubjectGroup({
        cardId: "learning-later",
        dueAt: "2026-04-02T10:20:00.001Z",
        scheduledDays: 0,
        state: "learning"
      })
    ]);

    expect(snapshot.queueModels).toEqual([]);
    expect(snapshot.queueCount).toBe(0);
    expect(snapshot.nextLearningDueAt).toBe("2026-04-02T10:20:00.001Z");
  });
});

function buildSnapshot(subjectGroups: ReviewSubjectGroup[]) {
  return buildReviewQueueSubjectSnapshot({
    cards: subjectGroups.map((group) => group.representativeCard),
    dailyLimit: 20,
    entryLookup: new Map(),
    extraNewCount: 0,
    newIntroducedTodayCount: 0,
    nowIso: NOW_ISO,
    subjectGroups
  });
}

function buildSubjectGroup(input: {
  cardId: string;
  dueAt?: string;
  scheduledDays?: number;
  state?: ReviewSubjectStateSnapshot["state"];
}): ReviewSubjectGroup {
  const card = {
    cardType: "recognition",
    createdAt: "2026-04-01T08:00:00.000Z",
    id: input.cardId,
    mediaId: "media-a",
    orderIndex: 0,
    status: "active"
  } as unknown as ReviewCardListItem;
  const identity = buildReviewSubjectIdentityFromCanonical({
    cardId: input.cardId,
    cardType: "recognition",
    canonicalSubjectKey: `card:${input.cardId}`,
    crossMediaGroupId: null,
    entryId: null,
    entryType: null,
    subjectKind: "card"
  });
  const subjectState = input.state
    ? ({
        cardId: input.cardId,
        canonicalSubjectKey: identity.canonicalSubjectKey,
        crossMediaGroupId: null,
        createdAt: "2026-04-01T08:00:00.000Z",
        difficulty: 5,
        dueAt: input.dueAt ?? null,
        entryId: null,
        entryType: null,
        lapses: 0,
        lastInteractionAt: "2026-04-02T09:00:00.000Z",
        lastReviewedAt: "2026-04-02T09:00:00.000Z",
        learningSteps: 1,
        manualOverride: false,
        recallTask: identity.recallTask,
        reps: 1,
        scheduledDays: input.scheduledDays ?? 0,
        schedulerVersion: "fsrs_v1",
        stability: 1,
        state: input.state,
        subjectKey: identity.subjectKey,
        subjectType: "card",
        suspended: false,
        updatedAt: "2026-04-02T09:00:00.000Z"
      } satisfies ReviewSubjectStateSnapshot)
    : null;

  return {
    cards: [card],
    identity,
    lastInteractionAt:
      subjectState?.lastInteractionAt ?? "2026-04-01T08:00:00.000Z",
    representativeCard: card,
    subjectState
  };
}
