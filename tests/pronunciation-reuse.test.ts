import path from "node:path";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseContentRoot } from "@/lib/content/validator";
import { reusePronunciationsAcrossMedia } from "@/lib/pronunciation-reuse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "fixtures", "content");
const validContentRoot = path.join(fixturesRoot, "valid", "content");

describe("pronunciation reuse", () => {
  let tempDir = "";
  let contentRoot = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pronunciation-reuse-"));
    contentRoot = path.join(tempDir, "content");
    await cp(validContentRoot, contentRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reuses audio from another media when lemma and reading match", async () => {
    await seedMedia({
      cardsSource: `---
id: cards-sample-game-ep01
media_id: media-sample-game
slug: ep01-core
title: Episodio 1 - Core cards
order: 10
segment_ref: episode-01
---

:::term
id: term-eat
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
aliases: [たべる, taberu]
:::

:::card
id: card-eat-recognition
entry_type: term
entry_id: term-eat
card_type: recognition
front: 食べる
back: mangiare
:::
`
    });

    const parseResult = await parseContentRoot(contentRoot);
    expect(parseResult.ok).toBe(true);

    const bundle = parseResult.ok
      ? parseResult.data.bundles.find((candidate) => candidate.mediaSlug === "sample-game")
      : undefined;

    expect(bundle).toBeDefined();

    const summary = await reusePronunciationsAcrossMedia({
      allBundles: parseResult.ok ? parseResult.data.bundles : [],
      bundle: bundle!
    });

    expect(summary.reused).toBe(1);
    expect(summary.ambiguous).toBe(0);
    expect(summary.results).toEqual([
      {
        entryId: "term-eat",
        kind: "term",
        sourceEntryId: "term-taberu",
        sourceMediaSlug: "sample-anime",
        status: "reused"
      }
    ]);

    const manifest = JSON.parse(
      await readFile(
        path.join(contentRoot, "media", "sample-game", "pronunciations.json"),
        "utf8"
      )
    );

    expect(manifest.entries).toEqual([
      {
        entry_type: "term",
        entry_id: "term-eat",
        audio_src: "assets/audio/term/term-eat/term-taberu.ogg",
        audio_source: "lingua_libre",
        audio_speaker: "Test Native Speaker",
        audio_license: "CC BY-SA 4.0",
        audio_attribution: "Test Native Speaker via Lingua Libre / Wikimedia Commons",
        audio_page_url:
          "https://commons.wikimedia.org/wiki/File:LL-Q188_(jpn)-Test_Native_Speaker-%E9%A3%9F%E3%81%B9%E3%82%8B.ogg"
      }
    ]);

    await expect(
      stat(
        path.join(
          contentRoot,
          "media",
          "sample-game",
          "assets",
          "audio",
          "term",
          "term-eat",
          "term-taberu.ogg"
        )
      )
    ).resolves.toBeDefined();
  });

  it("stops on ambiguous cross-media matches instead of picking one", async () => {
    await seedMedia({
      cardsSource: `---
id: cards-sample-game-ep01
media_id: media-sample-game
slug: ep01-core
title: Episodio 1 - Core cards
order: 10
segment_ref: episode-01
---

:::term
id: term-eat
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
aliases: [たべる, taberu]
:::
`
    });
    await seedMedia({
      cardsSource: `---
id: cards-sample-manga-ep01
media_id: media-sample-manga
slug: ch01-core
title: Capitolo 1 - Core cards
order: 10
segment_ref: chapter-01
---

:::term
id: term-devour
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: divorare
aliases: [たべる, taberu]
audio_src: assets/audio/term/term-devour/devour.ogg
audio_source: lingua_libre
audio_speaker: Ambiguous Speaker
audio_license: CC BY-SA 4.0
audio_attribution: Ambiguous Speaker via Lingua Libre / Wikimedia Commons
audio_page_url: https://example.com/devour
:::
`
    });
    await mkdir(
      path.join(
        contentRoot,
        "media",
        "sample-manga",
        "assets",
        "audio",
        "term",
        "term-devour"
      ),
      { recursive: true }
    );
    await writeFile(
      path.join(
        contentRoot,
        "media",
        "sample-manga",
        "assets",
        "audio",
        "term",
        "term-devour",
        "devour.ogg"
      ),
      "fake-audio"
    );

    const parseResult = await parseContentRoot(contentRoot);
    expect(parseResult.ok).toBe(true);

    const bundle = parseResult.ok
      ? parseResult.data.bundles.find((candidate) => candidate.mediaSlug === "sample-game")
      : undefined;

    expect(bundle).toBeDefined();

    const summary = await reusePronunciationsAcrossMedia({
      allBundles: parseResult.ok ? parseResult.data.bundles : [],
      bundle: bundle!
    });

    expect(summary.reused).toBe(0);
    expect(summary.ambiguous).toBe(1);
    expect(summary.results).toEqual([
      {
        candidateEntryIds: ["term-taberu", "term-devour"],
        candidateMediaSlugs: ["sample-anime", "sample-manga"],
        entryId: "term-eat",
        kind: "term",
        status: "ambiguous"
      }
    ]);
  });
});

async function seedMedia(input: { cardsSource: string }) {
  const mediaDirectory = path.join(contentRoot, "media", inferMediaSlug(input.cardsSource));

  await mkdir(path.join(mediaDirectory, "cards"), { recursive: true });
  await mkdir(path.join(mediaDirectory, "textbook"), { recursive: true });
  await writeFile(path.join(mediaDirectory, "cards", "001-core.md"), input.cardsSource);
  await writeFile(
    path.join(mediaDirectory, "textbook", "001-intro.md"),
    `---
id: lesson-${inferMediaSlug(input.cardsSource)}
media_id: media-${inferMediaSlug(input.cardsSource)}
slug: intro
title: Intro
order: 10
---

# Intro
`
  );
  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: media-${inferMediaSlug(input.cardsSource)}
slug: ${inferMediaSlug(input.cardsSource)}
title: ${inferMediaSlug(input.cardsSource)}
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
status: active
tags: [test]
---

# ${inferMediaSlug(input.cardsSource)}
`
  );
  await writeFile(
    path.join(mediaDirectory, "pronunciations.json"),
    `${JSON.stringify({ version: 1, entries: [] }, null, 2)}\n`
  );
}

function inferMediaSlug(cardsSource: string) {
  const mediaIdMatch = cardsSource.match(/media_id:\s+media-([a-z0-9-]+)/u);

  if (!mediaIdMatch?.[1]) {
    throw new Error("media_id missing in cards source fixture");
  }

  return mediaIdMatch[1];
}
