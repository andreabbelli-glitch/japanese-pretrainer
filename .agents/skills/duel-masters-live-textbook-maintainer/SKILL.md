---
name: duel-masters-live-textbook-maintainer
description: Create per-card Duel Masters DM25 live encounter lessons and flashcards from card screenshots, using the screenshot only for identification and then sourcing official or dedicated-page card art plus verified Japanese rules text while avoiding duplicate glossary entries and redundant review cards.
---

# Duel Masters Live Textbook Maintainer

Use this skill when the user gives you a Duel Masters card screenshot and wants
the DM25 textbook plus flashcards updated.

The screenshot is an identification aid. The final content should be built
around a dedicated per-card lesson, a clean card asset, and verified Japanese
text.

## Primary Objective

The primary objective of this workflow is teaching the user Japanese.

- Textbook, glossary, and flashcards exist first to improve Japanese reading.
- The main study targets are important words, kanji, reusable chunks, and
  grammar patterns.
- Gameplay explanation matters only insofar as it helps clarify the Japanese.
- If there is any doubt between "flashcard for mechanics" and "flashcard for
  Japanese", choose the Japanese-learning target.

This skill is repo-specific. Work in:

- `/Users/abelli/Codex/Japanese Custom Study`

This repo-scoped skill is versioned at
`.agents/skills/duel-masters-live-textbook-maintainer`.

Primary target files:

- `content/media/duel-masters-dm25/textbook/*-live-duel-encounters-*.md`
- `content/media/duel-masters-dm25/textbook/*-keyword-effects-reference.md`
- `content/media/duel-masters-dm25/cards/*-live-duel-encounters-*.md`
- `content/media/duel-masters-dm25/cards/*.md`
- `content/media/duel-masters-dm25/assets/cards/*`

## Workflow

1. Identify the card from the screenshot.

- Read the screenshot carefully enough to identify the exact card.
- Transcribe the exact Japanese card name.
- Extract races, keyword labels, and every effect line that is visible.
- Treat the screenshot as a lookup aid, not as the final image asset.

2. Source the clean card art and verified Japanese text.

- Once the exact card name is identified, look for the official card detail page
  first, preferably on `https://dm.takaratomy.co.jp/card/detail/`.
- If the official page is missing, incomplete, or unusable, search for the
  dedicated card page, preferably on
  `https://duelmasters.fandom.com/wiki/Duel_Masters_Wiki`.
- Use the official card detail page as the default external source of truth
  when available for:
  - clean card art
  - Japanese card name
  - printed Japanese effect text
- Use the dedicated card page as the fallback source of truth for:
  - clean card art
  - Japanese card name
  - keyword labels
  - effect text or effect paraphrase when the page provides it
- Do not ship the user's screenshot or tabletop photo as the final asset when
  an official card image or dedicated-page card image exists.
- For a single-card lesson, the final `:::image` should normally be the clean
  card art from the official page or dedicated card page, not the uploaded
  screenshot.
- Save the chosen asset under
  `content/media/duel-masters-dm25/assets/cards/<slug>.<ext>` with a stable,
  descriptive filename.
- Only keep the user's screenshot as the final asset if no verified public card
  art exists or if the lesson is explicitly about a printing or physical
  variant that the official image would hide. If so, say that clearly in the
  lesson.
- Before closing the task, sanity-check the chosen asset. If it shows a table,
  sleeve glare, camera perspective, fingers, background clutter, or camera
  metadata, treat that as a strong sign that the wrong file was imported for a
  per-card lesson.
- If the page and screenshot differ, prefer the dedicated card page unless the
  screenshot clearly shows a different printing or variant. In that case,
  reconcile cautiously and explain only the variant actually being imported.

3. Reuse existing IDs first.

- Search with `rg` in `content/media/duel-masters-dm25/cards` and the relevant
  `textbook/` files.
- Reuse existing `term.id` and `grammar.id` when the concept is already in the
  media.
- Do not create a second glossary entry for the same keyword, grammar chunk, or
  repeated rules-text expression.
- Before creating flashcards, search for existing cards that already train the
  same reading task.
