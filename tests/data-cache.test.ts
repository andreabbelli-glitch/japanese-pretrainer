import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTagMock, updateTagMock } = vi.hoisted(() => ({
  revalidateTagMock: vi.fn(),
  updateTagMock: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: revalidateTagMock,
  updateTag: updateTagMock,
  unstable_cache: vi.fn()
}));

import {
  buildGlossarySummaryTags,
  GLOSSARY_SUMMARY_TAG,
  revalidateGlossarySummaryCache,
  REVIEW_FIRST_CANDIDATE_TAG,
  updateGlossarySummaryCache
} from "@/lib/data-cache";

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
