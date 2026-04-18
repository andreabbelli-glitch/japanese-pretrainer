import path from "node:path";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  createDatabaseClient,
  getMediaBySlug,
  grammarPattern,
  lesson,
  lessonProgress,
  media,
  runMigrations,
  term,
  type DatabaseClient
} from "@/db";
import { parseContentRoot } from "@/lib/content/validator";
import type { NormalizedMediaBundle } from "@/lib/content/types";
import {
  executePronunciationResolveForBundle,
  parseTextbookLessonUrl,
  selectPronunciationResolveTargets
} from "@/lib/pronunciation-resolve";
import type { PronunciationTargetEntry } from "@/lib/pronunciation-shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "fixtures", "content");
const validContentRoot = path.join(fixturesRoot, "valid", "content");
const NOW = "2026-04-18T09:00:00.000Z";

describe("pronunciation resolve", () => {
  let contentRoot = "";
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pronunciation-resolve-"));
    contentRoot = path.join(tempDir, "content");
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await cp(validContentRoot, contentRoot, { recursive: true });
    await seedSampleGameContent(contentRoot);
    await seedResolveDatabase(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { force: true, recursive: true });
    vi.restoreAllMocks();
  });

  it("parses textbook lesson URLs from full URLs and app paths", () => {
    expect(
      parseTextbookLessonUrl(
        "http://localhost:3000/media/sample-game/textbook/next-lesson?foo=1#bar"
      )
    ).toEqual({
      lessonSlug: "next-lesson",
      mediaSlug: "sample-game"
    });

    expect(parseTextbookLessonUrl("/media/sample-game/textbook/next-lesson")).toEqual({
      lessonSlug: "next-lesson",
      mediaSlug: "sample-game"
    });
  });

  it("rejects non-textbook routes while parsing lesson URLs", () => {
    expect(() =>
      parseTextbookLessonUrl("/media/sample-game/glossary/term/term-kiku")
    ).toThrow("Unsupported lesson URL");
  });

  it("selects review targets globally and deduplicates linked entries", async () => {
    const selection = await selectPronunciationResolveTargets({
      contentRoot,
      database,
      mode: "review"
    });

    expect(selection.mode).toBe("review");
    expect(selection.selectedMediaSlugs.sort()).toEqual([
      "sample-anime",
      "sample-game"
    ]);
    expect(selection.bundles.map((bundle) => bundle.bundle.mediaSlug).sort()).toEqual([
      "sample-anime",
      "sample-game"
    ]);

    const animeTargets =
      selection.bundles.find((bundle) => bundle.bundle.mediaSlug === "sample-anime")
        ?.targets ?? [];
    const gameTargets =
      selection.bundles.find((bundle) => bundle.bundle.mediaSlug === "sample-game")
        ?.targets ?? [];

    expect(animeTargets.map((entry) => `${entry.kind}:${entry.id}`).sort()).toEqual([
      "grammar:grammar-teiru",
      "term:term-taberu"
    ]);
    expect(gameTargets.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      "term:term-miru"
    ]);
  });

  it("selects review targets for one media only when filtered", async () => {
    const selection = await selectPronunciationResolveTargets({
      contentRoot,
      database,
      mediaSlug: "sample-anime",
      mode: "review"
    });

    expect(selection.selectedMediaSlugs).toEqual(["sample-anime"]);
    expect(selection.bundles).toHaveLength(1);
    expect(selection.bundles[0]?.targets.map((entry) => `${entry.kind}:${entry.id}`).sort()).toEqual([
      "grammar:grammar-teiru",
      "term:term-taberu"
    ]);
  });

  it("selects the first non-completed lesson for next-lesson mode", async () => {
    const selection = await selectPronunciationResolveTargets({
      contentRoot,
      database,
      mediaSlug: "sample-game",
      mode: "next-lesson"
    });

    expect(selection.mode).toBe("next-lesson");
    expect(selection.bundles).toHaveLength(1);
    expect(selection.bundles[0]?.lessonSlug).toBe("next-lesson");
    expect(
      selection.bundles[0]?.targets.map((entry) => `${entry.kind}:${entry.id}`)
    ).toEqual(["term:term-kiku", "term:term-yomu"]);
  });

  it("selects lesson targets from a textbook page URL", async () => {
    const selection = await selectPronunciationResolveTargets({
      contentRoot,
      database,
      lessonUrl: "http://localhost:3000/media/sample-game/textbook/next-lesson",
      mode: "lesson-url"
    });

    expect(selection.mode).toBe("lesson-url");
    expect(selection.bundles).toHaveLength(1);
    expect(selection.bundles[0]?.bundle.mediaSlug).toBe("sample-game");
    expect(selection.bundles[0]?.lessonSlug).toBe("next-lesson");
    expect(
      selection.bundles[0]?.targets.map((entry) => `${entry.kind}:${entry.id}`)
    ).toEqual(["term:term-kiku", "term:term-yomu"]);
  });

  it("runs reuse, offline fetch, and Forvo only on the unresolved remainder", async () => {
    const bundle = await loadBundle(contentRoot, "sample-game");
    const selectedTargets: PronunciationTargetEntry[] = [
      createTarget(bundle, "term", "term-miru"),
      createTarget(bundle, "term", "term-kiku"),
      createTarget(bundle, "term", "term-yomu")
    ];

    const refreshSpy = vi.fn(async () => bundle);
    const reuseSpy = vi.fn(async () => ({
      ambiguous: 0,
      reused: 1,
      results: [
        {
          entryId: "term-miru",
          kind: "term" as const,
          sourceEntryId: "term-taberu",
          sourceMediaSlug: "sample-anime",
          status: "reused" as const
        }
      ]
    }));
    const offlineSpy = vi.fn(async () => ({
      matched: 1,
      missed: 1,
      results: [
        {
          entryId: "term-kiku",
          fileTitle: "File:Ja-kiku.ogg",
          kind: "term" as const,
          status: "matched" as const
        },
        {
          entryId: "term-yomu",
          kind: "term" as const,
          status: "miss" as const
        }
      ]
    }));
    const forvoSpy = vi.fn(async () => ({
      knownMissingSkipped: [],
      matched: 1,
      missed: 0,
      requestedUnresolved: [],
      results: [
        {
          entryId: "term-yomu",
          kind: "term" as const,
          speaker: "Test Speaker",
          status: "matched" as const,
          votes: 5
        }
      ]
    }));
    const pendingSpy = vi.fn(async () => ({
      audioBackedCount: 3,
      knownMissingCount: 0,
      mediaSlug: "sample-game",
      pending: [],
      pendingCount: 0,
      totalTargets: 3,
      workflowFilePath: path.join(bundle.mediaDirectory, "workflow", "pronunciation-pending.json")
    }));

    const summary = await executePronunciationResolveForBundle({
      bundle,
      dryRun: false,
      fetchOffline: offlineSpy,
      fetchForvoManual: forvoSpy,
      knownMissingEntryIds: new Set(),
      refreshBundleState: refreshSpy,
      reuseCrossMedia: reuseSpy,
      reuseContext: { audioBackedEntries: [] },
      selectedTargets,
      updatePendingSummary: pendingSpy
    });

    expect(reuseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onlyTargets: expect.arrayContaining([
          expect.objectContaining({ id: "term-kiku" }),
          expect.objectContaining({ id: "term-miru" }),
          expect.objectContaining({ id: "term-yomu" })
        ])
      })
    );
    expect(offlineSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onlyTargets: expect.arrayContaining([
          expect.objectContaining({ id: "term-kiku" }),
          expect.objectContaining({ id: "term-yomu" })
        ])
      })
    );
    expect(forvoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entryIds: ["term-yomu"]
      })
    );
    expect(refreshSpy).toHaveBeenCalledTimes(3);
    expect(pendingSpy).toHaveBeenCalledOnce();
    expect(summary.finalEntryIds).toEqual(["term-yomu"]);
    expect(summary.reuseSummary.reused).toBe(1);
    expect(summary.offlineSummary.matched).toBe(1);
    expect(summary.forvoSummary?.matched).toBe(1);
  });

  it("applies limit after dropping already audio-backed targets", async () => {
    const bundle = await loadBundle(contentRoot, "sample-game");
    const audioBackedTarget = createTarget(
      await loadBundle(contentRoot, "sample-anime"),
      "term",
      "term-taberu"
    );
    const unresolvedTarget = createTarget(bundle, "term", "term-kiku");
    const reuseSpy = vi.fn(async () => ({
      ambiguous: 0,
      reused: 0,
      results: []
    }));
    const offlineSpy = vi.fn(async () => ({
      matched: 0,
      missed: 1,
      results: [
        {
          entryId: "term-kiku",
          kind: "term" as const,
          status: "miss" as const
        }
      ]
    }));
    const forvoSpy = vi.fn(async () => ({
      knownMissingSkipped: [],
      matched: 1,
      missed: 0,
      requestedUnresolved: [],
      results: [
        {
          entryId: "term-kiku",
          kind: "term" as const,
          speaker: "Test Speaker",
          status: "matched" as const,
          votes: 5
        }
      ]
    }));

    const summary = await executePronunciationResolveForBundle({
      bundle,
      dryRun: false,
      fetchOffline: offlineSpy,
      fetchForvoManual: forvoSpy,
      knownMissingEntryIds: new Set(),
      refreshBundleState: vi.fn(async () => bundle),
      reuseCrossMedia: reuseSpy,
      reuseContext: { audioBackedEntries: [] },
      selectedTargets: [audioBackedTarget, unresolvedTarget],
      limit: 1,
      updatePendingSummary: vi.fn(async () => ({
        audioBackedCount: 1,
        knownMissingCount: 0,
        mediaSlug: "sample-game",
        pending: [],
        pendingCount: 0,
        totalTargets: 1,
        workflowFilePath: path.join(bundle.mediaDirectory, "workflow", "pronunciation-pending.json")
      }))
    });

    expect(reuseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onlyTargets: [expect.objectContaining({ id: "term-kiku" })]
      })
    );
    expect(offlineSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        onlyTargets: [expect.objectContaining({ id: "term-kiku" })]
      })
    );
    expect(forvoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entryIds: ["term-kiku"]
      })
    );
    expect(summary.finalEntryIds).toEqual(["term-kiku"]);
  });

  it("skips known-missing entries before the Forvo step", async () => {
    const bundle = await loadBundle(contentRoot, "sample-game");
    const forvoSpy = vi.fn();

    const summary = await executePronunciationResolveForBundle({
      bundle,
      dryRun: false,
      fetchOffline: vi.fn(async () => ({
        matched: 0,
        missed: 1,
        results: [
          {
            entryId: "term-yomu",
            kind: "term" as const,
            status: "miss" as const
          }
        ]
      })),
      fetchForvoManual: forvoSpy,
      knownMissingEntryIds: new Set(["term:term-yomu"]),
      refreshBundleState: vi.fn(async () => bundle),
      reuseCrossMedia: vi.fn(async () => ({
        ambiguous: 0,
        reused: 0,
        results: []
      })),
      reuseContext: { audioBackedEntries: [] },
      selectedTargets: [createTarget(bundle, "term", "term-yomu")],
      updatePendingSummary: vi.fn(async () => ({
        audioBackedCount: 0,
        knownMissingCount: 1,
        mediaSlug: "sample-game",
        pending: [],
        pendingCount: 0,
        totalTargets: 1,
        workflowFilePath: path.join(bundle.mediaDirectory, "workflow", "pronunciation-pending.json")
      }))
    });

    expect(forvoSpy).not.toHaveBeenCalled();
    expect(summary.finalEntryIds).toEqual([]);
    expect(summary.knownMissingSkipped).toEqual(["term-yomu"]);
  });

  it("retries known-missing entries when retry is enabled", async () => {
    const bundle = await loadBundle(contentRoot, "sample-game");
    const forvoSpy = vi.fn(async () => ({
      knownMissingSkipped: [],
      matched: 1,
      missed: 0,
      requestedUnresolved: [],
      results: [
        {
          entryId: "term-yomu",
          kind: "term" as const,
          speaker: "Test Speaker",
          status: "matched" as const,
          votes: 5
        }
      ]
    }));

    const summary = await executePronunciationResolveForBundle({
      bundle,
      dryRun: false,
      fetchOffline: vi.fn(async () => ({
        matched: 0,
        missed: 1,
        results: [
          {
            entryId: "term-yomu",
            kind: "term" as const,
            status: "miss" as const
          }
        ]
      })),
      fetchForvoManual: forvoSpy,
      knownMissingEntryIds: new Set(["term:term-yomu"]),
      refreshBundleState: vi.fn(async () => bundle),
      reuseCrossMedia: vi.fn(async () => ({
        ambiguous: 0,
        reused: 0,
        results: []
      })),
      reuseContext: { audioBackedEntries: [] },
      retryKnownMissing: true,
      selectedTargets: [createTarget(bundle, "term", "term-yomu")],
      updatePendingSummary: vi.fn(async () => ({
        audioBackedCount: 1,
        knownMissingCount: 0,
        mediaSlug: "sample-game",
        pending: [],
        pendingCount: 0,
        totalTargets: 1,
        workflowFilePath: path.join(bundle.mediaDirectory, "workflow", "pronunciation-pending.json")
      }))
    } as Parameters<typeof executePronunciationResolveForBundle>[0]);

    expect(forvoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entryIds: ["term-yomu"]
      })
    );
    expect(summary.finalEntryIds).toEqual(["term-yomu"]);
    expect(summary.knownMissingSkipped).toEqual([]);
  });
});

