import path from "node:path";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { parseContentRoot, parseMediaDirectory } from "@/lib/content";
import {
  cardTextPlainScalarMediaDirectory,
  duplicateIdsMediaDirectory,
  incompleteBundleMediaDirectory,
  invalidMediaDirectory,
  lineNumberOf,
  missingImageAssetMediaDirectory,
  missingReferencesMediaDirectory,
  unsafeYamlMediaDirectory,
  validContentRoot,
  validMediaDirectory,
  writeCardsDocument,
  writeLessonDocument,
  writeMediaDocument
} from "./helpers/content-fixtures";

describe("content validator and issue reporting", () => {
  it("rejects audio metadata without a local audio_src", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-audio-"));
    const contentRoot = path.join(tempRoot, "content");

    try {
      await cp(validContentRoot, contentRoot, { recursive: true });

      const cardsPath = path.join(
        contentRoot,
        "media",
        "sample-anime",
        "cards",
        "001-core.md"
      );
      const cardsSource = await readFile(cardsPath, "utf8");

      await writeFile(
        cardsPath,
        cardsSource.replace(
          "audio_src: assets/audio/term/term-taberu/term-taberu.ogg\n",
          ""
        )
      );

      const result = await parseMediaDirectory(
        path.join(contentRoot, "media", "sample-anime")
      );

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "audio.missing-src",
          category: "schema"
        })
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("accepts pitch accent metadata without requiring a local audio_src", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-pitch-"));
    const contentRoot = path.join(tempRoot, "content");

    try {
      await cp(validContentRoot, contentRoot, { recursive: true });

      const cardsPath = path.join(
        contentRoot,
        "media",
        "sample-anime",
        "cards",
        "001-core.md"
      );
      const cardsSource = await readFile(cardsPath, "utf8");

      await writeFile(
        cardsPath,
        cardsSource
          .replace(
            "audio_src: assets/audio/term/term-taberu/term-taberu.ogg\n",
            ""
          )
          .replace("audio_source: forvo\n", "")
          .replace("audio_speaker: Test Native Speaker\n", "")
          .replace("audio_license: Forvo terms\n", "")
          .replace("audio_attribution: Test Native Speaker via Forvo\n", "")
          .replace(
            "audio_page_url: https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%82%8B/#ja\n",
            ""
          )
      );

      const result = await parseMediaDirectory(
        path.join(contentRoot, "media", "sample-anime")
      );

      expect(result.ok).toBe(true);
      expect(result.data.terms[0]?.audio).toBeUndefined();
      expect(result.data.terms[0]?.pitchAccent).toBe(2);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns a structured issue when the media root is missing", async () => {
    const contentRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-root-"));

    try {
      const result = await parseContentRoot(contentRoot);

      expect(result.ok).toBe(false);
      expect(result.data.bundles).toEqual([]);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "content-root.missing-media-directory",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(contentRoot, "media")
          })
        })
      );
    } finally {
      await rm(contentRoot, { recursive: true, force: true });
    }
  });

  it("returns structured issues for invalid content", async () => {
    const result = await parseMediaDirectory(invalidMediaDirectory);
    const issueCodes = result.issues.map((issue) => issue.code);
    const categories = new Set(result.issues.map((issue) => issue.category));

    expect(result.ok).toBe(false);
    expect(categories).toEqual(
      new Set(["syntax", "schema", "reference", "integrity"])
    );
    expect(issueCodes).toContain("furigana.unclosed");
    expect(issueCodes).toContain("schema.unknown-field");
    expect(issueCodes).toContain("structured-block.invalid-yaml");
    expect(issueCodes).toContain("cards.free-text-not-allowed");
    expect(issueCodes).toContain("reference.missing-target");
    expect(issueCodes).toContain("card.missing-entry");
    expect(issueCodes).toContain("id.duplicate");

    expect(result.data.media?.frontmatter.id).toBe("media-bad");
    expect(result.data.lessons).toHaveLength(1);
    expect(result.data.cardFiles).toHaveLength(1);
  });

  it("flags fragile plain YAML scalars that an LLM can emit inside structured blocks", async () => {
    const result = await parseMediaDirectory(unsafeYamlMediaDirectory);
    const unsafeScalarIssues = result.issues.filter(
      (issue) => issue.code === "yaml.unsafe-plain-scalar"
    );

    expect(result.ok).toBe(false);
    expect(unsafeScalarIssues).toHaveLength(2);
    expect(unsafeScalarIssues).toContainEqual(
      expect.objectContaining({
        category: "syntax",
        path: "body.blocks[0].notes_it"
      })
    );
    expect(unsafeScalarIssues).toContainEqual(
      expect.objectContaining({
        category: "syntax",
        path: "body.blocks[1].notes_it"
      })
    );
  });

  it("flags full card-text examples left as plain YAML scalars", async () => {
    const result = await parseMediaDirectory(cardTextPlainScalarMediaDirectory);
    const unsafeScalarIssues = result.issues.filter(
      (issue) => issue.code === "yaml.unsafe-plain-scalar"
    );

    expect(result.ok).toBe(false);
    expect(unsafeScalarIssues).toContainEqual(
      expect.objectContaining({
        category: "syntax",
        path: "body.blocks[1].front",
        details: expect.objectContaining({
          field: "front",
          reason: "card-text-example"
        })
      })
    );
  });

  it("rejects markdown syntax inside lesson summaries because the UI renders them as plain text", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-summary-plain-"));
    const mediaDirectory = path.join(mediaRoot, "sample-anime");
    const lessonPath = path.join(mediaDirectory, "textbook", "001-intro.md");

    try {
      await cp(validMediaDirectory, mediaDirectory, { recursive: true });

      const lessonSource = await readFile(lessonPath, "utf8");
      const updatedLessonSource = lessonSource.replace(
        "prerequisites: []\n---",
        [
          "prerequisites: []",
          "summary: >-",
          "  Riconoscere [食べる](term:term-taberu), {{日本語|にほんご}} e `大丈夫` nella scena iniziale.",
          "---"
        ].join("\n")
      );
      await writeFile(lessonPath, updatedLessonSource);

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "frontmatter.summary-plain-text-only",
          category: "schema",
          path: "frontmatter.summary"
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("flags bare kanji inside plain-text summaries and media descriptions", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-plain-summary-"));

    try {
      const mediaDirectory = path.join(mediaRoot, "sample-anime");
      await cp(validMediaDirectory, mediaDirectory, { recursive: true });

      const mediaPath = path.join(mediaDirectory, "media.md");
      const lessonPath = path.join(mediaDirectory, "textbook", "001-intro.md");

      const mediaSource = await readFile(mediaPath, "utf8");
      const updatedMediaSource = mediaSource.replace(
        "---\n",
        [
          "---",
          "description: >-",
          "  Media con 報酬確認 nel testo descrittivo.",
          ""
        ].join("\n")
      );
      await writeFile(mediaPath, updatedMediaSource);

      const lessonSource = await readFile(lessonPath, "utf8");
      const updatedLessonSource = lessonSource.replace(
        "prerequisites: []\n---",
        [
          "prerequisites: []",
          "summary: >-",
          "  Riconoscere 報酬確認 nella scena iniziale.",
          "---"
        ].join("\n")
      );
      await writeFile(lessonPath, updatedLessonSource);

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "frontmatter.description-bare-kanji",
          category: "schema",
          path: "frontmatter.description"
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "frontmatter.summary-bare-kanji",
          category: "schema",
          path: "frontmatter.summary"
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("fails on duplicate IDs in a small targeted fixture", async () => {
    const result = await parseMediaDirectory(duplicateIdsMediaDirectory);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "id.duplicate",
        category: "integrity",
        details: expect.objectContaining({
          namespace: "term",
          id: "term-duel-masters-duplicate-invasion"
        })
      })
    );
  });

  it("fails on missing references in a small targeted fixture", async () => {
    const result = await parseMediaDirectory(missingReferencesMediaDirectory);
    const issueCodes = result.issues.map((issue) => issue.code);

    expect(result.ok).toBe(false);
    expect(issueCodes).toContain("reference.missing-target");
    expect(issueCodes).toContain("card.missing-entry");
  });

  it("fails on textbook image blocks that reference missing assets", async () => {
    const result = await parseMediaDirectory(missingImageAssetMediaDirectory);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "image.missing-asset",
        category: "integrity"
      })
    );
  });

  it("flags bare kanji in image alt text and captions", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-image-kanji-"));
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");
    const assetsDirectory = path.join(mediaDirectory, "assets", "ui");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await mkdir(cardsDirectory, { recursive: true });
      await mkdir(assetsDirectory, { recursive: true });

      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: game
segment_kind: lesson
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(
        path.join(textbookDirectory, "001-image.md"),
        `---
id: lesson-demo
media_id: media-demo
slug: image-demo
title: Image demo
order: 1
---

:::term
id: term-houshuu-kakunin
lemma: 報酬確認
reading: ほうしゅうかくにん
romaji: houshuu kakunin
meaning_it: verifica ricompensa
:::

:::image
src: assets/ui/demo.svg
alt: "Schermata 報酬確認."
caption: >-
  Apri [報酬確認](term:term-houshuu-kakunin) per vedere il dettaglio.
:::
`
      );
      await writeFile(
        path.join(cardsDirectory, "001-core.md"),
        `---
id: cards-demo
media_id: media-demo
slug: cards-demo
title: Demo cards
order: 1
---
`
      );
      await writeFile(
        path.join(assetsDirectory, "demo.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'
      );

      const result = await parseMediaDirectory(mediaDirectory);
      const issueCodes = result.issues.map((issue) => issue.code);

      expect(result.ok).toBe(false);
      expect(issueCodes).toContain("image.alt-bare-kanji");
      expect(issueCodes).toContain("image.caption-bare-kanji");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "image.alt-bare-kanji",
          path: "body.blocks[1].alt",
          category: "schema"
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "image.caption-bare-kanji",
          path: "body.blocks[1].caption",
          category: "schema"
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("flags bare learner-facing kanji and numerals outside furigana markup", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-visible-furigana-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await mkdir(cardsDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: game
segment_kind: lesson
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(
        path.join(textbookDirectory, "001-visible.md"),
        `---
id: lesson-demo
media_id: media-demo
slug: visible-demo
title: Visible demo
order: 1
---

Leggi 破壊された時 quando compare nel testo.

:::example_sentence
jp: >-
  このクリーチャーのパワーを+5000する。
translation_it: >-
  In italiano puoi citare 破壊された時 come trigger.
:::
`
      );
      await writeFile(
        path.join(cardsDirectory, "001-core.md"),
        `---
id: cards-demo
media_id: media-demo
slug: cards-demo
title: Demo cards
order: 1
---

:::term
id: term-demo
lemma: 破壊
reading: はかい
romaji: hakai
meaning_it: distruzione
notes_it: >-
  Qui 破壊された時 resta visibile senza furigana.
:::

:::card
id: card-demo
lesson_id: lesson-demo
entry_type: term
entry_id: term-demo
card_type: recognition
front: 破壊された時
back: ok
example_jp: >-
  このクリーチャーのパワーを5000する。
example_it: >-
  Anche qui 破壊された時 compare in chiaro.
notes_it: >-
  Nota su 破壊された時.
:::
`
      );

      const result = await parseMediaDirectory(mediaDirectory);
      const issueCodes = result.issues.map((issue) => issue.code);

      expect(result.ok).toBe(false);
      expect(issueCodes).toContain("furigana.visible-text-bare-kanji");
      expect(issueCodes).toContain("furigana.visible-text-bare-numerals");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.visible-text-bare-numerals",
          path: "body.blocks[1].jp",
          category: "schema",
          location: expect.objectContaining({
            filePath: path.join(textbookDirectory, "001-visible.md")
          })
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.visible-text-bare-kanji",
          path: "body.blocks[1].front",
          category: "schema",
          location: expect.objectContaining({
            filePath: path.join(cardsDirectory, "001-core.md")
          })
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.visible-text-bare-numerals",
          path: "body.blocks[1].example_jp",
          category: "schema",
          location: expect.objectContaining({
            filePath: path.join(cardsDirectory, "001-core.md")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("fails on an incomplete bundle fixture without cards/", async () => {
    const result = await parseMediaDirectory(incompleteBundleMediaDirectory);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "media.missing-directory",
        category: "integrity",
        location: expect.objectContaining({
          filePath: path.join(incompleteBundleMediaDirectory, "cards")
        })
      })
    );
  });

  it("maps card field issues and references back to the source file", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-inline-"));
    const mediaDirectory = path.join(mediaRoot, "demo");
    const cardsDirectory = path.join(mediaDirectory, "cards");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsPath = path.join(cardsDirectory, "001-inline.md");
    const cardsSource = `---
id: cards-demo
media_id: media-demo
slug: demo-cards
title: Demo cards
order: 1
---

:::term
id: term-demo
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
:::

:::card
id: card-demo
lesson_id: lesson-demo
entry_type: term
entry_id: term-demo
card_type: recognition
front: "{{未完}"
back: ok
notes_it: "[Ghost](term:term-missing)"
:::
`;

    try {
      await mkdir(cardsDirectory, { recursive: true });
      await mkdir(textbookDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(cardsPath, cardsSource);

      const result = await parseMediaDirectory(mediaDirectory);
      const furiganaIssue = result.issues.find(
        (issue) => issue.code === "furigana.unclosed"
      );
      const missingReferenceIssue = result.issues.find(
        (issue) => issue.code === "reference.missing-target"
      );
      const missingReference = result.data.references.find(
        (reference) => reference.targetId === "term-missing"
      );

      expect(result.ok).toBe(false);
      expect(furiganaIssue?.location.filePath).toBe(cardsPath);
      expect(furiganaIssue?.location.range?.start.line).toBe(
        lineNumberOf(cardsSource, 'front: "{{未完}"')
      );
      expect(missingReferenceIssue?.location.filePath).toBe(cardsPath);
      expect(missingReferenceIssue?.location.range?.start.line).toBe(
        lineNumberOf(cardsSource, 'notes_it: "[Ghost](term:term-missing)"')
      );
      expect(missingReference?.sourceFile).toBe(cardsPath);
      expect(missingReference?.location?.start.line).toBe(
        lineNumberOf(cardsSource, 'notes_it: "[Ghost](term:term-missing)"')
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("flags compact term romaji that expands a small tsu incorrectly", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-romaji-"));
    const mediaDirectory = path.join(mediaRoot, "demo");
    const cardsDirectory = path.join(mediaDirectory, "cards");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsPath = path.join(cardsDirectory, "001-romaji.md");
    const cardsSource = `---
id: cards-demo
media_id: media-demo
slug: demo-cards
title: Demo cards
order: 1
---

:::term
id: term-demo
lemma: 待って
reading: まって
romaji: matsu te
meaning_it: aspetta
:::

:::card
id: card-demo
lesson_id: lesson-demo
entry_type: term
entry_id: term-demo
card_type: recognition
front: '{{待|ま}}って'
back: aspetta
:::
`;

    try {
      await mkdir(cardsDirectory, { recursive: true });
      await mkdir(textbookDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(cardsPath, cardsSource);

      const result = await parseMediaDirectory(mediaDirectory);
      const romajiIssue = result.issues.find(
        (issue) => issue.code === "structured-block.term-romaji-sokuon-mismatch"
      );

      expect(result.ok).toBe(false);
      expect(romajiIssue?.location.filePath).toBe(cardsPath);
      expect(romajiIssue?.location.range?.start.line).toBe(
        lineNumberOf(cardsSource, "romaji: matsu te")
      );
      expect(romajiIssue?.message).toContain("small tsu");
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("does not flag spaced readings that use an editorial particle rendering", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-romaji-spaced-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const cardsDirectory = path.join(mediaDirectory, "cards");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsPath = path.join(cardsDirectory, "001-romaji-spaced.md");
    const cardsSource = `---
id: cards-demo
media_id: media-demo
slug: demo-cards
title: Demo cards
order: 1
---

:::term
id: term-demo
lemma: 指定の教室へ 向かってください
reading: していの きょうしつへ むかってください
romaji: shitei no kyoushitsu e mukatte kudasai
meaning_it: dirigiti verso l'aula indicata
:::

:::card
id: card-demo
lesson_id: lesson-demo
entry_type: term
entry_id: term-demo
card_type: recognition
front: '{{指定|してい}}の {{教室|きょうしつ}}へ {{向|む}}かってください'
back: dirigiti verso l'aula indicata
:::
`;

    try {
      await mkdir(cardsDirectory, { recursive: true });
      await mkdir(textbookDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(cardsPath, cardsSource);

      const result = await parseMediaDirectory(mediaDirectory);

      expect(
        result.issues.some(
          (issue) =>
            issue.code === "structured-block.term-romaji-sokuon-mismatch"
        )
      ).toBe(false);
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns a structured issue when media.md is missing", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-missing-media-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await writeLessonDocument(textbookDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });
      await writeCardsDocument(cardsDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.data.media).toBeNull();
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "media.missing-file",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(mediaDirectory, "media.md")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns a structured issue when textbook/ is missing", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-missing-textbook-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await mkdir(cardsDirectory, { recursive: true });
      await writeMediaDocument(mediaDirectory, {
        mediaId: "media-demo",
        mediaSlug: "demo"
      });
      await writeCardsDocument(cardsDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "media.missing-directory",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(mediaDirectory, "textbook")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns a structured issue when cards/ is missing", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-missing-cards-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await writeMediaDocument(mediaDirectory, {
        mediaId: "media-demo",
        mediaSlug: "demo"
      });
      await writeLessonDocument(textbookDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "media.missing-directory",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(mediaDirectory, "cards")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns structured issues when textbook/ and cards/ are present but empty", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-empty-directories-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await mkdir(cardsDirectory, { recursive: true });
      await writeMediaDocument(mediaDirectory, {
        mediaId: "media-demo",
        mediaSlug: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);
      const emptyDirectoryIssues = result.issues.filter(
        (issue) => issue.code === "media.empty-directory"
      );

      expect(result.ok).toBe(false);
      expect(emptyDirectoryIssues).toHaveLength(2);
      expect(emptyDirectoryIssues).toContainEqual(
        expect.objectContaining({
          category: "integrity",
          location: expect.objectContaining({
            filePath: textbookDirectory
          })
        })
      );
      expect(emptyDirectoryIssues).toContainEqual(
        expect.objectContaining({
          category: "integrity",
          location: expect.objectContaining({
            filePath: cardsDirectory
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });
});
