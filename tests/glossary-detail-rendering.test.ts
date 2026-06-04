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
import { GlossaryPortalPage } from "@/components/glossary/glossary-portal-page";
import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { term } from "@/db/schema/index.ts";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import { importContentWorkspace } from "@/features/content/importer";
import {
  getGlobalGlossaryPageData,
  getGlobalGrammarGlossaryDetailData,
  getGlossaryPageData,
  getGrammarGlossaryDetailData,
  getTermGlossaryDetailData
} from "@/features/glossary/server";
import { buildReviewSessionHref } from "@/features/navigation";
import { buildPitchAccentData } from "@/features/pitch-accent/model";
import { getReviewCardDetailData } from "@/features/review/server";
import { setReviewCardSuspended } from "@/features/review/server/service";
import {
  crossMediaOverflowFixture,
  writeCrossMediaOverflowContentFixture
} from "./helpers/cross-media-fixture";
import {
  expectMarkupHref,
  expectNoMarkupHref
} from "./helpers/glossary-href-assertions";
import {
  expectedGlossaryEntryHref,
  markAllLessonsCompleted,
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

  it("keeps review deep links available when the detail is opened from a filtered global glossary workspace", async () => {
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
          `/glossary?media=${developmentFixture.mediaSlug}&q=iku&segment=${developmentFixture.segmentId}&study=learning&returnTo=${encodeURIComponent(reviewReturnTo)}` as Route
      })
    );

    expect(markup).toContain("Torna al Glossary");
    expect(markup).not.toContain("Torna alla Review");
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

  it("does not recover review links from unsupported legacy local glossary returnTo", async () => {
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
          `/media/${developmentFixture.mediaSlug}/glossary?q=iku&returnTo=${encodeURIComponent(reviewReturnTo)}` as Route
      })
    );

    expect(markup).not.toContain("Torna al Glossary");
    expect(markup).not.toContain("Apri in Review");
    expectMarkupHref(markup, {
      pathname: `/media/${developmentFixture.mediaSlug}`
    });
    expectNoMarkupHref(markup, {
      pathname: `/media/${developmentFixture.mediaSlug}/glossary`,
      searchParams: {
        q: "iku",
        returnTo: reviewReturnTo
      }
    });
    expectNoMarkupHref(markup, {
      pathname: `/media/${developmentFixture.mediaSlug}/review`,
      searchParams: {
        answered: "3",
        card: developmentFixture.primaryCardId,
        extraNew: "2"
      }
    });
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
      expectedGlossaryEntryHref(
        crossMediaOverflowFixture.zeta.mediaSlug,
        "term",
        "コスト",
        crossMediaOverflowFixture.zeta.termSourceId
      )
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
    expect(detail?.lessons[0]?.href).toBe(
      "/media/sample-anime/textbook/ep01-intro"
    );
    expect(detail?.lessons).toHaveLength(1);
    expect(detail?.lessons[0]?.roleLabels).toEqual(["Spiegata", "Citata"]);
    expect(detail?.cards[0]?.front).toBe("～ている");
    expect(detail?.cards[0]?.relationshipLabel).toBe("Card principale");
    expect(detail?.cards[0]?.href).toBe(
      "/media/sample-anime/review/card/card-teiru-concept"
    );
  });

  it("resolves global grammar detail pages from unnormalized route surfaces", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(result.status).toBe("completed");

    const detail = await getGlobalGrammarGlossaryDetailData(
      "～ている",
      {
        media: "sample-anime",
        source: "grammar-teiru"
      },
      database
    );

    expect(detail).not.toBeNull();
    expect(detail?.entry.label).toBe("～ている");
    expect(detail?.media.slug).toBe("sample-anime");
    expect(detail?.cards[0]?.front).toBe("～ている");
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
    expect(detail?.entry.pronunciation?.src).toEqual(
      expect.stringMatching(
        /^\/media-audio\/sample-anime\/audio\/term\/term-taberu\/term-taberu\.ogg\?v=.+/u
      )
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
    expect(detail?.entry.studyState.key).toBe("available");
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
    await markAllLessonsCompleted(database);

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
      expectedGlossaryEntryHref(
        "sample-anime",
        "grammar",
        "～ている",
        "grammar-teiru"
      )
    );
    expect(detail?.pronunciations[0]?.audio.src).toEqual(
      expect.stringMatching(
        /^\/media-audio\/sample-anime\/audio\/grammar\/grammar-teiru\/grammar-teiru\.mp3\?v=.+/u
      )
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
    await markAllLessonsCompleted(database);

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
});
