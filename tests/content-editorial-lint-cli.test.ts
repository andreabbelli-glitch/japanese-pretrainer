import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runNodeCli } from "./helpers/run-cli";

const editorialLintScriptPath = path.join(
  process.cwd(),
  "scripts",
  "content-editorial-lint.ts"
);

describe("content editorial lint CLI", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((tempDir) => rm(tempDir, { force: true, recursive: true }))
    );
    tempDirs.length = 0;
  });

  it("prints compact warnings for meta prose, stock contrasts, degraded accents, and meta examples", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        editorialLintScriptPath,
        "--content-root",
        contentRoot,
        "--media-slug",
        "lint-media",
        "--lesson-slug",
        "meta-lesson"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("EDITORIAL_LINT warnings=9");
    expect(stdout).toContain("WARNING P0 meta.lesson-object");
    expect(stdout).toContain("WARNING P0 typography.degraded-accents");
    expect(stdout).toContain("WARNING P0 meta.card-rationale");
    expect(stdout).toContain("WARNING P0 card.example-meta-jp");
    expect(stdout).toContain("WARNING P1 style.stock-contrast");
    expect(stdout).toContain("WARNING P1 style.low-density-utility");
    expect(stdout).toContain(
      'message="Learner-facing text talks about the lesson/page as courseware."'
    );
    expect(stdout).toContain(
      'hint="Rewrite the sentence around the scene, screen, card, dialogue, or Japanese form instead of the lesson object."'
    );
    expect(stdout).toContain("content/media/lint-media/textbook/001-meta.md");
    expect(stdout).toContain("content/media/lint-media/cards/001-meta.md");
    expect(stdout).not.toContain("002-clean.md");
  });

  it("emits stable JSON for automation and keeps warnings non-fatal", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        editorialLintScriptPath,
        "--content-root",
        contentRoot,
        "--media-slug",
        "lint-media",
        "--lesson-slug",
        "meta-lesson",
        "--json"
      ],
      { timeoutMs: 60_000 }
    );

    const payload = JSON.parse(stdout) as {
      counts: Record<string, number>;
      warnings: Array<{ code: string; severity: string }>;
    };

    expect(payload.counts.P0).toBe(6);
    expect(payload.counts.P1).toBe(3);
    expect(payload.warnings.map((warning) => warning.code)).toContain(
      "meta.lesson-object"
    );
  });

  it("supports path-scoped linting without scanning unrelated lessons", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);
    await writeBrokenUnrelatedLesson(contentRoot);
    const targetPath = path.join(
      contentRoot,
      "media",
      "lint-media",
      "textbook",
      "001-meta.md"
    );

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        editorialLintScriptPath,
        "--content-root",
        contentRoot,
        "--path",
        targetPath
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("EDITORIAL_LINT warnings=6");
    expect(stdout).toContain("content/media/lint-media/textbook/001-meta.md");
    expect(stdout).not.toContain("cards/001-meta.md");
    expect(stdout).not.toContain("002-clean.md");
  });

  it("flags learner-facing prose in card fronts", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);
    const targetPath = path.join(
      contentRoot,
      "media",
      "lint-media",
      "cards",
      "001-meta.md"
    );
    const source = await readFile(targetPath, "utf8");
    await writeFile(
      targetPath,
      source.replace(
        'front: "{{受|う}}ける"',
        'front: "In questa lesson vedremo {{受|う}}ける"'
      )
    );

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        editorialLintScriptPath,
        "--content-root",
        contentRoot,
        "--path",
        targetPath
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("EDITORIAL_LINT warnings=4");
    expect(stdout).toContain("WARNING P0 meta.lesson-object");
    expect(stdout).toContain("card(card-ukeru).front");
  });

  it("keeps lesson-scoped linting usable when unrelated files have parse issues", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);
    await writeBrokenUnrelatedLesson(contentRoot);

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        editorialLintScriptPath,
        "--content-root",
        contentRoot,
        "--media-slug",
        "lint-media",
        "--lesson-slug",
        "meta-lesson"
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("EDITORIAL_LINT warnings=9");
    expect(stdout).not.toContain("999-broken-unrelated.md");
  });

  it("blocks parse issues in the requested lesson even when the filename does not contain the slug", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);
    const targetPath = path.join(
      contentRoot,
      "media",
      "lint-media",
      "textbook",
      "001-meta.md"
    );
    const targetSource = await readFile(targetPath, "utf8");
    await writeFile(targetPath, targetSource.replace("order: 10\n", ""));
    const cardsPath = path.join(
      contentRoot,
      "media",
      "lint-media",
      "cards",
      "001-meta.md"
    );
    const cardsSource = await readFile(cardsPath, "utf8");
    await writeFile(
      cardsPath,
      cardsSource.replace("slug: meta-lesson\n", "slug: other-cards\n")
    );

    let failure: { code?: number; stderr?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          editorialLintScriptPath,
          "--content-root",
          contentRoot,
          "--media-slug",
          "lint-media",
          "--lesson-slug",
          "meta-lesson"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }

    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("schema.required-integer");
    expect(failure?.stderr).toContain("001-meta.md");
  });

  it("blocks unreadable frontmatter in lesson-scoped files because the target slug cannot be proven out of scope", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);
    const targetPath = path.join(
      contentRoot,
      "media",
      "lint-media",
      "textbook",
      "001-meta.md"
    );
    const targetSource = await readFile(targetPath, "utf8");
    await writeFile(
      targetPath,
      targetSource.replace(
        'summary: "In questa lesson vedremo parole utili."\n---',
        'summary: "In questa lesson vedremo parole utili."'
      )
    );
    const cardsPath = path.join(
      contentRoot,
      "media",
      "lint-media",
      "cards",
      "001-meta.md"
    );
    const cardsSource = await readFile(cardsPath, "utf8");
    await writeFile(
      cardsPath,
      cardsSource.replace("slug: meta-lesson\n", "slug: other-cards\n")
    );

    let failure: { code?: number; stderr?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          editorialLintScriptPath,
          "--content-root",
          contentRoot,
          "--media-slug",
          "lint-media",
          "--lesson-slug",
          "meta-lesson"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }

    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("frontmatter.unclosed");
    expect(failure?.stderr).toContain("001-meta.md");
  });

  it("blocks media-level parse issues for an explicitly selected media even in lesson scope", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "editorial-lint-"));
    tempDirs.push(tempDir);
    const contentRoot = path.join(tempDir, "content");
    await mkdir(path.join(contentRoot, "media"), { recursive: true });

    let failure: { code?: number; stderr?: string } | null = null;

    try {
      await runNodeCli(
        [
          "--experimental-strip-types",
          editorialLintScriptPath,
          "--content-root",
          contentRoot,
          "--media-slug",
          "missing-media",
          "--lesson-slug",
          "meta-lesson"
        ],
        { timeoutMs: 60_000 }
      );
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }

    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain("media.missing-file");
    expect(failure?.stderr).toContain("missing-media");
  });

  it("flags the documented comma stock contrast shape", async () => {
    const contentRoot = await writeEditorialLintFixture(tempDirs);
    const targetPath = path.join(
      contentRoot,
      "media",
      "lint-media",
      "textbook",
      "002-clean.md"
    );

    const { stdout } = await runNodeCli(
      [
        "--experimental-strip-types",
        editorialLintScriptPath,
        "--content-root",
        contentRoot,
        "--path",
        targetPath
      ],
      { timeoutMs: 60_000 }
    );

    expect(stdout).toContain("EDITORIAL_LINT warnings=1");
    expect(stdout).toContain("WARNING P1 style.stock-contrast");
    expect(stdout).toContain("Non è un comando, è una richiesta.");
  });
});

