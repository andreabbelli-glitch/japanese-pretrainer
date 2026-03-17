import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { GlossaryPage } from "@/components/glossary/glossary-page";
import { GlossaryPortalPage } from "@/components/glossary/glossary-portal-page";
import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lessonProgress,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import { buildScopedEntryId } from "@/lib/entry-id";
import {
  card,
  cardEntryLink,
  grammarPattern,
  term,
  termAlias
} from "@/db/schema/index.ts";
import { importContentWorkspace } from "@/lib/content/importer";
import {
  getGlobalGlossaryAutocompleteData,
  getGlobalGlossaryPageData,
  getGlossaryPageData,
  getGrammarGlossaryDetailData,
  getTermGlossaryDetailData
} from "@/lib/glossary";
import { buildPitchAccentData } from "@/lib/pitch-accent";
import { getReviewCardDetailData } from "@/lib/review";
import { setReviewCardSuspended } from "@/lib/review-service";
import { buildReviewSessionHref } from "@/lib/site";
import {
  crossMediaOverflowFixture,
  crossMediaFixture,
  writeCrossMediaOverflowContentFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validContentRoot = path.join(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);

const reusedSourceIdFixture = {
  sourceId: "term-shared-source",
  alpha: {
    cardId: "card-shared-alpha",
    lessonId: "lesson-shared-alpha",
    lessonSlug: "shared-alpha-intro",
    mediaId: "media-shared-alpha",
    mediaSlug: "shared-alpha",
    meaning: "condivisione nel media alpha"
  },
  beta: {
    cardId: "card-shared-beta",
    lessonId: "lesson-shared-beta",
    lessonSlug: "shared-beta-intro",
    mediaId: "media-shared-beta",
    mediaSlug: "shared-beta",
    meaning: "condivisione nel media beta"
  }
} as const;

async function writeReusedSourceIdContentFixture(contentRoot: string) {
  await Promise.all([
    writeReusedSourceIdBundle(contentRoot, reusedSourceIdFixture.alpha),
    writeReusedSourceIdBundle(contentRoot, reusedSourceIdFixture.beta)
  ]);
}

async function writeReusedSourceIdBundle(
  contentRoot: string,
  input:
    | (typeof reusedSourceIdFixture)["alpha"]
    | (typeof reusedSourceIdFixture)["beta"]
) {
  const mediaRoot = path.join(contentRoot, "media", input.mediaSlug);
  const textbookRoot = path.join(mediaRoot, "textbook");
  const cardsRoot = path.join(mediaRoot, "cards");

  await mkdir(textbookRoot, { recursive: true });
  await mkdir(cardsRoot, { recursive: true });

  await writeFile(
    path.join(mediaRoot, "media.md"),
    `---
id: ${input.mediaId}
slug: ${input.mediaSlug}
title: ${input.mediaSlug}
media_type: game
segment_kind: chapter
language: ja
base_explanation_language: it
status: active
---

# ${input.mediaSlug}

Fixture con source id riusato tra media diversi.
`
  );

  await writeFile(
    path.join(textbookRoot, "001-intro.md"),
    `---
id: ${input.lessonId}
media_id: ${input.mediaId}
slug: ${input.lessonSlug}
title: ${input.mediaSlug} intro
order: 1
segment_ref: chapter-01
status: active
---

# Intro

Qui compare [共有](term:${reusedSourceIdFixture.sourceId}).
`
  );

  await writeFile(
    path.join(cardsRoot, "001-core.md"),
    `---
id: cards-${input.mediaSlug}
media_id: ${input.mediaId}
slug: ${input.mediaSlug}-core
title: ${input.mediaSlug} core
order: 1
segment_ref: chapter-01
---

:::term
id: ${reusedSourceIdFixture.sourceId}
lemma: 共有
reading: きょうゆう
romaji: kyouyuu
meaning_it: ${input.meaning}
aliases: [共有, きょうゆう, kyouyuu]
:::

:::card
id: ${input.cardId}
entry_type: term
entry_id: ${reusedSourceIdFixture.sourceId}
card_type: recognition
front: 共有
back: ${input.meaning}
:::
`
  );
}

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

  async function markAllLessonsCompleted() {
    const lessons = await database.query.lesson.findMany();

    if (lessons.length === 0) {
      return;
    }

    await database
      .insert(lessonProgress)
      .values(
        lessons.map((row) => ({
          lessonId: row.id,
          status: "completed" as const,
          startedAt: "2026-03-09T09:00:00.000Z",
          completedAt: "2026-03-09T10:00:00.000Z",
          lastOpenedAt: "2026-03-09T10:00:00.000Z"
        }))
      )
      .onConflictDoUpdate({
        target: lessonProgress.lessonId,
        set: {
          status: "completed",
          completedAt: "2026-03-09T10:00:00.000Z",
          lastOpenedAt: "2026-03-09T10:00:00.000Z"
        }
      });
  }

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
      `/media/${developmentFixture.mediaSlug}/glossary/term/${developmentFixture.termId}`
    );
    expect(data?.results[0]?.bestLocalHref).toBe(
      `/media/${developmentFixture.mediaSlug}/glossary/term/${developmentFixture.termId}`
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
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.termSourceId}`
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
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.termSourceId}`
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
    expect(allCardsData.results[0]?.mediaHits.map((hit) => hit.mediaSlug)).toEqual([
      crossMediaFixture.beta.mediaSlug,
      crossMediaFixture.alpha.mediaSlug
    ]);
    expect(allCardsData.results[0]?.bestLocalHref).toBe(
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.mixedCardTermSourceId}`
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
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.mixedCardTermSourceId}`
    );

    expect(withoutCardsData.results.map((entry) => entry.label)).toEqual(["余白"]);
    expect(withoutCardsData.results[0]?.hasCards).toBe(false);
    expect(withoutCardsData.results[0]?.cardCount).toBe(0);
    expect(withoutCardsData.results[0]?.mediaCount).toBe(1);
    expect(withoutCardsData.results[0]?.mediaHits).toHaveLength(1);
    expect(withoutCardsData.results[0]?.mediaHits[0]?.mediaSlug).toBe(
      crossMediaFixture.alpha.mediaSlug
    );
    expect(withoutCardsData.results[0]?.mediaHits[0]?.hasCards).toBe(false);
    expect(withoutCardsData.results[0]?.bestLocalHref).toBe(
      `/media/${crossMediaFixture.alpha.mediaSlug}/glossary/term/${crossMediaFixture.alpha.mixedNoCardTermSourceId}`
    );
  });

  it("loads global autocomplete suggestions on demand with active filters", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

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

    const termId = buildScopedEntryId("term", "media-sample-anime", "term-taberu");

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

    const [globalData, localData] = await Promise.all([
      getGlobalGlossaryPageData({}, database),
      getGlossaryPageData(developmentFixture.mediaSlug, {}, database)
    ]);

    expect(globalData.resultSummary.total).toBeGreaterThan(100);
    expect(globalData.results.some((entry) => entry.id === "term-bulk-139")).toBe(
      true
    );
    expect(localData).not.toBeNull();
    expect(localData?.results.length).toBeGreaterThan(100);
    expect(localData?.results.some((entry) => entry.id === "term-bulk-139")).toBe(
      true
    );
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

    expect(markup).not.toContain('<span class="status-pill">Ha flashcard</span>');
    expect(markup).toContain("Glossary");
    expect(markup).toContain(
      `returnTo=%2Fglossary%3Fq%3Dkosuto%26media%3D${crossMediaFixture.beta.mediaSlug}`
    );
    expect(markup).not.toContain("Apri voce");
    expect(markup).toContain("Aprila in");
    expect(markup).toContain(
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.termSourceId}?returnTo=%2Fglossary%3Fq%3Dkosuto%26media%3D${crossMediaFixture.beta.mediaSlug}`
    );
    expect(markup).toContain(
      `/media/${crossMediaFixture.alpha.mediaSlug}/glossary/term/${crossMediaFixture.alpha.termSourceId}?returnTo=%2Fglossary%3Fq%3Dkosuto%26media%3D${crossMediaFixture.beta.mediaSlug}`
    );
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

    expect(markup).toContain(
      `/media/${developmentFixture.mediaSlug}/glossary/term/${developmentFixture.termId}?returnTo=%2Fglossary%3Fq%3Diku%26type%3Dterm%26media%3D${developmentFixture.mediaSlug}%26study%3Dlearning%26cards%3Dwith_cards%26sort%3Dalphabetical`
    );
  });

  it("preserves the filtered local glossary workspace when opening a detail page", async () => {
    await seedDevelopmentDatabase(database);

    const data = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
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
        returnTo: `/glossary?q=iku&media=${developmentFixture.mediaSlug}` as Route
      })
    );

    expect(markup).toContain(
      `/media/${developmentFixture.mediaSlug}/glossary/term/${developmentFixture.termId}?returnTo=%2Fglossary%3Fq%3Diku%26segment%3D${developmentFixture.segmentId}%26study%3Dlearning%26sort%3Dalphabetical%26returnTo%3D%252Fglossary%253Fq%253Diku%2526media%253D${developmentFixture.mediaSlug}`
    );
  });

  it("keeps review deep links available when the detail is opened from a local glossary workspace", async () => {
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
        returnTo:
          `/media/${developmentFixture.mediaSlug}/glossary?q=iku&segment=${developmentFixture.segmentId}&study=learning&returnTo=${encodeURIComponent(reviewReturnTo)}` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expect(markup).not.toContain("Torna alla Review");
    expect(markup).toContain("Apri in Review");
    expect(markup).toContain(
      `/media/${developmentFixture.mediaSlug}/review?answered=3&amp;card=${developmentFixture.primaryCardId}&amp;extraNew=2`
    );
    expect(markup).not.toContain(
      `/media/${developmentFixture.mediaSlug}/review?answered=3&amp;card=${developmentFixture.primaryCardId}&amp;show=answer`
    );
  });

  it("keeps the recommended media visible when a cross-media group overflows the first three chips", async () => {
    const contentRoot = path.join(tempDir, "cross-media-overflow-content");

    await writeCrossMediaOverflowContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const data = await getGlobalGlossaryPageData(
      {
        q: "kosuto",
        media: crossMediaOverflowFixture.zeta.mediaSlug
      },
      database
    );

    expect(data.results).toHaveLength(1);
    expect(data.results[0]?.bestLocalHref).toBe(
      `/media/${crossMediaOverflowFixture.zeta.mediaSlug}/glossary/term/${crossMediaOverflowFixture.zeta.termSourceId}`
    );
    expect(data.results[0]?.mediaHits.map((hit) => hit.mediaSlug)).toEqual([
      crossMediaOverflowFixture.zeta.mediaSlug,
      crossMediaOverflowFixture.alpha.mediaSlug,
      crossMediaOverflowFixture.beta.mediaSlug,
      crossMediaOverflowFixture.gamma.mediaSlug
    ]);

    const markup = renderToStaticMarkup(GlossaryPortalPage({ data }));

    expect(markup).toContain("Aprila in");
    expect(markup).toContain("zeta · Chapter 01 · consigliato");
    expect(markup).toContain("+1 altri media");
  });

  it("matches hiragana and katakana input against readings through kana folding", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const hiraganaData = await getGlossaryPageData(
      "sample-anime",
      {
        q: "たべる"
      },
      database
    );
    const katakanaData = await getGlossaryPageData(
      "sample-anime",
      {
        q: "タベル"
      },
      database
    );

    expect(hiraganaData).not.toBeNull();
    expect(hiraganaData?.results[0]?.id).toBe("term-taberu");
    expect(hiraganaData?.results[0]?.matchBadges).toContain("lettura");
    expect(katakanaData).not.toBeNull();
    expect(katakanaData?.results[0]?.id).toBe("term-taberu");
    expect(katakanaData?.results[0]?.matchBadges).toContain("lettura");
  });

  it("matches Italian meaning queries without regressing term search", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const data = await getGlossaryPageData(
      "sample-anime",
      {
        q: "mangiare"
      },
      database
    );

    expect(data).not.toBeNull();
    expect(data?.results[0]?.id).toBe("term-taberu");
    expect(data?.results[0]?.matchBadges).toContain("significato");
  });

  it("builds grammar detail pages with linked lessons and cards", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const detail = await getGrammarGlossaryDetailData(
      "sample-anime",
      "grammar-teiru",
      database
    );

    expect(detail).not.toBeNull();
    expect(detail?.entry.label).toBe("～ている");
    expect(detail?.lessons[0]?.href).toBe("/media/sample-anime/textbook/ep01-intro");
    expect(detail?.lessons).toHaveLength(1);
    expect(detail?.lessons[0]?.roleLabels).toEqual(["Spiegata", "Citata"]);
    expect(detail?.cards[0]?.front).toBe("～ている");
    expect(detail?.cards[0]?.relationshipLabel).toBe("Card principale");
    expect(detail?.cards[0]?.href).toBe(
      "/media/sample-anime/review/card/card-teiru-concept"
    );
  });

  it("renders grammar pitch accent even when the entry has no separate reading field", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const detail = await getGrammarGlossaryDetailData(
      "sample-anime",
      "grammar-teiru",
      database
    );

    expect(detail).not.toBeNull();

    const grammarWithoutReading = structuredClone(detail!);
    grammarWithoutReading.entry.reading = undefined;
    grammarWithoutReading.entry.romaji = undefined;
    grammarWithoutReading.entry.pronunciation = {
      ...(grammarWithoutReading.entry.pronunciation ?? {}),
      pitchAccent: buildPitchAccentData("そうしたら", 4)!,
      pitchAccentPageUrl: "https://example.com/pitch",
      pitchAccentSource: "Wiktionary"
    };

    const markup = renderToStaticMarkup(
      GlossaryDetailPage({ data: grammarWithoutReading })
    );

    expect(markup).toContain("pitch-accent__graph");
    expect(markup).toContain("Pitch accent da Wiktionary");
  });

  it("builds term detail pages with card links that target the specific card", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const detail = await getTermGlossaryDetailData(
      "sample-anime",
      "term-taberu",
      database
    );

    expect(detail).not.toBeNull();
    expect(detail?.entry.label).toBe("食べる");
    expect(detail?.cards).toHaveLength(1);
    expect(detail?.cards[0]?.id).toBe("card-taberu-recognition");
    expect(detail?.cards[0]?.href).toBe(
      "/media/sample-anime/review/card/card-taberu-recognition"
    );
    expect(detail?.entry.pronunciation?.src).toBe(
      "/media/sample-anime/assets/audio/term/term-taberu/term-taberu.ogg"
    );
    expect(detail?.entry.pronunciation?.pitchAccent).toMatchObject({
      downstep: 2,
      shape: "nakadaka"
    });
    expect(detail?.entry.pronunciation?.pitchAccentSource).toBe("Wiktionary");
    expect(detail?.entry.pronunciation?.pitchAccentPageUrl).toBe(
      "https://en.wiktionary.org/wiki/%E9%A3%9F%E3%81%B9%E3%82%8B"
    );
  });

  it("keeps suspended cards visible in glossary detail so review context does not disappear", async () => {
    await seedDevelopmentDatabase(database);

    await setReviewCardSuspended({
      cardId: developmentFixture.secondaryCardId,
      database,
      now: new Date("2026-03-09T14:00:00.000Z"),
      suspended: true
    });

    const detail = await getGrammarGlossaryDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.grammarId,
      database
    );

    expect(detail).not.toBeNull();
    expect(detail?.cards).toHaveLength(1);
    expect(detail?.cards[0]?.reviewLabel).toBe("Sospesa");
  });

  it("loads a real review card detail page target from DB data", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");
    await markAllLessonsCompleted();

    const detail = await getReviewCardDetailData(
      "sample-anime",
      "card-teiru-concept",
      database
    );

    expect(detail).not.toBeNull();
    expect(detail?.card.front).toBe("～ている");
    expect(detail?.card.back).toContain("azione in corso");
    expect(detail?.entries).toHaveLength(1);
    expect(detail?.entries[0]?.href).toBe(
      "/media/sample-anime/glossary/grammar/grammar-teiru"
    );
    expect(detail?.pronunciations[0]?.audio.src).toBe(
      "/media/sample-anime/assets/audio/grammar/grammar-teiru/grammar-teiru.mp3"
    );
    expect(detail?.pronunciations[0]?.audio.pitchAccent).toMatchObject({
      downstep: 0,
      shape: "heiban"
    });
  });

  it("renders audio players only when local pronunciation audio exists", async () => {
    const imported = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(imported.status).toBe("completed");
    await markAllLessonsCompleted();

    const glossaryDetail = await getTermGlossaryDetailData(
      "sample-anime",
      "term-taberu",
      database
    );
    const reviewDetail = await getReviewCardDetailData(
      "sample-anime",
      "card-teiru-concept",
      database
    );

    await seedDevelopmentDatabase(database);
    const glossaryWithoutAudio = await getTermGlossaryDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.termId,
      database
    );

    expect(glossaryDetail).not.toBeNull();
    expect(reviewDetail).not.toBeNull();
    expect(glossaryWithoutAudio).not.toBeNull();

    const glossaryMarkup = renderToStaticMarkup(
      GlossaryDetailPage({ data: glossaryDetail! })
    );
    const reviewMarkup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: reviewDetail! })
    );
    const glossaryWithoutAudioMarkup = renderToStaticMarkup(
      GlossaryDetailPage({ data: glossaryWithoutAudio! })
    );

    expect(glossaryMarkup).toContain("<audio");
    expect(reviewMarkup).toContain("<audio");
    expect(glossaryMarkup).toContain("pitch-accent__graph");
    expect(glossaryMarkup).toContain("Pitch accent da Wiktionary");
    expect(glossaryMarkup).toContain(">Fonte</a>");
    expect(reviewMarkup).toContain("pitch-accent__graph");
    expect(glossaryWithoutAudioMarkup).not.toContain("<audio");
  });

  it("renders pitch accent even when no local audio exists", async () => {
    await seedDevelopmentDatabase(database);
    await database
      .update(term)
      .set({
        pitchAccent: 0
      })
      .where(eq(term.id, developmentFixture.termDbId));

    const glossaryWithoutAudio = await getTermGlossaryDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.termId,
      database
    );

    expect(glossaryWithoutAudio?.entry.pronunciation?.src).toBeUndefined();
    expect(
      glossaryWithoutAudio?.entry.pronunciation?.pitchAccent
    ).toMatchObject({
      downstep: 0,
      shape: "heiban"
    });

    const markup = renderToStaticMarkup(
      GlossaryDetailPage({ data: glossaryWithoutAudio! })
    );

    expect(markup).toContain("pitch-accent__graph");
    expect(markup).not.toContain("<audio");
  });

  it("renders pronunciation audio and pitch accent inside global glossary result cards when available", async () => {
    const imported = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(imported.status).toBe("completed");

    const data = await getGlobalGlossaryPageData(
      {
        q: "mangiare",
        media: "sample-anime"
      },
      database
    );

    const markup = renderToStaticMarkup(GlossaryPortalPage({ data }));

    expect(markup).toContain("pronunciation-audio__player");
    expect(markup).toContain("pitch-accent__graph");
  });

  it("renders pitch accent in global glossary result cards even without audio", async () => {
    await seedDevelopmentDatabase(database);
    await database
      .update(term)
      .set({
        pitchAccent: 0
      })
      .where(eq(term.id, developmentFixture.termDbId));

    const data = await getGlobalGlossaryPageData(
      {
        q: "iku",
        media: developmentFixture.mediaSlug
      },
      database
    );

    const markup = renderToStaticMarkup(GlossaryPortalPage({ data }));

    expect(markup).toContain("pitch-accent__graph");
    expect(markup).not.toContain("pronunciation-audio__player");
  });

  it("renders glossary and review notes through the shared inline AST renderer", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");
    await markAllLessonsCompleted();

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
    expect(glossaryMarkup).toContain("<ruby>");
    expect(glossaryMarkup).toContain("<code");
    expect(glossaryMarkup).toContain("inline-ref");
    expect(glossaryMarkup).not.toContain("**enfasi**");
    expect(glossaryMarkup).not.toContain("{{日本語|にほんご}}");
    expect(glossaryMarkup).not.toContain("[食べる](term:term-taberu)");
    expect(reviewMarkup).toContain("<strong>enfasi</strong>");
    expect(reviewMarkup).toContain("<ruby>");
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
    expect(data?.preview?.lessons).toHaveLength(1);
    expect(data?.preview?.lessons[0]?.roleLabels).toEqual([
      "Spiegata",
      "Citata"
    ]);
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
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.termSourceId}`
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
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.termSourceId}`
    );
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
        returnTo: `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expect(markup).not.toContain("Torna alla Review");
    expect(markup).toContain(
      `/media/${crossMediaFixture.beta.mediaSlug}/review/card/${crossMediaFixture.beta.termCardId}`
    );
    expect(markup).not.toContain("Apri in Review");
    expect(markup).toContain(
      `/media/${crossMediaFixture.alpha.mediaSlug}/glossary/term/${crossMediaFixture.alpha.termSourceId}?returnTo=%2Fglossary%3Fq%3Dkosuto%26media%3D${crossMediaFixture.beta.mediaSlug}`
    );
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
        returnTo: `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}&cards=with_cards` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expect(markup).toContain(
      `/glossary?q=kosuto&amp;media=${crossMediaFixture.beta.mediaSlug}&amp;cards=with_cards`
    );
    expect(markup).toContain(
      `/media/${crossMediaFixture.alpha.mediaSlug}/glossary/term/${crossMediaFixture.alpha.termSourceId}?returnTo=%2Fglossary%3Fq%3Dkosuto%26media%3D${crossMediaFixture.beta.mediaSlug}%26cards%3Dwith_cards`
    );
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
        returnTo: `/glossary?q=kosuto&media=${crossMediaFixture.beta.mediaSlug}` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expect(markup).not.toContain("Torna alla Review");
    expect(markup).toContain(
      `/glossary?q=kosuto&amp;media=${crossMediaFixture.beta.mediaSlug}`
    );
    expect(markup).toContain(
      `returnTo=%2Fglossary%3Fq%3Dkosuto%26media%3D${crossMediaFixture.beta.mediaSlug}`
    );
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
    expect(markup).toContain(
      `/media/${developmentFixture.mediaSlug}/review?answered=3&amp;card=${developmentFixture.primaryCardId}&amp;extraNew=2`
    );
    expect(markup).not.toContain(
      `/media/${developmentFixture.mediaSlug}/review?answered=3&amp;card=${developmentFixture.primaryCardId}&amp;show=answer`
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

    expect(data.results).toHaveLength(2);
    expect(new Set(data.results.map((entry) => entry.resultKey)).size).toBe(2);
    expect(data.results.map((entry) => entry.bestLocalHref)).toEqual([
      `/media/${reusedSourceIdFixture.alpha.mediaSlug}/glossary/term/${reusedSourceIdFixture.sourceId}`,
      `/media/${reusedSourceIdFixture.beta.mediaSlug}/glossary/term/${reusedSourceIdFixture.sourceId}`
    ]);
    expect(data.results.map((entry) => entry.mediaCount)).toEqual([1, 1]);
    expect(data.results.map((entry) => entry.cardCount)).toEqual([1, 1]);

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

    expect(alphaDetail?.entry.meaning).toBe(reusedSourceIdFixture.alpha.meaning);
    expect(alphaDetail?.cards[0]?.id).toBe(reusedSourceIdFixture.alpha.cardId);
    expect(betaDetail?.entry.meaning).toBe(reusedSourceIdFixture.beta.meaning);
    expect(betaDetail?.cards[0]?.id).toBe(reusedSourceIdFixture.beta.cardId);
  });
});
