import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

describe("progress query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/features/cache/server/data-cache");
    vi.doUnmock("@/features/shared/model/local-date");
    vi.doUnmock("@/features/media/server");
    vi.doUnmock("@/features/review/server");
    vi.doUnmock("@/features/settings/server");
    vi.doUnmock("@/features/navigation");
    vi.doUnmock("@/features/study/model/format");
  });

  it("starts shared settings lookups before the cache-enabled media lookup settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewAutoplayAudioOnReveal: true,
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
    vi.doMock("@/features/cache/server/data-cache", () => ({
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
    vi.doMock("@/features/shared/model/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/features/review/server", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(),
      loadReviewIntroducedTodayCountCached: vi.fn(introducedTodayGate.loader()),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      loadReviewOverviewBundle: vi.fn()
    }));
    vi.doMock("@/features/settings/server", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));

    const { getMediaProgressPageData } =
      await import("@/features/progress/server");
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
    vi.doMock("@/features/cache/server/data-cache", () => ({
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
    vi.doMock("@/features/shared/model/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/features/review/server", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(),
      loadReviewIntroducedTodayCountCached: vi.fn(introducedTodayGate.loader()),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      loadReviewOverviewBundle: vi.fn()
    }));
    vi.doMock("@/features/settings/server", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));

    const { getMediaProgressPageData } =
      await import("@/features/progress/server");
    const progressPromise = getMediaProgressPageData("missing-media");

    await schedule.expectStarted("media", "settings", "introduced today");
    settingsGate.reject(new Error("settings lookup failed after media miss"));
    introducedTodayGate.resolve(2);
    mediaGate.resolve(null);

    await expect(progressPromise).resolves.toBeNull();
    await schedule.releaseAll();
  });

  it("does not start the review overview before the cache-enabled media lookup settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewAutoplayAudioOnReveal: true,
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
    const reviewOverviewGate = schedule.gate<unknown>("review overview");

    const loadReviewOverviewBundle = vi.fn(reviewOverviewGate.loader());

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/features/cache/server/data-cache", () => ({
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
    vi.doMock("@/features/shared/model/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/features/media/server", () => ({
      getMediaDetailData: vi.fn()
    }));
    vi.doMock("@/features/review/server", () => ({
      loadReviewIntroducedTodayCountCached: vi.fn(introducedTodayGate.loader()),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      loadReviewOverviewBundle
    }));
    vi.doMock("@/features/settings/server", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));

    const { getMediaProgressPageData } =
      await import("@/features/progress/server");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await schedule.expectStarted("media", "settings", "introduced today");
    schedule.expectNotStarted("review overview");

    settingsGate.resolve(settingsValue);
    introducedTodayGate.resolve(2);
    schedule.expectNotStarted("review overview");
    schedule.expectNotSettled("media");

    mediaGate.resolve(null);
    await expect(progressPromise).resolves.toBeNull();
    expect(loadReviewOverviewBundle).not.toHaveBeenCalled();
  });

  it("loads global and local progress review snapshots in one overview bundle", async () => {
    const schedule = createQuerySchedulingHarness();
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewAutoplayAudioOnReveal: true,
      reviewFrontFurigana: true,
      reviewDailyLimit: 7
    };
    const globalOverviewValue = {
      activeCards: 3,
      dailyLimit: 7,
      dueCount: 1,
      effectiveDailyLimit: 7,
      manualCount: 0,
      newAvailableCount: 2,
      newQueuedCount: 1,
      nextCardFront: "共有レビュー",
      queueCount: 2,
      queueLabel: "2 queued",
      suspendedCount: 0,
      tomorrowCount: 0,
      totalCards: 5,
      upcomingCount: 2
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
    const reviewOverviewGate = schedule.gate<{
      byMedia: Map<string, unknown>;
      global: typeof globalOverviewValue;
    }>("review overview");
    const sharedMediaGate =
      schedule.gate<typeof sharedMediaValue>("shared media");

    const loadReviewOverviewBundle = vi.fn(reviewOverviewGate.loader());

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/features/cache/server/data-cache", () => ({
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
    vi.doMock("@/features/shared/model/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/features/media/server", () => ({
      getMediaDetailData: vi.fn(sharedMediaGate.loader())
    }));
    vi.doMock("@/features/review/server", () => ({
      loadReviewIntroducedTodayCountCached: vi.fn(introducedTodayGate.loader()),
      loadReviewOverviewBundle
    }));
    vi.doMock("@/features/settings/server", () => ({
      getStudySettings: vi.fn(settingsGate.loader())
    }));
    vi.doMock("@/features/navigation", () => ({
      mediaGlossaryHref: (slug: string) => `/glossary?media=${slug}`,
      mediaHref: (slug: string) => `/media/${slug}`,
      mediaStudyHref: (slug: string, area: string) =>
        area === "glossary"
          ? `/glossary?media=${slug}`
          : `/media/${slug}/${area}`,
      mediaTextbookLessonHref: (slug: string, lesson: string) =>
        `/media/${slug}/textbook/${lesson}`,
      reviewHref: () => "/review"
    }));
    vi.doMock("@/features/study/model/format", () => ({
      calculatePercent: vi.fn(() => null)
    }));

    const { getMediaProgressPageData } =
      await import("@/features/progress/server");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await schedule.expectStarted("settings", "introduced today");
    settingsGate.resolve(settingsValue);
    introducedTodayGate.resolve(2);
    await schedule.expectStarted("review overview");
    schedule.expectNotSettled("review overview");

    expect(loadReviewOverviewBundle).toHaveBeenCalledTimes(1);
    expect(loadReviewOverviewBundle).toHaveBeenCalledWith(
      {},
      [
        {
          id: "media-1",
          slug: "fixture-media",
          title: "Fixture Media"
        }
      ],
      expect.objectContaining({
        globalMediaRows: [
          {
            id: "media-1",
            slug: "fixture-media",
            title: "Fixture Media"
          }
        ],
        resolvedDailyLimit: 7,
        resolvedNewIntroducedTodayCount: 2
      })
    );

    reviewOverviewGate.resolve({
      byMedia: new Map([
        [
          "media-1",
          {
            activeCards: 1,
            dailyLimit: 7,
            dueCount: 1,
            effectiveDailyLimit: 7,
            manualCount: 0,
            newAvailableCount: 1,
            newQueuedCount: 0,
            queueCount: 1,
            queueLabel: "1 due",
            suspendedCount: 0,
            tomorrowCount: 0,
            totalCards: 2,
            upcomingCount: 0
          }
        ]
      ]),
      global: globalOverviewValue
    });
    sharedMediaGate.resolve(sharedMediaValue);

    const data = await progressPromise;

    expect(data).not.toBeNull();
    expect(data?.media.slug).toBe("fixture-media");
    expect(data?.review.dailyLimit).toBe(7);
  });
});
