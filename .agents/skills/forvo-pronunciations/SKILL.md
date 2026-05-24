---
name: forvo-pronunciations
description: Use when the task is to run the smart pronunciation workflow or Forvo Anki-style retrieval for unresolved Japanese pronunciation audio in the Japanese Custom Study repo. It supports review-scoped, next-lesson, and textbook-page driven batches, always reuses existing audio first, fetches Forvo audio through the Anki/addon-style player extraction flow, and opens word-add requests for true misses.
---

# Forvo Pronunciations

Use this skill for the Japanese Custom Study repo when the user wants Codex to:

- run the smart pronunciation workflow from review, next lesson, or a textbook page;
- add missing pronunciation audio to flashcards or media bundles;
- inspect and refresh the pending pronunciation backlog;
- fetch Japanese pronunciation audio from Forvo;
- import historically requested Forvo pronunciations once they have been
  fulfilled;
- use the Anki/addon-style Forvo helper and the normal browser for word-add;
- process a list of words or entry ids;
- write audio files into `content/media/<slug>/assets/audio/...`;
- update `content/media/<slug>/pronunciations.json`.

This is the only canonical pronunciation skill for this repo. It replaces the
older split `pronunciation-workflow` / `forvo-pronunciations` setup: generic
missing-audio requests, explicit Forvo fetch requests, and extreme manual
fallback cases all start here.

This skill is repo-specific. Use it only inside the Japanese Custom Study repo,
typically at:

- `/Users/abelli/Codex/Japanese Custom Study`

## Workflow

1. Work from the repo root above.
2. Prefer the repo entry point
   `./scripts/with-node.sh pnpm pronunciations:resolve` for normal user
   requests. It is the standard path for `review`, `next-lesson`, and
   `lesson-url`, and it already performs selection, audio-backed filtering,
   cross-media reuse, and then Forvo Anki-style retrieval for the unresolved
   remainder.
3. Before opening Forvo for any entry, always check whether another media
   already has a matching audio-backed card with the same entry type, label,
   and reading. If it exists, reuse/link that audio instead of fetching a new
   one from Forvo.
4. For real downloads, use the Anki/addon logic: run the dedicated Anki helper,
   parse the Forvo page/player `Play(...)` candidates, prefer configured
   speakers, download the direct audio candidate, and convert OGG to MP3 when
   needed.
5. Do not use `curl`, ad hoc HTTP scripts outside the Anki helper, or
   Playwright/headless browser automation as the normal batch path. Playwright
   may be mentioned only for targeted debug or fetcher maintenance.
6. Prefer the repo-scoped wrapper script, which auto-detects
   the repo root from `JAPANESE_CUSTOM_STUDY_ROOT`, the current working tree, or
   known local defaults:

```bash
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode review --media <media-slug>
```

7. For targeted runs, use one of:

```bash
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode review
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode next-lesson --media <media-slug>
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode lesson-url --lesson-url /media/<media-slug>/textbook/<lesson-slug>
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --word 食べる --word 設定
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --entry term-taberu
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --words-file /absolute/path/list.tsv
```

8. Do not add a default batch limit. Process every selected entry after audio-backed, reuse, known-missing, and requested-entry filtering. Pass `--limit` only when the user explicitly asks for a numeric cap or a smoke test.
9. If the browser pauses for manual verification or login, tell the user exactly that and then continue the batch.
10. Prefer `--dry-run` first when the user wants a preview or when selectors may have drifted.
11. If a term is not present on Forvo, open the prefilled `word-add` URL and
    record the miss in `data/forvo-known-missing.json` and
    `data/forvo-requested-word-add.json`; this is the normal outcome for true
    misses.
12. Manual download mode is an extreme fallback only. Use it for a specific item
    only when Anki-style retrieval or direct import fails but the Forvo page
    visibly has usable audio. Do not use it for ordinary batches, and report why
    the fallback was needed.
13. Keep the word-add prefill enabled. When an entry is a true miss, the command
    must record it in `data/forvo-requested-word-add.json` and open the
    prefilled `word-add/...` URL with the repo `jcs_*` hints for the
    Tampermonkey helper.
    Only Japanese lookup text is requestable: if a grammar label has no
    pronounceable Japanese query after markup/placeholder cleanup, record it as
    missing but do not open a garbage `word-add` request.
    If the authenticated Forvo `word-add` form rejects the canonical Japanese
    query after selecting Japanese, do not mark the entry as requested. Keep it
    in `data/forvo-known-missing.json` with `wordAddBlockedReason` /
    `wordAddBlockedDetail` so future ordinary batches skip it until the query is
    corrected or an explicit blocked retry is requested.
14. `./scripts/with-node.sh pnpm pronunciations:forvo` remains the low-level
    command for explicit fetcher targets, debug, and extreme manual fallback.
    Only mention Playwright when the user explicitly wants to test or debug
    fetcher internals.
15. For Forvo requests that were already submitted through `word-add` and later
    fulfilled, scan the authenticated Forvo account requested-pronunciations
    page, build an audio index, then import it with:

```bash
./scripts/with-node.sh pnpm pronunciations:forvo:import-requested -- --audio-index /tmp/forvo-requested-audio-index.json
```

    The importer downloads the indexed direct audio, converts OGG to MP3, marks
    matching `data/forvo-requested-word-add.json` entries as resolved, removes
    matching known-missing rows, and refreshes pending summaries.

16. If a task creates or revises flashcards, pronunciation resolution is
    mandatory before completion for every touched card entry. Each entry must end
    with local audio in Markdown or `pronunciations.json`, or with a recorded
    Forvo `word-add` request when Forvo does not yet have the pronunciation.
    Do not leave newly created card entries silently missing audio.
