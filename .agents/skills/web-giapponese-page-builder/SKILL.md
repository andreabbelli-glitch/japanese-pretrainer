---
name: web-giapponese-page-builder
description: Use when the user wants to create or revise a Japanese Web study page in the Japanese Custom Study repo from a public URL, with textbook content, flashcards, and screenshot assets derived from the rendered page.
---

# Web Giapponese Page Builder

Use this skill inside:

- `/Users/abelli/Codex/Japanese Custom Study`

This repo-scoped skill is versioned at
`.agents/skills/web-giapponese-page-builder`.

Trigger this skill when the request is like:

- add a new page to `web-giapponese`;
- turn this Japanese URL into a textbook lesson and flashcards;
- study this site page;
- generate screenshots and crops for a web page lesson.

## Required grounding

Before writing content, read:

- `docs/llm-kit/general/01-content-format.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- `docs/llm-kit/general/06-content-workflow-playbook.md`
- `docs/llm-kit/media/web-giapponese/01-brief.md`
- `docs/llm-kit/media/web-giapponese/02-batch-prompt.md`

## Inputs

Required:

- public URL;
- seed terms or seed phrases that must become study material.

Optional:

- copied page text;
- focus areas like navbar, filters, tabs, table, result box, badges, ranking;
- short note describing what is hard about the page.

## Canonical workflow

1. Open the page in a real browser and treat the rendered page as the primary
   source of truth.
2. Identify the site section slug using `domain + thematic area` when a plain
   domain would be too broad.
3. Capture:
   - one overview screenshot that helps remember the page;
   - only the crops that directly support the explanation.
4. Draft one lesson file for the page and one cards file for the page.
5. Save screenshot assets under `content/media/web-giapponese/assets/`.
6. Update:
   - `content/media/web-giapponese/workflow/image-requests.yaml`
   - `content/media/web-giapponese/workflow/image-assets.yaml`
7. Regenerate
   `content/media/web-giapponese/workflow/pronunciation-pending.json` with:
   `./scripts/with-node.sh pnpm pronunciations:pending -- --media-slug web-giapponese`
   so every newly added card without local audio is recorded in the pending
   manifest.
8. Run the repo validation flow before closing.
9. Fetch pitch accents for the updated media with:
   `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media web-giapponese`
10. Import the updated media into the configured target database with:
    `./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese`
11. Treat the work as incomplete if pitch accent fetch, import, or cache
    revalidation fails.

## Editorial rules

- A real lesson maps to one real page, not to a site overview.
- Keep the lesson focused on teaching Japanese, not on reviewing the website as
  a product.
- For learner-facing card text, keep the written Japanese surface, not a
  hiragana-only fallback. If a term is normally written with kanji, author the
  visible `front` with kanji plus furigana markup, because review surfaces show
  the card `front` as authored.
- Seed terms are mandatory.
- Automatic extra flashcards are capped at `5`.
- Automatic extras must be N5-N3 or extremely common and genuinely useful.
- Do not automatically promote highly site-specific labels into flashcards.
  Only do that when the user explicitly asks.
- If a term already exists in another media, create a local occurrence when this
  page adds a useful nuance, example, or review card.
- The importer groups glossary/review automatically by normalized written
  surface. `cross_media_group` is optional documentary metadata only; do not use
  it to force a merge or split.
- When the local nuance changes, state that clearly in `notes_it`.
- Reuse a full sentence from the page as `example_jp` only when the whole
  sentence stays readable with already-covered material; otherwise write a
  simpler example that still matches the page context.
- If a page introduces a high-risk shared-kanji contrast that may matter for
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

- One overview image per page.
- Crops only where the textbook actually explains something.
- Favor visible text and layout that clarify function: navbar, filters, tabs,
  table headers, badges, result boxes, CTA labels.
- Do not insert `:::image` blocks with invented `src` values.

## Output targets

Typical files for one page:

- `content/media/web-giapponese/textbook/<order>-<page-slug>.md`
- `content/media/web-giapponese/cards/<order>-<page-slug>.md`
- related assets under `content/media/web-giapponese/assets/...`

The bundle root already exists:

- `content/media/web-giapponese/media.md`

## Helpful companions

For browser capture and inspection, use:

- `$playwright`

## Verification

Always run:

```bash
cd /Users/abelli/Codex/Japanese\ Custom\ Study
./scripts/with-node.sh pnpm check
```

Then fetch pitch accents and import the generated lesson into the configured
target database:

```bash
cd /Users/abelli/Codex/Japanese\ Custom\ Study
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media web-giapponese
./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese
```

If `pitch-accents:fetch` creates or updates
`content/media/web-giapponese/pronunciations.json`, keep that file in the same
change set as the lesson and cards.

Keep
`content/media/web-giapponese/workflow/pronunciation-pending.json`
in the same change set as well whenever new cards are added or revised, so the
pending manifest immediately reflects new entries that still lack local audio.

If the work touches UI-visible flows, content workflow integration, or the real
bundle verification path, also run:

```bash
cd /Users/abelli/Codex/Japanese\ Custom\ Study
./scripts/with-node.sh pnpm release:check
```