async function writeEditorialLintFixture(tempDirs: string[]) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "editorial-lint-"));
  tempDirs.push(tempDir);

  const contentRoot = path.join(tempDir, "content");
  const mediaRoot = path.join(contentRoot, "media", "lint-media");
  const textbookRoot = path.join(mediaRoot, "textbook");
  const cardsRoot = path.join(mediaRoot, "cards");

  await mkdir(textbookRoot, { recursive: true });
  await mkdir(cardsRoot, { recursive: true });

  await writeFile(
    path.join(mediaRoot, "media.md"),
    `---
id: media-lint
slug: lint-media
title: Lint Media
media_type: anime
segment_kind: scene
language: ja
base_explanation_language: it
status: active
tags: [lint]
---

# Lint Media
`
  );

  await writeFile(
    path.join(textbookRoot, "001-meta.md"),
    `---
id: lesson-meta
media_id: media-lint
slug: meta-lesson
title: Meta lesson
order: 10
segment_ref: scene-01
difficulty: n5
status: active
tags: [lint]
prerequisites: []
summary: "In questa lesson vedremo parole utili."
---

# In questa lezione analizziamo la scena

Questo termine è utile da fissare.

{{受|う}}ける non è solo ricevere ma subire un effetto.

Questo e' un accento degradato.

:::term
id: term-ukeru
lemma: 受ける
reading: うける
romaji: ukeru
meaning_it: ricevere; subire
aliases: [うける]
:::

:::example_sentence
jp: >-
  {{効|こう}}{{果|か}}を{{受|う}}ける。
translation_it: >-
  Subisce l'effetto.
:::
`
  );

  await writeFile(
    path.join(textbookRoot, "002-clean.md"),
    `---
id: lesson-clean
media_id: media-lint
slug: clean-lesson
title: Dialogo pulito
order: 20
segment_ref: scene-02
difficulty: n5
status: active
tags: [lint]
prerequisites: []
---

# Il dialogo apre la scena

Quando [{{受|う}}ける](term:term-ukeru) compare con un effetto, il soggetto è il
bersaglio che lo subisce.

Non è un comando, è una richiesta.
`
  );

  await writeFile(
    path.join(cardsRoot, "001-meta.md"),
    `---
id: cards-meta
media_id: media-lint
slug: meta-lesson
title: Meta cards
order: 10
segment_ref: scene-01
---

:::card
id: card-ukeru
lesson_id: lesson-meta
entry_type: term
entry_id: term-ukeru
card_type: recognition
front: "{{受|う}}ける"
back: "It's receive not suffer."
example_jp: "{{受|う}}けるという{{言葉|ことば}}は{{便利|べんり}}です。"
example_it: "Il termine ricevere è comodo."
notes_it: "Conviene creare una nuova card per questo punto."
tags: [lint]
:::
`
  );

  await writeFile(
    path.join(mediaRoot, "pronunciations.json"),
    JSON.stringify({ version: 1, entries: [] }, null, 2)
  );

  return contentRoot;
}

async function writeBrokenUnrelatedLesson(contentRoot: string) {
  await writeFile(
    path.join(
      contentRoot,
      "media",
      "lint-media",
      "textbook",
      "999-broken-unrelated.md"
    ),
    `---
id: lesson-broken
media_id: media-lint
slug: broken-unrelated
title: Broken unrelated
segment_ref: scene-99
difficulty: n5
status: active
tags: [lint]
prerequisites: []
---

# Broken unrelated
`
  );
}