async function loadBundle(contentRoot: string, mediaSlug: string) {
  const parseResult = await parseContentRoot(contentRoot);

  if (!parseResult.ok) {
    throw new Error("Expected valid content fixtures.");
  }

  const bundle = parseResult.data.bundles.find(
    (candidate) => candidate.mediaSlug === mediaSlug
  );

  if (!bundle) {
    throw new Error(`Bundle '${mediaSlug}' not found.`);
  }

  return bundle;
}

function createTarget(
  bundle: NormalizedMediaBundle,
  kind: "term" | "grammar",
  entryId: string
) {
  if (kind === "term") {
    const target = bundle.terms.find((entry) => entry.id === entryId);

    if (!target) {
      throw new Error(`Target '${kind}:${entryId}' not found.`);
    }

    return {
      aliases: target.aliases,
      audioSrc: target.audio?.audioSrc,
      crossMediaGroup: target.crossMediaGroup,
      id: target.id,
      kind,
      label: target.lemma,
      mediaDirectory: bundle.mediaDirectory,
      mediaSlug: bundle.mediaSlug,
      reading: target.reading
    } satisfies PronunciationTargetEntry;
  }

  const target = bundle.grammarPatterns.find((entry) => entry.id === entryId);

  if (!target) {
    throw new Error(`Target '${kind}:${entryId}' not found.`);
  }

  return {
    aliases: target.aliases,
    audioSrc: target.audio?.audioSrc,
    crossMediaGroup: target.crossMediaGroup,
    id: target.id,
    kind,
    label: target.pattern,
    mediaDirectory: bundle.mediaDirectory,
    mediaSlug: bundle.mediaSlug,
    reading: target.reading
  } satisfies PronunciationTargetEntry;
}

