import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listMediaBySlugsMock,
  revalidateDataCacheTagsMock,
  revalidatePathMock
} = vi.hoisted(() => ({
  listMediaBySlugsMock: vi.fn(),
  revalidateDataCacheTagsMock: vi.fn(),
  revalidatePathMock: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("@/db", () => ({
  db: {}
}));

vi.mock("@/db/queries", () => ({
  listMediaBySlugs: listMediaBySlugsMock
}));

vi.mock("@/lib/data-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data-cache")>();

  return {
    ...actual,
    revalidateDataCacheTags: revalidateDataCacheTagsMock
  };
});

import { POST } from "@/app/api/internal/content-cache/revalidate/route";

describe("content cache revalidation route", () => {
  beforeEach(() => {
    process.env.CONTENT_CACHE_REVALIDATE_SECRET = "test-secret";
    listMediaBySlugsMock.mockReset();
    revalidateDataCacheTagsMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("revalidates both global and media-specific summary tags for imported media", async () => {
    listMediaBySlugsMock.mockResolvedValue([
      { id: "media_dm", slug: "duel-masters" },
      { id: "media_p5", slug: "persona" }
    ]);

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
    expect(listMediaBySlugsMock).toHaveBeenCalledTimes(1);
    expect(listMediaBySlugsMock).toHaveBeenCalledWith(
      {},
      ["duel-masters", "persona"]
    );
    expect(revalidateDataCacheTagsMock).toHaveBeenCalledTimes(1);
    expect(revalidateDataCacheTagsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        "media-list",
        "review-first-candidate",
        "glossary-summary",
        "glossary-summary:media_dm",
        "glossary-summary:media_p5",
        "review-summary",
        "review-summary:media_dm",
        "review-summary:media_p5",
        "textbook-lesson-body:duel-masters:lesson-1",
        "textbook-lesson-body:persona:lesson-2",
        "textbook-tooltips:duel-masters:lesson-1",
        "textbook-tooltips:persona:lesson-2"
      ])
    );
  });

  it("revalidates parent media pages when the payload only lists lessons", async () => {
    listMediaBySlugsMock.mockResolvedValue([
      { id: "media_dm", slug: "duel-masters" }
    ]);

    const response = await POST(
      new Request(
        "https://example.test/api/internal/content-cache/revalidate",
        {
          body: JSON.stringify({
            lessons: [
              { lessonSlug: "lesson-1", mediaSlug: "duel-masters" }
            ]
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
    expect(revalidatePathMock).toHaveBeenCalledWith("/media/duel-masters");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/media/duel-masters/progress"
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/media/duel-masters/textbook"
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/media/duel-masters/textbook/lesson-1"
    );
  });

  it("ignores malformed payload members instead of failing the revalidation request", async () => {
    listMediaBySlugsMock.mockResolvedValue([
      { id: "media_dm", slug: "duel-masters" }
    ]);

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
    expect(revalidateDataCacheTagsMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        "textbook-lesson-body:duel-masters:lesson-1",
        "textbook-tooltips:duel-masters:lesson-1"
      ])
    );
    expect(listMediaBySlugsMock).toHaveBeenCalledTimes(1);
    expect(listMediaBySlugsMock).toHaveBeenCalledWith({}, ["duel-masters"]);
  });
});
