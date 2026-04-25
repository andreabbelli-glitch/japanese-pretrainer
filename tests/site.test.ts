import type { Route } from "next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteShellPrimaryNav } from "@/components/site-shell-primary-nav";
import { TextbookIndexPage } from "@/components/textbook/textbook-index-page";
import {
  buildGlossaryHref,
  kanjiClashHref,
  buildReviewRedirectUrl,
  buildReviewSearchParams,
  buildReviewSessionHref,
  mediaKanjiClashHref,
  mediaAssetHref,
  mediaGlossaryEntryHref,
  mediaGlossaryGrammarHref,
  mediaGlossaryHref,
  mediaGlossaryTermHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref,
  mediaTextbookLessonHref,
  primaryNav,
  readInternalHref,
  resolveGlossaryBackNavigation,
  resolveActivePrimaryNavHref,
  resolveGlossaryReviewReturnTo,
  resolveReturnToContext,
  resolveReturnToLabel,
  type StudyAreaKey
} from "@/lib/site";

let pathname = "/";
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams
}));

describe("site helpers", () => {
  beforeEach(() => {
    pathname = "/";
    searchParams = new URLSearchParams();
  });

  it("keeps primary navigation labels unique and routable", () => {
    const labels = primaryNav.map((item) => item.label);
    const hrefs = primaryNav.map((item) => item.href);

    expect(new Set(labels).size).toBe(labels.length);
    expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
    expect(labels).toEqual([
      "Home",
      "Media",
      "Glossary",
      "Review",
      "Kanji Clash",
      "Settings"
    ]);
    expect(hrefs).toEqual([
      "/",
      "/media",
      "/glossary",
      "/review",
      "/kanji-clash",
      "/settings"
    ]);
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
    expect(mediaAssetHref("fixture-tcg", "assets\\ui\\deck-edit.webp")).toBe(
      "/media/fixture-tcg/assets/ui/deck-edit.webp"
    );
    expect(mediaAssetHref("fixture-tcg", "/assets/ui/deck-edit.webp")).toBe(
      "/media/fixture-tcg/assets/ui/deck-edit.webp"
    );
    expect(mediaAssetHref("fixture-tcg", "/ui/deck-edit.webp")).toBe(
      "/media/fixture-tcg/assets/ui/deck-edit.webp"
    );
    expect(mediaGlossaryTermHref("能力")).toBe(
      "/glossary/term/%E8%83%BD%E5%8A%9B"
    );
    expect(mediaGlossaryGrammarHref("〜ている")).toBe(
      "/glossary/grammar/%E3%80%9C%E3%81%A6%E3%81%84%E3%82%8B"
    );
    expect(mediaGlossaryGrammarHref("～ている")).toBe(
      "/glossary/grammar/%E3%80%9C%E3%81%A6%E3%81%84%E3%82%8B"
    );
    expect(
      mediaGlossaryEntryHref("fixture-tcg", "term", "能力", {
        sourceId: "term-nouryoku"
      })
    ).toBe(
      "/glossary/term/%E8%83%BD%E5%8A%9B?media=fixture-tcg&source=term-nouryoku"
    );
    expect(mediaGlossaryHref("fixture-tcg")).toBe(
      "/glossary?media=fixture-tcg"
    );
    expect(mediaReviewCardHref("fixture-tcg", "card-iku-review")).toBe(
      "/media/fixture-tcg/review/card/card-iku-review"
    );
    expect(kanjiClashHref()).toBe("/kanji-clash");
    expect(
      kanjiClashHref({
        media: "fixture-tcg",
        mode: "manual",
        size: 20
      })
    ).toBe("/kanji-clash?mode=manual&media=fixture-tcg&size=20");
    expect(mediaKanjiClashHref("fixture-tcg")).toBe(
      "/kanji-clash?media=fixture-tcg"
    );
    expect(
      buildReviewSessionHref({
        answeredCount: 3,
        cardId: "card-iku-review",
        extraNewCount: 2,
        mediaSlug: "fixture-tcg",
        segmentId: "segment_fixture_starter_core",
        showAnswer: true
      })
    ).toBe(
      "/media/fixture-tcg/review?answered=3&card=card-iku-review&extraNew=2&segment=segment_fixture_starter_core&show=answer"
    );
    expect(areas.map((area) => mediaStudyHref("fixture-tcg", area))).toEqual([
      "/media/fixture-tcg/textbook",
      "/glossary?media=fixture-tcg",
      "/media/fixture-tcg/review",
      "/media/fixture-tcg/progress"
    ]);
  });

  it("builds review redirect URLs with preserved cards, detail return targets, and answer state", () => {
    expect(
      buildReviewRedirectUrl({
        answeredCount: 4,
        cardId: "card-iku-review",
        extraNewCount: 2,
        mediaSlug: "fixture-tcg",
        notice: "known",
        redirectMode: "preserve_card",
        segmentId: "segment_fixture_starter_core"
      })
    ).toBe(
      "/media/fixture-tcg/review?answered=4&card=card-iku-review&extraNew=2&segment=segment_fixture_starter_core&notice=known"
    );

    expect(
      buildReviewRedirectUrl({
        answeredCount: 0,
        cardId: "card-iku-review",
        mediaSlug: "fixture-tcg",
        redirectMode: "stay_detail",
        returnTo: "/review?answered=3&card=card-prev" as Route
      })
    ).toBe(
      "/media/fixture-tcg/review/card/card-iku-review?returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-prev"
    );

    expect(
      buildReviewSearchParams({
        answeredCount: 1,
        cardId: "card-iku-review",
        extraNewCount: 0,
        segmentId: null,
        showAnswer: true
      })
    ).toEqual({
      answered: "1",
      card: "card-iku-review",
      show: "answer"
    });
  });

  it("resolves the active primary nav entry for nested review routes", () => {
    expect(resolveActivePrimaryNavHref("/")).toBe("/");
    expect(resolveActivePrimaryNavHref("/media")).toBe("/media");
    expect(resolveActivePrimaryNavHref("/media/fixture-tcg")).toBe("/media");
    expect(resolveActivePrimaryNavHref("/glossary")).toBe("/glossary");
    expect(resolveActivePrimaryNavHref("/glossary/search")).toBe("/glossary");
    expect(resolveActivePrimaryNavHref("/media/fixture-tcg/glossary")).toBe(
      "/glossary"
    );
    expect(
      resolveActivePrimaryNavHref(
        "/media/fixture-tcg/glossary/term/term-fixture-iku"
      )
    ).toBe("/glossary");
    expect(resolveActivePrimaryNavHref("/media/fixture-tcg/review")).toBe(
      "/review"
    );
    expect(
      resolveActivePrimaryNavHref(
        "/media/fixture-tcg/review/card/card-fixture-iku"
      )
    ).toBe("/review");
    expect(resolveActivePrimaryNavHref("/kanji-clash")).toBe("/kanji-clash");
    expect(resolveActivePrimaryNavHref("/kanji-clash/manual")).toBe(
      "/kanji-clash"
    );
    expect(resolveActivePrimaryNavHref("/settings")).toBe("/settings");
  });

  it("classifies internal return targets without conflating glossary and review", () => {
    expect(
      resolveReturnToContext("/review?answered=3&card=card-iku")
    ).toMatchObject({
      href: "/review?answered=3&card=card-iku",
      kind: "review",
      pathname: "/review"
    });
    expect(
      resolveReturnToContext("/media/fixture-tcg/review?card=card-iku")
    ).toMatchObject({
      href: "/media/fixture-tcg/review?card=card-iku",
      kind: "review",
      pathname: "/media/fixture-tcg/review"
    });
    expect(
      resolveReturnToContext("/glossary?q=iku&media=sample-anime")
    ).toMatchObject({
      href: "/glossary?q=iku&media=sample-anime",
      kind: "globalGlossary",
      pathname: "/glossary"
    });
    expect(
      resolveReturnToContext("/media/fixture-tcg/glossary?q=iku")
    ).toMatchObject({
      href: "/media/fixture-tcg/glossary?q=iku",
      kind: "localGlossary",
      pathname: "/media/fixture-tcg/glossary"
    });
    expect(
      resolveReturnToLabel(resolveReturnToContext("/glossary?q=iku"))
    ).toBe("Torna al Glossary");
    expect(
      resolveReturnToLabel(
        resolveReturnToContext("/media/fixture-tcg/review?card=card-iku")
      )
    ).toBe("Torna alla Review");
  });

  it("treats trailing-slash media library return targets as media library links", () => {
    expect(resolveReturnToContext("/media/")).toMatchObject({
      href: "/media/",
      kind: "mediaLibrary",
      pathname: "/media"
    });
    expect(resolveReturnToLabel(resolveReturnToContext("/media/"))).toBe(
      "Torna ai Media"
    );
  });

  it("keeps the first non-empty internal href when duplicated params start empty", () => {
    expect(readInternalHref(["", " /review?answered=3 "])).toBe(
      "/review?answered=3"
    );
    expect(readInternalHref(["   ", "/glossary?q=iku"])).toBe(
      "/glossary?q=iku"
    );
  });

  it("skips invalid duplicated href values until it finds an internal target", () => {
    expect(readInternalHref(["https://example.com/review", "/review"])).toBe(
      "/review"
    );
    expect(readInternalHref(["//evil.test/path", " /glossary?q=iku "])).toBe(
      "/glossary?q=iku"
    );
    expect(readInternalHref(["/\\evil.test/path", " /review "])).toBe(
      "/review"
    );
  });

  it("skips encoded slash and backslash variants before accepting an internal fallback", () => {
    expect(readInternalHref(["/%2f%2fevil.test/path", "/review"])).toBe(
      "/review"
    );
    expect(readInternalHref(["/%5c%5cevil.test/path", "/glossary"])).toBe(
      "/glossary"
    );
    expect(
      readInternalHref(["/%2525252f%2525252fevil.test/path", "/review"])
    ).toBe("/review");
  });

  it("derives glossary back navigation from explicit return context with safe fallbacks", () => {
    expect(
      resolveGlossaryBackNavigation({
        localGlossaryHref: mediaGlossaryHref("fixture-tcg"),
        mediaHref: mediaHref("fixture-tcg"),
        mediaTitle: "Fixture TCG",
        page: "index",
        returnTo: "/glossary?q=iku" as Route
      })
    ).toMatchObject({
      backHref: "/glossary?q=iku",
      backLabel: "Torna al Glossary",
      returnContext: {
        kind: "globalGlossary"
      }
    });

    expect(
      resolveGlossaryBackNavigation({
        localGlossaryHref: mediaGlossaryHref("fixture-tcg"),
        mediaHref: mediaHref("fixture-tcg"),
        mediaTitle: "Fixture TCG",
        page: "detail",
        returnTo: "/media/fixture-tcg/review?card=card-iku" as Route
      })
    ).toMatchObject({
      backHref: "/media/fixture-tcg/review?card=card-iku",
      backLabel: "Torna alla Review",
      returnContext: {
        kind: "review"
      }
    });

    expect(
      resolveGlossaryBackNavigation({
        localGlossaryHref: mediaGlossaryHref("fixture-tcg"),
        mediaHref: mediaHref("fixture-tcg"),
        mediaTitle: "Fixture TCG",
        page: "detail"
      })
    ).toMatchObject({
      backHref: "/glossary?media=fixture-tcg",
      backLabel: "Torna al Glossary",
      returnContext: null
    });
  });

  it("builds glossary hrefs with current filters and preserves nested return targets", () => {
    expect(
      buildGlossaryHref({
        baseHref: mediaStudyHref("fixture-tcg", "glossary"),
        query: "iku",
        returnTo: "/glossary?q=iku&media=fixture-tcg",
        segmentId: "segment_fixture_starter_core",
        sort: "alphabetical",
        study: "learning"
      })
    ).toBe(
      "/glossary?media=fixture-tcg&q=iku&segment=segment_fixture_starter_core&study=learning&sort=alphabetical&returnTo=%2Fglossary%3Fq%3Diku%26media%3Dfixture-tcg"
    );
  });

  it("resolves review return targets even when they are nested inside a glossary workspace href", () => {
    expect(
      resolveGlossaryReviewReturnTo(
        "/media/fixture-tcg/glossary?q=iku&segment=segment_fixture_starter_core&returnTo=%2Fmedia%2Ffixture-tcg%2Freview%3Fanswered%3D3%26card%3Dcard-iku"
      )
    ).toBe("/media/fixture-tcg/review?answered=3&card=card-iku");
    expect(
      resolveGlossaryReviewReturnTo(
        "/glossary?q=iku&returnTo=&returnTo=https%3A%2F%2Fevil.test%2Freview&returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku"
      )
    ).toBe("/review?answered=3&card=card-iku");
    expect(
      resolveGlossaryReviewReturnTo(
        "/media/fixture-tcg/glossary?q=iku&returnTo=%2Fglossary%3Fq%3Diku"
      )
    ).toBeNull();
  });

  it("renders glossary as the active primary nav item on global and local glossary routes", () => {
    pathname = "/glossary";

    const globalMarkup = renderToStaticMarkup(
      createElement(SiteShellPrimaryNav)
    );

    expect(globalMarkup).toContain(
      '<a aria-current="page" class="site-nav__link site-nav__link--active" href="/glossary">'
    );

    pathname = "/media/fixture-tcg/glossary/term/term-iku";

    const localMarkup = renderToStaticMarkup(
      createElement(SiteShellPrimaryNav)
    );

    expect(localMarkup).toContain(
      '<a aria-current="page" class="site-nav__link site-nav__link--active" href="/glossary">'
    );
    expect(localMarkup).not.toContain(
      '<a aria-current="page" class="site-nav__link site-nav__link--active" href="/review">'
    );
  });

  it("keeps the first non-empty duplicated review returnTo in primary nav links", () => {
    pathname = "/media/fixture-tcg/glossary";
    searchParams = new URLSearchParams(
      "returnTo=&returnTo=%2Fmedia%2Ffixture-tcg%2Freview%3Fanswered%3D3%26card%3Dcard-iku"
    );

    const markup = renderToStaticMarkup(createElement(SiteShellPrimaryNav));

    expect(markup).toContain(
      'href="/media/fixture-tcg/review?answered=3&amp;card=card-iku"'
    );
  });

  it("renders a textbook index CTA that jumps directly into segment review", () => {
    const markup = renderToStaticMarkup(
      createElement(TextbookIndexPage, {
        data: {
          media: {
            id: "media_fixture_tcg",
            slug: "fixture-tcg",
            title: "Fixture TCG",
            description: "Fixture",
            mediaTypeLabel: "TCG",
            segmentKindLabel: "Archi"
          },
          furiganaMode: "hover",
          lessons: [
            {
              id: "lesson_fixture_core_1",
              slug: "core-vocab",
              title: "Core vocab",
              orderIndex: 1,
              difficulty: "N5",
              summary: "Prime carte",
              excerpt: null,
              status: "not_started",
              statusLabel: "Da iniziare",
              segmentId: "segment_fixture_starter_core",
              segmentTitle: "Starter Core",
              lastOpenedAt: null,
              completedAt: null
            }
          ],
          groups: [
            {
              id: "segment_fixture_starter_core",
              title: "Starter Core",
              note: null,
              completedLessons: 0,
              totalLessons: 1,
              lessons: [
                {
                  id: "lesson_fixture_core_1",
                  slug: "core-vocab",
                  title: "Core vocab",
                  orderIndex: 1,
                  difficulty: "N5",
                  summary: "Prime carte",
                  excerpt: null,
                  status: "not_started",
                  statusLabel: "Da iniziare",
                  segmentId: "segment_fixture_starter_core",
                  segmentTitle: "Starter Core",
                  lastOpenedAt: null,
                  completedAt: null
                }
              ]
            }
          ],
          activeLesson: null,
          resumeLesson: null,
          completedLessons: 0,
          totalLessons: 1,
          textbookProgressPercent: 0,
          glossaryHref: "/glossary?media=fixture-tcg"
        }
      })
    );

    expect(markup).toContain("Ripassa vocaboli");
    expect(markup).toContain(
      'href="/media/fixture-tcg/review?segment=segment_fixture_starter_core"'
    );
    expect(markup).toContain('href="/media/fixture-tcg/textbook/core-vocab"');
  });
});
