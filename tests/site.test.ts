import { describe, expect, it } from "vitest";

import {
  mediaAssetHref,
  mediaGlossaryEntryHref,
  mediaGlossaryGrammarHref,
  mediaGlossaryTermHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref,
  mediaTextbookLessonHref,
  primaryNav,
  resolveActivePrimaryNavHref,
  type StudyAreaKey
} from "@/lib/site";

describe("site helpers", () => {
  it("keeps primary navigation labels unique and routable", () => {
    const labels = primaryNav.map((item) => item.label);
    const hrefs = primaryNav.map((item) => item.href);

    expect(new Set(labels).size).toBe(labels.length);
    expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
  });

  it("builds stable routes for media detail and study areas", () => {
    const areas: StudyAreaKey[] = [
      "textbook",
      "glossary",
      "review",
      "progress"
    ];

    expect(mediaHref("fixture-tcg")).toBe("/media/fixture-tcg");
    expect(mediaTextbookLessonHref("fixture-tcg", "core-vocab")).toBe(
      "/media/fixture-tcg/textbook/core-vocab"
    );
    expect(mediaAssetHref("fixture-tcg", "assets/ui/deck-edit.webp")).toBe(
      "/media/fixture-tcg/assets/ui/deck-edit.webp"
    );
    expect(mediaGlossaryTermHref("fixture-tcg", "term-iku")).toBe(
      "/media/fixture-tcg/glossary/term/term-iku"
    );
    expect(mediaGlossaryGrammarHref("fixture-tcg", "grammar-teiru")).toBe(
      "/media/fixture-tcg/glossary/grammar/grammar-teiru"
    );
    expect(mediaGlossaryEntryHref("fixture-tcg", "term", "term-iku")).toBe(
      "/media/fixture-tcg/glossary/term/term-iku"
    );
    expect(mediaReviewCardHref("fixture-tcg", "card-iku-review")).toBe(
      "/media/fixture-tcg/review/card/card-iku-review"
    );
    expect(areas.map((area) => mediaStudyHref("fixture-tcg", area))).toEqual([
      "/media/fixture-tcg/textbook",
      "/media/fixture-tcg/glossary",
      "/media/fixture-tcg/review",
      "/media/fixture-tcg/progress"
    ]);
  });

  it("resolves the active primary nav entry for nested review routes", () => {
    expect(resolveActivePrimaryNavHref("/")).toBe("/");
    expect(resolveActivePrimaryNavHref("/media")).toBe("/media");
    expect(resolveActivePrimaryNavHref("/media/fixture-tcg")).toBe("/media");
    expect(resolveActivePrimaryNavHref("/media/fixture-tcg/review")).toBe(
      "/review"
    );
    expect(
      resolveActivePrimaryNavHref("/media/fixture-tcg/review/card/card-fixture-iku")
    ).toBe("/review");
    expect(resolveActivePrimaryNavHref("/settings")).toBe("/settings");
  });
});