- If the new material could later feed `Kanji Clash`, keep the canonical
  orthography and reading stable; do not create near-duplicate cards or lessons
  just to manufacture extra pair candidates.
- When two close forms really stay distinct in the corpus, keep one canonical
  glossary surface per form and explain the nuance in notes or lesson prose
  instead of splitting the same Japanese into duplicate study surfaces.

4. Create a new per-card live encounter lesson.

- Do not append the new card to
  `textbook/021-live-duel-encounters-crash-hadou.md`.
- Create a new textbook page for the card, using the same structural template
  and editorial shape as
  `textbook/021-live-duel-encounters-crash-hadou.md`.
- The new lesson must stay in the `live-duel-encounters` sequence:
  - `segment_ref: live-duel-encounters`
  - a fresh `id`, `slug`, `title`, `summary`, and tags for the new card
  - a fresh filename of the form
    `textbook/<NNN>-live-duel-encounters-<slug>.md`
- Choose `<NNN>` as the next free numeric prefix that is not already used in
  `textbook/`.
- Set `order` to the next integer after the current maximum `order` among the
  textbook lessons with `segment_ref: live-duel-encounters`.
- Keep the live encounter lessons contiguous as a section. If the new `order`
  would collide with or overtake the keyword bank or later DM25 textbook pages,
  renumber those later textbook pages so the live encounter block remains in
  sequence before the keyword bank.
- If the import produces new canonical glossary entries or new flashcards,
  prefer a matching cards file with the same numeric prefix and slug:
  `cards/<NNN>-live-duel-encounters-<slug>.md`
- If the card adds only textbook explanation and no new glossary/review
  material, do not force a new `cards/` file.
- When you do create the matching cards file, keep it aligned with the
  textbook lesson on `slug`, `segment_ref`, and `order`.
- The lesson `summary` is UI plain text:
  - do not use semantic links like `[...](term:...)` or `[...](grammar:...)`
  - do not use furigana markup like `{{漢字|かな}}`
  - do not use backticks or markdown formatting
  - write a short plain-text sentence that still reads well when rendered raw

5. Write the textbook lesson like a real card-reading page.

- Use one `:::image` block for the clean card asset.
- Keep keyword labels in a compact list when they are already covered by the
  keyword bank.
- Use `:::example_sentence` for the effect lines that genuinely need parsing or
  translation support.
- For each effect line you keep, use:
  - `jp`
  - `translation_it`
  - `reveal_mode: sentence`
- Keep Japanese effect lines exact or very close to the verified card text when
  possible.
- After the effects, explain the Japanese concretely:
  - clause structure
  - particles
  - conditionals
  - timing windows
  - subject / target resolution
  - state expressions
- Explain the game consequence only as support for reading the Japanese.
- Do not write meta framing about the page, the workflow, the lesson strategy,
  or the fact that the card was imported from a screenshot.

6. Update the keyword bank only when needed.

- If the screenshot / card page contains a keyword already present in
  `textbook/*-keyword-effects-reference.md`, do not duplicate the section
  unless the new card introduces a genuinely new Japanese chunk worth
  preserving.
- If the keyword is new, add one keyword section in alphabetical order.
- Each keyword section should contain:
  - heading with the keyword
  - one `:::example_sentence` block with a compact Japanese operational
    definition
  - optionally one short note about the key chunk to recognize

7. Create all flashcards that satisfy the editorial criteria.

- Do not stop after one or two cards if more cards clearly satisfy the
  criteria.
- Do not create cards just to mirror every line on the card.
- The flashcard goal is Japanese literacy, not rules memorization.
- Bias toward creating a card when a candidate teaches useful Japanese and is
  not already covered elsewhere in the media. In this repo, a small excess of
  justified cards is better than systematically missing learnable Japanese.
- In every `:::card`, annotate Japanese that uses kanji with furigana whenever
  the visible field is meant to teach or review reading.
- For `example_jp`, prefer a short paraphrase that stays faithful to the real
  Duel Masters situation over a fake dictionary-style composition demo.
- Reuse a real source sentence only when the target entry appears there as a
  natural unit and the full sentence stays readable with the current study
  corpus.
