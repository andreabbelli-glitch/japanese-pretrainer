import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace() {}
  })
}));

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { GlossaryPage } from "@/components/glossary/glossary-page";
import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import * as dbQueriesModule from "@/db/queries";
import { runMigrations } from "@/db/migrate";
import { card, grammarPattern } from "@/db/schema/index.ts";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import { importContentWorkspace } from "@/features/content/importer";
import {
  getGlobalGlossaryPageData,
  getGlossaryPageData,
  getGrammarGlossaryDetailData,
  getTermGlossaryDetailData
} from "@/features/glossary/server";
import { buildReviewSessionHref } from "@/features/navigation";
import { getReviewCardDetailData } from "@/features/review/server";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import {
  expectMarkupHref,
  expectNoMarkupHref
} from "./helpers/glossary-href-assertions";
import {
  expectedGlossaryEntryHref,
  expectedGlossaryEntryPath,
  markAllLessonsCompleted,
  reusedSourceIdFixture,
  validContentRoot,
  writeLessonOrderContentFixture,
  writeReusedSourceIdContentFixture
} from "./helpers/glossary-test-fixtures";

describe("glossary data", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-glossary-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("renders glossary and review notes through the shared inline AST renderer", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");
    await markAllLessonsCompleted(database);

    await database
      .update(grammarPattern)
      .set({
        notesIt:
          "Nota con **enfasi**, {{日本語|にほんご}} e `[食べる](term:term-taberu)`."
      })
      .where(eq(grammarPattern.sourceId, "grammar-teiru"));
    await database
      .update(card)
      .set({
        notesIt:
          "Card con **enfasi**, {{語彙|ごい}} e `[～ている](grammar:grammar-teiru)`."
      })
      .where(eq(card.id, "card-teiru-concept"));

    const glossaryDetail = await getGrammarGlossaryDetailData(
      "sample-anime",
      "grammar-teiru",
      database
    );
    const reviewDetail = await getReviewCardDetailData(
      "sample-anime",
      "card-teiru-concept",
      database
    );

    expect(glossaryDetail).not.toBeNull();
    expect(reviewDetail).not.toBeNull();
    expect(glossaryDetail?.entry.notes).toContain("**enfasi**");
    expect(glossaryDetail?.cards[0]?.notes).toContain("{{語彙|ごい}}");
    expect(reviewDetail?.card.notes).toContain(
      "[～ている](grammar:grammar-teiru)"
    );

    const glossaryMarkup = renderToStaticMarkup(
      GlossaryDetailPage({ data: glossaryDetail! })
    );
    const reviewMarkup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: reviewDetail! })
    );

    expect(glossaryMarkup).toContain("<strong>enfasi</strong>");
    expect(glossaryMarkup).toContain('<ruby class="app-ruby">');
    expect(glossaryMarkup).toContain("<code");
    expect(glossaryMarkup).toContain("inline-ref");
    expect(glossaryMarkup).not.toContain("**enfasi**");
    expect(glossaryMarkup).not.toContain("{{日本語|にほんご}}");
    expect(glossaryMarkup).not.toContain("[食べる](term:term-taberu)");
    expect(reviewMarkup).toContain("<strong>enfasi</strong>");
    expect(reviewMarkup).toContain('<ruby class="app-ruby">');
    expect(reviewMarkup).toContain("<code");
    expect(reviewMarkup).toContain("inline-ref");
    expect(reviewMarkup).not.toContain("**enfasi**");
    expect(reviewMarkup).not.toContain("{{語彙|ごい}}");
    expect(reviewMarkup).not.toContain("[～ている](grammar:grammar-teiru)");
  });

  it("highlights the field that actually matched for kanji, kana, romaji, italian and alias queries", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const cases = [
      {
        query: "食べる",
        expectedId: "term-taberu",
        expectedHighlight: "<mark>食べる</mark>",
        assertMatch(
          data: NonNullable<Awaited<ReturnType<typeof getGlossaryPageData>>>
        ) {
          expect(data.results[0]?.matchedFields.label).toBe("normalized");
        }
      },
      {
        query: "たべる",
        expectedId: "term-taberu",
        expectedHighlight: "<mark>たべる</mark>",
        assertMatch(
          data: NonNullable<Awaited<ReturnType<typeof getGlossaryPageData>>>
        ) {
          expect(data.results[0]?.matchedFields.reading).toBe("kana");
        }
      },
      {
        query: "タベル",
        expectedId: "term-taberu",
        expectedHighlight: "<mark>たべる</mark>",
        assertMatch(
          data: NonNullable<Awaited<ReturnType<typeof getGlossaryPageData>>>
        ) {
          expect(data.results[0]?.matchedFields.reading).toBe("kana");
        }
      },
      {
        query: "taberu",
        expectedId: "term-taberu",
        expectedHighlight: "<mark>taberu</mark>",
        assertMatch(
          data: NonNullable<Awaited<ReturnType<typeof getGlossaryPageData>>>
        ) {
          expect(data.results[0]?.matchedFields.romaji).toBe("romajiCompact");
        }
      },
      {
        query: "mangiare",
        expectedId: "term-taberu",
        expectedHighlight: "<mark>mangiare</mark>",
        assertMatch(
          data: NonNullable<Awaited<ReturnType<typeof getGlossaryPageData>>>
        ) {
          expect(data.results[0]?.matchedFields.meaning).toBe("normalized");
        }
      },
      {
        query: "てる",
        expectedId: "grammar-teiru",
        expectedHighlight: "<mark>てる</mark>",
        expectedSnippet: "Alias:",
        assertMatch(
          data: NonNullable<Awaited<ReturnType<typeof getGlossaryPageData>>>
        ) {
          expect(data.results[0]?.matchedFields.aliases).toContainEqual({
            mode: "grammarKana",
            text: "てる"
          });
        }
      }
    ];

    for (const testCase of cases) {
      const data = await getGlossaryPageData(
        "sample-anime",
        {
          q: testCase.query
        },
        database
      );

      expect(data).not.toBeNull();
      expect(data?.results[0]?.id).toBe(testCase.expectedId);
      testCase.assertMatch(data!);

      const markup = renderToStaticMarkup(GlossaryPage({ data: data! }));

      expect(markup).toContain(testCase.expectedHighlight);

      if ("expectedSnippet" in testCase) {
        expect(markup).toContain(testCase.expectedSnippet);
      }
    }
  });

  it("keeps desktop preview aligned to the selected result without duplicating lesson counts", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const data = await getGlossaryPageData(
      "sample-anime",
      {
        preview: "grammar-teiru",
        previewKind: "grammar"
      },
      database
    );

    const selectedResult = data?.results.find(
      (entry) => entry.id === "grammar-teiru"
    );

    expect(data).not.toBeNull();
    expect(selectedResult?.lessonCount).toBe(1);
    expect(data?.preview?.entry.id).toBe("grammar-teiru");
    expect(data?.preview?.cards).toHaveLength(1);
    expect(data?.preview?.lessons).toHaveLength(1);
    expect(data?.preview?.lessons[0]?.roleLabels).toEqual([
      "Spiegata",
      "Citata"
    ]);
  });

  it("keeps preview detail fields populated when browsing the local glossary without a query", async () => {
    await seedDevelopmentDatabase(database);

    const data = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        preview: developmentFixture.termId,
        previewKind: "term"
      },
      database
    );

    expect(data).not.toBeNull();
    expect(data?.preview?.entry.id).toBe(developmentFixture.termId);
    expect(data?.preview?.entry.literalMeaning).toBe(
      "muoversi verso una destinazione"
    );
    expect(data?.preview?.entry.notes).toBe("Verbo base molto frequente.");
    expect(
      data?.preview?.entry.aliasGroups.flatMap((group) => group.values)
    ).toEqual(expect.arrayContaining(["いきます", "iku"]));
  });

  it("skips preview card queries when the selected local entry has no cards", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");
    const cardConnectionsSpy = vi.spyOn(
      dbQueriesModule,
      "listEntryCardConnections"
    );

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const data = await getGlossaryPageData(
      crossMediaFixture.alpha.mediaSlug,
      {
        preview: crossMediaFixture.alpha.mixedNoCardTermSourceId,
        previewKind: "term"
      },
      database
    );

    expect(data?.preview?.entry.id).toBe(
      crossMediaFixture.alpha.mixedNoCardTermSourceId
    );
    expect(data?.preview?.cards).toHaveLength(0);
    expect(cardConnectionsSpy).not.toHaveBeenCalled();
    cardConnectionsSpy.mockRestore();
  });

  it("skips duplicated invalid preview params until it finds a valid glossary preview", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const data = await getGlossaryPageData(
      "sample-anime",
      {
        preview: ["missing-entry", "grammar-teiru"],
        previewKind: ["bad", "grammar"]
      },
      database
    );

    expect(data).not.toBeNull();
    expect(data?.preview?.entry.id).toBe("grammar-teiru");
    expect(data?.preview?.entry.kind).toBe("grammar");
  });

  it("keeps glossary detail local to the current media when source ids are reused across media", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const [alphaDetail, betaDetail] = await Promise.all([
      getTermGlossaryDetailData(
        crossMediaFixture.alpha.mediaSlug,
        crossMediaFixture.alpha.termSourceId,
        database
      ),
      getTermGlossaryDetailData(
        crossMediaFixture.beta.mediaSlug,
        crossMediaFixture.beta.termSourceId,
        database
      )
    ]);

    expect(alphaDetail?.entry.id).toBe(crossMediaFixture.alpha.termSourceId);
    expect(alphaDetail?.entry.meaning).toBe(
      crossMediaFixture.alpha.termMeaning
    );
    expect(alphaDetail?.cards[0]?.id).toBe(crossMediaFixture.alpha.termCardId);
    expect(alphaDetail?.crossMedia?.siblings).toHaveLength(1);
    expect(alphaDetail?.crossMedia?.siblings[0]?.href).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.beta.mediaSlug,
        "term",
        "コスト",
        crossMediaFixture.beta.termSourceId
      )
    );
    expect(betaDetail?.entry.meaning).toBe(crossMediaFixture.beta.termMeaning);
    expect(betaDetail?.cards[0]?.id).toBe(crossMediaFixture.beta.termCardId);
    expect(betaDetail?.crossMedia?.siblings[0]?.meaning).toBe(
      crossMediaFixture.alpha.termMeaning
    );

    const markup = renderToStaticMarkup(
      GlossaryDetailPage({ data: alphaDetail! })
    );

    expect(markup).toContain("Compare anche in altri media");
    expect(markup).toContain(
      "/glossary/term/%E3%82%B3%E3%82%B9%E3%83%88?media=beta&amp;source=term-beta-shared"
    );
  });

  it("skips cross-media detail queries for entries outside shared families", async () => {
    await seedDevelopmentDatabase(database);
    const crossMediaSpy = vi.spyOn(
      dbQueriesModule,
      "getCrossMediaFamilyByEntryId"
    );

    const detail = await getTermGlossaryDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.termId,
      database
    );

    expect(detail?.entry.id).toBe(developmentFixture.termId);
    expect(detail?.crossMedia).toBeNull();
    expect(crossMediaSpy).not.toHaveBeenCalled();
    crossMediaSpy.mockRestore();
  });

  it("treats glossary returnTo as glossary context instead of review", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const detail = await getTermGlossaryDetailData(
      crossMediaFixture.beta.mediaSlug,
      crossMediaFixture.beta.termSourceId,
      database
    );

    expect(detail).not.toBeNull();

    const markup = renderToStaticMarkup(
      GlossaryDetailPage({
        data: detail!,
        returnTo:
          `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expect(markup).not.toContain("Torna alla Review");
    expect(markup).toContain(
      `/media/${crossMediaFixture.beta.mediaSlug}/review/card/${crossMediaFixture.beta.termCardId}`
    );
    expect(markup).not.toContain("Apri in Review");
    expectMarkupHref(markup, {
      pathname: expectedGlossaryEntryPath("term", "コスト"),
      searchParams: {
        media: crossMediaFixture.alpha.mediaSlug,
        source: crossMediaFixture.alpha.termSourceId
      },
      returnTo: `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}`
    });
  });

  it("keeps back navigation anchored to the filtered global portal after opening a local detail", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const detail = await getTermGlossaryDetailData(
      crossMediaFixture.beta.mediaSlug,
      crossMediaFixture.beta.termSourceId,
      database
    );

    expect(detail).not.toBeNull();

    const markup = renderToStaticMarkup(
      GlossaryDetailPage({
        data: detail!,
        returnTo:
          `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}&cards=with_cards` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expectMarkupHref(markup, {
      pathname: "/glossary",
      searchParams: {
        cards: "with_cards",
        media: crossMediaFixture.beta.mediaSlug,
        q: "kosuto"
      }
    });
    expectMarkupHref(markup, {
      pathname: expectedGlossaryEntryPath("term", "コスト"),
      searchParams: {
        media: crossMediaFixture.alpha.mediaSlug,
        source: crossMediaFixture.alpha.termSourceId
      },
      returnTo: `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}&cards=with_cards`
    });
  });

  it("uses glossary returnTo on the local glossary index without relabeling it as review", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const data = await getGlossaryPageData(
      crossMediaFixture.beta.mediaSlug,
      {
        q: "kosuto"
      },
      database
    );

    expect(data).not.toBeNull();

    const markup = renderToStaticMarkup(
      GlossaryPage({
        data: data!,
        returnTo:
          `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expect(markup).not.toContain("Torna alla Review");
    expectMarkupHref(markup, {
      pathname: "/glossary",
      searchParams: {
        media: crossMediaFixture.beta.mediaSlug,
        q: "kosuto"
      }
    });
  });

  it("keeps review-specific card deep links only when returnTo is an actual review session", async () => {
    await seedDevelopmentDatabase(database);

    const detail = await getTermGlossaryDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.termId,
      database
    );

    expect(detail).not.toBeNull();

    const reviewReturnTo = buildReviewSessionHref({
      answeredCount: 3,
      cardId: developmentFixture.secondaryCardId,
      extraNewCount: 2,
      mediaSlug: developmentFixture.mediaSlug,
      showAnswer: true
    });
    const markup = renderToStaticMarkup(
      GlossaryDetailPage({
        data: detail!,
        returnTo: reviewReturnTo
      })
    );

    expect(markup).toContain("Torna alla Review");
    expect(markup).toContain("Apri in Review");
    expectMarkupHref(markup, {
      pathname: `/media/${developmentFixture.mediaSlug}/review`,
      searchParams: {
        answered: "3",
        card: developmentFixture.primaryCardId,
        extraNew: "2"
      }
    });
    expectNoMarkupHref(markup, {
      pathname: `/media/${developmentFixture.mediaSlug}/review`,
      searchParams: {
        answered: "3",
        card: developmentFixture.primaryCardId,
        show: "answer"
      }
    });
  });

  it("orders global browse results by segment position when sort is lesson_order", async () => {
    const contentRoot = path.join(tempDir, "lesson-order-content");

    await writeLessonOrderContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const alphabetical = await getGlobalGlossaryPageData(
      { sort: "alphabetical" },
      database
    );
    const lessonOrder = await getGlobalGlossaryPageData(
      { sort: "lesson_order" },
      database
    );

    expect(alphabetical.results.length).toBeGreaterThanOrEqual(2);
    expect(lessonOrder.results.length).toBeGreaterThanOrEqual(2);

    const alphaLabels = alphabetical.results.map((r) => r.label);
    const lessonLabels = lessonOrder.results.map((r) => r.label);

    // Alphabetical: アイス before ゼリー (ア < ゼ)
    expect(alphaLabels.indexOf("アイス")).toBeLessThan(
      alphaLabels.indexOf("ゼリー")
    );

    // Lesson order: ゼリー (chapter-01, order 0) before アイス (chapter-02, order 1)
    expect(lessonLabels.indexOf("ゼリー")).toBeLessThan(
      lessonLabels.indexOf("アイス")
    );
  });

  it("does not merge global results when different media reuse the same source id", async () => {
    const contentRoot = path.join(tempDir, "reused-source-id-content");

    await writeReusedSourceIdContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const data = await getGlobalGlossaryPageData(
      {
        q: "共有"
      },
      database
    );

    expect(data.results).toHaveLength(1);
    expect(new Set(data.results.map((entry) => entry.resultKey)).size).toBe(1);
    expect(data.results.map((entry) => entry.bestLocalHref)).toEqual([
      expectedGlossaryEntryHref(
        reusedSourceIdFixture.alpha.mediaSlug,
        "term",
        "共有",
        reusedSourceIdFixture.sourceId
      )
    ]);
    expect(data.results.map((entry) => entry.mediaCount)).toEqual([2]);
    expect(data.results.map((entry) => entry.cardCount)).toEqual([2]);

    const [alphaDetail, betaDetail] = await Promise.all([
      getTermGlossaryDetailData(
        reusedSourceIdFixture.alpha.mediaSlug,
        reusedSourceIdFixture.sourceId,
        database
      ),
      getTermGlossaryDetailData(
        reusedSourceIdFixture.beta.mediaSlug,
        reusedSourceIdFixture.sourceId,
        database
      )
    ]);

    expect(alphaDetail?.entry.meaning).toBe(
      reusedSourceIdFixture.alpha.meaning
    );
    expect(alphaDetail?.cards[0]?.id).toBe(reusedSourceIdFixture.alpha.cardId);
    expect(betaDetail?.entry.meaning).toBe(reusedSourceIdFixture.beta.meaning);
    expect(betaDetail?.cards[0]?.id).toBe(reusedSourceIdFixture.beta.cardId);
  });
});
