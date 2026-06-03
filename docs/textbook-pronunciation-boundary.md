# Textbook And Pronunciation Boundary

Textbook and pronunciation share lesson-oriented workflows, but they must keep
runtime display code separate from content workflow code.

## Textbook Runtime Boundary

- Routes, actions, and components that consume textbook data should import
  through the feature facade:
  `@/features/textbook/server`, `@/features/textbook/types`, and
  `@/features/textbook/client/reader-state`.
- Textbook runtime implementation lives under `src/features/textbook/`.
  Do not reintroduce `src/lib/textbook*` compatibility modules or wrappers.
- The resume lesson semantic is the first lesson whose status is not
  `completed`. Pronunciation `next-lesson` selection must stay aligned with
  that same semantic.

## Pronunciation Runtime Boundary

- Runtime display code uses `@/features/pronunciation/model/data` for
  `PronunciationData` and `buildPronunciationData`.
- Runtime display code must not import the `@/features/pronunciation` barrel,
  because it exposes workflow, Forvo, filesystem, and maintenance helpers.
- Do not introduce a second pronunciation facade in small hardening slices; the
  current display boundary is `@/features/pronunciation/model/data`.
- Runtime pronunciation audio URLs must be emitted as `/media-audio/...`, with
  `?v=<updatedAt>` when available. Do not route pronunciation audio through
  `/media/[mediaSlug]/assets/audio/...`; that route remains for images and
  compatibility assets.

## Pronunciation Workflow Boundary

- The normal operational entry point is:
  `./scripts/with-node.sh pnpm pronunciations:resolve`.
- When a textbook/card content edit produced exact entry IDs, use the narrower
  entry-only wrapper:
  `./scripts/with-node.sh pnpm pronunciations:resolve-entries -- --media-slug <media-slug> --entry <entry-id>`.
- The repo-scoped Forvo skill wrapper may be used when running the
  pronunciation skill for non-entry selectors:
  `.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh`.
- `./scripts/with-node.sh pnpm pronunciations:forvo` is low-level maintenance
  or debug only. Do not use it as the normal workflow for review, next lesson,
  textbook page, or targeted pronunciation batches.
- After a real pronunciation workflow adds or replaces
  `content/media/<slug>/assets/audio/**`, refresh the generated runtime copy with
  `./scripts/with-node.sh pnpm media-audio:sync` and verify it with
  `./scripts/with-node.sh pnpm media-audio:check`, unless the next step is
  already `./scripts/with-node.sh pnpm dev` or
  `./scripts/with-node.sh pnpm build`.
- Content workflow runs must keep edits scoped to the requested media and use
  the verification commands declared by the relevant skill or workflow docs.
