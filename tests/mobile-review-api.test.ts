import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDatabaseClient, type DatabaseClient } from "@/db";
import { developmentFixture } from "@/db/seed";
import { reviewSubjectLog, reviewSubjectState, term } from "@/db/schema";
import {
  primarySubjectKey,
  secondarySubjectKey
} from "./helpers/review-shared";
import { withTestDatabase } from "./helpers/test-db";

describe("mobile review API", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.MOBILE_API_TOKEN = "mobile-review-secret";
  });

  afterEach(() => {
    restoreDatabaseUrl(previousDatabaseUrl);
    delete process.env.MOBILE_API_TOKEN;
    closeAndForgetDatabaseSingleton();
    vi.resetModules();
  });

  it("rejects live session requests without the mobile bearer token", async () => {
    const { GET } = await importSessionRouteWithMockedDatabase();

    const response = await GET(
      new Request("https://example.test/api/mobile/review/session")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized."
    });
  });

  it("returns live global queue state with no-store caching", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-review-session-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await makePrimaryAndSecondaryCardsDue(database);
        await database
          .update(term)
          .set({
            audioSource: "fixture",
            audioSrc: "assets/audio/term/term-iku/iku.mp3",
            pitchAccent: 0,
            pitchAccentSource: "fixture"
          })
          .where(eq(term.id, developmentFixture.termDbId));
        const { GET } = await importSessionRouteForDatabase(databasePath);

        const response = await GET(
          new Request("https://example.test/api/mobile/review/session", {
            headers: {
              authorization: "Bearer mobile-review-secret"
            }
          })
        );
        const body = await response.json();

        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(response.headers.get("cache-control")).toBe(
          "private, no-store, max-age=0"
        );
        expect(body).toMatchObject({
          ok: true,
          source: "live",
          advanceCards: [
            {
              cardId: developmentFixture.secondaryCardId,
              front: expect.any(String),
              gradePreviews: expect.any(Array),
              mediaSlug: developmentFixture.mediaSlug,
              reviewStateUpdatedAt: expect.any(String)
            }
          ],
          queue: {
            dueCount: expect.any(Number),
            queueCount: expect.any(Number)
          },
          selectedCard: {
            back: expect.any(String),
            cardId: developmentFixture.primaryCardId,
            front: expect.any(String),
            gradePreviews: [
              {
                nextReviewLabel: expect.any(String),
                rating: "again"
              },
              {
                nextReviewLabel: expect.any(String),
                rating: "hard"
              },
              {
                nextReviewLabel: expect.any(String),
                rating: "good"
              },
              {
                nextReviewLabel: expect.any(String),
                rating: "easy"
              }
            ],
            mediaSlug: developmentFixture.mediaSlug,
            pronunciations: [
              {
                audio: {
                  pitchAccent: {
                    downstep: 0,
                    morae: ["い", "く"],
                    shape: "heiban"
                  },
                  pitchAccentSource: "fixture",
                  source: "fixture",
                  src: expect.stringMatching(
                    /^\/media-audio\/fixture-tcg\/audio\/term\/term-iku\/iku\.mp3(?:\?v=.+)?$/u
                  )
                },
                kind: "term",
                label: "行く",
                meaning: "andare"
              }
            ],
            reading: "いく",
            reviewStateUpdatedAt: expect.any(String)
          }
        });
        expect(body.queue.dueCount).toBeGreaterThan(0);
      }
    );
  });

  it("applies a mobile grade and returns the next live state", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-review-grade-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        const expectedUpdatedAt = await makePrimaryCardDue(database);
        const existingLogRows = await database.query.reviewSubjectLog.findMany({
          where: eq(reviewSubjectLog.cardId, developmentFixture.primaryCardId)
        });
        const { POST } = await importGradeRouteForDatabase(databasePath);

        const response = await POST(
          new Request("https://example.test/api/mobile/review/grade", {
            body: JSON.stringify({
              cardId: developmentFixture.primaryCardId,
              expectedUpdatedAt,
              rating: "good",
              responseMs: 1200
            }),
            headers: {
              authorization: "Bearer mobile-review-secret",
              "content-type": "application/json"
            },
            method: "POST"
          })
        );
        const body = await response.json();
        const logRows = await database.query.reviewSubjectLog.findMany({
          where: eq(reviewSubjectLog.cardId, developmentFixture.primaryCardId)
        });
        const state = await database.query.reviewSubjectState.findFirst({
          where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
        });

        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body).toMatchObject({
          ok: true,
          grade: {
            cardId: developmentFixture.primaryCardId,
            rating: "good"
          },
          session: {
            ok: true,
            source: "live"
          }
        });
        expect(logRows).toHaveLength(existingLogRows.length + 1);
        expect(state?.lastReviewedAt).not.toBeNull();
      }
    );
  });

  it("persists a safe buffered grade without rebuilding the global session", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-review-buffered-grade-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        const expectedUpdatedAt =
          await makePrimaryAndSecondaryCardsDue(database);
        const existingLogRows = await database.query.reviewSubjectLog.findMany({
          where: eq(reviewSubjectLog.cardId, developmentFixture.primaryCardId)
        });
        const { POST } = await importGradeRouteForDatabase(databasePath);

        const response = await POST(
          new Request("https://example.test/api/mobile/review/grade", {
            body: JSON.stringify({
              cardId: developmentFixture.primaryCardId,
              expectedUpdatedAt,
              hasBufferedSuccessor: true,
              rating: "good",
              responseMs: 900
            }),
            headers: {
              authorization: "Bearer mobile-review-secret",
              "content-type": "application/json"
            },
            method: "POST"
          })
        );
        const body = await response.json();
        const logRows = await database.query.reviewSubjectLog.findMany({
          where: eq(reviewSubjectLog.cardId, developmentFixture.primaryCardId)
        });

        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body).toMatchObject({
          ok: true,
          grade: {
            cardId: developmentFixture.primaryCardId,
            rating: "good"
          },
          session: null
        });
        expect(logRows).toHaveLength(existingLogRows.length + 1);
      }
    );
  });

  it("rejects mobile grades that omit the required freshness token", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-review-no-freshness-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await makePrimaryCardDue(database);
        const existingLogRows = await database.query.reviewSubjectLog.findMany({
          where: eq(reviewSubjectLog.cardId, developmentFixture.primaryCardId)
        });
        const { POST } = await importGradeRouteForDatabase(databasePath);

        const response = await POST(
          new Request("https://example.test/api/mobile/review/grade", {
            body: JSON.stringify({
              cardId: developmentFixture.primaryCardId,
              rating: "good"
            }),
            headers: {
              authorization: "Bearer mobile-review-secret",
              "content-type": "application/json"
            },
            method: "POST"
          })
        );
        const body = await response.json();
        const logRows = await database.query.reviewSubjectLog.findMany({
          where: eq(reviewSubjectLog.cardId, developmentFixture.primaryCardId)
        });

        expect(response.status, JSON.stringify(body)).toBe(400);
        expect(body).toEqual({
          error: "Invalid mobile review grade request.",
          ok: false
        });
        expect(logRows).toHaveLength(existingLogRows.length);
      }
    );
  });

  it("returns a recoverable conflict for stale mobile grading", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-review-stale-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await makePrimaryCardDue(database);
        const { POST } = await importGradeRouteForDatabase(databasePath);

        const response = await POST(
          new Request("https://example.test/api/mobile/review/grade", {
            body: JSON.stringify({
              cardId: developmentFixture.primaryCardId,
              expectedUpdatedAt: "1999-01-01T00:00:00.000Z",
              rating: "good"
            }),
            headers: {
              authorization: "Bearer mobile-review-secret",
              "content-type": "application/json"
            },
            method: "POST"
          })
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
          error: "Review card is out of date.",
          ok: false
        });
      }
    );
  });

  it("persists the single-user APNs device token", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-review-device-token-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        const { POST } = await importDeviceTokenRouteForDatabase(databasePath);
        const deviceToken = "a".repeat(64);

        const response = await POST(
          new Request("https://example.test/api/mobile/review/device-token", {
            body: JSON.stringify({ deviceToken }),
            headers: {
              authorization: "Bearer mobile-review-secret",
              "content-type": "application/json"
            },
            method: "POST"
          })
        );
        const row = await database.query.userSetting.findFirst({
          where: (setting, { eq }) =>
            eq(setting.key, "mobile_review_apns_device_token")
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
          ok: true
        });
        expect(row?.valueJson).toContain(deviceToken);
      }
    );
  });
});

