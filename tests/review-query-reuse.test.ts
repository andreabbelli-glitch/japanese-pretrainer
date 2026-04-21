import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as dataCacheModule from "@/lib/data-cache";
import * as dbModule from "@/db";
import * as fsrsOptimizerModule from "@/lib/fsrs-optimizer";
import * as reviewCardHydrationModule from "@/lib/review-card-hydration";
import * as settingsModule from "@/lib/settings";
import {
  closeDatabaseClient,
  card,
  cardEntryLink,
  createDatabaseClient,
  developmentFixture,
  lessonProgress,
  media,
  reviewSubjectState,
  runMigrations,
  seedDevelopmentDatabase,
  term,
  type DatabaseClient
} from "@/db";
import {
  getReviewCardDetailData,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  hydrateReviewCard,
  loadGlobalReviewOverviewSnapshot,
  loadReviewLaunchCandidatesCached,
  loadReviewOverviewSnapshots
} from "@/lib/review";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import { importContentWorkspace } from "@/lib/content/importer";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForTruthy(
  predicate: () => boolean,
  message: string,
  attempts = 50
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(message);
}

describe("review media query reuse", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-query-reuse-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("builds the media review page from the loaded media rows without a slug lookup", async () => {
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");
    const mediaFindManySpy = vi.spyOn(database.query.media, "findMany");

    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(pageData).not.toBeNull();
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();
    expect(mediaFindManySpy).toHaveBeenCalledTimes(1);

    mediaFindFirstSpy.mockRestore();
    mediaFindManySpy.mockRestore();
  });

  it("starts the settings lookup before the media list settles when the media is already resolved", async () => {
    const mediaGate = createDeferred();
    const settingsGate = createDeferred();
    let mediaStarted = false;
    let settingsStarted = false;
    const resolvedMedia = await dataCacheModule.getMediaBySlugCached(
      database,
      developmentFixture.mediaSlug
    );

    expect(resolvedMedia).not.toBeNull();

    const originalListMediaCached = dataCacheModule.listMediaCached;
    const originalGetStudySettings = settingsModule.getStudySettings;
    const mediaLookupSpy = vi
      .spyOn(dataCacheModule, "listMediaCached")
      .mockImplementation(async (...args) => {
        mediaStarted = true;
        const resultPromise = originalListMediaCached(...args);
        await mediaGate.promise;
        return resultPromise;
      });
    const settingsLookupSpy = vi
      .spyOn(settingsModule, "getStudySettings")
      .mockImplementation(async (...args) => {
        settingsStarted = true;
        const resultPromise = originalGetStudySettings(...args);
        await settingsGate.promise;
        return resultPromise;
      });

    const pageDataPromise = getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database,
      {
        resolvedMedia
      }
    );

    await Promise.resolve();
    await Promise.resolve();

    try {
      expect(mediaStarted).toBe(true);
      expect(settingsStarted).toBe(true);
    } finally {
      mediaGate.resolve();
      settingsGate.resolve();
      await pageDataPromise;
      mediaLookupSpy.mockRestore();
      settingsLookupSpy.mockRestore();
    }
  });

  it("builds the media queue snapshot from the loaded media rows without a slug lookup", async () => {
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");
    const mediaFindManySpy = vi.spyOn(database.query.media, "findMany");

    const queueSnapshot = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(queueSnapshot).not.toBeNull();
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();
    expect(mediaFindManySpy).toHaveBeenCalledTimes(1);

    mediaFindFirstSpy.mockRestore();
    mediaFindManySpy.mockRestore();
  });

  it("builds the review card detail without a separate media slug lookup", async () => {
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");

    const detailData = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detailData).not.toBeNull();
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();

    mediaFindFirstSpy.mockRestore();
  });

  it("builds the review card detail without loading FSRS settings", async () => {
    const userSettingFindManySpy = vi.spyOn(
      database.query.userSetting,
      "findMany"
    );

    const detailData = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detailData).not.toBeNull();
    expect(userSettingFindManySpy).not.toHaveBeenCalled();

    userSettingFindManySpy.mockRestore();
  });

  it("starts cross-media detail lookups before the review subject state settles", async () => {
    const subjectStateGate = createDeferred();
    const crossMediaGate = createDeferred();
    let subjectStateStarted = false;
    let crossMediaStarted = false;

    const originalGetReviewSubjectStateByKey = dbModule.getReviewSubjectStateByKey;
    const originalListCrossMediaFamiliesByEntryIds =
      dbModule.listCrossMediaFamiliesByEntryIds;
    const subjectStateSpy = vi
      .spyOn(dbModule, "getReviewSubjectStateByKey")
      .mockImplementation(async (...args) => {
        subjectStateStarted = true;
        const resultPromise = originalGetReviewSubjectStateByKey(...args);
        await subjectStateGate.promise;
        return resultPromise;
      });
    const crossMediaSpy = vi
      .spyOn(dbModule, "listCrossMediaFamiliesByEntryIds")
      .mockImplementation(async (...args) => {
        crossMediaStarted = true;
        const resultPromise = originalListCrossMediaFamiliesByEntryIds(...args);
        await crossMediaGate.promise;
        return resultPromise;
      });

    const detailPromise = getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    try {
      await waitForTruthy(
        () => subjectStateStarted,
        "Expected the review subject lookup to start."
      );
      await flushMicrotasks();

      expect(crossMediaStarted).toBe(true);
    } finally {
      subjectStateGate.resolve();
      crossMediaGate.resolve();
      await detailPromise;
      subjectStateSpy.mockRestore();
      crossMediaSpy.mockRestore();
    }
  });

  it("starts selected-card pronunciation loading before the FSRS snapshot settles", async () => {
    const fsrsGate = createDeferred();
    const pronunciationsGate = createDeferred();
    let fsrsStarted = false;
    let pronunciationsStarted = false;

    const originalGetFsrsOptimizerRuntimeSnapshot =
      fsrsOptimizerModule.getFsrsOptimizerRuntimeSnapshot;
    const originalLoadReviewCardPronunciations =
      reviewCardHydrationModule.loadReviewCardPronunciations;
    const fsrsSnapshotSpy = vi
      .spyOn(fsrsOptimizerModule, "getFsrsOptimizerRuntimeSnapshot")
      .mockImplementation(async (...args) => {
        fsrsStarted = true;
        const resultPromise = originalGetFsrsOptimizerRuntimeSnapshot(...args);
        await fsrsGate.promise;
        return resultPromise;
      });
    const pronunciationsSpy = vi
      .spyOn(reviewCardHydrationModule, "loadReviewCardPronunciations")
      .mockImplementation(async (...args) => {
        pronunciationsStarted = true;
        const resultPromise = originalLoadReviewCardPronunciations(...args);
        await pronunciationsGate.promise;
        return resultPromise;
      });

    const pageDataPromise = getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    try {
      await waitForTruthy(
        () => fsrsStarted,
        "Expected the FSRS snapshot lookup to start."
      );
      await flushMicrotasks();

      expect(pronunciationsStarted).toBe(true);
    } finally {
      fsrsGate.resolve();
      pronunciationsGate.resolve();
      await pageDataPromise;
      fsrsSnapshotSpy.mockRestore();
      pronunciationsSpy.mockRestore();
    }
  });

  it("does not expose review card detail for archived media slugs", async () => {
    await database
      .update(media)
      .set({ status: "archived" })
      .where(eq(media.id, developmentFixture.mediaId));

    const detailData = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detailData).toBeNull();
  });

  it("hydrates a single review card with one FSRS settings read when the cache path is enabled", async () => {
    const canUseDataCacheSpy = vi
      .spyOn(dataCacheModule, "canUseDataCache")
      .mockReturnValue(true);
    const runWithTaggedCacheSpy = vi
      .spyOn(dataCacheModule, "runWithTaggedCache")
      .mockImplementation(async ({ loader }) => loader());
    const userSettingFindManySpy = vi.spyOn(
      database.query.userSetting,
      "findMany"
    );

    const hydratedCard = await hydrateReviewCard({
      cardId: developmentFixture.primaryCardId,
      database
    });

    expect(hydratedCard).not.toBeNull();
    expect(userSettingFindManySpy).toHaveBeenCalledTimes(1);

    userSettingFindManySpy.mockRestore();
    runWithTaggedCacheSpy.mockRestore();
    canUseDataCacheSpy.mockRestore();
  });

  it("builds the global review overview from a single raw overview query", async () => {
    const databaseAllSpy = vi.spyOn(
      database as DatabaseClient & {
        all: (sql: string) => Promise<unknown[]>;
      },
      "all"
    );

    const overview = await loadGlobalReviewOverviewSnapshot(database);

    expect(overview.queueCount).toBeGreaterThanOrEqual(0);
    expect(
      databaseAllSpy.mock.calls.filter(
        ([sql]) =>
          typeof sql === "string" &&
          sql.includes("global_subject_card_candidates")
      )
    ).toHaveLength(1);

    databaseAllSpy.mockRestore();
  });

  it("keeps the global next-card front on the earliest due media even when alphabetical order disagrees", async () => {
    const contentRoot = path.join(tempDir, "cross-media-overview-content");

    await writeCrossMediaContentFixture(contentRoot);

    const importResult = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(importResult.status).toBe("completed");

    await database.insert(lessonProgress).values([
      {
        lessonId: crossMediaFixture.alpha.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      },
      {
        lessonId: crossMediaFixture.beta.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      }
    ]);

    await database.update(reviewSubjectState).set({
      dueAt: "2999-01-01T00:00:00.000Z"
    });

    const alphaTermId = "term_review_query_reuse_alpha_launch";
    const betaTermId = "term_review_query_reuse_beta_launch";
    const alphaCardId = "card_review_query_reuse_alpha_launch";
    const betaCardId = "card_review_query_reuse_beta_launch";
    const alphaDueAt = "2000-01-02T00:00:00.000Z";
    const betaDueAt = "2000-01-01T00:00:00.000Z";

    await database.insert(term).values([
      {
        id: alphaTermId,
        sourceId: "review-query-reuse-alpha-launch",
        crossMediaGroupId: null,
        mediaId: crossMediaFixture.alpha.mediaId,
        segmentId: null,
        lemma: "アルファ遅い",
        reading: "あるふぁおそい",
        romaji: "arufuaosoi",
        meaningIt: "termine alpha con scadenza più lenta",
        meaningLiteralIt: null,
        notesIt: null,
        levelHint: null,
        audioSrc: null,
        audioSource: null,
        audioSpeaker: null,
        audioLicense: null,
        audioAttribution: null,
        audioPageUrl: null,
        pitchAccent: null,
        pitchAccentSource: null,
        pitchAccentPageUrl: null,
        searchLemmaNorm: "アルファ遅い",
        searchReadingNorm: "あるふぁおそい",
        searchRomajiNorm: "arufuaosoi",
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-11T08:00:00.000Z"
      },
      {
        id: betaTermId,
        sourceId: "review-query-reuse-beta-launch",
        crossMediaGroupId: null,
        mediaId: crossMediaFixture.beta.mediaId,
        segmentId: null,
        lemma: "ベータ早い",
        reading: "べーたはやい",
        romaji: "beetahayai",
        meaningIt: "termine beta con scadenza più rapida",
        meaningLiteralIt: null,
        notesIt: null,
        levelHint: null,
        audioSrc: null,
        audioSource: null,
        audioSpeaker: null,
        audioLicense: null,
        audioAttribution: null,
        audioPageUrl: null,
        pitchAccent: null,
        pitchAccentSource: null,
        pitchAccentPageUrl: null,
        searchLemmaNorm: "ベータ早い",
        searchReadingNorm: "べーたはやい",
        searchRomajiNorm: "beetahayai",
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-11T08:00:00.000Z"
      }
    ]);

    await database.insert(card).values([
      {
        id: alphaCardId,
        mediaId: crossMediaFixture.alpha.mediaId,
        lessonId: crossMediaFixture.alpha.lessonId,
        segmentId: null,
        sourceFile: "tests/fixtures/db/cross-media-overview/alpha-launch.md",
        cardType: "recognition",
        front: "アルファ遅い",
        back: "termine alpha con scadenza più lenta",
        notesIt: null,
        status: "active",
        orderIndex: 90,
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-11T08:00:00.000Z"
      },
      {
        id: betaCardId,
        mediaId: crossMediaFixture.beta.mediaId,
        lessonId: crossMediaFixture.beta.lessonId,
        segmentId: null,
        sourceFile: "tests/fixtures/db/cross-media-overview/beta-launch.md",
        cardType: "recognition",
        front: "ベータ早い",
        back: "termine beta con scadenza più rapida",
        notesIt: null,
        status: "active",
        orderIndex: 90,
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-11T08:00:00.000Z"
      }
    ]);

    await database.insert(cardEntryLink).values([
      {
        id: "card_entry_link_review_query_reuse_alpha_launch",
        cardId: alphaCardId,
        entryType: "term",
        entryId: alphaTermId,
        relationshipType: "primary"
      },
      {
        id: "card_entry_link_review_query_reuse_beta_launch",
        cardId: betaCardId,
        entryType: "term",
        entryId: betaTermId,
        relationshipType: "primary"
      }
    ]);

    await database.insert(reviewSubjectState).values([
      {
        subjectKey: `entry:term:${alphaTermId}`,
        subjectType: "entry",
        entryType: "term",
        crossMediaGroupId: null,
        entryId: alphaTermId,
        cardId: alphaCardId,
        state: "review",
        dueAt: alphaDueAt,
        lastInteractionAt: alphaDueAt,
        createdAt: alphaDueAt,
        updatedAt: alphaDueAt
      },
      {
        subjectKey: `entry:term:${betaTermId}`,
        subjectType: "entry",
        entryType: "term",
        crossMediaGroupId: null,
        entryId: betaTermId,
        cardId: betaCardId,
        state: "review",
        dueAt: betaDueAt,
        lastInteractionAt: betaDueAt,
        createdAt: betaDueAt,
        updatedAt: betaDueAt
      }
    ]);

    const overviewFromDb = await loadGlobalReviewOverviewSnapshot(database);

    expect(overviewFromDb.dueCount).toBe(2);
    expect(overviewFromDb.nextCardFront).toBe("ベータ早い");
  });

  it("keeps launch candidates media-local for shared review subjects across media", async () => {
    const contentRoot = path.join(tempDir, "cross-media-launch-content");

    await writeCrossMediaContentFixture(contentRoot);

    const importResult = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(importResult.status).toBe("completed");

    await database.insert(lessonProgress).values([
      {
        lessonId: crossMediaFixture.alpha.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      },
      {
        lessonId: crossMediaFixture.beta.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      }
    ]);

    await database.update(reviewSubjectState).set({
      dueAt: "2999-01-01T00:00:00.000Z"
    });

    const sharedSubjectState =
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.cardId, crossMediaFixture.alpha.termCardId)
      });

    expect(sharedSubjectState).not.toBeNull();

    await database
      .update(reviewSubjectState)
      .set({
        state: "review",
        dueAt: "2000-01-01T00:00:00.000Z",
        lastReviewedAt: "2026-03-10T08:00:00.000Z",
        lastInteractionAt: "2026-03-10T08:00:00.000Z",
        manualOverride: false,
        suspended: false
      })
      .where(eq(reviewSubjectState.subjectKey, sharedSubjectState!.subjectKey));

    const [candidates, globalReviewOverview] = await Promise.all([
      loadReviewLaunchCandidatesCached(database),
      loadGlobalReviewOverviewSnapshot(database)
    ]);

    const candidatesByMediaId = new Map(
      candidates.map((candidate) => [candidate.mediaId, candidate])
    );

    expect(globalReviewOverview.dueCount).toBe(1);
    expect(
      candidatesByMediaId.get(crossMediaFixture.alpha.mediaId)?.dueCount
    ).toBe(1);
    expect(
      candidatesByMediaId.get(crossMediaFixture.beta.mediaId)?.dueCount
    ).toBe(1);
  });

  it("builds a single-media overview snapshot without hydrating the full review workspace", async () => {
    const reviewCardsSpy = vi.spyOn(dbModule, "listReviewCardsByMediaIds");
    const termsSpy = vi.spyOn(dbModule, "listTermEntryReviewSummariesByIds");
    const grammarSpy = vi.spyOn(
      dbModule,
      "listGrammarEntryReviewSummariesByIds"
    );

    const snapshots = await loadReviewOverviewSnapshots(database, [
      {
        id: developmentFixture.mediaId,
        slug: developmentFixture.mediaSlug
      }
    ]);

    expect(
      snapshots.get(developmentFixture.mediaId)?.queueCount
    ).toBeGreaterThanOrEqual(0);
    expect(reviewCardsSpy).not.toHaveBeenCalled();
    expect(termsSpy).not.toHaveBeenCalled();
    expect(grammarSpy).not.toHaveBeenCalled();

    reviewCardsSpy.mockRestore();
    termsSpy.mockRestore();
    grammarSpy.mockRestore();
  });

  it("keeps the single-media overview next card aligned with the canonical representative when subject state has no pinned card", async () => {
    await database.insert(card).values({
      id: "card_fixture_iku_newer",
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/iku-newer.md",
      cardType: "recognition",
      front: "行った",
      normalizedFront: "行った",
      back: "andato",
      exampleJp: null,
      exampleIt: null,
      notesIt: "Sibling card for representative-card ordering coverage.",
      status: "active",
      orderIndex: 99,
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-10T09:30:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_iku_newer_primary",
      cardId: "card_fixture_iku_newer",
      entryType: "term",
      entryId: developmentFixture.termDbId,
      relationshipType: "primary"
    });
    await database
      .update(reviewSubjectState)
      .set({
        cardId: null,
        state: "review",
        dueAt: "2000-01-01T00:00:00.000Z",
        lastInteractionAt: "2026-03-10T08:00:00.000Z"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    const snapshots = await loadReviewOverviewSnapshots(database, [
      {
        id: developmentFixture.mediaId,
        slug: developmentFixture.mediaSlug
      }
    ]);

    expect(snapshots.get(developmentFixture.mediaId)?.nextCardFront).toBe(
      "行った"
    );
  });
});
