import { describe, expect, it } from "vitest";

import type { ReviewCardListItem } from "@/db";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  normalizeReviewSubjectSurface,
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
    sourceFile: input.sourceFile ?? `tests/${input.id}.md`,
    cardType: input.cardType ?? "recognition",
    front: input.front,
    normalizedFront:
      input.normalizedFront ?? normalizeReviewSubjectSurface(input.front),
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
        id: input.lessonId ?? "lesson-fixture",
        mediaId: input.mediaId ?? "media-fixture",
        segmentId: input.segmentId ?? null,
        slug: "lesson-fixture",
        title: "Lesson fixture",
        orderIndex: 1,
        difficulty: "beginner",
        summary: "Lesson fixture",
        status: "active",
        sourceFile: "tests/lesson-fixture.md",
        createdAt: "2026-03-10T08:00:00.000Z",
        updatedAt: "2026-03-10T08:00:00.000Z",
        progress: {
          lessonId: input.lessonId ?? "lesson-fixture",
          status: "completed",
          startedAt: "2026-03-10T08:00:00.000Z",
          completedAt: "2026-03-10T08:00:00.000Z",
          lastOpenedAt: "2026-03-10T08:00:00.000Z"
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
});
