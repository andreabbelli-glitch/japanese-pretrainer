import { revalidatePathMock } from "./helpers/review-next-mocks";

import { cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import { ReviewPage } from "@/components/review/review-page";
import type { DatabaseClient } from "@/db";
import { card, cardEntryLink, reviewSubjectState } from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { importContentWorkspace } from "@/features/content/importer";
import {
  getReviewCardDetailData,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  hydrateReviewCard
} from "@/features/review/server";
import { applyReviewGrade } from "@/features/review/server/service";
import { setLinkedEntryStatusByCard } from "@/features/review/server/mutations";
import { updateStudySettings } from "@/features/settings/server";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import {
  cleanupReviewDatabase,
  markAllLessonsCompleted,
  setupReviewDatabase
} from "./helpers/review-db-fixture";
import {
  expectedGlossaryEntryHref,
  reviewValidContentRoot as validContentRoot
} from "./helpers/review-shared";

describe("review rendering", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    revalidatePathMock.mockReset();
    ({ database, tempDir } = await setupReviewDatabase({
      prefix: "jcs-review-",
      seedDevelopmentFixture: true
    }));
  });

  afterEach(async () => {
    await cleanupReviewDatabase({ database, tempDir });
  });

  it("exposes reading and example sentences in review answers", async () => {
    const primaryPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId,
        show: "answer"
      },
      database
    );
    const secondaryPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.secondaryCardId,
        show: "answer"
      },
      database
    );
    const primaryDetail = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(primaryPage?.selectedCard?.reading).toBe("いく");
    expect(primaryPage?.selectedCard?.exampleJp).toBe(
      "{{駅|えき}}まで {{行|い}}く。"
    );
    expect(primaryPage?.selectedCard?.exampleIt).toBe(
      "Vado fino alla stazione."
    );
    expect(secondaryPage?.selectedCard?.reading).toBe("〜ている");
    expect(primaryDetail?.card.reading).toBe("いく");
    expect(primaryDetail?.card.exampleJp).toBe("{{駅|えき}}まで {{行|い}}く。");
    expect(primaryDetail?.card.exampleIt).toBe("Vado fino alla stazione.");

    const primaryMarkup = renderToStaticMarkup(
      ReviewPage({ data: primaryPage! })
    );

    expect(primaryMarkup).toContain("review-stage__reading");
    expect(primaryMarkup).toContain("いく");
    expect(primaryMarkup).toContain("reader-example-sentence");
    expect(primaryMarkup).toContain("Mostra traduzione italiana");
    expect(primaryMarkup).toContain("Vado fino alla stazione.");
  });

  it("renders pronunciation audio players directly in the review answer when audio exists", async () => {
    const imported = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(imported.status).toBe("completed");
    await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

    const reviewPage = await getReviewPageData(
      "sample-anime",
      {
        card: "card-taberu-recognition",
        show: "answer"
      },
      database
    );

    expect(reviewPage?.selectedCard?.pronunciations).toHaveLength(1);
    expect(reviewPage?.selectedCard?.pronunciations[0]?.audio.src).toEqual(
      expect.stringMatching(
        /^\/media-audio\/sample-anime\/audio\/term\/term-taberu\/term-taberu\.ogg\?v=.+/u
      )
    );
    expect(
      reviewPage?.selectedCard?.pronunciations[0]?.audio.pitchAccent
    ).toMatchObject({
      downstep: 2,
      shape: "nakadaka"
    });

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));

    expect(markup).toContain("Pronuncia");
    expect(markup).toContain("pronunciation-audio__player");
    expect(markup).toContain('preload="metadata"');
    expect(markup).toContain("pitch-accent__graph");
    expect(markup).toContain(
      "/media-audio/sample-anime/audio/term/term-taberu/term-taberu.ogg"
    );
  });

  it("renders example sentence audio when a review card defines it", async () => {
    const contentRoot = path.join(tempDir, "content-with-example-audio");
    const cardsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "cards",
      "001-core.md"
    );

    await cp(validContentRoot, contentRoot, { recursive: true });
    const cardsSource = await readFile(cardsPath, "utf8");
    await writeFile(
      cardsPath,
      cardsSource.replace(
        "example_it: \"Mangio il pane.\"",
        [
          "example_it: \"Mangio il pane.\"",
          "example_audio_src: assets/audio/term/term-taberu/term-taberu.ogg",
          "example_audio_source: kaishi",
          "example_audio_attribution: Kaishi 1.5k sample sentence audio"
        ].join("\n")
      )
    );

    try {
      const imported = await importContentWorkspace({
        contentRoot,
        database,
        mediaSlugs: ["sample-anime"]
      });

      expect(imported.status).toBe("completed");
      await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

      const reviewPage = await getReviewPageData(
        "sample-anime",
        {
          card: "card-taberu-recognition",
          show: "answer"
        },
        database
      );

      expect(reviewPage?.selectedCard?.exampleAudio?.src).toEqual(
        expect.stringMatching(
          /^\/media-audio\/sample-anime\/audio\/term\/term-taberu\/term-taberu\.ogg\?v=.+/u
        )
      );

      const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));

      expect(markup).toContain("Audio frase");
      expect(markup).toContain("Kaishi 1.5k sample sentence audio");
      expect(markup).toContain(
        "/media-audio/sample-anime/audio/term/term-taberu/term-taberu.ogg"
      );
    } finally {
      await rm(contentRoot, { recursive: true, force: true });
    }
  });

  it("keeps non-canonical entry-linked cards separate and hides borrowed reading metadata", async () => {
    const chunkCardId = "card_fixture_iku_chunk";

    await database.insert(card).values({
      id: chunkCardId,
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/iku-chunk.md",
      cardType: "concept",
      front: "{{行|い}}かずに{{残|のこ}}る",
      normalizedFront: "行かずに残る",
      back: "restare senza andare",
      exampleJp: "{{駅|えき}}へ{{行|い}}かずに{{家|いえ}}に{{残|のこ}}る。",
      exampleIt: "Resto a casa senza andare alla stazione.",
      notesIt:
        "Chunk card legata allo stesso termine ma con fronte non canonico.",
      status: "active",
      orderIndex: 3,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_iku_chunk_primary",
      cardId: chunkCardId,
      entryType: "term",
      entryId: developmentFixture.termDbId,
      relationshipType: "primary"
    });

    const queueSnapshot = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: chunkCardId,
        show: "answer"
      },
      database
    );
    const detailPage = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      chunkCardId,
      database
    );

    if (!queueSnapshot) {
      return;
    }

    expect(queueSnapshot.queueCount).toBe(2);
    expect(queueSnapshot.cards.map((item) => item.id)).toContain(chunkCardId);
    expect(reviewPage?.selectedCard?.reading).toBeUndefined();
    expect(reviewPage?.selectedCard?.pronunciations).toHaveLength(0);
    expect(
      reviewPage?.selectedCard?.entries.map((entry) => entry.id)
    ).toContain(developmentFixture.termId);
    expect(detailPage?.card.reading).toBeUndefined();
    expect(detailPage?.pronunciations).toHaveLength(0);

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-11T12:00:00.000Z"),
      rating: "good"
    });

    const chunkReviewState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.cardId, chunkCardId)
    });

    expect(chunkReviewState).toBeUndefined();
  });

  it("hydrates a single review card with the same render-critical fields as the full page selection", async () => {
    const now = new Date("2026-03-12T10:00:00.000Z");

    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const [hydratedCard, reviewPage] = await Promise.all([
        hydrateReviewCard({
          cardId: developmentFixture.primaryCardId,
          database,
          now
        }),
        getReviewPageData(
          developmentFixture.mediaSlug,
          {
            card: developmentFixture.primaryCardId,
            show: "answer"
          },
          database
        )
      ]);

      expect(hydratedCard).not.toBeNull();
      expect(reviewPage?.selectedCard).not.toBeNull();
      expect(hydratedCard?.contexts).toHaveLength(1);
      expect(hydratedCard?.contexts[0]).toMatchObject({
        cardId: developmentFixture.primaryCardId
      });
      expect(hydratedCard).toMatchObject({
        back: reviewPage?.selectedCard?.back,
        bucket: reviewPage?.selectedCard?.bucket,
        bucketDetail: reviewPage?.selectedCard?.bucketDetail,
        bucketLabel: reviewPage?.selectedCard?.bucketLabel,
        dueAt: reviewPage?.selectedCard?.dueAt,
        dueLabel: reviewPage?.selectedCard?.dueLabel,
        effectiveState: reviewPage?.selectedCard?.effectiveState,
        effectiveStateLabel: reviewPage?.selectedCard?.effectiveStateLabel,
        entries: reviewPage?.selectedCard?.entries,
        front: reviewPage?.selectedCard?.front,
        href: reviewPage?.selectedCard?.href,
        id: reviewPage?.selectedCard?.id,
        mediaSlug: reviewPage?.selectedCard?.mediaSlug,
        mediaTitle: reviewPage?.selectedCard?.mediaTitle,
        pronunciations: reviewPage?.selectedCard?.pronunciations,
        rawReviewLabel: reviewPage?.selectedCard?.rawReviewLabel,
        reading: reviewPage?.selectedCard?.reading,
        reviewSeedState: reviewPage?.selectedCard?.reviewSeedState,
        typeLabel: reviewPage?.selectedCard?.typeLabel
      });
      expect(hydratedCard?.gradePreviews).toEqual(
        reviewPage?.selectedCardContext.gradePreviews
      );
      expect(hydratedCard?.gradePreviews).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hydrates a single review card without a separate media lookup", async () => {
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");

    const hydratedCard = await hydrateReviewCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-12T10:00:00.000Z")
    });

    expect(hydratedCard).not.toBeNull();
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();

    mediaFindFirstSpy.mockRestore();
  });

  it("renders furigana markup in review card fronts instead of showing raw braces", async () => {
    await database
      .update(card)
      .set({
        front: "{{語彙|ごい}}",
        back: "lessico; in `{{語彙|ごい}}` indica il vocabolario"
      })
      .where(eq(card.id, developmentFixture.primaryCardId));

    const [reviewPage, reviewDetail] = await Promise.all([
      getReviewPageData(
        developmentFixture.mediaSlug,
        {
          card: developmentFixture.primaryCardId,
          show: "answer"
        },
        database
      ),
      getReviewCardDetailData(
        developmentFixture.mediaSlug,
        developmentFixture.primaryCardId,
        database
      )
    ]);

    expect(reviewPage).not.toBeNull();
    expect(reviewDetail).not.toBeNull();

    const reviewMarkup = renderToStaticMarkup(
      ReviewPage({ data: reviewPage! })
    );
    const detailMarkup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: reviewDetail! })
    );

    expect(reviewMarkup).toContain(
      'review-stage__front jp-inline" lang="ja"><ruby class="app-ruby">'
    );
    expect(reviewMarkup).not.toContain("{{語彙|ごい}}");
    expect(reviewMarkup).toContain(
      'review-stage__back">lessico; in <code class="jp-inline"><ruby class="app-ruby">'
    );
    expect(detailMarkup).toContain(
      'glossary-entry-hero__title jp-inline"><ruby class="app-ruby">'
    );
    expect(detailMarkup).not.toContain("{{語彙|ごい}}");
    expect(detailMarkup).toContain(
      'glossary-entry-hero__meaning">lessico; in <code class="jp-inline"><ruby class="app-ruby">'
    );
  });

  it("preserves a review return target on the detail page when provided", async () => {
    const detail = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detail).not.toBeNull();

    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({
        data: detail!,
        returnTo: "/review?answered=3&card=card-iku" as Route
      })
    );

    expect(markup).toContain('href="/review?answered=3&amp;card=card-iku"');
    expect(markup).toContain("Apri nella sessione");
    expect(markup).toContain("Torna alla Review");
  });

  it("keeps review return targets on glossary links and detail actions", async () => {
    const detail = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detail).not.toBeNull();

    const returnTo = "/review?answered=3&card=card-iku" as Route;
    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({
        data: detail!,
        returnTo
      })
    );

    expect(markup).toContain(
      `href="/glossary?media=${developmentFixture.mediaSlug}&amp;returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku"`
    );
    expect(markup).toContain(
      `href="/glossary/term/%E8%A1%8C%E3%81%8F?media=${developmentFixture.mediaSlug}&amp;source=${developmentFixture.termId}&amp;returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku"`
    );
    expect(markup).toContain(
      'name="returnTo" value="/review?answered=3&amp;card=card-iku"'
    );
  });

  it("can hide furigana on the review front until the answer is revealed", async () => {
    await database
      .update(card)
      .set({
        front: "{{語彙|ごい}}"
      })
      .where(eq(card.id, developmentFixture.primaryCardId));

    await updateStudySettings(
      {
        reviewFrontFurigana: false
      },
      database
    );

    const [frontHiddenPage, revealedPage] = await Promise.all([
      getReviewPageData(
        developmentFixture.mediaSlug,
        {
          card: developmentFixture.primaryCardId
        },
        database
      ),
      getReviewPageData(
        developmentFixture.mediaSlug,
        {
          card: developmentFixture.primaryCardId,
          show: "answer"
        },
        database
      )
    ]);

    expect(frontHiddenPage).not.toBeNull();
    expect(revealedPage).not.toBeNull();

    const frontHiddenMarkup = renderToStaticMarkup(
      ReviewPage({ data: frontHiddenPage! })
    );
    const revealedMarkup = renderToStaticMarkup(
      ReviewPage({ data: revealedPage! })
    );

    expect(frontHiddenMarkup).toContain(
      'review-stage__front jp-inline" lang="ja">語彙</h2>'
    );
    expect(frontHiddenMarkup).not.toContain(
      'review-stage__front jp-inline" lang="ja"><ruby class="app-ruby">'
    );
    expect(frontHiddenMarkup).not.toContain("{{語彙|ごい}}");
    expect(revealedMarkup).toContain(
      'review-stage__front jp-inline" lang="ja"><ruby class="app-ruby">'
    );
  });

  it("renders grading actions from easy to again with next-review previews", async () => {
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId,
        show: "answer"
      },
      database
    );

    expect(reviewPage?.selectedCardContext.gradePreviews).toHaveLength(4);
    expect(reviewPage?.selectedCard?.gradePreviews).toEqual([]);
    expect(
      reviewPage?.queue.advanceCards.every(
        (card) => card.gradePreviews.length === 0
      )
    ).toBe(true);
    expect(
      reviewPage?.selectedCardContext.gradePreviews.map(
        (preview) => preview.rating
      )
    ).toEqual(["again", "hard", "good", "easy"]);

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));
    const easyIndex = markup.indexOf(">Easy<");
    const goodIndex = markup.indexOf(">Good<");
    const hardIndex = markup.indexOf(">Hard<");
    const againIndex = markup.indexOf(">Again<");

    expect(easyIndex).toBeGreaterThan(-1);
    expect(goodIndex).toBeGreaterThan(easyIndex);
    expect(hardIndex).toBeGreaterThan(goodIndex);
    expect(againIndex).toBeGreaterThan(hardIndex);
    expect(markup).toContain("Prossima review:");
    expect(
      reviewPage?.selectedCardContext.gradePreviews.every(
        (preview) => preview.nextReviewLabel.length > 0
      )
    ).toBe(true);
  });

  it("keeps the review page focused on the active card instead of rendering the lower queue panels", async () => {
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId
      },
      database
    );

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));

    expect(markup).not.toContain("Pronte oggi");
    expect(markup).not.toContain("Contesto utile");
    expect(markup).not.toContain("Fuori coda");
  });

  it("shows the reopen action for suspended cards in the review detail page", async () => {
    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:00:00.000Z"),
      status: "ignored"
    });

    const detailData = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detailData?.card.reviewLabel).toBe("Sospesa");

    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: detailData! })
    );

    expect(markup).toContain("Rimetti in studio");
    expect(markup).not.toContain("Segna già nota");
  });

  it("surfaces shared cross-media siblings while keeping local review card ids stable", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

    const [alphaQueue, betaDetail, hydratedBetaCard] = await Promise.all([
      getReviewQueueSnapshotForMedia(
        crossMediaFixture.alpha.mediaSlug,
        database
      ),
      getReviewCardDetailData(
        crossMediaFixture.beta.mediaSlug,
        crossMediaFixture.beta.termCardId,
        database
      ),
      hydrateReviewCard({
        cardId: crossMediaFixture.beta.termCardId,
        database
      })
    ]);

    expect(alphaQueue?.cards.map((card) => card.id)).toContain(
      crossMediaFixture.alpha.termCardId
    );
    expect(betaDetail?.entries[0]?.id).toBe(
      crossMediaFixture.beta.termSourceId
    );
    expect(betaDetail?.entries[0]?.meaning).toBe(
      crossMediaFixture.beta.termMeaning
    );
    expect(betaDetail?.entries[0]?.href).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.beta.mediaSlug,
        "term",
        "コスト",
        crossMediaFixture.beta.termSourceId
      )
    );
    expect(betaDetail?.crossMedia).toHaveLength(1);
    expect(betaDetail?.crossMedia[0]?.siblings[0]?.href).toBe(
      expectedGlossaryEntryHref(
        crossMediaFixture.alpha.mediaSlug,
        "term",
        "コスト",
        crossMediaFixture.alpha.termSourceId
      )
    );
    expect(betaDetail?.card.back).toContain(
      crossMediaFixture.alpha.termMeaning
    );
    expect(betaDetail?.card.back).toContain(crossMediaFixture.beta.termMeaning);
    expect(hydratedBetaCard?.back).toContain(
      crossMediaFixture.alpha.termMeaning
    );
    expect(hydratedBetaCard?.back).toContain(
      crossMediaFixture.beta.termMeaning
    );

    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: betaDetail! })
    );

    expect(markup).toContain("Altri media in cui compare");
    expect(markup).toContain(crossMediaFixture.alpha.termMeaning);
  });
});
