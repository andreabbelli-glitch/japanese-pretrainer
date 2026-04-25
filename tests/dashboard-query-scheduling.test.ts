import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaShellSnapshot } from "@/lib/media-shell";

describe("dashboard data", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/local-date");
    vi.doUnmock("@/lib/media-shell");
    vi.doUnmock("@/lib/review");
    vi.doUnmock("@/lib/settings");
  });

  it("combines media shell totals with the global review overview", async () => {
    const mediaSnapshots = [
      buildMediaSnapshot({
        cardsDue: 0,
        entriesKnown: 2,
        entriesTotal: 5,
        id: "media-1",
        lessonsCompleted: 1,
        lessonsTotal: 3,
        slug: "media-one",
        title: "Media One"
      }),
      buildMediaSnapshot({
        cardsDue: 2,
        entriesKnown: 3,
        entriesTotal: 4,
        id: "media-2",
        lessonsCompleted: 2,
        lessonsTotal: 4,
        slug: "media-two",
        title: "Media Two"
      })
    ];

    mockDashboardDependencies({
      mediaSnapshots
    });

    const { getDashboardData } = await import("@/lib/dashboard");
    const dashboard = await getDashboardData({} as never);

    expect(dashboard.media).toEqual(mediaSnapshots);
    expect(dashboard.focusMedia).toBe(mediaSnapshots[0]);
    expect(dashboard.reviewMedia).toBe(mediaSnapshots[1]);
    expect(dashboard.review).toEqual({
      activeReviewCards: 4,
      cardsDue: 2,
      newQueuedCount: 1,
      queueCount: 3,
      queueLabel: "3 card in coda"
    });
    expect(dashboard.totals).toEqual({
      entriesKnown: 5,
      entriesTotal: 9,
      lessonsCompleted: 3,
      lessonsTotal: 7
    });
  });

  it("prefers due media for the dashboard review shortcut", async () => {
    const focusMedia = buildMediaSnapshot({
      cardsDue: 0,
      cardsTotal: 8,
      id: "focus-media",
      slug: "focus-media",
      title: "Focus Media"
    });
    const dueMedia = buildMediaSnapshot({
      activeReviewCards: 1,
      cardsDue: 1,
      cardsTotal: 1,
      id: "due-media",
      slug: "due-media",
      title: "Due Media"
    });

    mockDashboardDependencies({
      mediaSnapshots: [focusMedia, dueMedia]
    });

    const { getDashboardData } = await import("@/lib/dashboard");
    const dashboard = await getDashboardData({} as never);

    expect(dashboard.focusMedia).toBe(focusMedia);
    expect(dashboard.reviewMedia).toBe(dueMedia);
  });
});

function mockDashboardDependencies(input: {
  mediaSnapshots: MediaShellSnapshot[];
}) {
  vi.doMock("@/db", () => ({
    db: {}
  }));
  vi.doMock("@/lib/data-cache", () => ({
    GLOSSARY_SUMMARY_TAG: "glossary-summary",
    MEDIA_LIST_TAG: "media-list",
    REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
    REVIEW_SUMMARY_TAG: "review-summary",
    SETTINGS_TAG: "settings",
    canUseDataCache: vi.fn(() => false),
    listMediaCached: vi.fn(() =>
      Promise.resolve(
        input.mediaSnapshots.map((snapshot) => ({
          id: snapshot.id,
          slug: snapshot.slug,
          title: snapshot.title
        }))
      )
    ),
    runWithTaggedCache: vi.fn(async ({ loader }) => loader())
  }));
  vi.doMock("@/lib/local-date", () => ({
    getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
  }));
  vi.doMock("@/lib/media-shell", () => ({
    loadMediaShellSnapshots: vi.fn(() => Promise.resolve(input.mediaSnapshots)),
    pickFocusMedia: vi.fn(() => input.mediaSnapshots[0] ?? null)
  }));
  vi.doMock("@/lib/review", () => ({
    loadGlobalReviewOverviewSnapshot: vi.fn(() =>
      Promise.resolve({
        activeCards: 4,
        dailyLimit: 7,
        dueCount: 2,
        effectiveDailyLimit: 7,
        manualCount: 0,
        newAvailableCount: 1,
        newQueuedCount: 1,
        queueCount: 3,
        queueLabel: "3 card in coda",
        suspendedCount: 0,
        tomorrowCount: 0,
        totalCards: 5,
        upcomingCount: 0
      })
    ),
    loadReviewIntroducedTodayCountCached: vi.fn(() => Promise.resolve(0)),
    loadReviewLaunchCandidatesCached: vi.fn(() => Promise.resolve([]))
  }));
  vi.doMock("@/lib/settings", () => ({
    getReviewDailyLimit: vi.fn(() => Promise.resolve(7))
  }));
}

function buildMediaSnapshot(
  overrides: Partial<MediaShellSnapshot> &
    Pick<MediaShellSnapshot, "id" | "slug" | "title">
): MediaShellSnapshot {
  const { id, slug, title, ...rest } = overrides;

  return {
    activeLesson: null,
    activeReviewCards: 0,
    cardsDue: 0,
    cardsTotal: 0,
    description: `${title} description`,
    entriesKnown: 0,
    entriesTotal: 0,
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
      previewEntries: [],
      progressPercent: null
    },
    glossaryProgressPercent: null,
    id,
    inProgressLessons: 0,
    lastOpenedLesson: null,
    lessonsCompleted: 0,
    lessonsTotal: 0,
    mediaType: "game",
    mediaTypeLabel: "Videogioco",
    nextLesson: null,
    previewEntries: [],
    resumeLesson: null,
    reviewQueueLabel: "Nessuna review",
    reviewStatDetail: "Nessuna review",
    reviewStatValue: "0",
    segmentKindLabel: "Capitoli",
    segments: [],
    slug,
    statusLabel: "Attivo",
    textbookProgressPercent: null,
    title,
    ...rest
  };
}