async function seedSampleGameContent(contentRoot: string) {
  const mediaDirectory = path.join(contentRoot, "media", "sample-game");
  await mkdir(path.join(mediaDirectory, "textbook"), { recursive: true });
  await mkdir(path.join(mediaDirectory, "cards"), { recursive: true });

  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: media-sample-game
slug: sample-game
title: Sample Game
media_type: game
segment_kind: chapter
language: ja
base_explanation_language: it
status: active
tags: [game]
---

# Sample Game
`
  );

  await writeFile(
    path.join(mediaDirectory, "textbook", "001-intro.md"),
    `---
id: lesson-sample-game-intro
media_id: media-sample-game
slug: intro-lesson
title: Intro Lesson
order: 10
difficulty: n5
status: active
tags: [intro]
prerequisites: []
---

# Intro
`
  );

  await writeFile(
    path.join(mediaDirectory, "textbook", "002-next.md"),
    `---
id: lesson-sample-game-next
media_id: media-sample-game
slug: next-lesson
title: Next Lesson
order: 20
difficulty: n5
status: active
tags: [next]
prerequisites: []
---

# Next
`
  );

  await writeFile(
    path.join(mediaDirectory, "cards", "001-intro.md"),
    `---
id: cards-sample-game-intro
media_id: media-sample-game
slug: intro-core
title: Intro Core
order: 10
---

:::term
id: term-miru
lemma: 見る
reading: みる
romaji: miru
meaning_it: vedere
aliases: [みる, miru]
:::

:::card
id: card-miru-recognition
lesson_id: lesson-sample-game-intro
entry_type: term
entry_id: term-miru
card_type: recognition
front: '{{見|み}}る'
back: vedere
:::
`
  );

  await writeFile(
    path.join(mediaDirectory, "cards", "002-next.md"),
    `---
id: cards-sample-game-next
media_id: media-sample-game
slug: next-core
title: Next Core
order: 20
---

:::term
id: term-kiku
lemma: 聞く
reading: きく
romaji: kiku
meaning_it: ascoltare
aliases: [きく, kiku]
:::

:::term
id: term-yomu
lemma: 読む
reading: よむ
romaji: yomu
meaning_it: leggere
aliases: [よむ, yomu]
:::

:::card
id: card-kiku-recognition
lesson_id: lesson-sample-game-next
entry_type: term
entry_id: term-kiku
card_type: recognition
front: '{{聞|き}}く'
back: ascoltare
:::

:::card
id: card-yomu-recognition
lesson_id: lesson-sample-game-next
entry_type: term
entry_id: term-yomu
card_type: recognition
front: '{{読|よ}}む'
back: leggere
:::
`
  );
}

async function seedResolveDatabase(database: DatabaseClient) {
  await database.insert(media).values([
    {
      baseExplanationLanguage: "it",
      createdAt: NOW,
      description: "Sample Anime",
      id: "media-sample-anime",
      language: "ja",
      mediaType: "anime",
      segmentKind: "episode",
      slug: "sample-anime",
      status: "active",
      title: "Sample Anime",
      updatedAt: NOW
    },
    {
      baseExplanationLanguage: "it",
      createdAt: NOW,
      description: "Sample Game",
      id: "media-sample-game",
      language: "ja",
      mediaType: "game",
      segmentKind: "chapter",
      slug: "sample-game",
      status: "active",
      title: "Sample Game",
      updatedAt: NOW
    }
  ]);

  await database.insert(lesson).values([
    {
      createdAt: NOW,
      difficulty: "n5",
      id: "lesson-sample-anime-ep01-intro",
      mediaId: "media-sample-anime",
      orderIndex: 10,
      segmentId: null,
      slug: "ep01-intro",
      sourceFile: "content/media/sample-anime/textbook/001-intro.md",
      status: "active",
      summary: "Intro",
      title: "Episodio 1 - Introduzione",
      updatedAt: NOW
    },
    {
      createdAt: NOW,
      difficulty: "n5",
      id: "lesson-sample-game-intro",
      mediaId: "media-sample-game",
      orderIndex: 10,
      segmentId: null,
      slug: "intro-lesson",
      sourceFile: "content/media/sample-game/textbook/001-intro.md",
      status: "active",
      summary: "Intro",
      title: "Intro Lesson",
      updatedAt: NOW
    },
    {
      createdAt: NOW,
      difficulty: "n5",
      id: "lesson-sample-game-next",
      mediaId: "media-sample-game",
      orderIndex: 20,
      segmentId: null,
      slug: "next-lesson",
      sourceFile: "content/media/sample-game/textbook/002-next.md",
      status: "active",
      summary: "Next",
      title: "Next Lesson",
      updatedAt: NOW
    }
  ]);

  await database.insert(lessonProgress).values([
    {
      completedAt: NOW,
      lastOpenedAt: NOW,
      lessonId: "lesson-sample-anime-ep01-intro",
      startedAt: NOW,
      status: "completed"
    },
    {
      completedAt: NOW,
      lastOpenedAt: NOW,
      lessonId: "lesson-sample-game-intro",
      startedAt: NOW,
      status: "completed"
    },
    {
      completedAt: null,
      lastOpenedAt: NOW,
      lessonId: "lesson-sample-game-next",
      startedAt: NOW,
      status: "in_progress"
    }
  ]);

  await database.insert(term).values([
    {
      audioAttribution: "Test Native Speaker via Lingua Libre / Wikimedia Commons",
      audioLicense: "CC BY-SA 4.0",
      audioPageUrl:
        "https://commons.wikimedia.org/wiki/File:LL-Q188_(jpn)-Test_Native_Speaker-%E9%A3%9F%E3%81%B9%E3%82%8B.ogg",
      audioSource: "lingua_libre",
      audioSpeaker: "Test Native Speaker",
      audioSrc: "assets/audio/term/term-taberu/term-taberu.ogg",
      createdAt: NOW,
      crossMediaGroupId: null,
      id: "term-taberu",
      lemma: "食べる",
      meaningIt: "mangiare",
      meaningLiteralIt: null,
      mediaId: "media-sample-anime",
      notesIt: null,
      pitchAccent: 2,
      pitchAccentPageUrl: null,
      pitchAccentSource: null,
      pos: null,
      reading: "たべる",
      romaji: "taberu",
      searchLemmaNorm: "食べる",
      searchReadingNorm: "たべる",
      searchRomajiNorm: "taberu",
      segmentId: null,
      sourceId: "term-taberu",
      updatedAt: NOW
    },
    {
      audioAttribution: null,
      audioLicense: null,
      audioPageUrl: null,
      audioSource: null,
      audioSpeaker: null,
      audioSrc: null,
      createdAt: NOW,
      crossMediaGroupId: null,
      id: "term-miru",
      lemma: "見る",
      meaningIt: "vedere",
      meaningLiteralIt: null,
      mediaId: "media-sample-game",
      notesIt: null,
      pitchAccent: null,
      pitchAccentPageUrl: null,
      pitchAccentSource: null,
      pos: null,
      reading: "みる",
      romaji: "miru",
      searchLemmaNorm: "見る",
      searchReadingNorm: "みる",
      searchRomajiNorm: "miru",
      segmentId: null,
      sourceId: "term-miru",
      updatedAt: NOW
    },
    {
      audioAttribution: null,
      audioLicense: null,
      audioPageUrl: null,
      audioSource: null,
      audioSpeaker: null,
      audioSrc: null,
      createdAt: NOW,
      crossMediaGroupId: null,
      id: "term-kiku",
      lemma: "聞く",
      meaningIt: "ascoltare",
      meaningLiteralIt: null,
      mediaId: "media-sample-game",
      notesIt: null,
      pitchAccent: null,
      pitchAccentPageUrl: null,
      pitchAccentSource: null,
      pos: null,
      reading: "きく",
      romaji: "kiku",
      searchLemmaNorm: "聞く",
      searchReadingNorm: "きく",
      searchRomajiNorm: "kiku",
      segmentId: null,
      sourceId: "term-kiku",
      updatedAt: NOW
    },
    {
      audioAttribution: null,
      audioLicense: null,
      audioPageUrl: null,
      audioSource: null,
      audioSpeaker: null,
      audioSrc: null,
      createdAt: NOW,
      crossMediaGroupId: null,
      id: "term-yomu",
      lemma: "読む",
      meaningIt: "leggere",
      meaningLiteralIt: null,
      mediaId: "media-sample-game",
      notesIt: null,
      pitchAccent: null,
      pitchAccentPageUrl: null,
      pitchAccentSource: null,
      pos: null,
      reading: "よむ",
      romaji: "yomu",
      searchLemmaNorm: "読む",
      searchReadingNorm: "よむ",
      searchRomajiNorm: "yomu",
      segmentId: null,
      sourceId: "term-yomu",
      updatedAt: NOW
    }
  ]);

  await database.insert(grammarPattern).values([
    {
      audioAttribution: null,
      audioLicense: null,
      audioPageUrl: null,
      audioSource: null,
      audioSpeaker: null,
      audioSrc: null,
      createdAt: NOW,
      crossMediaGroupId: null,
      id: "grammar-teiru",
      levelHint: null,
      meaningIt: "azione in corso o stato risultante",
      mediaId: "media-sample-anime",
      notesIt: null,
      pattern: "～ている",
      pitchAccent: null,
      pitchAccentPageUrl: null,
      pitchAccentSource: null,
      reading: "ている",
      searchPatternNorm: "ている",
      searchRomajiNorm: "teiru",
      segmentId: null,
      sourceId: "grammar-teiru",
      title: "Forma in -te iru",
      updatedAt: NOW
    }
  ]);

  await database.insert(card).values([
    {
      back: "mangiare",
      cardType: "recognition",
      createdAt: NOW,
      exampleIt: null,
      exampleJp: null,
      front: "食べる",
      id: "card-taberu-recognition",
      lessonId: "lesson-sample-anime-ep01-intro",
      mediaId: "media-sample-anime",
      notesIt: null,
      orderIndex: 1,
      segmentId: null,
      sourceFile: "content/media/sample-anime/cards/001-core.md",
      status: "active",
      updatedAt: NOW
    },
    {
      back: "azione in corso",
      cardType: "concept",
      createdAt: NOW,
      exampleIt: null,
      exampleJp: null,
      front: "～ている",
      id: "card-teiru-concept",
      lessonId: "lesson-sample-anime-ep01-intro",
      mediaId: "media-sample-anime",
      notesIt: null,
      orderIndex: 2,
      segmentId: null,
      sourceFile: "content/media/sample-anime/cards/001-core.md",
      status: "active",
      updatedAt: NOW
    },
    {
      back: "vedere",
      cardType: "recognition",
      createdAt: NOW,
      exampleIt: null,
      exampleJp: null,
      front: "見る",
      id: "card-miru-recognition",
      lessonId: "lesson-sample-game-intro",
      mediaId: "media-sample-game",
      notesIt: null,
      orderIndex: 1,
      segmentId: null,
      sourceFile: "content/media/sample-game/cards/001-intro.md",
      status: "active",
      updatedAt: NOW
    },
    {
      back: "ascoltare",
      cardType: "recognition",
      createdAt: NOW,
      exampleIt: null,
      exampleJp: null,
      front: "聞く",
      id: "card-kiku-recognition",
      lessonId: "lesson-sample-game-next",
      mediaId: "media-sample-game",
      notesIt: null,
      orderIndex: 1,
      segmentId: null,
      sourceFile: "content/media/sample-game/cards/002-next.md",
      status: "active",
      updatedAt: NOW
    },
    {
      back: "leggere",
      cardType: "recognition",
      createdAt: NOW,
      exampleIt: null,
      exampleJp: null,
      front: "読む",
      id: "card-yomu-recognition",
      lessonId: "lesson-sample-game-next",
      mediaId: "media-sample-game",
      notesIt: null,
      orderIndex: 2,
      segmentId: null,
      sourceFile: "content/media/sample-game/cards/002-next.md",
      status: "active",
      updatedAt: NOW
    }
  ]);

  await database.insert(cardEntryLink).values([
    {
      cardId: "card-taberu-recognition",
      entryId: "term-taberu",
      entryType: "term",
      id: "card-entry-taberu-primary",
      relationshipType: "primary"
    },
    {
      cardId: "card-taberu-recognition",
      entryId: "grammar-teiru",
      entryType: "grammar",
      id: "card-entry-taberu-secondary-grammar",
      relationshipType: "secondary"
    },
    {
      cardId: "card-teiru-concept",
      entryId: "grammar-teiru",
      entryType: "grammar",
      id: "card-entry-teiru-primary",
      relationshipType: "primary"
    },
    {
      cardId: "card-miru-recognition",
      entryId: "term-miru",
      entryType: "term",
      id: "card-entry-miru-primary",
      relationshipType: "primary"
    },
    {
      cardId: "card-kiku-recognition",
      entryId: "term-kiku",
      entryType: "term",
      id: "card-entry-kiku-primary",
      relationshipType: "primary"
    },
    {
      cardId: "card-yomu-recognition",
      entryId: "term-yomu",
      entryType: "term",
      id: "card-entry-yomu-primary",
      relationshipType: "primary"
    }
  ]);

  expect(await getMediaBySlug(database, "sample-anime")).not.toBeNull();
}
