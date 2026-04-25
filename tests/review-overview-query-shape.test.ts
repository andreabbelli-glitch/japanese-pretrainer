import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";
import { reviewSubjectState } from "@/db/schema";
import { listReviewLaunchCandidates } from "@/db/queries/review";

import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";
import {
  buildReviewSubjectStateRow,
  createIsolatedNewMediaFixture
} from "./helpers/review-fixture";

type ReviewLaunchCandidateFixture = {
  database: DatabaseClient;
  tempDir: string;
};

describe("review launch candidates query", () => {
  let fixture: ReviewLaunchCandidateFixture | null = null;

  beforeEach(async () => {
    fixture = await setupReviewDatabase({
      prefix: "jcs-review-launch-candidates-",
      seedDevelopmentFixture: false
    });
  });

  afterEach(async () => {
    if (!fixture) {
      return;
    }

    await cleanupReviewDatabase(fixture);
    fixture = null;
  });

  it("returns first due and new fronts for each media in one database round trip", async () => {
    if (!fixture) {
      throw new Error("Missing review launch candidate fixture.");
    }

    const seededMedia = await createIsolatedNewMediaFixture(fixture.database, {
      cardCount: 4,
      mediaId: "media_launch_candidates",
      mediaSlug: "launch-candidates",
      title: "Launch Candidates"
    });

    await fixture.database.insert(reviewSubjectState).values([
      buildReviewSubjectStateRow({
        cardId: "media_launch_candidates_card_1",
        difficulty: 4,
        dueAt: "2026-04-20T09:00:00.000Z",
        entryId: seededMedia.termIds[0],
        entryType: "term",
        lastInteractionAt: "2026-04-19T09:00:00.000Z",
        lastReviewedAt: "2026-04-19T09:00:00.000Z",
        learningSteps: 0,
        lapses: 0,
        reps: 4,
        scheduledDays: 3,
        stability: 8,
        state: "review",
        subjectKey: `entry:term:${seededMedia.termIds[0]}`
      }),
      buildReviewSubjectStateRow({
        cardId: "media_launch_candidates_card_2",
        difficulty: 4,
        dueAt: "2026-04-23T09:00:00.000Z",
        entryId: seededMedia.termIds[1],
        entryType: "term",
        lastInteractionAt: "2026-04-19T10:00:00.000Z",
        lastReviewedAt: "2026-04-19T10:00:00.000Z",
        learningSteps: 0,
        lapses: 0,
        reps: 3,
        scheduledDays: 4,
        stability: 7,
        state: "review",
        subjectKey: `entry:term:${seededMedia.termIds[1]}`
      }),
      buildReviewSubjectStateRow({
        cardId: "media_launch_candidates_card_3",
        difficulty: 0,
        dueAt: "2026-04-21T09:00:00.000Z",
        entryId: seededMedia.termIds[2],
        entryType: "term",
        lastInteractionAt: "2026-04-18T10:00:00.000Z",
        learningSteps: 0,
        lapses: 0,
        reps: 0,
        scheduledDays: 0,
        stability: 0,
        state: "new",
        subjectKey: `entry:term:${seededMedia.termIds[2]}`
      }),
      buildReviewSubjectStateRow({
        cardId: "media_launch_candidates_card_4",
        difficulty: 0,
        dueAt: "2026-04-21T09:00:00.000Z",
        entryId: seededMedia.termIds[3],
        entryType: "term",
        lastInteractionAt: "2026-04-19T10:00:00.000Z",
        learningSteps: 0,
        lapses: 0,
        reps: 0,
        scheduledDays: 0,
        stability: 0,
        state: "new",
        subjectKey: `entry:term:${seededMedia.termIds[3]}`
      })
    ]);

    const databaseAllSpy = vi.spyOn(fixture.database, "all");
    const candidates = await listReviewLaunchCandidates(
      fixture.database,
      "2026-04-21T10:00:00.000Z"
    );
    const mediaCandidate = candidates.find(
      (candidate) => candidate.mediaId === "media_launch_candidates"
    );

    expect(databaseAllSpy).toHaveBeenCalledTimes(1);
    expect(mediaCandidate).toMatchObject({
      activeReviewCards: 2,
      cardsTotal: 4,
      dueCount: 1,
      firstDueCardId: "media_launch_candidates_card_1",
      firstDueFront: "新規 1",
      firstNewCardId: "media_launch_candidates_card_4",
      firstNewFront: "新規 4",
      mediaId: "media_launch_candidates",
      newAvailableCount: 2,
      slug: "launch-candidates",
      title: "Launch Candidates",
      totalCards: 4
    });
  });
});
