import { describe, expect, it } from "vitest";

import { mediaAssetHref, mediaAudioAssetHref } from "@/features/navigation/hrefs";

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

  it("builds static cacheable media audio hrefs with optional cache busting", () => {
    expect(
      mediaAudioAssetHref(
        "fixture-tcg",
        "assets/audio/term/term yomu/yomu.mp3",
        "2026-01-02T03:04:05.000Z"
      )
    ).toBe(
      "/media-audio/fixture-tcg/audio/term/term%20yomu/yomu.mp3?v=2026-01-02T03%3A04%3A05.000Z"
    );

    expect(
      mediaAudioAssetHref(
        "fixture-tcg",
        "assets/audio/term/../grammar/teiru.ogg"
      )
    ).toBe("/media-audio/fixture-tcg/audio/grammar/teiru.ogg");
  });
});
