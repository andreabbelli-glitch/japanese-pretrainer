import { describe, expect, it, vi } from "vitest";

import type { ReviewCardListItem } from "@/db/queries";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  selectReviewSubjectRepresentativeCard
} from "@/lib/review-subject";

function buildReviewCard(
  input: Partial<ReviewCardListItem> & Pick<ReviewCardListItem, "id" | "front">
): ReviewCardListItem {
  return {
    id: input.id,
    mediaId: input.mediaId ?? "media-fixture",
    lessonId: input.lessonId ?? "lesson-fixture",
    segmentId: input.segmentId ?? null,
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
    lesson:
      input.lesson ??
      ({
        status: "active",
        progress: {
          status: "completed"
        }
      } satisfies ReviewCardListItem["lesson"]),
    segment: input.segment ?? null,
    entryLinks: input.entryLinks ?? []
  };
}

describe("review subject representative fallback", () => {
  it("keeps canonical entry cards grouped on the shared subject", () => {
    const entryLookup = buildReviewSubjectEntryLookup({
      grammar: [],
      terms: [
        {
          crossMediaGroupId: "shared-iku",
          id: "term-iku",
          lemma: "行く",
          reading: "いく"
        }
      ]
    });

    const identity = deriveReviewSubjectIdentity({
      cardId: "card-iku",
      cardType: "recognition",
      front: "{{行|い}}く",
      entryLinks: [
        {
          entryId: "term-iku",
          entryType: "term",
          relationshipType: "primary"
        }
      ],
      entryLookup
    });

    expect(identity).toMatchObject({
      crossMediaGroupId: "shared-iku",
      entryId: "term-iku",
      entryType: "term",
      subjectKey: "group:term:shared-iku",
      subjectKind: "group"
    });
  });

  it("falls back to a card subject when the front is a chunk instead of the canonical entry form", () => {
    const entryLookup = buildReviewSubjectEntryLookup({
      grammar: [],
      terms: [
        {
          crossMediaGroupId: "shared-iku",
          id: "term-iku",
          lemma: "行く",
          reading: "いく"
        }
      ]
    });

    const identity = deriveReviewSubjectIdentity({
      cardId: "card-iku-chunk",
      cardType: "concept",
      front: "{{行|い}}かずに{{残|のこ}}る",
      entryLinks: [
        {
          entryId: "term-iku",
          entryType: "term",
          relationshipType: "primary"
        }
      ],
      entryLookup
    });

    expect(identity).toMatchObject({
      crossMediaGroupId: null,
      entryId: null,
      entryType: null,
      subjectKey: "card:card-iku-chunk",
      subjectKind: "card"
    });
  });

  it("does not let a suspended sibling mask an active sibling", () => {
    const suspendedCard = buildReviewCard({
      id: "card-suspended",
      front: "suspended",
      orderIndex: 2,
      status: "suspended"
    });
    const activeCard = buildReviewCard({
      id: "card-active",
      front: "active",
      orderIndex: 99
    });

    const representative = selectReviewSubjectRepresentativeCard(
      [suspendedCard, activeCard],
      null,
      "2026-03-10T08:00:00.000Z"
    );

    expect(representative.id).toBe("card-active");
  });

  it("picks the most relevant due sibling without sorting the whole group", () => {
    const sortSpy = vi.spyOn(Array.prototype, "sort");
    const olderCard = buildReviewCard({
      id: "card-older",
      front: "older",
      orderIndex: 2,
      updatedAt: "2026-03-10T08:00:00.000Z"
    });
    const newerCard = buildReviewCard({
      id: "card-newer",
      front: "newer",
      orderIndex: 5,
      updatedAt: "2026-03-10T09:00:00.000Z"
    });

    try {
      const representative = selectReviewSubjectRepresentativeCard(
        [olderCard, newerCard],
        {
          cardId: null,
          createdAt: "2026-03-10T07:00:00.000Z",
          crossMediaGroupId: null,
          dueAt: "2026-03-10T07:30:00.000Z",
          difficulty: 2.5,
          entryId: null,
          entryType: null,
          lapses: 0,
          lastInteractionAt: "2026-03-10T07:30:00.000Z",
          lastReviewedAt: "2026-03-10T07:30:00.000Z",
          learningSteps: 0,
          manualOverride: false,
          reps: 1,
          scheduledDays: 1,
          schedulerVersion: "fsrs_v1",
          stability: 2,
          state: "review",
          subjectKey: "card:card-older",
          subjectType: "card",
          suspended: false,
          updatedAt: "2026-03-10T07:30:00.000Z"
        },
        "2026-03-10T10:00:00.000Z"
      );

      expect(representative.id).toBe("card-newer");
      expect(sortSpy).not.toHaveBeenCalled();
    } finally {
      sortSpy.mockRestore();
    }
  });
});