- If the entry was extracted from a longer collocation and does not appear on
  its own in the source text, write a new natural Duel Masters-domain sentence
  that uses the extracted term correctly on its own.
- `example_jp` must show live usage of the target Japanese, not explain the
  word itself.
- Never write metalinguistic examples such as `XにYがつくと...`,
  `XはYの意味`, `Xという言葉は...`, or any sentence where the target term is
  being discussed instead of used.
- If you need to explain morphology, compositional meaning, or how a longer
  expression is built, put that in `notes_it`, not in `example_jp`.
- This applies at minimum to `front` and `example_jp`, and also to any Japanese
  quoted in `notes_it` when that Japanese is part of the teaching point.
- Annotate all visible numbers with furigana as well, not only the hard ones:
  use `{{4|よん}}`, `{{5000|ごせん}}`, `{{-3000|マイナスさんぜん}}`, and
  similar forms instead of leaving bare numerals in review-facing Japanese.
- For `:::grammar` entries, if the `pattern` contains kanji or a non-trivial
  reading, add an explicit `reading` field.
- Treat mixed kana+kanji patterns the same way: `それ以外なら`, `その中から`,
  and similar forms still need furigana in visible review text and a declared
  reading in the grammar entry.
- For numbers, use one furigana block on the whole visible numeric chunk,
  whether the number stands alone or comes with counters, qualifiers, signs, or
  units: `{{4|よん}}`, `{{5000|ごせん}}`, `{{-3000|マイナスさんぜん}}`,
  `{{1枚|いちまい}}`, `{{4以下|よんいか}}`, `{{4つ以上|よっついじょう}}`,
  `{{2つ|ふたつ}}`.
- When a number is paired with a counter, the reading must be the correct
  lexicalized reading of the full chunk, never a guessed composition. Check it
  explicitly before finishing, for example `{{1体|いったい}}`,
  `{{2つ|ふたつ}}`, `{{2回|にかい}}`, `{{4枚|よんまい}}`.
- Do not leave review-facing Japanese like `無月の門`, `堕魔`, `4枚`,
  `コスト4以下`, or similar chunks without furigana in newly created cards.

Default positive criteria:

- create a flashcard by default for a new lemma with kanji when the media does
  not already contain an entry or card that covers the same reading task;
- create a flashcard by default for a new grammar pattern or structural chunk
  when the media does not already contain an entry or card that covers the same
  reading task, even if the chunk is short;
- create a flashcard when it trains an important kanji, reading, or compound;
- create a flashcard when it fixes reusable Japanese vocabulary or rules-text
  chunks that are likely to recur;
- create a flashcard when a general-Japanese expression becomes easier to learn
  by seeing how it specializes in Duel Masters rules text;
- create a flashcard when it captures a grammar pattern that unlocks many other
  sentences in the corpus;
- create a flashcard when a small but structurally decisive Japanese element
  controls scope, totality, reference resolution, target selection, or grouped
  quantities in the rules text;
- create a flashcard when it covers a compact but recurring label or keyword
  that is not transparent and is useful beyond a single one-off screenshot;
- create a concept card for a full effect chunk only when the learning value is
  in the Japanese form itself, not in an abstract mechanics summary.

Default negative criteria:

- do not create flashcards that only teach "what the card does" without
  training a concrete Japanese form;
- do not create backs that paraphrase gameplay but do not improve reading of
  the original Japanese;
- do not create cards for pure ruling detail if the Japanese itself is not the
  study target;
- do not create flashcards for the proper name of a creature just to memorize
  that creature's name; creature names are not a useful Japanese-learning
  target for this workflow;
- do not create pure katakana cards unless the term is genuinely opaque,
  recurring, and needed for corpus literacy;
- do not create cards for acronyms, product codes, set codes, event names, or
  highly vertical details with little reuse;
- do not skip a non-duplicate card just because its corpus reuse is not yet
  proven, if the Japanese form itself is clearly useful to learn;
- do not create near-duplicate cards when an existing recognition or concept
  card already covers the same reading task.