async function makePrimaryCardDue(database: DatabaseClient) {
  await makeReviewSubjectDue(database, primarySubjectKey, {
    dueAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2026-04-02T12:00:00.000Z"
  });

  return "2026-04-02T12:00:00.000Z";
}

async function makeSecondaryCardDue(database: DatabaseClient) {
  await makeReviewSubjectDue(database, secondarySubjectKey, {
    dueAt: "2000-01-02T00:00:00.000Z",
    updatedAt: "2026-04-02T12:05:00.000Z"
  });
}

async function makeReviewSubjectDue(
  database: DatabaseClient,
  subjectKey: string,
  input: {
    dueAt: string;
    updatedAt: string;
  }
) {
  await database
    .update(reviewSubjectState)
    .set({
      dueAt: input.dueAt,
      manualOverride: false,
      state: "learning",
      suspended: false,
      updatedAt: input.updatedAt
    })
    .where(eq(reviewSubjectState.subjectKey, subjectKey));
}

async function makePrimaryAndSecondaryCardsDue(database: DatabaseClient) {
  const primaryUpdatedAt = await makePrimaryCardDue(database);
  await makeSecondaryCardDue(database);
  await database
    .update(reviewSubjectState)
    .set({
      difficulty: 1,
      lastReviewedAt: "2026-04-01T00:00:00.000Z",
      scheduledDays: 1,
      stability: 1_000_000,
      state: "review"
    })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
  await database
    .update(reviewSubjectState)
    .set({
      difficulty: 10,
      lastReviewedAt: "2000-01-01T00:00:00.000Z",
      scheduledDays: 1,
      stability: 0.1,
      state: "review"
    })
    .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

  return primaryUpdatedAt;
}

