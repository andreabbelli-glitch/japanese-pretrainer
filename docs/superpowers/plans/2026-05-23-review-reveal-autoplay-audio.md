# Review Reveal Autoplay Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Play review pronunciation audio immediately when the user reveals an answer, with a Settings flag controlling the behavior.

**Architecture:** Use a shared client audio helper that keeps bounded off-DOM `Audio` elements warm by URL, so reveal can call `play()` synchronously inside the click handler. Store `reviewAutoplayAudioOnReveal` alongside existing study settings and serialize it into review page data.

**Tech Stack:** Next.js App Router, React 19 client hooks, TypeScript strict, Vitest, existing SQLite `user_setting` key/value settings.

---

### Task 1: Shared Audio Element Cache

**Files:**
- Modify: `src/components/ui/audio-preload.ts`
- Test: `tests/audio-preload.test.ts`

- [x] **Step 1: Write failing tests**
  - Add tests that preloading retains one `Audio` instance per normalized URL, duplicate preloads do not allocate a new element, `playPreloadedAudioSource("/a.mp3")` rewinds and calls `play()`, and rejected `play()` promises are swallowed.

- [x] **Step 2: Run red test**
  - Run: `./scripts/with-node.sh pnpm test tests/audio-preload.test.ts`
  - Expected: fail because `playPreloadedAudioSource` does not exist and preloading does not expose retained playback behavior.

- [x] **Step 3: Implement helper**
  - Replace the marker-only set with a bounded `Map<string, HTMLAudioElement>`.
  - Keep `preloadAudioSources(sources)` API stable.
  - Add `playPreloadedAudioSource(source)` that normalizes the source, gets or creates the cached element, sets `preload = "auto"`, rewinds to `0`, calls `play()`, catches sync and promise rejections, and returns whether a source was attempted.
  - Keep `resetAudioPreloadCacheForTests()`.

- [x] **Step 4: Run green test**
  - Run: `./scripts/with-node.sh pnpm test tests/audio-preload.test.ts`
  - Expected: pass.

### Task 2: Settings Flag

**Files:**
- Modify: `src/db/schema/enums.ts`
- Modify: `src/lib/settings.ts`
- Modify: `src/actions/settings.ts`
- Modify: `src/components/settings/settings-page.tsx`
- Test: `tests/settings.test.ts`
- Test: `tests/settings-actions.test.ts`
- Test: `tests/settings-page.test.ts`

- [x] **Step 1: Write failing tests**
  - Assert default `reviewAutoplayAudioOnReveal` is `true`.
  - Assert saving form data forwards `reviewAutoplayAudioOnReveal`.
  - Assert Settings page renders the new Review audio control and checked option.

- [x] **Step 2: Run red tests**
  - Run: `./scripts/with-node.sh pnpm test tests/settings.test.ts tests/settings-actions.test.ts tests/settings-page.test.ts`
  - Expected: fail because the setting is not typed, parsed, or rendered.

- [x] **Step 3: Implement setting**
  - Add user setting key `review_autoplay_audio_on_reveal`.
  - Add `reviewAutoplayAudioOnReveal` to `StudySettings`, defaults, key list, snapshot parsing, update merging, changed-settings array, and boolean normalizer.
  - Add the form field to `saveStudySettingsAction`.
  - Add a compact Review settings panel to toggle autoplay.

- [x] **Step 4: Run green tests**
  - Run: `./scripts/with-node.sh pnpm test tests/settings.test.ts tests/settings-actions.test.ts tests/settings-page.test.ts`
  - Expected: pass.

### Task 3: Review Reveal Playback

**Files:**
- Modify: `src/lib/review-types.ts`
- Modify: `src/lib/review-loader.ts`
- Modify: `src/lib/review-page-data.ts`
- Modify: `src/components/review/use-review-page-controller.ts`
- Modify: test fixtures in `tests/review-page-*.test.ts`
- Test: `tests/review-page-controller.test.ts`
- Test: `tests/review-page-client.test.ts`

- [x] **Step 1: Write failing tests**
  - Mock `playPreloadedAudioSource`.
  - Assert `handleRevealAnswer()` plays the first pronunciation audio when `settings.reviewAutoplayAudioOnReveal` is true and full review data has audio.
  - Assert it does not play when the setting is false or no audio exists.
  - Assert review payload settings include `reviewAutoplayAudioOnReveal`.

- [x] **Step 2: Run red tests**
  - Run: `./scripts/with-node.sh pnpm test tests/review-page-controller.test.ts tests/review-page-client.test.ts`
  - Expected: fail because controller does not call playback and types lack the setting.

- [x] **Step 3: Implement review playback**
  - Serialize `reviewAutoplayAudioOnReveal` into `ReviewPageData.settings`.
  - Pass the setting from `getStudySettings()` through global/media/first-candidate review builders.
  - In `handleRevealAnswer()`, if the setting is true, call `playPreloadedAudioSource()` synchronously with the first audio source from `fullSelectedCard?.pronunciations`.

- [x] **Step 4: Run green tests**
  - Run: `./scripts/with-node.sh pnpm test tests/review-page-controller.test.ts tests/review-page-client.test.ts`
  - Expected: pass.

### Task 4: Verification, Review, Commit, Push

**Files:**
- Modify: `docs/qa-manual-checklist.md`

- [x] **Step 1: Update QA docs**
  - Add a manual check that review reveal autoplay can be toggled in Settings and plays immediately on reveal for cards with pronunciation audio.

- [x] **Step 2: Run full verification**
  - Run: `./scripts/with-node.sh pnpm check`
  - Run: `./scripts/with-node.sh pnpm release:check`
  - Expected: both pass.

- [x] **Step 3: Request reviewer subagents**
  - Spawn independent reviewers focused on browser media/Safari gesture timing and settings/data contract/cache behavior.
  - Fix valid findings and repeat until reviewers return green.

- [x] **Step 4: Commit and push**
  - Commit only relevant files.
  - Push `main` after verification and reviewer green.
