---
name: web-giapponese-page-builder
description: Use when the user wants to create or revise a Giapponese random study item in the Japanese Custom Study repo from a public URL, screenshot, copied UI text, game prompt, card/rules text, with textbook content, flashcards, and screenshot assets.
---

# Giapponese Random Item Builder

Use this skill inside:

- `/Users/abelli/Codex/Japanese Custom Study`

This repo-scoped skill is versioned at
`.agents/skills/web-giapponese-page-builder`.

Trigger this skill when the request is like:

- add a new item to `web-giapponese`;
- turn this Japanese URL, screenshot, UI prompt, game text or card text into a
  textbook lesson and flashcards;
- study this source page or in-game screenshot;
- generate screenshots and crops for a random/web lesson.

## Required grounding

Before writing content, read:

- `docs/llm-kit/general/01-content-format.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- `docs/llm-kit/general/06-content-workflow-playbook.md`
- `docs/llm-kit/general/09-editorial-quality-rubric.md`
- `docs/llm-kit/general/10-textbook-lesson-style-standard.md`
- `docs/llm-kit/media/web-giapponese/01-brief.md`
- `docs/llm-kit/media/web-giapponese/02-batch-prompt.md`

## Inputs

Required:

- public URL, screenshot path/attachment, copied UI text, game prompt or card
  text;
- seed terms or seed phrases that must become study material.

Optional:

- copied page text or manual transcription;
- focus areas like navbar, filters, tabs, table, result box, badges, ranking,
  dialog box, tutorial prompt, rules text;
- short note describing what is hard about the item.

## Canonical workflow

1. Identify the concrete source item. For web pages, open the page in a real
   browser and treat the rendered page as the primary source of truth. For
   screenshots or attached images, treat the provided image plus visible text as
   the source of truth.
2. Identify the section slug using the source/game/app plus thematic area when a
   plain source name would be too broad.
3. Capture:
   - one overview screenshot or the provided image that helps remember the item;
   - only the crops that directly support the explanation.
4. Draft one lesson file for the item and one cards file for the item.
5. Save screenshot assets under `content/media/web-giapponese/assets/`.
6. Update:
   - `content/media/web-giapponese/workflow/image-requests.yaml`
   - `content/media/web-giapponese/workflow/image-assets.yaml`
7. Resolve pronunciation audio for every new or revised card entry with:
   `.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media web-giapponese --entry <new-term-or-grammar-id>`
   Pass multiple `--entry` flags for multiple new cards. If Forvo has no audio,
   the workflow must open and record the `word-add` request. Forvo audio must be
   attempted through the Anki/addon-style flow first: dedicated Anki helper,
   `Play(...)` candidates, speaker ranking, direct audio download, and OGG -> MP3
   conversion when needed. Manual download is only an extreme fallback for a
   specific blocked item.
8. Regenerate
   `content/media/web-giapponese/workflow/pronunciation-pending.json` with:
   `./scripts/with-node.sh pnpm pronunciations:pending -- --media-slug web-giapponese`
   so every newly added card without local audio is recorded in the pending
   manifest after the request path has run.
9. Run the repo validation flow before closing.
10. Fetch pitch accents only for the flashcard entries created or revised in
    this task. Prefer entry IDs:
    `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media web-giapponese --entry <new-term-or-grammar-id>`
    Pass multiple `--entry` flags for multiple new cards. Use `--word` or
    `--words-file` only when a reliable entry-id list is not available.
11. Import the updated item into the configured target database with a
    lesson-scoped import:
    `./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese --lesson-slug <new-or-revised-lesson-slug>`
    Use the broader media-scoped import only when the task changed media-wide
    ordering or other content that must apply archive/prune to all
    `web-giapponese` lessons/cards.
12. Treat the work as incomplete if pronunciation resolution, pitch accent fetch,
    import, or cache
    revalidation fails.
13. After a completed item/card workflow with passing required checks, commit
    and push the relevant changes to `main` before closing the task. Stage only
    files created or updated by this workflow, and leave unrelated worktree
    changes unstaged.

## Editorial rules

- A real lesson maps to one real item, not to a source overview.
- Keep the lesson focused on teaching Japanese, not on reviewing the website,
  game, app or card product.
- Treat every importable field as learner-facing unless the content format says
  otherwise. This includes `summary`, textbook body, image captions, `meaning_it`,
  `notes_it`, `back`, and `example_it`.
- Never write author/reviewer notes into importable content: no rationale about
  creating, not creating, deduplicating, canonizing, auditing, validating, or
  sending a card/entry to review. Do not move those notes to another field; omit
  them.
- If Italian naturalness or JP->IT fidelity is uncertain, ask DeepL MCP for a
  second opinion before finalizing: use `mcp__deepl__translate_text` on plain
  Japanese for translation doubts, or `mcp__deepl__rephrase_text` on Italian for
  naturalness doubts. Do not mention DeepL or the check in the saved content.
- Follow `docs/llm-kit/general/10-textbook-lesson-style-standard.md` for the
  textbook prose: tutor-like voice, concrete contextual opening, thematic
  clusters, dense micro-explanations, anatomy of phrase, operational contrasts,
  and ganci cognitivi when useful.
- For compact UI or web pages, keep the standard but scale the page to the real
  item: fewer clusters, strong focus on the visible action, object, particles,
  field, button, confirmation, and operational contrast.
- Keep H1 and Italian headings in sentence case, not Title Case, except for
  proper names, acronyms, and official UI labels.
- Preserve identity frontmatter when revising an existing item: `id`, `slug`,
  `order`, segment/status fields, and other routing fields. `title` is visible
  to the learner: if it still reads like a batch or workflow label, rewrite it
  as a natural sentence-case lesson title aligned with the H1.
- Use the standard's expected body sequence and visual block grammar when the
  item supports it: cluster, dense explanation, example, anatomy, contrast,
  cognitive hook, recap.
- Prefer the recognizable lesson markers from the standard when useful: `🗺️`
  for anatomy, `⚖️` for operational contrasts, `🧠` for cognitive hooks.
- Do not write the item page as a screenshot inventory or UI outline. Every
  section should make the Japanese text more readable in the real item.
- For learner-facing card text, keep the written Japanese surface, not a
  hiragana-only fallback. If a term is normally written with kanji, author the
  visible `front` with kanji plus furigana markup, because review surfaces show
  the card `front` as authored.
- When a textbook link points to a term or grammar entry that has a flashcard
  and the visible label contains kanji, annotate the link label itself with
  furigana in inventories, first explanations, captions, and recaps. Do not
  rely on tooltips, the entry `reading`, or the card `front` to supply the
  reading.
- Do not use dotted ruby readings or ruby on pure katakana. Prefer semantic
  kanji chunks such as `{{目的|もくてき}}{{地|ち}}` over
  `{{目的地|もく.てき.ち}}`; keep `デッキコード` as katakana text or a semantic
  link without furigana.
- In lesson inventories, keep the label, `—`, and the beginning of the gloss on
  the same bullet line. Every inventoried term/pattern must reappear in the
  body with a semantic link or be removed from the inventory.
- Never wrap a Markdown semantic link in backticks. Put code spans only around
  raw Japanese fragments, or use the semantic link outside code formatting.
- Place `:::image` only after the inventory block and `---`, ideally inside the
  cluster that explains the screenshot.
- Do not split lexical compounds kanji-by-kanji when a natural block is more
  readable: use `{{言語|げんご}}{{学|がく}}`,
  `{{課外|かがい}}{{授業|じゅぎょう}}`,
  `{{興味|きょうみ}}{{深|ぶか}}い`, not
  `{{言|げん}}{{語|ご}}{{学|がく}}`,
  `{{課|か}}{{外|がい}}{{授|じゅ}}{{業|ぎょう}}`, or
  `{{興|きょう}}{{味|み}}{{深|ぶか}}い`.
- The ban on "deck/review/flashcard" language is about study-workflow
  metadiscourse. If the source UI really says deck or `デッキコード`, explain it
  as source text while using natural Italian like "mazzo" where appropriate.
- Example sentences may be didactic recombinations, but do not present them as
  exact screen text unless they are copied from the source.
- Seed terms are mandatory.
- Automatic extra flashcards are capped at `5`.
- Automatic extras must be N5-N3 or extremely common and genuinely useful.
- Do not automatically promote highly source-specific labels into flashcards.
  Only do that when the user explicitly asks.
- If a term already exists in another media, create a local occurrence when this
  item adds a useful nuance, example, or review card.
- A card's `entry_id` must represent the full review surface trained by its
  `front`, not merely a shorter lemma contained inside that front. If the front
  is a longer UI phrase, chunk, or inflected form, create or reuse a dedicated
  local entry for that exact surface. Reuse the same `entry_id` only when the
  visible Japanese surface and reading are the same.
- The importer groups glossary/review automatically by normalized written
  surface. `cross_media_group` is optional documentary metadata only; do not use
  it to force a merge or split.
- When the local nuance changes, state that clearly in `notes_it`.
- Reuse a full sentence from the source as `example_jp` only when the whole
  sentence stays readable with already-covered material; otherwise write a
  simpler example that still matches the item context.
- If an item introduces a high-risk shared-kanji contrast that may matter for
  Kanji Clash later, keep the local entry canonical and avoid creating a
  duplicate study card solely to mirror the contrast. See
  `docs/kanji-clash.md` for the workspace contract.
- Prefer one canonical surface and reading over cosmetic variants; if the same
  contrast is already covered elsewhere, reuse that material instead of making
  a second near-clone just to expand pairability.
- If two close forms must stay distinct, explain the nuance in `notes_it` or in
  the lesson rather than splitting the same Japanese into duplicate glossary or
  review surfaces.

## Screenshot rules

- One overview image per item.
- Crops only where the textbook actually explains something.
- Favor visible text and layout that clarify function: navbar, filters, tabs,
  table headers, badges, result boxes, CTA labels, prompt text or rules text.
- Do not insert `:::image` blocks with invented `src` values.

## Output targets

Typical files for one item:

- `content/media/web-giapponese/textbook/<order>-<page-slug>.md`
- `content/media/web-giapponese/cards/<order>-<page-slug>.md`
- related assets under `content/media/web-giapponese/assets/...`

The bundle root already exists:

- `content/media/web-giapponese/media.md`

## Helpful companions

For browser capture and inspection, use:

- `$playwright`

## Verification

For the normal item-builder workflow, where the diff is limited to
`content/media/web-giapponese/**` lesson/card/asset/workflow/pronunciation files
and no app code, parser, importer, routing, DB schema, auth, cache, or UI code
changed, do not run the full `pnpm check` or `pnpm release:check` suites.

Always validate only the affected media bundle:

```bash
./scripts/with-node.sh pnpm content:validate -- --media-slug web-giapponese
```

Then refresh the media-side pronunciation workflows and import the generated
lesson into the configured target database:

```bash
./scripts/with-node.sh pnpm pronunciations:pending -- --media-slug web-giapponese
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media web-giapponese --entry <new-term-or-grammar-id> [--entry <new-term-or-grammar-id> ...]
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media web-giapponese --entry <new-term-or-grammar-id> [--entry <new-term-or-grammar-id> ...]
./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese --lesson-slug <new-or-revised-lesson-slug>
```

Repeat `--lesson-slug` if the item update legitimately spans multiple
textbook routes. Use
`./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese`
only for media-wide cleanup or ordering changes.

If `pitch-accents:fetch` creates or updates
`content/media/web-giapponese/pronunciations.json`, keep that file in the same
change set as the lesson and cards.

Do not run a whole-media pitch accent fetch for normal item-builder batches.
Use the whole-media form only when the user explicitly asks to backfill the
media backlog.

Every new or revised card entry must go through pronunciation resolution before
completion. Finish with local audio in Markdown or `pronunciations.json`; if
Forvo has no pronunciation yet, the workflow must open and record the `word-add`
request instead of leaving the entry silently missing audio. Forvo audio is
retrieved through the Anki/addon-style flow, not as a normal manual download; use
manual import only as an extreme fallback for a specific blocked item.

Keep
`content/media/web-giapponese/workflow/pronunciation-pending.json`
in the same change set as well whenever new cards are added or revised, so the
pending manifest immediately reflects new entries that still lack local audio.

Run broader targeted tests only when the implementation actually changed. If the
renderer, parser, or content model code changed, run:

```bash
./scripts/with-node.sh pnpm test -- tests/textbook.test.ts tests/content.test.ts
```

If importer or DB sync code changed, run:

```bash
./scripts/with-node.sh pnpm test -- tests/importer.test.ts
```

Run `pnpm check` or `pnpm release:check` only if the task also changes app
routing, DB schema, auth, cache revalidation, or user-facing UI outside this
content-only workflow.

## Publish

At the end of every completed Giapponese random item/card workflow, commit and
push the changes after validation, pitch-accent fetch, import, and cache
revalidation have succeeded.

- Do not commit or push if any required verification, import, or cache
  revalidation step fails; report the blocker instead.
- Use explicit `git add` paths for the lesson, cards, assets, workflow
  manifests, pronunciation files, and any skill/documentation files touched by
  the task.
- Do not stage unrelated user changes from the working tree.
- Do not create a task branch for normal item/card workflows. Commit on `main`
  unless the user explicitly asks for a different branch.
- Push `main` to `origin` before the final response.
