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

import { GlossaryPage } from "@/components/glossary/glossary-page";
import { GlossaryPortalPage } from "@/components/glossary/glossary-portal-page";
import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import {
  countGlobalGlossaryBrowseGroups,
  getGlobalGlossaryAggregateStats,
  listGlobalGlossaryBrowseGroupRefs
} from "@/db/queries/glossary";
import { runMigrations } from "@/db/migrate";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import { buildScopedEntryId } from "@/features/study/model/entry-id";
import {
  card,
  cardEntryLink,
  reviewSubjectState,
  term,
  termAlias
} from "@/db/schema/index.ts";
import { importContentWorkspace } from "@/features/content/importer";
import {
  getGlobalGlossaryAutocompleteData,
  getGlobalGlossaryPageData,
  getGlossaryPageData
} from "@/features/glossary/server";
import * as settings from "@/features/settings/server";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import { expectMarkupHref } from "./helpers/glossary-href-assertions";
import {
  expectedGlossaryEntryHref,
  expectedGlossaryEntryPath,
  validContentRoot
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

  it("ranks romaji queries and carries lesson/card metadata into results", async () => {
    await seedDevelopmentDatabase(database);

    const data = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        q: "iku"
      },
      database
    );

    expect(data).not.toBeNull();
    expect(data?.results).toHaveLength(1);
    expect(data?.results[0]?.id).toBe(developmentFixture.termId);
    expect(data?.results[0]?.href).toBe(
      expectedGlossaryEntryHref(
        developmentFixture.mediaSlug,
        "term",
        "行く",
        developmentFixture.termId
      )
    );
    expect(data?.results[0]?.bestLocalHref).toBe(
      expectedGlossaryEntryHref(
        developmentFixture.mediaSlug,
        "term",
        "行く",
        developmentFixture.termId
      )
    );
    expect(data?.results[0]?.primaryLesson?.roleLabel).toBe("Introdotta");
    expect(data?.results[0]?.hasCards).toBe(true);
    expect(data?.results[0]?.cardCount).toBe(1);
    expect(data?.results[0]?.mediaCount).toBe(1);
    expect(data?.results[0]?.mediaHits).toHaveLength(1);
    expect(data?.results[0]?.matchBadges).toContain("romaji");
  });

  it("finds grammar entries from compact romaji queries", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const data = await getGlossaryPageData(
      "sample-anime",
      {
        q: "teiru"
      },
      database
    );

    expect(data).not.toBeNull();
    expect(data?.results[0]?.id).toBe("grammar-teiru");
    expect(data?.results[0]?.kind).toBe("grammar");
    expect(data?.results[0]?.matchBadges).toContain("romaji");
  });

  it("maps the learning filter to entries with learning review cards", async () => {
    await seedDevelopmentDatabase(database);

    const learningData = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        study: "learning"
      },
      database
    );
    const reviewData = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        study: "review"
      },
      database
    );

    expect(learningData).not.toBeNull();
    expect(learningData?.results.map((entry) => entry.id)).toEqual([
      developmentFixture.termId
    ]);
    expect(learningData?.results[0]?.studyState.key).toBe("learning");
    expect(reviewData).not.toBeNull();
    expect(reviewData?.results).toHaveLength(0);
  });

  it("builds a global glossary result contract across media and selects the filtered local href", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const data = await getGlobalGlossaryPageData(
      {
        q: "kosuto",
        media: crossMediaFixture.beta.mediaSlug
      },
      database
    );

    expect(data.results).toHaveLength(1);
    expect(data.results[0]?.label).toBe("コスト");
    expect(data.results[0]?.hasCards).toBe(true);
    expect(data.results[0]?.cardCount).toBe(2);
    expect(data.results[0]?.mediaCount).toBe(2);
    expect(data.results[0]?.bestLocalHref).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.beta.mediaSlug,
        "term",
        "コスト",
        crossMediaFixture.beta.termSourceId
      )
    );
    expect(data.results[0]?.mediaHits).toHaveLength(2);
    expect(data.results[0]?.mediaHits.map((hit) => hit.mediaSlug)).toEqual([
      crossMediaFixture.beta.mediaSlug,
      crossMediaFixture.alpha.mediaSlug
    ]);
    expect(
      data.results[0]?.mediaHits.filter((hit) => hit.matchesCurrentFilters)
    ).toHaveLength(1);
    expect(
      data.results[0]?.mediaHits.find((hit) => hit.isBestLocal)?.href
    ).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.beta.mediaSlug,
        "term",
        "コスト",
        crossMediaFixture.beta.termSourceId
      )
    );
  });

  it("keeps cross-media global result metadata coherent with cards filters", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const [allCardsData, withCardsData, withoutCardsData] = await Promise.all([
      getGlobalGlossaryPageData(
        {
          q: "yohaku"
        },
        database
      ),
      getGlobalGlossaryPageData(
        {
          q: "yohaku",
          cards: "with_cards"
        },
        database
      ),
      getGlobalGlossaryPageData(
        {
          q: "yohaku",
          cards: "without_cards"
        },
        database
      )
    ]);

    expect(allCardsData.results.map((entry) => entry.label)).toEqual(["余白"]);
    expect(allCardsData.results[0]?.hasCards).toBe(true);
    expect(allCardsData.results[0]?.cardCount).toBe(1);
    expect(allCardsData.results[0]?.mediaCount).toBe(2);
    expect(allCardsData.results[0]?.mediaHits).toHaveLength(2);
    expect(
      allCardsData.results[0]?.mediaHits.map((hit) => hit.mediaSlug)
    ).toEqual([
      crossMediaFixture.beta.mediaSlug,
      crossMediaFixture.alpha.mediaSlug
    ]);
    expect(allCardsData.results[0]?.bestLocalHref).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.beta.mediaSlug,
        "term",
        "余白",
        crossMediaFixture.beta.mixedCardTermSourceId
      )
    );

    expect(withCardsData.results.map((entry) => entry.label)).toEqual(["余白"]);
    expect(withCardsData.results[0]?.hasCards).toBe(true);
    expect(withCardsData.results[0]?.cardCount).toBe(1);
    expect(withCardsData.results[0]?.mediaCount).toBe(1);
    expect(withCardsData.results[0]?.mediaHits).toHaveLength(1);
    expect(withCardsData.results[0]?.mediaHits[0]?.mediaSlug).toBe(
      crossMediaFixture.beta.mediaSlug
    );
    expect(withCardsData.results[0]?.mediaHits[0]?.hasCards).toBe(true);
    expect(withCardsData.results[0]?.bestLocalHref).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.beta.mediaSlug,
        "term",
        "余白",
        crossMediaFixture.beta.mixedCardTermSourceId
      )
    );

    expect(withoutCardsData.results.map((entry) => entry.label)).toEqual([
      "余白"
    ]);
    expect(withoutCardsData.results[0]?.hasCards).toBe(false);
    expect(withoutCardsData.results[0]?.cardCount).toBe(0);
    expect(withoutCardsData.results[0]?.mediaCount).toBe(1);
    expect(withoutCardsData.results[0]?.mediaHits).toHaveLength(1);
    expect(withoutCardsData.results[0]?.mediaHits[0]?.mediaSlug).toBe(
      crossMediaFixture.alpha.mediaSlug
    );
    expect(withoutCardsData.results[0]?.mediaHits[0]?.hasCards).toBe(false);
    expect(withoutCardsData.results[0]?.bestLocalHref).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.alpha.mediaSlug,
        "term",
        "余白",
        crossMediaFixture.alpha.mixedNoCardTermSourceId
      )
    );
  });

  it("loads global autocomplete suggestions on demand with active filters", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");
    const defaultSortSpy = vi.spyOn(settings, "getGlossaryDefaultSort");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const suggestions = await getGlobalGlossaryAutocompleteData(
      {
        q: "yohaku",
        cards: "without_cards"
      },
      database
    );

    expect(suggestions.map((entry) => entry.label)).toEqual(["余白"]);
    expect(suggestions[0]?.hasCards).toBe(true);
    expect(suggestions[0]?.hasCardlessVariant).toBe(true);
    expect(defaultSortSpy).not.toHaveBeenCalled();
    defaultSortSpy.mockRestore();
  });

  it("loads global aggregate stats with a single raw query", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const executeSpy = vi.spyOn(database.$client, "execute");
    const aggregateStats = await getGlobalGlossaryAggregateStats(database);

    expect(aggregateStats).toEqual({
      crossMediaCount: 3,
      entryCount: 3,
      withCardsCount: 3
    });
    expect(executeSpy).toHaveBeenCalledTimes(1);
    executeSpy.mockRestore();
  });

  it("supports global study and entry type filters without regressing ranking", async () => {
    await seedDevelopmentDatabase(database);

    const learningData = await getGlobalGlossaryPageData(
      {
        q: "iku",
        study: "learning",
        type: "term"
      },
      database
    );
    const grammarData = await getGlobalGlossaryPageData(
      {
        q: "iku",
        type: "grammar"
      },
      database
    );

    expect(learningData.results.map((entry) => entry.id)).toEqual([
      developmentFixture.termId
    ]);
    expect(learningData.results[0]?.studyState.key).toBe("learning");
    expect(learningData.results[0]?.matchBadges).toContain("romaji");
    expect(grammarData.results).toHaveLength(0);
  });

  it("keeps global browse counts and representative rows stable for grouped term browse entries", async () => {
    const contentRoot = path.join(tempDir, "mixed-browse-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const [filteredTotal, pageRefs, pageData] = await Promise.all([
      countGlobalGlossaryBrowseGroups(database, {
        cards: "all",
        entryType: "term"
      }),
      listGlobalGlossaryBrowseGroupRefs(database, {
        cards: "all",
        entryType: "term",
        page: 1,
        pageSize: 10,
        sort: "alphabetical"
      }),
      getGlobalGlossaryPageData(
        {
          sort: "alphabetical",
          type: "term"
        },
        database
      )
    ]);

    expect(filteredTotal).toBe(2);
    expect(pageRefs).toHaveLength(2);
    expect(pageRefs.every((ref) => ref.totalCount === filteredTotal)).toBe(
      true
    );
    expect(pageRefs.map((ref) => ref.resultKey)).toEqual([
      "term:group:コスト",
      "term:group:余白"
    ]);
    expect(pageRefs.every((ref) => ref.crossMediaGroupId !== null)).toBe(true);
    expect(pageData.results.map((entry) => entry.label)).toEqual([
      "コスト",
      "余白"
    ]);
    expect(pageData.results.map((entry) => entry.mediaCount)).toEqual([2, 2]);
    expect(pageData.results.map((entry) => entry.bestLocalHref)).toEqual([
      expectedGlossaryEntryHref(
        crossMediaFixture.alpha.mediaSlug,
        "term",
        "コスト",
        crossMediaFixture.alpha.termSourceId
      ),
      expectedGlossaryEntryHref(
        crossMediaFixture.beta.mediaSlug,
        "term",
        "余白",
        crossMediaFixture.beta.mixedCardTermSourceId
      )
    ]);
  });

  it("ignores legacy grouped study signals stored with groupKey instead of group id", async () => {
    const contentRoot = path.join(tempDir, "legacy-group-key-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const groupedTerm = await database.query.term.findFirst({
      where: (row, { eq }) =>
        eq(row.sourceId, crossMediaFixture.alpha.termSourceId),
      with: {
        crossMediaGroup: true
      }
    });

    expect(groupedTerm?.crossMediaGroupId).toBeTruthy();
    expect(groupedTerm?.crossMediaGroup?.groupKey).toBe("コスト");

    await database
      .update(reviewSubjectState)
      .set({
        crossMediaGroupId: groupedTerm?.crossMediaGroup?.groupKey,
        manualOverride: true,
        state: "known_manual"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `group:term:${groupedTerm?.crossMediaGroupId}`
        )
      );

    const knownGroups = await listGlobalGlossaryBrowseGroupRefs(database, {
      cards: "all",
      entryType: "term",
      page: 1,
      pageSize: 10,
      sort: "alphabetical",
      study: "known"
    });

    expect(knownGroups).toEqual([]);
  });

  it("loads the first global browse page without issuing a separate count query", async () => {
    const executeSpy = vi.spyOn(database.$client, "execute");

    await getGlobalGlossaryPageData({}, database);

    const browseCountQueries = executeSpy.mock.calls.filter(([input]) => {
      const sql =
        typeof input === "string" ? input : (input as { sql?: unknown }).sql;

      return (
        typeof sql === "string" &&
        sql.includes("select cast(count(*) as integer) as count") &&
        sql.includes("from matching_groups")
      );
    });

    expect(browseCountQueries).toHaveLength(0);
  });

  it("keeps global grammar romaji queries working after SQL candidate prefiltering", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const data = await getGlobalGlossaryPageData(
      {
        q: "teiru"
      },
      database
    );

    expect(data.results[0]?.id).toBe("grammar-teiru");
    expect(data.results[0]?.kind).toBe("grammar");
    expect(data.results[0]?.matchBadges).toContain("romaji");
  });

  it("keeps global Italian meaning queries discoverable after SQL candidate prefiltering", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const data = await getGlobalGlossaryPageData(
      {
        q: "mangiare"
      },
      database
    );

    expect(data.results[0]?.id).toBe("term-taberu");
    expect(data.results[0]?.kind).toBe("term");
    expect(data.results[0]?.matchedFields.meaning).toBe("normalized");
  });

  it("keeps global term alias kana queries consistent with local matching", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const termId = buildScopedEntryId(
      "term",
      "media-sample-anime",
      "term-taberu"
    );

    await database.insert(termAlias).values({
      id: "term_alias_katakana_only_taberu",
      termId,
      aliasText: "タベモノ",
      aliasNorm: "タベモノ",
      aliasType: "alt"
    });

    const [localData, globalData] = await Promise.all([
      getGlossaryPageData(
        "sample-anime",
        {
          q: "たべもの"
        },
        database
      ),
      getGlobalGlossaryPageData(
        {
          q: "たべもの"
        },
        database
      )
    ]);

    expect(localData).not.toBeNull();
    expect(localData?.results[0]?.id).toBe("term-taberu");
    expect(globalData.results[0]?.id).toBe("term-taberu");
    expect(globalData.results[0]?.matchedFields.aliases).toContainEqual({
      mode: "kana",
      text: "タベモノ"
    });
  });

  it("handles glossary datasets larger than SQLite expression depth limits", async () => {
    await seedDevelopmentDatabase(database);

    const bulkTerms = Array.from({ length: 140 }, (_, index) => {
      const sourceId = `term-bulk-${index}`;
      const scopedId = buildScopedEntryId(
        "term",
        developmentFixture.mediaId,
        sourceId
      );

      return {
        card: {
          id: `card-bulk-${index}`,
          mediaId: developmentFixture.mediaId,
          lessonId: developmentFixture.lessonId,
          segmentId: developmentFixture.segmentId,
          sourceFile: `tests/fixtures/db/fixture-tcg/cards/bulk-${index}.md`,
          cardType: "recognition",
          front: `単語 ${index}`,
          back: `significato ${index}`,
          notesIt: "Fixture bulk per regression test glossary.",
          status: "active" as const,
          orderIndex: 10 + index,
          createdAt: "2026-03-10T09:00:00.000Z",
          updatedAt: "2026-03-10T09:00:00.000Z"
        },
        cardEntryLink: {
          id: `card-entry-link-bulk-${index}`,
          cardId: `card-bulk-${index}`,
          entryType: "term" as const,
          entryId: scopedId,
          relationshipType: "primary" as const
        },
        term: {
          id: scopedId,
          sourceId,
          mediaId: developmentFixture.mediaId,
          segmentId: developmentFixture.segmentId,
          lemma: `用語${index}`,
          reading: `ようご${index}`,
          romaji: `yougo-${index}`,
          pos: "noun",
          meaningIt: `voce bulk ${index}`,
          notesIt: "Fixture bulk per regression test glossary.",
          searchLemmaNorm: `用語${index}`,
          searchReadingNorm: `ようご${index}`,
          searchRomajiNorm: `yougo-${index}`,
          createdAt: "2026-03-10T09:00:00.000Z",
          updatedAt: "2026-03-10T09:00:00.000Z"
        }
      };
    });

    await database.insert(term).values(bulkTerms.map((entry) => entry.term));
    await database.insert(card).values(bulkTerms.map((entry) => entry.card));
    await database
      .insert(cardEntryLink)
      .values(bulkTerms.map((entry) => entry.cardEntryLink));

    const [globalData, globalPageTwoData, localData] = await Promise.all([
      getGlobalGlossaryPageData({}, database),
      getGlobalGlossaryPageData(
        {
          page: "2"
        },
        database
      ),
      getGlossaryPageData(developmentFixture.mediaSlug, {}, database)
    ]);

    expect(globalData.resultSummary.total).toBeGreaterThan(100);
    expect(globalData.resultSummary.filtered).toBeGreaterThan(
      globalData.results.length
    );
    expect(globalData.pagination.page).toBe(1);
    expect(globalData.pagination.pageSize).toBe(globalData.results.length);
    expect(globalData.pagination.totalPages).toBeGreaterThan(1);
    expect(globalPageTwoData.filters.page).toBe(2);
    expect(globalPageTwoData.resultSummary.filtered).toBe(
      globalData.resultSummary.filtered
    );
    expect(globalPageTwoData.results.length).toBeGreaterThan(0);
    expect(globalPageTwoData.results[0]?.resultKey).not.toBe(
      globalData.results[0]?.resultKey
    );
    expect(localData).not.toBeNull();
    expect(localData?.results.length).toBeGreaterThan(100);
    expect(
      localData?.results.some((entry) => entry.id === "term-bulk-139")
    ).toBe(true);
  });

  it("preserves the current page inside global glossary return links", async () => {
    await seedDevelopmentDatabase(database);

    const bulkTerms = Array.from({ length: 30 }, (_, index) => {
      const sourceId = `term-page-${index}`;
      const scopedId = buildScopedEntryId(
        "term",
        developmentFixture.mediaId,
        sourceId
      );

      return {
        card: {
          id: `card-page-${index}`,
          mediaId: developmentFixture.mediaId,
          lessonId: developmentFixture.lessonId,
          segmentId: developmentFixture.segmentId,
          sourceFile: `tests/fixtures/db/fixture-tcg/cards/page-${index}.md`,
          cardType: "recognition",
          front: `Pagina ${index}`,
          back: `pagina ${index}`,
          notesIt: "Fixture pagination glossary.",
          status: "active" as const,
          orderIndex: 200 + index,
          createdAt: "2026-03-10T09:00:00.000Z",
          updatedAt: "2026-03-10T09:00:00.000Z"
        },
        cardEntryLink: {
          id: `card-entry-link-page-${index}`,
          cardId: `card-page-${index}`,
          entryType: "term" as const,
          entryId: scopedId,
          relationshipType: "primary" as const
        },
        term: {
          id: scopedId,
          sourceId,
          mediaId: developmentFixture.mediaId,
          segmentId: developmentFixture.segmentId,
          lemma: `頁${index}`,
          reading: `ぺーじ${index}`,
          romaji: `peeji-${index}`,
          pos: "noun",
          meaningIt: `voce pagina ${index}`,
          notesIt: "Fixture pagination glossary.",
          searchLemmaNorm: `頁${index}`,
          searchReadingNorm: `ぺーじ${index}`,
          searchRomajiNorm: `peeji-${index}`,
          createdAt: "2026-03-10T09:00:00.000Z",
          updatedAt: "2026-03-10T09:00:00.000Z"
        }
      };
    });

    await database.insert(term).values(bulkTerms.map((entry) => entry.term));
    await database.insert(card).values(bulkTerms.map((entry) => entry.card));
    await database
      .insert(cardEntryLink)
      .values(bulkTerms.map((entry) => entry.cardEntryLink));

    const data = await getGlobalGlossaryPageData(
      {
        page: "2"
      },
      database
    );

    const markup = renderToStaticMarkup(GlossaryPortalPage({ data }));

    expect(data.filters.page).toBe(2);
    expect(markup).toContain("Pagina 2 di");
    expect(data.results[0]?.bestLocalHref).toBeDefined();
    expectMarkupHref(markup, {
      pathname: expectedGlossaryEntryPath("term", data.results[0]!.label),
      searchParams: {
        media: data.results[0]!.mediaSlug,
        source: data.results[0]!.id
      },
      returnTo: "/glossary?page=2"
    });
  });

  it("renders the global glossary portal with explicit flashcard signals and return links", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const data = await getGlobalGlossaryPageData(
      {
        q: "kosuto",
        media: crossMediaFixture.beta.mediaSlug
      },
      database
    );

    const markup = renderToStaticMarkup(GlossaryPortalPage({ data }));

    expect(markup).not.toContain(
      '<span class="status-pill">Ha flashcard</span>'
    );
    expect(markup).toContain("Ricerca globale");
    expect(markup).not.toContain("Apri voce");
    expect(markup).toContain("Aprila in");
    expectMarkupHref(markup, {
      pathname: expectedGlossaryEntryPath("term", "コスト"),
      searchParams: {
        media: crossMediaFixture.beta.mediaSlug,
        source: crossMediaFixture.beta.termSourceId
      },
      returnTo: `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}`
    });
    expectMarkupHref(markup, {
      pathname: expectedGlossaryEntryPath("term", "コスト"),
      searchParams: {
        media: crossMediaFixture.alpha.mediaSlug,
        source: crossMediaFixture.alpha.termSourceId
      },
      returnTo: `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}`
    });
  });

  it("preserves all active global filters inside returnTo links to local detail pages", async () => {
    await seedDevelopmentDatabase(database);

    const data = await getGlobalGlossaryPageData(
      {
        q: "iku",
        type: "term",
        media: developmentFixture.mediaSlug,
        study: "learning",
        cards: "with_cards",
        sort: "alphabetical"
      },
      database
    );

    const markup = renderToStaticMarkup(GlossaryPortalPage({ data }));

    expectMarkupHref(markup, {
      pathname: expectedGlossaryEntryPath("term", "行く"),
      searchParams: {
        media: developmentFixture.mediaSlug,
        source: developmentFixture.termId
      },
      returnTo: `/glossary?q=iku&type=term&media=${developmentFixture.mediaSlug}&study=learning&cards=with_cards&sort=alphabetical`
    });
  });

  it("preserves the filtered local glossary workspace when opening a detail page", async () => {
    await seedDevelopmentDatabase(database);

    const data = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        cards: "with_cards",
        q: "iku",
        segment: developmentFixture.segmentId,
        sort: "alphabetical",
        study: "learning"
      },
      database
    );

    expect(data).not.toBeNull();

    const markup = renderToStaticMarkup(
      GlossaryPage({
        data: data!,
        returnTo:
          `/glossary?q=iku&media=${developmentFixture.mediaSlug}` as Route
      })
    );

    expect(markup).toContain(
      `?q=iku&amp;segment=${developmentFixture.segmentId}&amp;cards=with_cards&amp;sort=alphabetical&amp;study=learning&amp;preview=${developmentFixture.termId}&amp;previewKind=term&amp;returnTo=%2Fglossary%3Fq%3Diku%26media%3D${developmentFixture.mediaSlug}`
    );
    expectMarkupHref(markup, {
      pathname: expectedGlossaryEntryPath("term", "行く"),
      searchParams: {
        media: developmentFixture.mediaSlug,
        source: developmentFixture.termId
      },
      returnTo: `/glossary?media=${developmentFixture.mediaSlug}&q=iku&segment=${developmentFixture.segmentId}&study=learning&cards=with_cards&sort=alphabetical&returnTo=/glossary?q=iku&media=${developmentFixture.mediaSlug}`
    });
  });

  it("keeps the active local cards filter when submitting a new glossary search", async () => {
    await seedDevelopmentDatabase(database);

    const data = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        cards: "without_cards",
        q: "iku"
      },
      database
    );

    expect(data).not.toBeNull();

    const markup = renderToStaticMarkup(GlossaryPage({ data: data! }));

    expect(markup).toContain(
      '<input type="hidden" name="cards" value="without_cards"/>'
    );
  });
});