- Treat `Kanji Clash` eligibility as downstream from canonical content: if a
  form is already covered elsewhere, reuse it rather than splitting the same
  Japanese into cosmetically different study surfaces.

Priority order when choosing among candidates:

1. grammar and recurring sentence patterns
2. reusable Japanese vocabulary and chunks
3. kanji and compounds that improve general literacy
4. recurring compact labels or keywords
5. only then highly vertical but structurally important corpus terms

Practical card-selection rules:

- if a term or pattern is new, non-duplicate, and genuinely teaches Japanese,
  prefer making the flashcard instead of stopping at the textbook explanation;
- only stop at the textbook explanation when the candidate is mainly a local
  mechanics detail, a pure proper name, a transparent katakana item with weak
  learning value, or an existing card already covers the same reading task;
- for a creature card, use the proper name as lesson context only; do not add a
  term entry or flashcard for the creature's proper name unless the user
  explicitly asks for name memorization as a separate goal;
- if several candidates satisfy the criteria, create all of them, provided they
  are not duplicates;
- do not ignore "small" items just because they are written in kana or look
  simple; words like `すべて`, `それ`, `それら`, `その中`, `各`, or similar
  markers can deserve a card when they change who is affected, how many cards
  are counted, or which earlier group the sentence points back to;
- before adding one of these structural items, search the media for an existing
  term, grammar entry, or flashcard that already covers the same reading task;
- recognition cards are the default for new useful lemmas, keywords, and
  readings, especially when they contain kanji;
- concept cards are better for multi-part effect chunks that combine condition,
  timing, and payoff in a reusable Japanese form;
- concept cards are also the default for new grammar chunks and small
  structural patterns that unlock the sentence, even when they look simple;
- creature proper-name cards are off by default and should normally never be
  created, because they optimize for memorizing a card title rather than
  learning reusable Japanese.

8. Validate before finishing.

- Check that the new textbook lesson, cards file, and asset path all exist and
  point to the same card.
- Check that `id`, `slug`, `order`, `segment_ref`, links, and asset references
  are internally coherent.
- For the normal live-card workflow, where the diff is limited to
  `content/media/duel-masters-dm25/**` lesson/card/asset/pronunciation files and
  no app code, parser, importer, routing, DB schema, auth, cache, or UI code
  changed, do not run the full `pnpm test`, `pnpm check`, or
  `pnpm release:check` suites.
- Always validate only the affected media bundle:
  `./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25`
- Also run only the two Vitest cases that exercise the real DM25 bundle parse
  and import paths:
  `./scripts/with-node.sh pnpm test -- tests/content.test.ts tests/importer.test.ts -t "real Duel Masters bundle"`
- If the DM25 real bundle changes in a way that alters observable parser/import
  expectations, align only the affected real-bundle assertions or fixtures in
  the same diff.
- Treat this as alignment work, not as a generic "fix the tests" rule: update
  expectations only when the content change really affects asserted lesson
  slugs, cards-file IDs, term IDs, grammar IDs, card IDs, reference links,
  source-file counts, imported row checks, alias totals, entry-link totals, or
  other asserted real-bundle outputs.
- If the real-bundle fixture stats become stale, update them with the repo
  command:
  `./scripts/with-node.sh pnpm content:test-stats -- --write`
- If a test fails because of a real code bug, fix the code first instead of
  weakening or rewriting the assertion to match the bug.
- Run broader targeted tests only when the implementation actually changed.
  If the renderer, parser, or content model code changed, run:
  `./scripts/with-node.sh pnpm test -- tests/textbook.test.ts tests/content.test.ts`
- If importer or DB sync code changed, run:
  `./scripts/with-node.sh pnpm test -- tests/importer.test.ts`
- If app routing, DB schema, auth, cache revalidation, or user-facing UI changed,
  follow the repo-level gate in `AGENTS.md` instead of this content-only shortcut.
- Do not consider the task complete until the relevant tests pass and any test
  or fixture updates caused by the new content have been committed alongside
  the content change.
- After creating new glossary or grammar entries for the card, fetch pitch
  accents for the affected media bundle before finishing.
- Use the repo workflow:
  `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media duel-masters-dm25`
