import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export const crossMediaFixture = {
  grammarGroup: "shared-grammar-ui",
  termGroup: "shared-term-cost",
  mixedCardsGroup: "shared-term-margin",
  alpha: {
    mediaId: "media-alpha",
    mediaSlug: "alpha",
    lessonId: "lesson-alpha-intro",
    lessonSlug: "alpha-intro",
    grammarSourceId: "grammar-alpha-shared",
    mixedNoCardTermSourceId: "term-alpha-margin",
    termCardId: "card-alpha-term",
    termSourceId: "term-alpha-shared",
    grammarCardId: "card-alpha-grammar",
    mixedNoCardTermMeaning: "variante senza card nel media alpha",
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
    mixedCardTermCardId: "card-beta-margin",
    mixedCardTermMeaning: "variante con card nel media beta",
    mixedCardTermSourceId: "term-beta-margin",
    grammarCardId: "card-beta-grammar",
    termMeaning: "costo nel media beta",
    grammarMeaning: "uso grammaticale nel media beta"
  }
} as const;

export const crossMediaOverflowFixture = {
  termGroup: "shared-term-overflow-cost",
  alpha: {
    mediaId: "media-overflow-alpha",
    mediaSlug: "alpha",
    lessonId: "lesson-overflow-alpha-intro",
    lessonSlug: "alpha-intro",
    grammarSourceId: "grammar-overflow-alpha-shared",
    termCardId: "card-overflow-alpha-term",
    termSourceId: "term-overflow-alpha-shared",
    grammarCardId: "card-overflow-alpha-grammar",
    termMeaning: "costo nel media alpha",
    grammarMeaning: "uso grammaticale nel media alpha"
  },
  beta: {
    mediaId: "media-overflow-beta",
    mediaSlug: "beta",
    lessonId: "lesson-overflow-beta-intro",
    lessonSlug: "beta-intro",
    grammarSourceId: "grammar-overflow-beta-shared",
    termCardId: "card-overflow-beta-term",
    termSourceId: "term-overflow-beta-shared",
    grammarCardId: "card-overflow-beta-grammar",
    termMeaning: "costo nel media beta",
    grammarMeaning: "uso grammaticale nel media beta"
  },
  gamma: {
    mediaId: "media-overflow-gamma",
    mediaSlug: "gamma",
    lessonId: "lesson-overflow-gamma-intro",
    lessonSlug: "gamma-intro",
    grammarSourceId: "grammar-overflow-gamma-shared",
    termCardId: "card-overflow-gamma-term",
    termSourceId: "term-overflow-gamma-shared",
    grammarCardId: "card-overflow-gamma-grammar",
    termMeaning: "costo nel media gamma",
    grammarMeaning: "uso grammaticale nel media gamma"
  },
  zeta: {
    mediaId: "media-overflow-zeta",
    mediaSlug: "zeta",
    lessonId: "lesson-overflow-zeta-intro",
    lessonSlug: "zeta-intro",
    grammarSourceId: "grammar-overflow-zeta-shared",
    termCardId: "card-overflow-zeta-term",
    termSourceId: "term-overflow-zeta-shared",
    grammarCardId: "card-overflow-zeta-grammar",
    termMeaning: "costo nel media zeta",
    grammarMeaning: "uso grammaticale nel media zeta"
  }
} as const;

export async function writeCrossMediaContentFixture(contentRoot: string) {
  await Promise.all([
    writeCrossMediaBundle(contentRoot, crossMediaFixture.alpha),
    writeCrossMediaBundle(contentRoot, crossMediaFixture.beta)
  ]);
}

export async function writeCrossMediaOverflowContentFixture(contentRoot: string) {
  await Promise.all([
    writeCrossMediaOverflowBundle(contentRoot, crossMediaOverflowFixture.alpha),
    writeCrossMediaOverflowBundle(contentRoot, crossMediaOverflowFixture.beta),
    writeCrossMediaOverflowBundle(contentRoot, crossMediaOverflowFixture.gamma),
    writeCrossMediaOverflowBundle(contentRoot, crossMediaOverflowFixture.zeta)
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

  const extraMixedTermBlock =
    "mixedNoCardTermSourceId" in input && "mixedNoCardTermMeaning" in input
      ? `
:::term
id: ${input.mixedNoCardTermSourceId}
cross_media_group: ${crossMediaFixture.mixedCardsGroup}
lemma: 余白
reading: よはく
romaji: yohaku
meaning_it: ${input.mixedNoCardTermMeaning}
:::
`
      : "mixedCardTermSourceId" in input &&
          "mixedCardTermMeaning" in input &&
          "mixedCardTermCardId" in input
        ? `
:::term
id: ${input.mixedCardTermSourceId}
cross_media_group: ${crossMediaFixture.mixedCardsGroup}
lemma: 余白
reading: よはく
romaji: yohaku
meaning_it: ${input.mixedCardTermMeaning}
:::

:::card
id: ${input.mixedCardTermCardId}
lesson_id: ${input.lessonId}
entry_type: term
entry_id: ${input.mixedCardTermSourceId}
card_type: recognition
front: '{{余白|よはく}}'
back: ${input.mixedCardTermMeaning}
tags: [shared, mixed]
:::
`
      : "";

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
${extraMixedTermBlock}

:::grammar
id: ${input.grammarSourceId}
cross_media_group: ${crossMediaFixture.grammarGroup}
pattern: ～共有
title: Forma condivisa
meaning_it: ${input.grammarMeaning}
:::

:::card
id: ${input.termCardId}
lesson_id: ${input.lessonId}
entry_type: term
entry_id: ${input.termSourceId}
card_type: recognition
front: コスト
back: ${input.termMeaning}
tags: [shared, term]
:::

:::card
id: ${input.grammarCardId}
lesson_id: ${input.lessonId}
entry_type: grammar
entry_id: ${input.grammarSourceId}
card_type: concept
front: >-
  ～{{共有|きょうゆう}}
back: ${input.grammarMeaning}
tags: [shared, grammar]
:::
`
  );
}

async function writeCrossMediaOverflowBundle(
  contentRoot: string,
  input:
    | (typeof crossMediaOverflowFixture)["alpha"]
    | (typeof crossMediaOverflowFixture)["beta"]
    | (typeof crossMediaOverflowFixture)["gamma"]
    | (typeof crossMediaOverflowFixture)["zeta"]
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

Bundle per test cross-media con overflow chip.
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
cross_media_group: ${crossMediaOverflowFixture.termGroup}
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
lesson_id: ${input.lessonId}
entry_type: term
entry_id: ${input.termSourceId}
card_type: recognition
front: コスト
back: ${input.termMeaning}
tags: [shared, term]
:::

:::card
id: ${input.grammarCardId}
lesson_id: ${input.lessonId}
entry_type: grammar
entry_id: ${input.grammarSourceId}
card_type: concept
front: >-
  ～{{共有|きょうゆう}}
back: ${input.grammarMeaning}
tags: [shared, grammar]
:::
`
  );
}
