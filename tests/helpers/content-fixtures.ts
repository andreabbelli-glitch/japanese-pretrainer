import path from "node:path";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repositoryRoot = path.join(__dirname, "..", "..");
export const contentLibraryRoot = path.join(
  repositoryRoot,
  "src",
  "features",
  "content"
);
export const fixturesRoot = path.join(
  repositoryRoot,
  "tests",
  "fixtures",
  "content"
);
export const validContentRoot = path.join(fixturesRoot, "valid", "content");
export const validMediaDirectory = path.join(
  validContentRoot,
  "media",
  "sample-anime"
);
export const invalidMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "bad-media"
);
export const unsafeYamlMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "llm-unsafe-yaml"
);
export const duplicateIdsMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "duplicate-ids"
);
export const missingReferencesMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "missing-references"
);
export const incompleteBundleMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "incomplete-bundle"
);
export const missingImageAssetMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "missing-image-asset"
);
export const cardTextPlainScalarMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "card-text-plain-scalar"
);

export const richContentFixture = {
  mediaId: "media-rich-fixture",
  mediaSlug: "rich-fixture",
  mediaTitle: "Rich Fixture",
  segmentSlug: "scene-01",
  lessonIntroId: "lesson-rich-fixture-intro",
  lessonIntroSlug: "intro-scene",
  lessonFollowupId: "lesson-rich-fixture-followup",
  lessonFollowupSlug: "grammar-followup",
  cardsCoreId: "cards-rich-fixture-core",
  cardsBonusId: "cards-rich-fixture-bonus",
  termPrimaryId: "term-rich-akari",
  termSecondaryId: "term-rich-yuushoku",
  grammarPrimaryId: "grammar-rich-teiru",
  grammarSecondaryId: "grammar-rich-node",
  termPrimaryCardId: "card-rich-akari-recognition",
  grammarPrimaryCardId: "card-rich-teiru-concept",
  termSecondaryCardId: "card-rich-yuushoku-recognition",
  grammarSecondaryCardId: "card-rich-node-concept",
  imageSrc: "assets/scenes/scene-01.svg",
  termAudioSrc: "assets/audio/term/term-rich-akari/term-rich-akari.ogg",
  grammarAudioSrc:
    "assets/audio/grammar/grammar-rich-teiru/grammar-rich-teiru.mp3"
} as const;

export const bonusDistinctCardsFixture = {
  mediaId: "media-bonus-distinct-fixture",
  mediaSlug: "bonus-distinct-fixture",
  lessonId: "lesson-bonus-distinct-acquisition",
  expectedCardCount: 7
} as const;

