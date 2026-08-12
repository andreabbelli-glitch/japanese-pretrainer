import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTagMock, unstableCacheMock, updateTagMock } = vi.hoisted(
  () => ({
    revalidateTagMock: vi.fn(),
    unstableCacheMock: vi.fn(),
    updateTagMock: vi.fn()
  })
);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: revalidateTagMock,
  updateTag: updateTagMock,
  unstable_cache: unstableCacheMock
}));

import {
  buildGlossarySummaryTags,
  GLOSSARY_SUMMARY_TAG,
  revalidateGlossarySummaryCache,
  REVIEW_FIRST_CANDIDATE_TAG,
  runWithTaggedCache,
  updateGlossarySummaryCache
} from "@/features/cache/server/data-cache";

describe("glossary summary cache tags", () => {
  beforeEach(() => {
    revalidateTagMock.mockReset();
    updateTagMock.mockReset();
  });

  it("keeps global tags only for truly global glossary caches", () => {
    expect(buildGlossarySummaryTags()).toEqual([GLOSSARY_SUMMARY_TAG]);
    expect(buildGlossarySummaryTags(["media_a", "media_b"])).toEqual([
      `${GLOSSARY_SUMMARY_TAG}:media_a`,
      `${GLOSSARY_SUMMARY_TAG}:media_b`
    ]);
  });

  it("revalidates only the scoped glossary tag when a media id is provided", () => {
    revalidateGlossarySummaryCache("media_a");

    expect(revalidateTagMock).toHaveBeenCalledWith(
      `${GLOSSARY_SUMMARY_TAG}:media_a`,
      "max"
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(
      REVIEW_FIRST_CANDIDATE_TAG,
      "max"
    );
    expect(revalidateTagMock).not.toHaveBeenCalledWith(
      GLOSSARY_SUMMARY_TAG,
      "max"
    );
  });

  it("revalidates the global glossary tag when no media id is provided", () => {
    revalidateGlossarySummaryCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(GLOSSARY_SUMMARY_TAG, "max");
    expect(revalidateTagMock).toHaveBeenCalledWith(
      REVIEW_FIRST_CANDIDATE_TAG,
      "max"
    );
  });

  it("updates the scoped glossary tag immediately for server actions", () => {
    updateGlossarySummaryCache("media_a");

    expect(updateTagMock).toHaveBeenCalledWith(
      `${GLOSSARY_SUMMARY_TAG}:media_a`
    );
    expect(updateTagMock).toHaveBeenCalledWith(REVIEW_FIRST_CANDIDATE_TAG);
    expect(updateTagMock).not.toHaveBeenCalledWith(GLOSSARY_SUMMARY_TAG);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});

describe("tagged data cache execution", () => {
  beforeEach(() => {
    unstableCacheMock.mockReset();
  });

  it("falls back to the loader when a background revalidation loses its incremental cache context", async () => {
    const incrementalCacheError = Object.assign(
      new Error("Invariant: incrementalCache missing in unstable_cache loader"),
      { __NEXT_ERROR_CODE: "E469" }
    );
    const loader = vi.fn().mockResolvedValue("fresh-value");
    unstableCacheMock.mockReturnValue(
      vi.fn().mockRejectedValue(incrementalCacheError)
    );

    await expect(
      runWithTaggedCache({
        enabled: true,
        keyParts: ["nested", "background"],
        loader,
        tags: ["review-card-content"]
      })
    ).resolves.toBe("fresh-value");

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not hide unrelated cache or loader failures", async () => {
    const cacheError = new Error("cache storage unavailable");
    const loader = vi.fn().mockResolvedValue("unused");
    unstableCacheMock.mockReturnValue(vi.fn().mockRejectedValue(cacheError));

    await expect(
      runWithTaggedCache({
        enabled: true,
        keyParts: ["nested", "failure"],
        loader,
        tags: ["review-card-content"]
      })
    ).rejects.toBe(cacheError);

    expect(loader).not.toHaveBeenCalled();
  });
});
