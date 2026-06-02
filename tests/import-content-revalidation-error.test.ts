import { afterEach, describe, expect, it, vi } from "vitest";

import { revalidateImportedContentCache } from "@/features/content/importer/cache-revalidation";
import { readContentCacheRevalidationErrorDetails } from "@/features/content/importer/revalidation-error";

describe("content import cache revalidation error details", () => {
  afterEach(() => {
    delete process.env.CONTENT_CACHE_REVALIDATE_SECRET;
    delete process.env.CONTENT_CACHE_REVALIDATE_URL;
    vi.unstubAllGlobals();
  });

  it("preserves plain-text error bodies from the revalidation endpoint", async () => {
    const response = new Response("remote cache failed", {
      status: 500
    });

    await expect(
      readContentCacheRevalidationErrorDetails(response)
    ).resolves.toBe("remote cache failed");
  });

  it("skips cache revalidation when endpoint configuration is absent", async () => {
    await expect(
      revalidateImportedContentCache({
        importId: "import-test",
        lessons: [],
        mediaSlugs: ["sample-anime"]
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: "skipped"
      })
    );
  });

  it("reports revalidation endpoint failures with the response body", async () => {
    process.env.CONTENT_CACHE_REVALIDATE_SECRET = "test-secret";
    process.env.CONTENT_CACHE_REVALIDATE_URL =
      "https://example.test/api/internal/content-cache/revalidate";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("remote cache failed", { status: 500 }))
    );

    await expect(
      revalidateImportedContentCache({
        importId: "import-test",
        lessons: [{ lessonSlug: "ep01-intro", mediaSlug: "sample-anime" }],
        mediaSlugs: ["sample-anime"]
      })
    ).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining("remote cache failed"),
        status: "failed"
      })
    );
  });
});
