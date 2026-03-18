import type { Route } from "next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteShellPrimaryNav } from "@/components/site-shell-primary-nav";
import {
  buildGlossaryHref,
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
    expect(labels).toEqual(["Home", "Media", "Glossary", "Review", "Settings"]);
    expect(hrefs).toEqual(["/", "/media", "/glossary", "/review", "/settings"]);
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
    expect(mediaGlossaryHref("fixture-tcg")).toBe(
      "/glossary?media=fixture-tcg"
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
    expect(resolveActivePrimaryNavHref("/glossary")).toBe("/glossary");
    expect(resolveActivePrimaryNavHref("/glossary/search")).toBe("/glossary");
    expect(resolveActivePrimaryNavHref("/media/fixture-tcg/glossary")).toBe(
      "/glossary"
    );
    expect(
      resolveActivePrimaryNavHref("/media/fixture-tcg/glossary/term/term-fixture-iku")
    ).toBe("/glossary");
    expect(resolveActivePrimaryNavHref("/media/fixture-tcg/review")).toBe(
      "/review"
    );
    expect(
      resolveActivePrimaryNavHref("/media/fixture-tcg/review/card/card-fixture-iku")
    ).toBe("/review");
    expect(resolveActivePrimaryNavHref("/settings")).toBe("/settings");
  });

  it("classifies internal return targets without conflating glossary and review", () => {
    expect(resolveReturnToContext("/review?answered=3&card=card-iku")).toMatchObject(
      {
        href: "/review?answered=3&card=card-iku",
        kind: "review",
        pathname: "/review"
      }
    );
    expect(resolveReturnToContext("/media/fixture-tcg/review?card=card-iku"))
      .toMatchObject({
        href: "/media/fixture-tcg/review?card=card-iku",
        kind: "review",
        pathname: "/media/fixture-tcg/review"
      });
    expect(resolveReturnToContext("/glossary?q=iku&media=sample-anime")).toMatchObject(
      {
        href: "/glossary?q=iku&media=sample-anime",
        kind: "globalGlossary",
        pathname: "/glossary"
      }
    );
    expect(
      resolveReturnToContext("/media/fixture-tcg/glossary?q=iku")
    ).toMatchObject({
      href: "/media/fixture-tcg/glossary?q=iku",
      kind: "localGlossary",
      pathname: "/media/fixture-tcg/glossary"
    });
    expect(resolveReturnToLabel(resolveReturnToContext("/glossary?q=iku"))).toBe(
      "Torna al Glossary"
    );
    expect(
      resolveReturnToLabel(
        resolveReturnToContext("/media/fixture-tcg/review?card=card-iku")
      )
    ).toBe("Torna alla Review");
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
      "/media/fixture-tcg/glossary?q=iku&segment=segment_fixture_starter_core&study=learning&sort=alphabetical&returnTo=%2Fglossary%3Fq%3Diku%26media%3Dfixture-tcg"
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
});
