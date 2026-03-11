import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export const crossMediaFixture = {
  grammarGroup: "shared-grammar-ui",
  termGroup: "shared-term-cost",
  alpha: {
    mediaId: "media-alpha",
    mediaSlug: "alpha",
    lessonId: "lesson-alpha-intro",
    lessonSlug: "alpha-intro",
    grammarSourceId: "grammar-alpha-shared",
    termCardId: "card-alpha-term",
    termSourceId: "term-alpha-shared",
    grammarCardId: "card-alpha-grammar",
    termMeaning: "costo nel media alpha",
    grammarMeaning: "uso grammaticale nel media alpha"
  },
  beta: {
    mediaId: "media-beta",
    mediaSlug: "beta",
    lessonId: "lesson-beta-intro",
    lessonSlug: "beta-intro",
    grammarSourceId: "grammar-beta-shared",
    termCardId: "card-beta-term",
    termSourceId: "term-beta-shared",
    grammarCardId: "card-beta-grammar",
    termMeaning: "costo nel media beta",
    grammarMeaning: "uso grammaticale nel media beta"
  }
} as const;

export async function writeCrossMediaContentFixture(contentRoot: string) {
  await Promise.all([
    writeCrossMediaBundle(contentRoot, crossMediaFixture.alpha),
    writeCrossMediaBundle(contentRoot, crossMediaFixture.beta)
  ]);
}

async function writeCrossMediaBundle(
  contentRoot: string,
  input:
    | (typeof crossMediaFixture)["alpha"]
    | (typeof crossMediaFixture)["beta"]
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

Bundle per test cross-media.
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

Nel media ${input.mediaSlug} leggiamo [コスト](term:${input.termSourceId}) e [～共有](grammar:${input.grammarSourceId}).
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
id: ${input.termSourceId}
cross_media_group: ${crossMediaFixture.termGroup}
lemma: コスト
reading: こすと
romaji: kosuto
meaning_it: ${input.termMeaning}
:::

:::grammar
id: ${input.grammarSourceId}
cross_media_group: ${crossMediaFixture.grammarGroup}
pattern: ～共有
title: Forma condivisa
meaning_it: ${input.grammarMeaning}
:::

:::card
id: ${input.termCardId}
entry_type: term
entry_id: ${input.termSourceId}
card_type: recognition
front: コスト
back: ${input.termMeaning}
tags: [shared, term]
:::

:::card
id: ${input.grammarCardId}
entry_type: grammar
entry_id: ${input.grammarSourceId}
card_type: concept
front: ～共有
back: ${input.grammarMeaning}
tags: [shared, grammar]
:::
`
  );
}
