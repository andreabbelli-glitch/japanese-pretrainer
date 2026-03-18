import { describe, expect, it } from "vitest";

import type { ReviewCardListItem } from "@/db";
import { selectReviewSubjectRepresentativeCard } from "@/lib/review-subject";
import type { ReviewEntryStatusValue } from "@/lib/review-model";

function buildReviewCard(
  input: Partial<ReviewCardListItem> & Pick<ReviewCardListItem, "id" | "front">
): ReviewCardListItem {
  return {
    id: input.id,
    mediaId: input.mediaId ?? "media-fixture",
    segmentId: input.segmentId ?? null,
    sourceFile: input.sourceFile ?? `tests/${input.id}.md`,
    cardType: input.cardType ?? "recognition",
    front: input.front,
    back: input.back ?? `${input.front} back`,
    exampleJp: input.exampleJp ?? null,
    exampleIt: input.exampleIt ?? null,
    notesIt: input.notesIt ?? null,
    status: input.status ?? "active",
    orderIndex: input.orderIndex ?? 1,
    createdAt: input.createdAt ?? "2026-03-10T08:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-03-10T08:00:00.000Z",
    segment: input.segment ?? null,
    entryLinks: input.entryLinks ?? [],
    reviewState:
      input.reviewState === undefined
        ? {
            cardId: input.id,
            state: "new",
            stability: null,
            difficulty: null,
            dueAt: null,
            lastReviewedAt: null,
            scheduledDays: 0,
            learningSteps: 0,
            lapses: 0,
            reps: 0,
            schedulerVersion: "fsrs_v1",
            manualOverride: false,
            createdAt: "2026-03-10T08:00:00.000Z",
            updatedAt: "2026-03-10T08:00:00.000Z"
          }
        : input.reviewState
  };
}

describe("review subject representative fallback", () => {
  it("does not let manual or suspended legacy siblings mask an active sibling", () => {
    const manualCard = buildReviewCard({
      id: "card-manual",
      front: "manual",
      orderIndex: 1,
      reviewState: {
        cardId: "card-manual",
        state: "known_manual",
        stability: null,
        difficulty: null,
        dueAt: "2026-03-10T08:00:00.000Z",
        lastReviewedAt: "2026-03-10T08:00:00.000Z",
        scheduledDays: 0,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: true,
        createdAt: "2026-03-10T08:00:00.000Z",
        updatedAt: "2026-03-10T08:00:00.000Z"
      }
    });
    const suspendedCard = buildReviewCard({
      id: "card-suspended",
      front: "suspended",
      orderIndex: 2,
      status: "suspended",
      reviewState: {
        cardId: "card-suspended",
        state: "suspended",
        stability: null,
        difficulty: null,
        dueAt: "2026-03-10T08:00:00.000Z",
        lastReviewedAt: "2026-03-10T08:00:00.000Z",
        scheduledDays: 0,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        createdAt: "2026-03-10T08:00:00.000Z",
        updatedAt: "2026-03-10T08:00:00.000Z"
      }
    });
    const activeCard = buildReviewCard({
      id: "card-active",
      front: "active",
      orderIndex: 99,
      reviewState: {
        cardId: "card-active",
        state: "review",
        stability: 3,
        difficulty: 2.5,
        dueAt: "2026-03-10T08:00:00.000Z",
        lastReviewedAt: "2026-03-10T08:00:00.000Z",
        scheduledDays: 3,
        learningSteps: 0,
        lapses: 0,
        reps: 3,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        createdAt: "2026-03-10T08:00:00.000Z",
        updatedAt: "2026-03-10T08:00:00.000Z"
      }
    });

    const representative = selectReviewSubjectRepresentativeCard(
      [manualCard, suspendedCard, activeCard],
      null
    );

    expect(representative.id).toBe("card-active");
  });

  it("prefers an active sibling over a legacy manual override stored in entry_status", () => {
    const manualCard = buildReviewCard({
      id: "card-manual-entry-status",
      front: "manual-entry-status",
      orderIndex: 1,
      reviewState: {
        cardId: "card-manual-entry-status",
        state: "review",
        stability: 2.2,
        difficulty: 3.4,
        dueAt: "2026-03-10T08:00:00.000Z",
        lastReviewedAt: "2026-03-10T08:00:00.000Z",
        scheduledDays: 2,
        learningSteps: 0,
        lapses: 0,
        reps: 2,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        createdAt: "2026-03-10T08:00:00.000Z",
        updatedAt: "2026-03-10T08:00:00.000Z"
      }
    });
    const activeCard = buildReviewCard({
      id: "card-active-entry-status",
      front: "active-entry-status",
      orderIndex: 99,
      reviewState: {
        cardId: "card-active-entry-status",
        state: "review",
        stability: 2.2,
        difficulty: 3.4,
        dueAt: "2026-03-10T08:00:00.000Z",
        lastReviewedAt: "2026-03-10T08:00:00.000Z",
        scheduledDays: 2,
        learningSteps: 0,
        lapses: 0,
        reps: 2,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        createdAt: "2026-03-10T08:00:00.000Z",
        updatedAt: "2026-03-10T08:00:00.000Z"
      }
    });
    const drivingEntryStatusesByCardId = new Map<
      string,
      ReviewEntryStatusValue[]
    >([
      ["card-manual-entry-status", ["known_manual"]],
      ["card-active-entry-status", [null]]
    ]);

    const representative = selectReviewSubjectRepresentativeCard(
      [manualCard, activeCard],
      null,
      "2026-03-10T08:00:00.000Z",
      {
        drivingEntryStatusesByCardId
      }
    );

    expect(representative.id).toBe("card-active-entry-status");
  });
});