async function importSessionRouteWithMockedDatabase() {
  closeAndForgetDatabaseSingleton();
  vi.resetModules();
  vi.doMock("@/db", () => ({
    db: {}
  }));

  return import("@/app/api/mobile/review/session/route");
}

async function importSessionRouteForDatabase(databasePath: string) {
  await importRouteForDatabase(databasePath);

  return import("@/app/api/mobile/review/session/route");
}

async function importGradeRouteForDatabase(databasePath: string) {
  await importRouteForDatabase(databasePath);

  return import("@/app/api/mobile/review/grade/route");
}

async function importDeviceTokenRouteForDatabase(databasePath: string) {
  await importRouteForDatabase(databasePath);

  return import("@/app/api/mobile/review/device-token/route");
}

async function importRouteForDatabase(databasePath: string) {
  closeAndForgetDatabaseSingleton();
  vi.resetModules();
  vi.doUnmock("@/db");
  process.env.DATABASE_URL = databasePath;
}

function closeAndForgetDatabaseSingleton() {
  const globalForDatabase = globalThis as {
    __japaneseCustomStudyDb__?: DatabaseClient;
  };

  if (globalForDatabase.__japaneseCustomStudyDb__) {
    closeDatabaseClient(globalForDatabase.__japaneseCustomStudyDb__);
    delete globalForDatabase.__japaneseCustomStudyDb__;
  }
}

function restoreDatabaseUrl(previousDatabaseUrl: string | undefined) {
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = previousDatabaseUrl;
}
