import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  backfillLegacyReviewEvents,
  LEGACY_UNKNOWN_REVIEW_CARD_TYPE
} from "@/db/backfills/review-event-ledger";
import { runMigrations } from "@/db/migrate";
import { card, media, reviewSubjectLog, reviewSubjectState } from "@/db/schema";
import { withTestDatabase } from "./helpers/test-db";

describe("legacy review event ledger backfill", () => {
  it("snapshots live cards, safely handles deleted cards, and is idempotent", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-review-event-ledger-backfill-",
        seedDevelopmentFixture: false
      },
      async ({ database }) => {
        await database.insert(media).values({
          baseExplanationLanguage: "it",
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "Backfill fixture",
          id: "legacy_media",
          language: "ja",
          mediaType: "game",
          segmentKind: "chapter",
          slug: "legacy-media",
          status: "active",
          title: "Legacy media",
          updatedAt: "2026-01-01T00:00:00.000Z"
        });
        await database.insert(card).values({
          back: "meaning",
          cardType: "concept",
          createdAt: "2026-01-01T00:00:00.000Z",
          front: "legacy",
          id: "legacy_live_card",
          mediaId: "legacy_media",
          sourceFile: "tests/review-event-ledger-backfill.test.ts",
          status: "active",
          updatedAt: "2026-01-01T00:00:00.000Z"
        });
        await database.insert(reviewSubjectLog).values([
          {
            answeredAt: "2026-03-29T01:30:00.000Z",
            cardId: "legacy_live_card",
            id: "legacy_live_event",
            rating: "good",
            subjectKey: "entry:term:legacy"
          },
          {
            answeredAt: "2026-01-15T03:00:00.000Z",
            cardId: "deleted_card",
            id: "legacy_deleted_event",
            rating: "again",
            subjectKey: "card:deleted_card"
          },
          {
            answeredAt: "2026-01-01T00:00:00.000Z",
            cardId: "deleted_card",
            eventKind: "reset",
            eventSchemaVersion: 1,
            id: "current_event",
            recordedAt: "2026-01-01T00:00:01.000Z",
            subjectKey: "card:already-current"
          }
        ]);

        await expect(backfillLegacyReviewEvents(database)).resolves.toEqual({
          backfilledCount: 2
        });
        await expect(backfillLegacyReviewEvents(database)).resolves.toEqual({
          backfilledCount: 0
        });

        const liveEvent = await database.query.reviewSubjectLog.findFirst({
          where: eq(reviewSubjectLog.id, "legacy_live_event")
        });
        const deletedEvent = await database.query.reviewSubjectLog.findFirst({
          where: eq(reviewSubjectLog.id, "legacy_deleted_event")
        });
        const currentEvent = await database.query.reviewSubjectLog.findFirst({
          where: eq(reviewSubjectLog.id, "current_event")
        });

        expect(liveEvent).toMatchObject({
          algorithmVersion: "fsrs6",
          bindingVersion: "ts-fsrs@5.2.3",
          canonicalSubjectKey: "entry:term:legacy",
          cardTypeSnapshot: "concept",
          eventKind: "grade",
          eventSchemaVersion: 0,
          mediaIdSnapshot: "legacy_media",
          recallTask: "concept",
          recordedAt: "2026-03-29T01:30:00.000Z",
          studyDay: "2026-03-28",
          studyDayPolicy: "study-day:v1:Europe/Rome:rollover-240"
        });
        expect(liveEvent?.answeredAt).toBe("2026-03-29T01:30:00.000Z");
        expect(deletedEvent).toMatchObject({
          algorithmVersion: "fsrs6",
          bindingVersion: "ts-fsrs@5.2.3",
          canonicalSubjectKey: "card:deleted_card",
          cardTypeSnapshot: LEGACY_UNKNOWN_REVIEW_CARD_TYPE,
          eventKind: "grade",
          eventSchemaVersion: 0,
          mediaIdSnapshot: null,
          recallTask: "other",
          recordedAt: "2026-01-15T03:00:00.000Z",
          studyDay: "2026-01-15",
          studyDayPolicy: "study-day:v1:Europe/Rome:rollover-240"
        });
        expect(currentEvent).toMatchObject({
          algorithmVersion: null,
          eventKind: "reset",
          eventSchemaVersion: 1,
          recordedAt: "2026-01-01T00:00:01.000Z"
        });
      }
    );
  });

  it("runs automatically after schema migrations", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-review-event-ledger-migrate-",
        seedDevelopmentFixture: false
      },
      async ({ database }) => {
        await database.insert(reviewSubjectLog).values({
          answeredAt: "2026-01-15T03:00:00.000Z",
          cardId: "already_deleted_card",
          id: "legacy_event_before_migrate_rerun",
          rating: "hard",
          subjectKey: "card:already_deleted_card"
        });

        await runMigrations(database);

        const event = await database.query.reviewSubjectLog.findFirst({
          where: eq(reviewSubjectLog.id, "legacy_event_before_migrate_rerun")
        });

        expect(event).toMatchObject({
          canonicalSubjectKey: "card:already_deleted_card",
          eventKind: "grade",
          eventSchemaVersion: 0,
          recallTask: "other",
          recordedAt: "2026-01-15T03:00:00.000Z"
        });
      }
    );
  });

  it("keeps a versioned event unchanged after its mutable state and card are deleted", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-review-event-ledger-delete-",
        seedDevelopmentFixture: false
      },
      async ({ database }) => {
        const timestamp = "2026-02-10T10:00:00.000Z";

        await database.insert(media).values({
          baseExplanationLanguage: "it",
          createdAt: timestamp,
          description: "Ledger delete fixture",
          id: "ledger_delete_media",
          language: "ja",
          mediaType: "game",
          segmentKind: "chapter",
          slug: "ledger-delete-media",
          status: "active",
          title: "Ledger delete media",
          updatedAt: timestamp
        });
        await database.insert(card).values({
          back: "meaning",
          cardType: "recognition",
          createdAt: timestamp,
          front: "記憶",
          id: "ledger_delete_card",
          mediaId: "ledger_delete_media",
          sourceFile: "tests/review-event-ledger-backfill.test.ts",
          status: "active",
          updatedAt: timestamp
        });
        await database.insert(reviewSubjectState).values({
          cardId: "ledger_delete_card",
          createdAt: timestamp,
          lastInteractionAt: timestamp,
          state: "review",
          subjectKey: "entry:term:ledger-delete",
          subjectType: "entry",
          updatedAt: timestamp
        });
        await database.insert(reviewSubjectLog).values({
          afterStateJson: JSON.stringify({ dueAt: "2026-02-20T00:00:00.000Z" }),
          algorithmVersion: "fsrs6",
          answeredAt: timestamp,
          beforeStateJson: JSON.stringify({ dueAt: timestamp }),
          bindingVersion: "ts-fsrs@5.2.3",
          canonicalSubjectKey: "entry:term:ledger-delete",
          cardId: "ledger_delete_card",
          cardTypeSnapshot: "recognition",
          eventKind: "grade",
          eventSchemaVersion: 1,
          id: "durable_review_event",
          mediaIdSnapshot: "ledger_delete_media",
          newState: "review",
          parameterHash: "sha256:durable-fixture",
          previousDueAt: timestamp,
          previousState: "learning",
          rating: "good",
          recallTask: "recognition",
          recordedAt: timestamp,
          scheduledDueAt: "2026-02-20T00:00:00.000Z",
          studyDay: "2026-02-10",
          studyDayPolicy: "study-day:v1:Europe/Rome:rollover-240",
          subjectKey: "entry:term:ledger-delete"
        });

        const eventBeforeDelete =
          await database.query.reviewSubjectLog.findFirst({
            where: eq(reviewSubjectLog.id, "durable_review_event")
          });

        await database
          .delete(reviewSubjectState)
          .where(eq(reviewSubjectState.subjectKey, "entry:term:ledger-delete"));
        await database.delete(card).where(eq(card.id, "ledger_delete_card"));

        expect(
          await database.query.reviewSubjectState.findFirst({
            where: eq(reviewSubjectState.subjectKey, "entry:term:ledger-delete")
          })
        ).toBeUndefined();
        expect(
          await database.query.card.findFirst({
            where: eq(card.id, "ledger_delete_card")
          })
        ).toBeUndefined();
        expect(
          await database.query.reviewSubjectLog.findFirst({
            where: eq(reviewSubjectLog.id, "durable_review_event")
          })
        ).toEqual(eventBeforeDelete);
      }
    );
  });
});
