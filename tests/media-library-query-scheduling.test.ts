import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

describe("media library query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/db/queries");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/local-date");
    vi.doUnmock("@/lib/media-shell-snapshot");
    vi.doUnmock("@/lib/review-loader");
    vi.doUnmock("@/lib/settings");
    vi.doUnmock("@/lib/site");
    vi.doUnmock("@/lib/study-format");
    vi.doUnmock("@/lib/study-metrics");
  });

  it("starts shared review settings before the cached media list settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const mediaRowsGate = schedule.gate<
      Array<{
        description: string;
        id: string;
        mediaType: string;
        segmentKind: string;
        slug: string;
        status: string;
        title: string;
      }>
    >("media rows");
    const dailyLimitGate = schedule.gate<number>("daily limit");
    const introducedTodayGate = schedule.gate<number>("introduced today");
    const queuedSummaryGate = schedule.gate<{
      count: number;
      firstDueFront: string | null;
      firstFront: string | null;
    }>(
      "queued summary"
    );

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/db/queries", () => ({
      getQueuedNewReviewSubjectSummaryByMediaId: vi.fn(
        queuedSummaryGate.loader()
      ),
      listGlossaryPreviewEntries: vi.fn(() => Promise.resolve([])),
      listGlossaryProgressSummaries: vi.fn(() => Promise.resolve([])),
      listLessonsByMediaId: vi.fn(() => Promise.resolve([])),
      listLessonsByMediaIdsForShell: vi.fn(() => Promise.resolve([]))
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildGlossarySummaryTags: vi.fn(() => []),
      buildReviewSummaryTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => true),
      getMediaBySlugCached: vi.fn(),
      listMediaCached: vi.fn(mediaRowsGate.loader()),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell-snapshot", () => ({
      mapMediaShellSnapshotFromCounts: vi.fn(
        ({ glossary, lessons, media, reviewCounts }) => ({
          activeReviewCards: reviewCounts?.activeReviewCards ?? 0,
          cardsDue: reviewCounts?.dueCount ?? 0,
          cardsTotal: reviewCounts?.cardsTotal ?? 0,
          description: media.description,
          entriesKnown: glossary.entriesCovered,
          entriesTotal: glossary.entriesTotal,
          glossary,
          glossaryProgressPercent: glossary.progressPercent,
          id: media.id,
          inProgressLessons: 0,
          lessonsCompleted: 0,
          lessonsTotal: lessons.length,
          mediaType: media.mediaType,
          mediaTypeLabel: "Gioco",
          nextLesson: null,
          previewEntries: [],
          resumeLesson: null,
          reviewQueueLabel: "",
          reviewStatDetail: "",
          reviewStatValue: "",
          segmentKindLabel: "Capitolo",
          segments: [],
          slug: media.slug,
          statusLabel: "Attivo",
          textbookProgressPercent: null,
          title: media.title
        })
      ),
      pickFocusMedia: vi.fn(() => null)
    }));
    vi.doMock("@/lib/review-loader", () => ({
      loadReviewIntroducedTodayCountCached: vi.fn(
        introducedTodayGate.loader()
      ),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      loadReviewLaunchCandidatesCached: vi.fn(() =>
        Promise.resolve([
          {
            activeReviewCards: 1,
            cardsTotal: 3,
            dueCount: 1,
            manualCount: 0,
            mediaId: "media-1",
            newAvailableCount: 4,
            newCount: 4,
            suspendedCount: 0,
            tomorrowCount: 0,
            totalCards: 3
          }
        ])
      ),
      loadReviewOverviewSnapshots: vi.fn()
    }));
    vi.doMock("@/lib/settings", () => ({
      getReviewDailyLimit: vi.fn(dailyLimitGate.loader())
    }));
    vi.doMock("@/lib/site", () => ({
      mediaGlossaryEntryHref: vi.fn(() => "/glossary/entry")
    }));
    vi.doMock("@/lib/study-format", () => ({
      calculatePercent: vi.fn(() => 0)
    }));
    vi.doMock("@/lib/study-metrics", () => ({
      buildEmptyGlossaryProgressSnapshot: vi.fn(() => ({
        breakdown: {
          available: 0,
          known: 0,
          learning: 0,
          new: 0,
          review: 0
        },
        entriesCovered: 0,
        entriesTotal: 0,
        previewEntries: [],
        progressPercent: 0
      }))
    }));

    const { getMediaLibraryData } = await import("@/lib/media-shell");
    const mediaLibraryPromise = getMediaLibraryData();

    await schedule.expectStarted(
      "media rows",
      "daily limit",
      "introduced today"
    );
    schedule.expectNotStarted("queued summary");
    schedule.expectNotSettled("media rows");

    mediaRowsGate.resolve([
      {
        description: "Fixture media",
        id: "media-1",
        mediaType: "game",
        segmentKind: "chapter",
        slug: "fixture-media",
        status: "active",
        title: "Fixture Media"
      }
    ]);
    dailyLimitGate.resolve(7);
    introducedTodayGate.resolve(2);
    await schedule.expectStarted("queued summary");
    queuedSummaryGate.resolve({
      count: 4,
      firstDueFront: null,
      firstFront: null
    });

    await expect(mediaLibraryPromise).resolves.toEqual([
      expect.objectContaining({
        id: "media-1",
        cardsDue: 1,
        cardsTotal: 3,
        activeReviewCards: 1
      })
    ]);
  });
});
