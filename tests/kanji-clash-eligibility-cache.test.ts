import { describe, expect, it, vi } from "vitest";

describe("kanji clash eligibility cache", () => {
  it("uses a stable media-scoped cache key and existing review/media tags", async () => {
    vi.resetModules();

    const database = {};
    const subjects = [{ subjectKey: "subject-a" }];
    const listEligibleKanjiClashSubjects = vi.fn(() =>
      Promise.resolve(subjects)
    );
    const runWithTaggedCache = vi.fn(async ({ loader }) => loader());

    vi.doMock("@/db/queries", () => ({
      listEligibleKanjiClashSubjects
    }));
    vi.doMock("@/lib/data-cache", () => ({
      buildReviewSummaryTags: (mediaIds: string[] = []) => [
        "review-summary",
        ...mediaIds.map((mediaId) => `review-summary:${mediaId}`)
      ],
      canUseDataCache: vi.fn(() => true),
      MEDIA_LIST_TAG: "media-list",
      REVIEW_SUMMARY_TAG: "review-summary",
      runWithTaggedCache
    }));

    const { listEligibleKanjiClashSubjectsCached } = await import(
      "@/features/kanji-clash/server/eligibility-cache.ts"
    );

    await expect(
      listEligibleKanjiClashSubjectsCached(database as never, {
        mediaIds: ["media-b", "media-a", "media-a", ""]
      })
    ).resolves.toBe(subjects);

    expect(runWithTaggedCache).toHaveBeenCalledWith({
      enabled: true,
      keyParts: [
        "kanji-clash",
        "eligible-subjects",
        "media:media-a,media-b"
      ],
      loader: expect.any(Function),
      tags: [
        "media-list",
        "review-summary",
        "review-summary:media-a",
        "review-summary:media-b"
      ]
    });
    expect(listEligibleKanjiClashSubjects).toHaveBeenCalledWith(database, {
      mediaIds: ["media-a", "media-b"]
    });
  });

  it("uses the global eligibility cache key when no media ids are provided", async () => {
    vi.resetModules();

    const database = {};
    const listEligibleKanjiClashSubjects = vi.fn(() => Promise.resolve([]));
    const runWithTaggedCache = vi.fn(async ({ loader }) => loader());

    vi.doMock("@/db/queries", () => ({
      listEligibleKanjiClashSubjects
    }));
    vi.doMock("@/lib/data-cache", () => ({
      buildReviewSummaryTags: () => ["review-summary"],
      canUseDataCache: vi.fn(() => true),
      MEDIA_LIST_TAG: "media-list",
      REVIEW_SUMMARY_TAG: "review-summary",
      runWithTaggedCache
    }));

    const { listEligibleKanjiClashSubjectsCached } = await import(
      "@/features/kanji-clash/server/eligibility-cache.ts"
    );

    await listEligibleKanjiClashSubjectsCached(database as never);

    expect(runWithTaggedCache).toHaveBeenCalledWith({
      enabled: true,
      keyParts: ["kanji-clash", "eligible-subjects", "media:all"],
      loader: expect.any(Function),
      tags: ["media-list", "review-summary"]
    });
    expect(listEligibleKanjiClashSubjects).toHaveBeenCalledWith(database, {
      mediaIds: undefined
    });
  });

  it("bypasses the data cache when the database cannot use Next cache", async () => {
    vi.resetModules();

    const database = {};
    const listEligibleKanjiClashSubjects = vi.fn(() => Promise.resolve([]));
    const runWithTaggedCache = vi.fn(async ({ loader }) => loader());

    vi.doMock("@/db/queries", () => ({
      listEligibleKanjiClashSubjects
    }));
    vi.doMock("@/lib/data-cache", () => ({
      buildReviewSummaryTags: () => ["review-summary"],
      canUseDataCache: vi.fn(() => false),
      MEDIA_LIST_TAG: "media-list",
      REVIEW_SUMMARY_TAG: "review-summary",
      runWithTaggedCache
    }));

    const { listEligibleKanjiClashSubjectsCached } = await import(
      "@/features/kanji-clash/server/eligibility-cache.ts"
    );

    await listEligibleKanjiClashSubjectsCached(database as never);

    expect(runWithTaggedCache).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false
      })
    );
  });
});
