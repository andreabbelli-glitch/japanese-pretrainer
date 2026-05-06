import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

describe("progress query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/local-date");
    vi.doUnmock("@/lib/media-shell");
    vi.doUnmock("@/lib/review");
    vi.doUnmock("@/lib/settings");
    vi.doUnmock("@/lib/site");
    vi.doUnmock("@/lib/study-format");
  });

  it("starts shared settings lookups before the cache-enabled media lookup settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewFrontFurigana: true,
      reviewDailyLimit: 7
    };
    const mediaGate = schedule.gate<{
      id: string;
      slug: string;
      title: string;
    } | null>("media");
    const settingsGate = schedule.gate<typeof settingsValue>("settings");
    const introducedTodayGate = schedule.gate<number>("introduced today");

    vi.doMock("@/db", () => ({
      db: {}
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
      getMediaBySlugCached: vi.fn(mediaGate.loader()),
      listMediaCached: vi.fn(),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(),
      loadReviewIntroducedTodayCountCached: vi.fn(
        introducedTodayGate.loader()
      ),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      mapReviewOverviewSnapshot: vi.fn()
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await schedule.expectStarted("media", "settings", "introduced today");
    schedule.expectNotSettled("media");

    mediaGate.resolve(null);
    settingsGate.resolve(settingsValue);
    introducedTodayGate.resolve(2);
    await expect(progressPromise).resolves.toBeNull();
  });

  it("handles shared query failures when the media lookup misses", async () => {
    const schedule = createQuerySchedulingHarness();
    const mediaGate = schedule.gate<{
      id: string;
      slug: string;
      title: string;
    } | null>("media");
    const settingsGate = schedule.gate<never>("settings");
    const introducedTodayGate = schedule.gate<number>("introduced today");

    vi.doMock("@/db", () => ({
      db: {}
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
      getMediaBySlugCached: vi.fn(mediaGate.loader()),
      listMediaCached: vi.fn(),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(),
      loadReviewIntroducedTodayCountCached: vi.fn(
        introducedTodayGate.loader()
      ),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      mapReviewOverviewSnapshot: vi.fn()
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("missing-media");

    await schedule.expectStarted("media", "settings", "introduced today");
    settingsGate.reject(new Error("settings lookup failed after media miss"));
    introducedTodayGate.resolve(2);
    mediaGate.resolve(null);

    await expect(progressPromise).resolves.toBeNull();
    await schedule.releaseAll();
  });

  it("starts the global review overview before the cache-enabled media lookup settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewFrontFurigana: true,
      reviewDailyLimit: 7
    };
    const mediaGate = schedule.gate<{
      id: string;
      slug: string;
      title: string;
    } | null>("media");
    const settingsGate = schedule.gate<typeof settingsValue>("settings");
    const introducedTodayGate = schedule.gate<number>("introduced today");
    const globalOverviewGate = schedule.gate<unknown>("global overview");

    const loadGlobalReviewOverviewSnapshot = vi.fn(globalOverviewGate.loader());

    vi.doMock("@/db", () => ({
      db: {}
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
      getMediaBySlugCached: vi.fn(mediaGate.loader()),
      listMediaCached: vi.fn(),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell", () => ({
      getMediaDetailData: vi.fn()
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot,
      loadReviewIntroducedTodayCountCached: vi.fn(
        introducedTodayGate.loader()
      ),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      mapReviewOverviewSnapshot: vi.fn()
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await schedule.expectStarted("media", "settings", "introduced today");
    schedule.expectNotStarted("global overview");

    settingsGate.resolve(settingsValue);
    introducedTodayGate.resolve(2);
    await schedule.expectStarted("global overview");
    schedule.expectNotSettled("media");

    expect(loadGlobalReviewOverviewSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        resolvedDailyLimit: 7,
        resolvedNewIntroducedTodayCount: 2
      })
    );

    mediaGate.resolve(null);
    globalOverviewGate.resolve(null);
    await expect(progressPromise).resolves.toBeNull();
  });

  it("starts the global review overview load before the local media overview settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewFrontFurigana: true,
      reviewDailyLimit: 7
    };
    const globalOverviewValue = {
      activeReviewCards: 3,
      cardsTotal: 5,
      dueCount: 1,
      manualCount: 0,
      newAvailableCount: 2,
      firstDueFront: "共有レビュー",
      firstNewFront: "新しいカード",
      suspendedCount: 0,
      tomorrowCount: 0,
      totalCards: 5
    };
    const sharedMediaValue = {
      activeLesson: null,
      description: "Fixture media",
      glossary: {
        breakdown: {
          available: 0,
          known: 0,
          learning: 0,
          new: 0,
          review: 0
        },
        entriesCovered: 0,
        entriesTotal: 0,
        previewEntries: []
      },
      inProgressLessons: 0,
      lastOpenedLesson: null,
      lessonsCompleted: 0,
      lessonsTotal: 0,
      mediaTypeLabel: "Gioco",
      nextLesson: null,
      resumeLesson: null,
      segmentKindLabel: "Capitolo",
      segments: [],
      slug: "fixture-media",
      statusLabel: "Attivo",
      textbookProgressPercent: null,
      title: "Fixture Media"
    };
    const settingsGate = schedule.gate<typeof settingsValue>("settings");
    const introducedTodayGate = schedule.gate<number>("introduced today");
    const mediaOverviewGate =
      schedule.gate<Map<string, unknown>>("media overview");
    const globalOverviewGate =
      schedule.gate<typeof globalOverviewValue>("global overview");
    const sharedMediaGate =
      schedule.gate<typeof sharedMediaValue>("shared media");

    const loadGlobalReviewOverviewSnapshot = vi.fn(
      globalOverviewGate.loader()
    );

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildGlossarySummaryTags: vi.fn(() => []),
      buildReviewSummaryTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => false),
      getMediaBySlugCached: vi.fn(),
      listMediaCached: vi.fn(async () => [
        {
          id: "media-1",
          slug: "fixture-media",
          title: "Fixture Media"
        }
      ]),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell", () => ({
      getMediaDetailData: vi.fn(sharedMediaGate.loader())
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot,
      loadReviewIntroducedTodayCountCached: vi.fn(
        introducedTodayGate.loader()
      ),
      loadReviewOverviewSnapshots: vi.fn(mediaOverviewGate.loader())
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));
    vi.doMock("@/lib/site", () => ({
      mediaGlossaryHref: (slug: string) => `/media/${slug}/glossary`,
      mediaHref: (slug: string) => `/media/${slug}`,
      mediaStudyHref: (slug: string, area: string) => `/media/${slug}/${area}`,
      mediaTextbookLessonHref: (slug: string, lesson: string) =>
        `/media/${slug}/textbook/${lesson}`,
      reviewHref: () => "/review"
    }));
    vi.doMock("@/lib/study-format", () => ({
      calculatePercent: vi.fn(() => null)
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await schedule.expectStarted("settings", "introduced today");
    settingsGate.resolve(settingsValue);
    introducedTodayGate.resolve(2);
    await schedule.expectStarted("media overview", "global overview");
    schedule.expectNotSettled("media overview");

    expect(loadGlobalReviewOverviewSnapshot).toHaveBeenCalledTimes(1);
    expect(loadGlobalReviewOverviewSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        resolvedDailyLimit: 7,
        resolvedNewIntroducedTodayCount: 2
      })
    );

    mediaOverviewGate.resolve(
      new Map([
        [
          "media-1",
          {
            activeCards: 1,
            dailyLimit: 7,
            dueCount: 1,
            newAvailableCount: 1,
            newQueuedCount: 0,
            queueCount: 1,
            queueLabel: "1 due",
            totalCards: 2
          }
        ]
      ])
    );
    globalOverviewGate.resolve(globalOverviewValue);
    sharedMediaGate.resolve(sharedMediaValue);

    const data = await progressPromise;

    expect(data).not.toBeNull();
    expect(data?.media.slug).toBe("fixture-media");
    expect(data?.review.dailyLimit).toBe(7);
  });
});