- Let the workflow save `pitch_accent`, `pitch_accent_source`, and
  `pitch_accent_page_url` into `pronunciations.json` when it resolves them.
- After adding or revising cards, regenerate
  `content/media/duel-masters-dm25/workflow/pronunciation-pending.json`
  with:
  `./scripts/with-node.sh pnpm pronunciations:pending -- --media-slug duel-masters-dm25`
  so every newly created entry without local audio is recorded in the pending
  manifest.
- If some new entries remain unresolved, report which ones were misses or
  source errors.
- Treat the pitch-accent fetch as part of completion, not as an optional extra:
  new card content is not done until this check has been run and the outcome is
  reported.
- Run `./scripts/with-node.sh pnpm content:import -- --media-slug duel-masters-dm25`
  against the real workspace database before finishing, not only a temporary
  test harness import.
- If the import fails because the database schema is missing, run
  `./scripts/with-node.sh pnpm db:migrate` for the configured database and then
  rerun
  `./scripts/with-node.sh pnpm content:import -- --media-slug duel-masters-dm25`.
- Do not consider the task complete until the real import succeeds.
- Keep
  `content/media/duel-masters-dm25/workflow/pronunciation-pending.json`
  in the same change set whenever new cards are added or revised, so the
  pending manifest immediately reflects new entries that still lack local
  audio.

## Editorial rules

- Explanations must focus on what is new in the current corpus, not repeat the
  whole base theory every time.
- In associated card `notes_it`, prefer this shape when it fits the material:
  explain first the general Japanese meaning of the word or pattern, then
  explain how that same meaning narrows or specializes in the Duel Masters
  context.
- Use `無視する` as the model example for that card-note shape: first clarify
  that in general Japanese it means "to ignore, not consider something", then
  explain what that implies on the card or in the rules text being read now.
- Flashcards must focus on Japanese learning targets: kanji, vocabulary chunks,
  and grammar patterns that help the learner read future cards more easily.
- When choosing what to add, prioritize important Japanese words and important
  Japanese grammar before keyword summaries or mechanical reminders.
- A gameplay idea is worth a flashcard only when it is anchored to a Japanese
  form the learner needs to recognize.
- All final Italian prose must be orthographically correct: use proper accents
  like `è`, `può`, `più`, `già`, `cioè`, `così`, `perché`, and never leave
  degraded ASCII Italian in the final content.
- Prefer existing semantic links like `[...](term:...)` and `[...](grammar:...)`
  when the entry already exists in body prose, captions, and structured blocks,
  but not inside frontmatter fields like `summary`.
- If a new import introduces a high-risk shared-kanji contrast that might be
  useful for Kanji Clash later, keep the canonical lemma and reading stable and
  avoid creating a duplicate card just to mirror that contrast. See
  `docs/kanji-clash.md` for the workspace contract.

## Never Do This

Do not write meta or tautological explanations like these:

- `Da qui in poi questa pagina non e piu una monografia su una sola carta: diventa l'archivio progressivo delle carte che incontro davvero durante il gioco.`
- `Il punto piu importante non e la keyword offensiva in se, ma il blocco タップ状態でいたら: qui non basta sapere cos'e タップ, bisogna riconoscere lo stato gia presente nel momento del controllo.`

Why these are wrong:

- they explain the page instead of the Japanese;
- they describe importance vaguely instead of parsing the phrase;
- they do not tell the learner how the grammar works.

Replace that style with concrete analysis such as:

- `タップ状態` = noun phrase meaning "tapped state"
- `でいる` = be in that state
- `〜たら` = if/when
- `このターンの後に` = after this turn

## Templates

Live encounter effect block:

```md
:::example_sentence
jp: >-
このクリーチャーが{{破壊|はかい}}された{{時|とき}}、...
translation_it: >-
Quando questa creatura viene distrutta, ...
reveal_mode: sentence
:::
```

Keyword bank block:

```md
### [B・A・D 2](term:term-b-a-d-two)

:::example_sentence
jp: >-
[B・A・D 2](term:term-b-a-d-two)：...
translation_it: >-
B.A.D 2: ...
reveal_mode: sentence
:::
```
