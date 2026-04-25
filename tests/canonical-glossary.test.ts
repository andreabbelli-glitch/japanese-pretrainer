import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { importContentWorkspace } from "@/lib/content/importer";

describe("canonical global glossary subjects", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-canonical-glossary-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("groups terms and grammar by written surface without explicit cross_media_group", async () => {
    const contentRoot = path.join(tempDir, "content");

    await Promise.all([
      writeCanonicalMediaBundle(contentRoot, {
        cardSuffix: "alpha",
        grammarMeaning: "desiderio nel media alpha",
        grammarSourceId: "grammar-alpha-tai",
        lessonId: "lesson-alpha-intro",
        mediaId: "media-alpha",
        mediaSlug: "alpha",
        reading: "のうりょく",
        romaji: "nouryoku",
        termMeaning: "abilità nel media alpha",
        termSourceId: "term-alpha-nouryoku"
      }),
      writeCanonicalMediaBundle(contentRoot, {
        cardSuffix: "beta",
        grammarMeaning: "volere fare nel media beta",
        grammarSourceId: "grammar-beta-tai",
        lessonId: "lesson-beta-intro",
        mediaId: "media-beta",
        mediaSlug: "beta",
        reading: "ちから",
        romaji: "chikara",
        termMeaning: "potere nel media beta",
        termSourceId: "term-beta-nouryoku"
      })
    ]);

    const importResult = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(importResult.status).toBe("completed");

    const terms = await database.query.term.findMany();
    const grammar = await database.query.grammarPattern.findMany();
    const groups = await database.query.crossMediaGroup.findMany();
    const states = await database.query.reviewSubjectState.findMany();

    expect(new Set(terms.map((entry) => entry.crossMediaGroupId)).size).toBe(1);
    expect(new Set(grammar.map((entry) => entry.crossMediaGroupId)).size).toBe(
      1
    );
    expect(groups.map((group) => group.groupKey).sort()).toEqual([
      "〜たい",
      "能力"
    ]);
    expect(states).toHaveLength(2);
    expect(states.map((state) => state.subjectKey).sort()).toEqual(
      groups
        .map((group) => `group:${group.entryType}:${group.id}`)
        .sort()
    );
  });
});

async function writeCanonicalMediaBundle(
  contentRoot: string,
  input: {
    cardSuffix: string;
    grammarMeaning: string;
    grammarSourceId: string;
    lessonId: string;
    mediaId: string;
    mediaSlug: string;
    reading: string;
    romaji: string;
    termMeaning: string;
    termSourceId: string;
  }
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
`
  );

  await writeFile(
    path.join(textbookRoot, "001-intro.md"),
    `---
id: ${input.lessonId}
media_id: ${input.mediaId}
slug: intro
title: Intro
order: 1
status: active
---

# Intro

Qui incontriamo [能力](term:${input.termSourceId}) e [〜たい](grammar:${input.grammarSourceId}).
`
  );

  await writeFile(
    path.join(cardsRoot, "001-core.md"),
    `---
id: cards-${input.cardSuffix}
media_id: ${input.mediaId}
slug: core
title: Core
order: 1
---

:::term
id: ${input.termSourceId}
lemma: 能力
reading: ${input.reading}
romaji: ${input.romaji}
meaning_it: ${input.termMeaning}
:::

:::grammar
id: ${input.grammarSourceId}
pattern: 〜たい
title: Desiderativo
meaning_it: ${input.grammarMeaning}
:::

:::card
id: card-${input.cardSuffix}-term
lesson_id: ${input.lessonId}
entry_type: term
entry_id: ${input.termSourceId}
card_type: recognition
front: '{{能力|${input.reading}}}'
back: ${input.termMeaning}
:::

:::card
id: card-${input.cardSuffix}-grammar
lesson_id: ${input.lessonId}
entry_type: grammar
entry_id: ${input.grammarSourceId}
card_type: concept
front: 〜たい
back: ${input.grammarMeaning}
:::
`
  );
}