17. This skill normally updates pronunciation audio artifacts only. If the same
    task also creates or revises local flashcard entries, run the pitch accent
    workflow after the content edit and before import, targeted to those new
    entries:
    `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --entry <new-term-or-grammar-id>`
    Pass multiple `--entry` flags as needed; use `--word` / `--words-file`
    only when the entry IDs are not available. Do not use a whole-media pitch
    accent fetch for normal content-creation follow-up.
18. This skill does not define textbook prose. If a pronunciation request
    expands into creating or revising lesson text, load the relevant
    content-building workflow and follow
    `docs/llm-kit/general/10-textbook-lesson-style-standard.md` for voice and
    explanation quality.

## Input format

`--words-file` supports:

- one word per line, for example `食べる`
- `word<TAB>reading`
- `word<TAB>reading<TAB>entry_id`
- a direct `term-...` or `grammar-...` entry id on its own line

## Guardrails

- Keep the Anki helper profile under `data/forvo-anki-profile` unless the user asks otherwise.
- Keep the known-missing registry under `data/forvo-known-missing.json` unless the user asks otherwise.
- For `review`, support both the global scope and the filtered `--media <slug>`
  scope; the default without `--media` is global. Review mode must not impose
  an implicit `--limit`; it should cover every active review card in scope.
- For all modes, never add an implicit `--limit`; only preserve one provided
  explicitly by the user.
- For `next-lesson`, use the same repo semantics as the textbook resume CTA:
  first lesson whose status is not `completed`.
- For `lesson-url`, accept only the app textbook route shape
  `/media/<media-slug>/textbook/<lesson-slug>` or a full URL to that route.
- Cross-media reuse is mandatory before Forvo. If another media already has a
  matching audio-backed entry, reuse/link it and do not ask the user to fetch a
  new Forvo MP3 for that item.
- Use only the unresolved remainder as Forvo input; do not run Forvo blindly on
  the whole bundle by default.
- For normal user-facing runs, Anki-style retrieval is mandatory for Forvo audio:
  helper profile, `Play(...)` candidates, speaker ranking, direct
  audio download, and OGG -> MP3 conversion when needed.
- Manual mode is not a normal path. Use it only as an extreme fallback for a
  single blocked item, and state why the standard fetch failed.
- Never propose `curl` or ad hoc HTTP scraping outside the Anki helper as a workflow.
- If you need Playwright, state clearly that you are switching to a debug or
  maintenance flow, not a normal batch fetch.
- For account requested-pronunciation backfills, only import entries that can be
  matched to local `word-add` history and have a concrete audio candidate in the
  extracted index.
- Never disable the word-add request prefill for missing entries.
- Do not invent new asset locations or manifest formats; use the repo conventions already implemented by the command.
- If Forvo returns no candidate for a word, record it as a miss, open/register
  `word-add`, and continue.
- A historical `word-add` row whose URL no longer matches the current
  normalization is not a valid current request. Let the request workflow reopen
  the canonical URL and update `data/forvo-requested-word-add.json`.
- A `word-add` row that Forvo rejected in the form is not a valid request.
  Remove it from `data/forvo-requested-word-add.json`, keep the known-missing
  row, and set `wordAddBlockedReason` so the batch request command does not
  loop on it.
- Before opening a large `word-add` batch, make sure the local Tampermonkey
  helper is version 0.11 or newer so autosubmitted `/word-add-success/<word>/`
  tabs close themselves.
- If matching a word list to glossary entries is ambiguous, report the skipped rows instead of forcing a guess.

## Verification

For normal skill runs that only update pronunciation artifacts such as
`content/media/<slug>/assets/audio/**`, `content/media/<slug>/pronunciations.json`,
`content/media/<slug>/workflow/pronunciation-pending.json`,
`data/forvo-known-missing.json`, or `data/forvo-requested-word-add.json`, do not
run the full `pnpm check` or `pnpm release:check` suites.

For each media bundle whose pronunciation manifest or audio assets changed, run
only:

```bash
./scripts/with-node.sh pnpm content:validate -- --media-slug <media-slug>
./scripts/with-node.sh pnpm content:import -- --media-slug <media-slug>
```

If the pronunciation update is part of a known single-lesson content edit, you
may use the narrower import form instead:

```bash
./scripts/with-node.sh pnpm content:import -- --media-slug <media-slug> --lesson-slug <lesson-slug> [--lesson-slug <lesson-slug> ...]
```

Keep the media-scoped import when the run touched entries across review,
multiple unknown lessons, or a media-wide pending backlog.

If the run only changed `data/forvo-known-missing.json` or
`data/forvo-requested-word-add.json` and no content media file changed, no repo
test is required; report the registry update.

If you edit pronunciation or Forvo implementation code, wrapper scripts, or the
selection workflow, run the targeted subsystem tests instead of the full suite:

```bash
./scripts/with-node.sh pnpm test -- tests/pronunciation-resolve.test.ts tests/pronunciation-workflow.test.ts tests/pronunciation-reuse.test.ts tests/forvo-pronunciation-fetch.test.ts tests/forvo-known-missing.test.ts tests/forvo-word-add.test.ts tests/forvo-pronunciations-wrapper.test.ts tests/pronunciation-runtime-boundary.test.ts
```

Run `pnpm check` or `pnpm release:check` only if the task also changes app
routing, DB schema, importer/sync code, auth, cache revalidation, or
user-facing UI outside the pronunciation workflow.

## References

- Repo command docs: `docs/forvo-pronunciation-fetch.md`
- Workflow overview: `docs/pronunciation-workflow.md`
- Wrapper script: `/Users/abelli/Codex/Japanese Custom Study/.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh`
