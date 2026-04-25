---
name: forvo-pronunciations
description: Use when the task is to run the smart pronunciation workflow or the Forvo fallback for unresolved Japanese pronunciation audio in the Japanese Custom Study repo. It supports review-scoped, next-lesson, and textbook-page driven batches, always reuses existing audio first, runs offline fetch before Forvo, and uses manual Forvo only for the final unresolved remainder.
---

# Forvo Pronunciations

Use this skill for the Japanese Custom Study repo when the user wants Codex to:

- run the smart pronunciation workflow from review, next lesson, or a textbook page;
- add missing pronunciation audio to flashcards or media bundles;
- inspect and refresh the pending pronunciation backlog;
- fetch Japanese pronunciation audio from Forvo;
- use a real logged-in browser/manual session;
- process a list of words or entry ids;
- write audio files into `content/media/<slug>/assets/audio/...`;
- update `content/media/<slug>/pronunciations.json`.

This is the only canonical pronunciation skill for this repo. It replaces the
older split `pronunciation-workflow` / `forvo-pronunciations` setup: generic
missing-audio requests and explicit Forvo fallback requests both start here.

This skill is repo-specific. Use it only inside the Japanese Custom Study repo,
typically at:

- `/Users/abelli/Codex/Japanese Custom Study`

## Workflow

1. Work from the repo root above.
2. Prefer the repo entry point
   `./scripts/with-node.sh pnpm pronunciations:resolve` for normal user
   requests. It is the standard path for `review`, `next-lesson`, and
   `lesson-url`, and it already performs selection, audio-backed filtering,
   cross-media reuse, offline fetch, and only then the manual Forvo fallback.
3. Before opening Forvo for any entry, always check whether another media
   already has a matching audio-backed card with the same entry type, label,
   and reading. If it exists, reuse/link that audio instead of fetching a new
   one from Forvo.
4. For real downloads, always use manual mode in the user’s normal browser. Do
   not start Playwright unless the user explicitly asks to debug the automated
   browser flow.
5. Prefer the repo-scoped wrapper script, which is manual-first and auto-detects
   the repo root from `JAPANESE_CUSTOM_STUDY_ROOT`, the current working tree, or
   known local defaults:

```bash
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode review --media <media-slug>
```

6. For targeted runs, use one of:

```bash
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode review
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode next-lesson --media <media-slug>
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --mode lesson-url --lesson-url /media/<media-slug>/textbook/<lesson-slug>
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --word 食べる --word 設定
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --entry term-taberu
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --words-file /absolute/path/list.tsv
```

7. Default the batch size to `10` unless the user asks for a different size or a tighter smoke test.
8. If the browser pauses for manual verification or login, tell the user exactly that and then continue the batch.
9. Prefer `--dry-run` first when the user wants a preview or when selectors may have drifted.
10. Manual mode means: open the Forvo URL in the user’s real browser, wait for the downloaded MP3 in `~/Downloads`, and import it into the repo. Do not claim or assume that Downloads cleanup happens automatically.
11. In manual mode, if a term is not present on Forvo, tell the user they can either type `s` and Enter in the terminal or trigger the local browser control URL `http://127.0.0.1:3210/skip`; this persists the entry as known-missing and skips it in future runs.
12. `./scripts/with-node.sh pnpm pronunciations:forvo` remains the low-level
    command for explicit fallback batches and debug. Only use the raw automated
    Playwright path without `--manual` when the user explicitly wants to test
    or debug the browser fetcher.

## Input format

`--words-file` supports:

- one word per line, for example `食べる`
- `word<TAB>reading`
- `word<TAB>reading<TAB>entry_id`
- a direct `term-...` or `grammar-...` entry id on its own line

## Guardrails

- Keep the browser profile under `data/forvo-profile` unless the user asks otherwise.
- Keep the known-missing registry under `data/forvo-known-missing.json` unless the user asks otherwise.
- For `review`, support both the global scope and the filtered `--media <slug>`
  scope; the default without `--media` is global.
- For `next-lesson`, use the same repo semantics as the textbook resume CTA:
  first lesson whose status is not `completed`.
- For `lesson-url`, accept only the app textbook route shape
  `/media/<media-slug>/textbook/<lesson-slug>` or a full URL to that route.
- Cross-media reuse is mandatory before Forvo. If another media already has a
  matching audio-backed entry, reuse/link it and do not ask the user to fetch a
  new Forvo MP3 for that item.
- Use only the unresolved remainder as Forvo input; do not run Forvo blindly on
  the whole bundle by default.
- For normal user-facing runs, manual mode is mandatory. If you need the Playwright path, state clearly that you are switching to a debug flow.
- Do not invent new asset locations or manifest formats; use the repo conventions already implemented by the command.
- If Forvo returns no candidate for a word, skip it and continue.
- If matching a word list to glossary entries is ambiguous, report the skipped rows instead of forcing a guess.

## Verification

After workflow changes, run at least:

```bash
./scripts/with-node.sh pnpm check
```

For content workflow changes, real bundle imports, or user-visible flows, also
run:

```bash
./scripts/with-node.sh pnpm release:check
```

## References

- Repo command docs: `docs/forvo-pronunciation-fetch.md`
- Workflow overview: `docs/pronunciation-workflow.md`
- Wrapper script: `/Users/abelli/Codex/Japanese Custom Study/.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh`
