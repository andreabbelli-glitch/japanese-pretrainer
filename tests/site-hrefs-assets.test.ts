import { describe, expect, it } from "vitest";

import { mediaAssetHref } from "@/lib/site/hrefs";

describe("media asset hrefs", () => {
  it("normalizes dot segments without escaping the media assets route", () => {
    expect(
      mediaAssetHref("fixture-tcg", "assets/ui/../artwork/./deck edit.webp")
    ).toBe("/media/fixture-tcg/assets/artwork/deck%20edit.webp");

    expect(mediaAssetHref("fixture-tcg", "../shared/cover.webp")).toBe(
      "/media/fixture-tcg/assets/shared/cover.webp"
    );

    expect(mediaAssetHref("fixture-tcg", "assets/../../cover.webp")).toBe(
      "/media/fixture-tcg/assets/cover.webp"
    );
  });
});