export async function writeRichContentFixture(contentRoot: string) {
  const mediaDirectory = path.join(
    contentRoot,
    "media",
    richContentFixture.mediaSlug
  );
  const textbookDirectory = path.join(mediaDirectory, "textbook");
  const cardsDirectory = path.join(mediaDirectory, "cards");
  const imageDirectory = path.join(mediaDirectory, "assets", "scenes");
  const termAudioDirectory = path.join(
    mediaDirectory,
    "assets",
    "audio",
    "term",
    "term-rich-akari"
  );
  const grammarAudioDirectory = path.join(
    mediaDirectory,
    "assets",
    "audio",
    "grammar",
    "grammar-rich-teiru"
  );

  await mkdir(textbookDirectory, { recursive: true });
  await mkdir(cardsDirectory, { recursive: true });
  await mkdir(imageDirectory, { recursive: true });
  await mkdir(termAudioDirectory, { recursive: true });
  await mkdir(grammarAudioDirectory, { recursive: true });

  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: ${richContentFixture.mediaId}
slug: ${richContentFixture.mediaSlug}
title: ${richContentFixture.mediaTitle}
media_type: anime
segment_kind: scene
language: ja
base_explanation_language: it
status: active
tags: [fixture, parser]
---

# Rich Fixture

Bundle sintetico per parser e importer.
`
  );
  await writeFile(
    path.join(textbookDirectory, "001-intro.md"),
    `---
id: ${richContentFixture.lessonIntroId}
media_id: ${richContentFixture.mediaId}
slug: ${richContentFixture.lessonIntroSlug}
title: Intro scene
order: 10
segment_ref: ${richContentFixture.segmentSlug}
difficulty: n5
status: active
tags: [intro, core]
prerequisites: []
---

# Intro

In questa scena [明かり](term:${richContentFixture.termPrimaryId}) resta accesa
mentre [～ている](grammar:${richContentFixture.grammarPrimaryId}) descrive lo stato.

:::image
src: ${richContentFixture.imageSrc}
alt: Rich Fixture mostra una lanterna accesa.
caption: >-
  Screenshot sintetico per [{{明|あ}}かり](term:${richContentFixture.termPrimaryId}).
:::

:::grammar
id: ${richContentFixture.grammarPrimaryId}
pattern: ～ている
title: Forma in -te iru
meaning_it: azione in corso o stato risultante
reading: ている
aliases: [てる]
notes_it: "Nota con riferimento a [明かり](term:${richContentFixture.termPrimaryId})."
:::
`
  );
  await writeFile(
    path.join(textbookDirectory, "002-followup.md"),
    `---
id: ${richContentFixture.lessonFollowupId}
media_id: ${richContentFixture.mediaId}
slug: ${richContentFixture.lessonFollowupSlug}
title: Follow-up grammaticale
order: 20
segment_ref: ${richContentFixture.segmentSlug}
difficulty: n4
status: active
tags: [grammar]
prerequisites: [${richContentFixture.lessonIntroId}]
---

# Follow-up

Colleghiamo [夕食](term:${richContentFixture.termSecondaryId}) a
[～ので](grammar:${richContentFixture.grammarSecondaryId}).

:::grammar
id: ${richContentFixture.grammarSecondaryId}
pattern: ～ので
title: Spiegare una ragione
meaning_it: poiche; dato che
reading: ので
aliases: [ので]
notes_it: "Si confronta con [～ている](grammar:${richContentFixture.grammarPrimaryId})."
:::
`
  );
  await writeFile(
    path.join(cardsDirectory, "001-core.md"),
    `---
id: ${richContentFixture.cardsCoreId}
media_id: ${richContentFixture.mediaId}
slug: core-cards
title: Core cards
order: 10
segment_ref: ${richContentFixture.segmentSlug}
---

:::term
id: ${richContentFixture.termPrimaryId}
lemma: 明かり
reading: あかり
romaji: akari
meaning_it: luce; lanterna
aliases: [あかり, akari]
audio_src: ${richContentFixture.termAudioSrc}
audio_source: forvo
audio_speaker: Fixture Speaker
audio_license: Forvo terms
audio_attribution: Fixture Speaker via Forvo
audio_page_url: https://forvo.com/word/%E6%98%8E%E3%81%8B%E3%82%8A/#ja
:::

:::card
id: ${richContentFixture.termPrimaryCardId}
lesson_id: ${richContentFixture.lessonIntroId}
entry_type: term
entry_id: ${richContentFixture.termPrimaryId}
card_type: recognition
front: '{{明|あ}}かり'
back: luce; lanterna
example_jp: "{{明|あ}}かりがついている。"
example_it: "La luce e accesa."
tags: [noun, core]
:::

:::card
id: ${richContentFixture.grammarPrimaryCardId}
lesson_id: ${richContentFixture.lessonIntroId}
entry_type: grammar
entry_id: ${richContentFixture.grammarPrimaryId}
card_type: concept
front: ～ている
back: azione in corso / stato risultante
example_jp: "{{明|あ}}かりがついている。"
example_it: "La luce e accesa."
notes_it: "Si collega a [明かり](term:${richContentFixture.termPrimaryId})."
tags: [grammar, core]
:::
`
  );
  await writeFile(
    path.join(cardsDirectory, "002-bonus.md"),
    `---
id: ${richContentFixture.cardsBonusId}
media_id: ${richContentFixture.mediaId}
slug: bonus-cards
title: Bonus cards
order: 20
segment_ref: ${richContentFixture.segmentSlug}
---

:::term
id: ${richContentFixture.termSecondaryId}
lemma: 夕食
reading: ゆうしょく
romaji: yuushoku
meaning_it: cena
aliases: [ゆうしょく, yuushoku]
:::

:::card
id: ${richContentFixture.termSecondaryCardId}
lesson_id: ${richContentFixture.lessonFollowupId}
entry_type: term
entry_id: ${richContentFixture.termSecondaryId}
card_type: recognition
front: '{{夕食|ゆうしょく}}'
back: cena
example_jp: "{{夕食|ゆうしょく}}なので、あとで{{行|い}}く。"
example_it: "Dato che e ora di cena, vado dopo."
tags: [noun, bonus]
:::

:::card
id: ${richContentFixture.grammarSecondaryCardId}
lesson_id: ${richContentFixture.lessonFollowupId}
entry_type: grammar
entry_id: ${richContentFixture.grammarSecondaryId}
card_type: concept
front: ～ので
back: poiche; dato che
example_jp: "{{夕食|ゆうしょく}}なので、あとで{{行|い}}く。"
example_it: "Dato che e ora di cena, vado dopo."
notes_it: "Si collega a [夕食](term:${richContentFixture.termSecondaryId})."
tags: [grammar, bonus]
:::
`
  );
  await writeFile(
    path.join(mediaDirectory, "pronunciations.json"),
    JSON.stringify(
      {
        version: 1,
        entries: [
          {
            entry_type: "grammar",
            entry_id: richContentFixture.grammarPrimaryId,
            audio_src: richContentFixture.grammarAudioSrc,
            audio_source: "forvo",
            audio_speaker: "Grammar Fixture Speaker",
            audio_license: "Forvo terms",
            audio_attribution: "Grammar Fixture Speaker via Forvo",
            audio_page_url:
              "https://forvo.com/word/%E3%81%A6%E3%81%84%E3%82%8B/#ja",
            pitch_accent: 0,
            pitch_accent_source: "Fixture dictionary",
            pitch_accent_page_url: "https://example.test/teiru"
          }
        ]
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(imageDirectory, "scene-01.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'
  );
  await writeFile(
    path.join(termAudioDirectory, "term-rich-akari.ogg"),
    "OggS-rich-fixture-audio"
  );
  await writeFile(
    path.join(grammarAudioDirectory, "grammar-rich-teiru.mp3"),
    "ID3-rich-fixture-audio"
  );
}

export async function writeBonusDistinctCardsFixture(contentRoot: string) {
  const mediaDirectory = path.join(
    contentRoot,
    "media",
    bonusDistinctCardsFixture.mediaSlug
  );
  const textbookDirectory = path.join(mediaDirectory, "textbook");
  const cardsDirectory = path.join(mediaDirectory, "cards");

  await mkdir(textbookDirectory, { recursive: true });
  await mkdir(cardsDirectory, { recursive: true });
  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: ${bonusDistinctCardsFixture.mediaId}
slug: ${bonusDistinctCardsFixture.mediaSlug}
title: Bonus Distinct Fixture
media_type: game
segment_kind: lesson
language: ja
base_explanation_language: it
status: active
---

# Bonus Distinct Fixture
`
  );
  await writeFile(
    path.join(textbookDirectory, "001-acquisition.md"),
    `---
id: ${bonusDistinctCardsFixture.lessonId}
media_id: ${bonusDistinctCardsFixture.mediaId}
slug: bonus-acquisition
title: Bonus acquisition
order: 10
status: active
---

# Bonus acquisition

Sette ricompense usano card front distinte.
`
  );

  const rewardFixtures = [
    ["ichi", "一", "いち"],
    ["ni", "二", "に"],
    ["san", "三", "さん"],
    ["yon", "四", "よん"],
    ["go", "五", "ご"],
    ["roku", "六", "ろく"],
    ["nana", "七", "なな"]
  ] as const;
  const termBlocks = rewardFixtures
    .map(([slug, numberKanji, reading]) => {
      return `:::term
id: term-bonus-reward-${slug}
lemma: 報酬${numberKanji}
reading: ほうしゅう${reading}
romaji: houshuu ${slug}
meaning_it: ricompensa ${slug}
:::

:::card
id: card-bonus-reward-${slug}
lesson_id: ${bonusDistinctCardsFixture.lessonId}
entry_type: term
entry_id: term-bonus-reward-${slug}
card_type: recognition
front: '{{報酬${numberKanji}|ほうしゅう${reading}}}'
back: ricompensa ${slug}
example_jp: "{{報酬${numberKanji}|ほうしゅう${reading}}}を{{受|う}}け{{取|と}}る。"
example_it: "Ricevi la ricompensa ${slug}."
:::`;
    })
    .join("\n\n");

  await writeFile(
    path.join(cardsDirectory, "001-rewards.md"),
    `---
id: cards-bonus-distinct-rewards
media_id: ${bonusDistinctCardsFixture.mediaId}
slug: bonus-rewards
title: Bonus rewards
order: 10
---

${termBlocks}
`
  );
}

