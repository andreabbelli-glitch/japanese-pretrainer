import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DatabaseClient } from "@/db";
import { lessonProgress } from "@/db/schema";
import { mediaGlossaryEntryHref } from "@/features/navigation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const validContentRoot = path.join(
  __dirname,
  "..",
  "fixtures",
  "content",
  "valid",
  "content"
);

export function expectedGlossaryEntryHref(
  mediaSlug: string,
  kind: "term" | "grammar",
  surface: string,
  sourceId: string
) {
  return mediaGlossaryEntryHref(mediaSlug, kind, surface, {
    sourceId
  });
}

export function expectedGlossaryEntryPath(
  kind: "term" | "grammar",
  surface: string
) {
  return `/glossary/${kind}/${encodeURIComponent(surface)}`;
}

export async function markAllLessonsCompleted(database: DatabaseClient) {
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

export const reusedSourceIdFixture = {
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

export async function writeReusedSourceIdContentFixture(contentRoot: string) {
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
lesson_id: ${input.lessonId}
entry_type: term
entry_id: ${reusedSourceIdFixture.sourceId}
card_type: recognition
front: '{{共有|きょうゆう}}'
back: ${input.meaning}
:::
`
  );
}

export async function writeLessonOrderContentFixture(contentRoot: string) {
  const mediaRoot = path.join(contentRoot, "media", "lesson-order-media");
  const textbookRoot = path.join(mediaRoot, "textbook");
  const cardsRoot = path.join(mediaRoot, "cards");

  await mkdir(textbookRoot, { recursive: true });
  await mkdir(cardsRoot, { recursive: true });

  await writeFile(
    path.join(mediaRoot, "media.md"),
    `---
id: media-lesson-order
slug: lesson-order-media
title: Lesson Order Media
media_type: game
segment_kind: chapter
language: ja
base_explanation_language: it
status: active
---

# Lesson Order Media
`
  );

  await writeFile(
    path.join(textbookRoot, "001-chapter-one.md"),
    `---
id: lesson-lo-ch1
media_id: media-lesson-order
slug: lo-ch1
title: Chapter 1
order: 1
segment_ref: chapter-01
status: active
---

# Chapter 1

Qui compare [ゼリー](term:term-lo-jelly).
`
  );

  await writeFile(
    path.join(textbookRoot, "002-chapter-two.md"),
    `---
id: lesson-lo-ch2
media_id: media-lesson-order
slug: lo-ch2
title: Chapter 2
order: 2
segment_ref: chapter-02
status: active
---

# Chapter 2

Qui compare [アイス](term:term-lo-ice).
`
  );

  await writeFile(
    path.join(cardsRoot, "001-ch1.md"),
    `---
id: cards-lo-ch1
media_id: media-lesson-order
slug: lo-ch1-cards
title: Chapter 1 cards
order: 1
segment_ref: chapter-01
---

:::term
id: term-lo-jelly
lemma: ゼリー
reading: ぜりー
romaji: zerii
meaning_it: gelatina
:::

:::card
id: card-lo-jelly
lesson_id: lesson-lo-ch1
entry_type: term
entry_id: term-lo-jelly
card_type: recognition
front: ゼリー
back: gelatina
:::
`
  );

  await writeFile(
    path.join(cardsRoot, "002-ch2.md"),
    `---
id: cards-lo-ch2
media_id: media-lesson-order
slug: lo-ch2-cards
title: Chapter 2 cards
order: 2
segment_ref: chapter-02
---

:::term
id: term-lo-ice
lemma: アイス
reading: あいす
romaji: aisu
meaning_it: gelato
:::

:::card
id: card-lo-ice
lesson_id: lesson-lo-ch2
entry_type: term
entry_id: term-lo-ice
card_type: recognition
front: アイス
back: gelato
:::
`
  );
}
