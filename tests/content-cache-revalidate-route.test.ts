import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMediaBySlugMock,
  revalidateGlossarySummaryCacheMock,
  revalidateTextbookLessonBodyCacheMock,
  revalidateMediaListCacheMock,
  revalidatePathMock,
  revalidateReviewSummaryCacheMock,
  revalidateTextbookTooltipCacheMock
} = vi.hoisted(() => ({
  getMediaBySlugMock: vi.fn(),
  revalidateGlossarySummaryCacheMock: vi.fn(),
  revalidateTextbookLessonBodyCacheMock: vi.fn(),
  revalidateMediaListCacheMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  revalidateReviewSummaryCacheMock: vi.fn(),
  revalidateTextbookTooltipCacheMock: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("@/db", () => ({
  db: {}
}));

vi.mock("@/db/queries", () => ({
  getMediaBySlug: getMediaBySlugMock
}));

vi.mock("@/lib/data-cache", () => ({
  revalidateGlossarySummaryCache: revalidateGlossarySummaryCacheMock,
  revalidateMediaListCache: revalidateMediaListCacheMock,
  revalidateReviewSummaryCache: revalidateReviewSummaryCacheMock,
  revalidateTextbookLessonBodyCache: revalidateTextbookLessonBodyCacheMock,
  revalidateTextbookTooltipCache: revalidateTextbookTooltipCacheMock
}));

import { POST } from "@/app/api/internal/content-cache/revalidate/route";

describe("content cache revalidation route", () => {
  beforeEach(() => {
    process.env.CONTENT_CACHE_REVALIDATE_SECRET = "test-secret";
    getMediaBySlugMock.mockReset();
    revalidateGlossarySummaryCacheMock.mockReset();
    revalidateTextbookLessonBodyCacheMock.mockReset();
    revalidateMediaListCacheMock.mockReset();
    revalidatePathMock.mockReset();
    revalidateReviewSummaryCacheMock.mockReset();
    revalidateTextbookTooltipCacheMock.mockReset();
  });

  it("revalidates both global and media-specific summary tags for imported media", async () => {
    getMediaBySlugMock.mockImplementation(async (_database, slug: string) => {
      if (slug === "duel-masters") {
        return { id: "media_dm" };
      }

      if (slug === "persona") {
        return { id: "media_p5" };
      }

      return null;
    });

    const response = await POST(
      new Request(
        "https://example.test/api/internal/content-cache/revalidate",
        {
          body: JSON.stringify({
            lessons: [
              { lessonSlug: "lesson-1", mediaSlug: "duel-masters" },
              { lessonSlug: "lesson-2", mediaSlug: "persona" }
            ],
            mediaSlugs: ["duel-masters", "persona"]
          }),
          headers: {
            "content-type": "application/json",
            "x-revalidate-secret": "test-secret"
          },
          method: "POST"
        }
      )
    );

    expect(response.status).toBe(200);
    expect(revalidateMediaListCacheMock).toHaveBeenCalledTimes(1);
    expect(revalidateGlossarySummaryCacheMock).toHaveBeenCalledWith();
    expect(revalidateReviewSummaryCacheMock).toHaveBeenCalledWith();
    expect(revalidateGlossarySummaryCacheMock).toHaveBeenCalledWith("media_dm");
    expect(revalidateGlossarySummaryCacheMock).toHaveBeenCalledWith("media_p5");
    expect(revalidateReviewSummaryCacheMock).toHaveBeenCalledWith("media_dm");
    expect(revalidateReviewSummaryCacheMock).toHaveBeenCalledWith("media_p5");
    expect(revalidateTextbookLessonBodyCacheMock).toHaveBeenCalledTimes(2);
    expect(revalidateTextbookTooltipCacheMock).toHaveBeenCalledTimes(2);
  });

  it("ignores malformed payload members instead of failing the revalidation request", async () => {
    getMediaBySlugMock.mockResolvedValue({ id: "media_dm" });

    const response = await POST(
      new Request(
        "https://example.test/api/internal/content-cache/revalidate",
        {
          body: JSON.stringify({
            lessons: [
              { lessonSlug: "lesson-1", mediaSlug: "duel-masters" },
              null,
              "lesson-2",
              { lessonSlug: 3, mediaSlug: "persona" }
            ],
            mediaSlugs: ["duel-masters", 42, null, " duel-masters "]
          }),
          headers: {
            "content-type": "application/json",
            "x-revalidate-secret": "test-secret"
          },
          method: "POST"
        }
      )
    );

    await expect(response.json()).resolves.toMatchObject({
      lessonCount: 1,
      mediaCount: 1,
      ok: true
    });
    expect(response.status).toBe(200);
    expect(revalidateTextbookLessonBodyCacheMock).toHaveBeenCalledTimes(1);
    expect(revalidateTextbookTooltipCacheMock).toHaveBeenCalledTimes(1);
    expect(getMediaBySlugMock).toHaveBeenCalledTimes(1);
  });
});