export async function writeMediaBundle(
  contentRoot: string,
  input: {
    mediaSlug: string;
    mediaId: string;
    cardsFileId: string;
    cardId: string;
    crossMediaGrammarGroup?: string;
    crossMediaTermGroup?: string;
    sharedGrammarId: string;
    sharedTermId: string;
  }
) {
  const mediaDirectory = path.join(contentRoot, "media", input.mediaSlug);
  const cardsDirectory = path.join(mediaDirectory, "cards");
  const textbookDirectory = path.join(mediaDirectory, "textbook");

  await mkdir(cardsDirectory, { recursive: true });
  await mkdir(textbookDirectory, { recursive: true });
  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: ${input.mediaId}
slug: ${input.mediaSlug}
title: ${input.mediaSlug}
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
  );
  await writeFile(
    path.join(textbookDirectory, "001-intro.md"),
    `---
id: lesson-${input.mediaSlug}
media_id: ${input.mediaId}
slug: ${input.mediaSlug}-intro
title: ${input.mediaSlug} intro
order: 1
---

# Intro

Qui introduciamo [食べる](term:${input.sharedTermId}) e [～ている](grammar:${input.sharedGrammarId}).

:::grammar
id: ${input.sharedGrammarId}
${input.crossMediaGrammarGroup ? `cross_media_group: ${input.crossMediaGrammarGroup}` : ""}
pattern: ～ている
title: Forma in -te iru
meaning_it: azione in corso
:::
`
  );
  await writeFile(
    path.join(cardsDirectory, "001-core.md"),
    `---
id: ${input.cardsFileId}
media_id: ${input.mediaId}
slug: ${input.mediaSlug}-cards
title: ${input.mediaSlug} cards
order: 1
---

:::term
id: ${input.sharedTermId}
${input.crossMediaTermGroup ? `cross_media_group: ${input.crossMediaTermGroup}` : ""}
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
:::

:::card
id: ${input.cardId}
lesson_id: lesson-${input.mediaSlug}
entry_type: term
entry_id: ${input.sharedTermId}
card_type: recognition
front: '{{食|た}}べる'
back: mangiare
:::
`
  );
}

export async function writeMediaDocument(
  mediaDirectory: string,
  input: {
    mediaId: string;
    mediaSlug: string;
  }
) {
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: ${input.mediaId}
slug: ${input.mediaSlug}
title: ${input.mediaSlug}
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
  );
}

export async function writeLessonDocument(
  textbookDirectory: string,
  input: {
    mediaId: string;
    slugPrefix: string;
  }
) {
  await mkdir(textbookDirectory, { recursive: true });
  await writeFile(
    path.join(textbookDirectory, "001-intro.md"),
    `---
id: lesson-${input.slugPrefix}-intro
media_id: ${input.mediaId}
slug: ${input.slugPrefix}-intro
title: Intro
order: 1
---

# Intro
`
  );
}

export async function writeCardsDocument(
  cardsDirectory: string,
  input: {
    mediaId: string;
    slugPrefix: string;
  }
) {
  await mkdir(cardsDirectory, { recursive: true });
  await writeFile(
    path.join(cardsDirectory, "001-core.md"),
    `---
id: cards-${input.slugPrefix}
media_id: ${input.mediaId}
slug: ${input.slugPrefix}-cards
title: Core cards
order: 1
---

:::term
id: term-${input.slugPrefix}
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
:::

:::card
id: card-${input.slugPrefix}
lesson_id: lesson-${input.slugPrefix}-intro
entry_type: term
entry_id: term-${input.slugPrefix}
card_type: recognition
front: '{{食|た}}べる'
back: mangiare
:::
`
  );
}

export async function listFilesRecursively(
  directory: string
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listFilesRecursively(entryPath);
      }

      return [entryPath];
    })
  );

  return nestedFiles.flat().sort();
}

export function lineNumberOf(source: string, needle: string) {
  const index = source.indexOf(needle);

  if (index === -1) {
    throw new Error(`Could not find line marker: ${needle}`);
  }

  return source.slice(0, index).split("\n").length;
}
