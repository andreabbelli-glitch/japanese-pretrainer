# Consolidation Meaning Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically play pronunciation audio during the 2 second `meaning` retrieval window in consolidation, while preserving the current immutable asset cache policy.

**Architecture:** Consolidation session data will carry the same `PronunciationData` shape used by review/textbook. A focused client hook will preload the current audio and call `play()` only for `meaning` retrieval, swallowing autoplay failures. Review queued-card prefetching will lightly prewarm pronunciation audio URLs that are already present in prefetched payloads.

**Tech Stack:** Next.js App Router, React client hooks, TypeScript strict, Drizzle query data, Vitest, existing `./scripts/with-node.sh pnpm ...` command wrapper.

---

## File Structure

- Create `src/components/ui/audio-preload.ts`: shared browser-only audio preload helper with in-memory dedupe.
- Create `tests/audio-preload.test.ts`: unit tests for preload dedupe and no-browser guard.
- Modify `src/lib/consolidation.ts`: add `PronunciationData` to consolidation entry summaries, presentations, and session subjects.
- Modify `tests/consolidation-service.test.ts`: prove session data exposes the expected audio URL for an audio-backed subject.
- Create `src/components/consolidation/use-consolidation-meaning-audio.ts`: consolidation-specific preload/play hook.
- Create `tests/consolidation-meaning-audio.test.ts`: hook tests for preload, `meaning` playback, and rejected `play()` handling.
- Modify `src/components/consolidation/consolidation-session-client.tsx`: call the hook for the active subject.
- Modify `src/components/review/review-page-helpers.ts`: add a pure helper that extracts deduped pronunciation audio URLs from review cards.
- Modify `src/components/review/use-review-queued-card-prefetch.ts`: prewarm pronunciation audio after queued-card payload prefetch completes.
- Modify `tests/review-page-client.test.ts`: test the review audio URL collection helper.

## Task 1: Shared Audio Preload Helper

**Files:**
- Create: `src/components/ui/audio-preload.ts`
- Test: `tests/audio-preload.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `tests/audio-preload.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  preloadAudioSources,
  resetAudioPreloadCacheForTests
} from "@/components/ui/audio-preload";

describe("preloadAudioSources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudioPreloadCacheForTests();
  });

  it("does nothing when the browser Audio constructor is unavailable", () => {
    vi.stubGlobal("Audio", undefined);

    expect(() => preloadAudioSources(["/media/a/assets/audio/a.mp3"])).not.toThrow();
  });

  it("preloads each source once and ignores blank sources", () => {
    const load = vi.fn();
    const AudioMock = vi.fn().mockImplementation((src: string) => ({
      load,
      preload: "",
      src
    }));
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources([
      "/media/a/assets/audio/a.mp3",
      " ",
      "/media/a/assets/audio/a.mp3",
      "/media/a/assets/audio/b.mp3"
    ]);
    preloadAudioSources(["/media/a/assets/audio/b.mp3"]);

    expect(AudioMock).toHaveBeenCalledTimes(2);
    expect(AudioMock).toHaveBeenNthCalledWith(
      1,
      "/media/a/assets/audio/a.mp3"
    );
    expect(AudioMock).toHaveBeenNthCalledWith(
      2,
      "/media/a/assets/audio/b.mp3"
    );
    expect(load).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
./scripts/with-node.sh pnpm test tests/audio-preload.test.ts
```

Expected: FAIL because `@/components/ui/audio-preload` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/components/ui/audio-preload.ts`:

```ts
const preloadedAudioSources = new Set<string>();

export function preloadAudioSources(sources: readonly (string | null | undefined)[]) {
  if (typeof Audio === "undefined") {
    return;
  }

  for (const source of sources) {
    const normalizedSource = source?.trim();

    if (!normalizedSource || preloadedAudioSources.has(normalizedSource)) {
      continue;
    }

    preloadedAudioSources.add(normalizedSource);

    try {
      const audio = new Audio(normalizedSource);
      audio.preload = "auto";
      audio.load();
    } catch {
      preloadedAudioSources.delete(normalizedSource);
    }
  }
}

export function resetAudioPreloadCacheForTests() {
  preloadedAudioSources.clear();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
./scripts/with-node.sh pnpm test tests/audio-preload.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Stage only these files:

```bash
git add src/components/ui/audio-preload.ts tests/audio-preload.test.ts
git commit -m "feat: add shared audio preload helper"
```

## Task 2: Add Pronunciation Audio To Consolidation Session Data

**Files:**
- Modify: `src/lib/consolidation.ts`
- Test: `tests/consolidation-service.test.ts`

- [ ] **Step 1: Write the failing service test**

In `tests/consolidation-service.test.ts`, add this test near the existing session data tests:

```ts
  it("includes pronunciation audio on consolidation subjects when the linked entry has audio", async () => {
    await seedConsolidationLesson(database);
    await database
      .update(term)
      .set({
        audioSource: "forvo",
        audioSpeaker: "Native Speaker",
        audioSrc: "assets/audio/term/term-yomu/yomu.mp3"
      })
      .where(eq(term.id, "term_consolidation_reading"));
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const session = await getConsolidationSessionData({
      database,
      lessonSlug: "consolidation-intro",
      mediaSlug: "media-consolidation"
    });
    const subject = session?.subjects.find(
      (item) => item.subjectKey === "entry:term:term_consolidation_reading"
    );

    expect(subject?.pronunciation).toMatchObject({
      label: "Native Speaker · forvo",
      source: "forvo",
      speaker: "Native Speaker",
      src: "/media/media-consolidation/assets/audio/term/term-yomu/yomu.mp3"
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
./scripts/with-node.sh pnpm test tests/consolidation-service.test.ts
```

Expected: FAIL because `ConsolidationSessionSubject` does not expose `pronunciation`.

- [ ] **Step 3: Extend consolidation types and lookup data**

Modify `src/lib/consolidation.ts`:

```ts
import {
  buildPronunciationData,
  type PronunciationData
} from "./pronunciation-data";
```

Add `pronunciation?: PronunciationData;` to `ConsolidationSessionSubject`.

Add `pronunciation?: PronunciationData;` to `ConsolidationEntrySummary`.

Add `pronunciation?: PronunciationData;` to `ConsolidationSubjectPresentation`.

When mapping `pendingPresentations` in both `getConsolidationSessionData` and
`getRetrainingConsolidationSessionData`, include:

```ts
      pronunciation: presentation.pronunciation,
```

In `buildCardPresentation`, include:

```ts
    pronunciation: entry?.pronunciation,
```

In `buildConsolidationEntrySummaryLookup`, when setting term entries, include:

```ts
      pronunciation:
        buildPronunciationData(entry.mediaSlug, {
          audioAttribution: entry.audioAttribution,
          audioLicense: entry.audioLicense,
          audioPageUrl: entry.audioPageUrl,
          audioSource: entry.audioSource,
          audioSpeaker: entry.audioSpeaker,
          audioSrc: entry.audioSrc,
          pitchAccent: entry.pitchAccent,
          pitchAccentPageUrl: entry.pitchAccentPageUrl,
          pitchAccentSource: entry.pitchAccentSource,
          reading: entry.reading
        }) ?? undefined,
```

When setting grammar entries, include:

```ts
      pronunciation:
        buildPronunciationData(entry.mediaSlug, {
          audioAttribution: entry.audioAttribution,
          audioLicense: entry.audioLicense,
          audioPageUrl: entry.audioPageUrl,
          audioSource: entry.audioSource,
          audioSpeaker: entry.audioSpeaker,
          audioSrc: entry.audioSrc,
          pitchAccent: entry.pitchAccent,
          pitchAccentPageUrl: entry.pitchAccentPageUrl,
          pitchAccentSource: entry.pitchAccentSource,
          reading: entry.reading
        }) ?? undefined,
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
./scripts/with-node.sh pnpm test tests/consolidation-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Stage only these files:

```bash
git add src/lib/consolidation.ts tests/consolidation-service.test.ts
git commit -m "feat: expose consolidation pronunciation audio"
```

## Task 3: Play Audio During Meaning Retrieval

**Files:**
- Create: `src/components/consolidation/use-consolidation-meaning-audio.ts`
- Modify: `src/components/consolidation/consolidation-session-client.tsx`
- Test: `tests/consolidation-meaning-audio.test.ts`

- [ ] **Step 1: Write the failing hook tests**

Add `tests/consolidation-meaning-audio.test.ts`:

```ts
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMinimalDom, uninstallMinimalDom } from "./helpers/minimal-dom";

import { useConsolidationMeaningAudio } from "@/components/consolidation/use-consolidation-meaning-audio";

type AudioProbeProps = {
  audioSrc?: string;
  phase: "answering" | "feedback" | "retrieval";
  step: "meaning" | "reading";
  subjectKey: string;
};

describe("useConsolidationMeaningAudio", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    vi.restoreAllMocks();
    uninstallMinimalDom();
    container = null;
    root = null;
  });

  it("preloads audio but does not play during reading retrieval", async () => {
    const audio = installAudioElementMock();

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "reading",
      subjectKey: "entry:term:yomu"
    });

    expect(audio.load).toHaveBeenCalledTimes(1);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("rewinds and plays audio during meaning retrieval", async () => {
    const audio = installAudioElementMock();

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "reading",
      subjectKey: "entry:term:yomu"
    });
    audio.currentTime = 0.75;

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });

    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("swallows browser autoplay rejections", async () => {
    const audio = installAudioElementMock();
    audio.play.mockRejectedValueOnce(new Error("NotAllowedError"));

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  async function renderProbe(props: AudioProbeProps) {
    function Probe() {
      useConsolidationMeaningAudio(props);
      return null;
    }

    await act(async () => {
      root!.render(createElement(Probe));
      await Promise.resolve();
    });
  }
});

function installAudioElementMock() {
  const originalCreateElement = document.createElement.bind(document);
  const audio = {
    currentTime: 0,
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    preload: "",
    src: ""
  };

  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    if (tagName === "audio") {
      return audio as unknown as HTMLElement;
    }

    return originalCreateElement(tagName);
  });

  return audio;
}
```

- [ ] **Step 2: Run the hook test to verify it fails**

Run:

```bash
./scripts/with-node.sh pnpm test tests/consolidation-meaning-audio.test.ts
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/components/consolidation/use-consolidation-meaning-audio.ts`:

```ts
"use client";

import { useEffect, useRef } from "react";

type ConsolidationMeaningAudioInput = {
  audioSrc?: string;
  phase: "answering" | "feedback" | "retrieval";
  step: "meaning" | "reading";
  subjectKey: string;
};

export function useConsolidationMeaningAudio({
  audioSrc,
  phase,
  step,
  subjectKey
}: ConsolidationMeaningAudioInput) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioSrc || typeof document === "undefined") {
      return;
    }

    const audio = audioRef.current ?? document.createElement("audio");
    audioRef.current = audio;
    audio.preload = "auto";

    if (audio.src !== audioSrc) {
      audio.src = audioSrc;
    }

    audio.load();

    return () => {
      audio.pause();
    };
  }, [audioSrc]);

  useEffect(() => {
    if (!audioSrc || phase !== "retrieval" || step !== "meaning") {
      return;
    }

    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    try {
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      // Browser autoplay policy can reject rare gesture-less first cards.
    }
  }, [audioSrc, phase, step, subjectKey]);
}
```

- [ ] **Step 4: Wire the hook into the consolidation client**

Modify `src/components/consolidation/consolidation-session-client.tsx`:

```ts
import { useConsolidationMeaningAudio } from "./use-consolidation-meaning-audio";
```

After `completed` is computed, before any early return, call:

```ts
  useConsolidationMeaningAudio({
    audioSrc: currentSubject?.pronunciation?.src,
    phase,
    step: currentStep?.step ?? "reading",
    subjectKey: currentSubject?.subjectKey ?? ""
  });
```

Do not render visible audio controls in the consolidation UI.

- [ ] **Step 5: Run the hook and client tests**

Run:

```bash
./scripts/with-node.sh pnpm test tests/consolidation-meaning-audio.test.ts tests/consolidation-session-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Stage only these files:

```bash
git add src/components/consolidation/use-consolidation-meaning-audio.ts src/components/consolidation/consolidation-session-client.tsx tests/consolidation-meaning-audio.test.ts
git commit -m "feat: autoplay consolidation meaning audio"
```

## Task 4: Prewarm Review Prefetched Card Audio

**Files:**
- Modify: `src/components/review/review-page-helpers.ts`
- Modify: `src/components/review/use-review-queued-card-prefetch.ts`
- Test: `tests/review-page-client.test.ts`

- [ ] **Step 1: Write the failing helper test**

In `tests/review-page-client.test.ts`, add `collectReviewCardAudioSources` to the import from `review-page-helpers`:

```ts
import {
  collectQueuedPrefetchCardIds,
  collectReviewCardAudioSources,
  resolveReviewQueuePosition
} from "@/components/review/review-page-helpers";
```

Add this test:

```ts
  it("collects deduped pronunciation audio sources from review cards", () => {
    const first = buildQueueCard("card-a");
    const second = buildQueueCard("card-b");
    first.pronunciations = [
      {
        audio: { src: "/media/sample/assets/audio/a.mp3" },
        kind: "term",
        label: "読む",
        meaning: "leggere",
        relationshipLabel: "Voce"
      },
      {
        audio: { src: "/media/sample/assets/audio/a.mp3" },
        kind: "term",
        label: "読む",
        meaning: "leggere",
        relationshipLabel: "Voce"
      }
    ];
    second.pronunciations = [
      {
        audio: { pitchAccent: { downstep: 1, morae: [], shape: "atamadaka" } },
        kind: "term",
        label: "書く",
        meaning: "scrivere",
        relationshipLabel: "Voce"
      },
      {
        audio: { src: "/media/sample/assets/audio/b.mp3" },
        kind: "term",
        label: "聞く",
        meaning: "ascoltare",
        relationshipLabel: "Voce"
      }
    ];

    expect(collectReviewCardAudioSources([first, second])).toEqual([
      "/media/sample/assets/audio/a.mp3",
      "/media/sample/assets/audio/b.mp3"
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
./scripts/with-node.sh pnpm test tests/review-page-client.test.ts
```

Expected: FAIL because `collectReviewCardAudioSources` does not exist.

- [ ] **Step 3: Implement the helper**

In `src/components/review/review-page-helpers.ts`, add:

```ts
export function collectReviewCardAudioSources(
  cards: Iterable<Pick<ReviewQueueCard, "pronunciations">>
) {
  const sources = new Set<string>();

  for (const card of cards) {
    for (const pronunciation of card.pronunciations) {
      const source = pronunciation.audio.src?.trim();

      if (source) {
        sources.add(source);
      }
    }
  }

  return [...sources];
}
```

If `ReviewQueueCard` is not already imported in that file, import it from
`@/lib/review-types`.

- [ ] **Step 4: Prewarm audio after queued card prefetch**

In `src/components/review/use-review-queued-card-prefetch.ts`, add:

```ts
import { preloadAudioSources } from "@/components/ui/audio-preload";
```

Extend the helpers import:

```ts
import {
  collectQueuedPrefetchCardIds,
  collectReviewCardAudioSources,
  pruneQueuedPrefetchedCardMap
} from "./review-page-helpers";
```

Inside the `.then((card) => { ... })` block, after:

```ts
          prefetchBufferRef.current.set(cardId, card);
```

add:

```ts
          preloadAudioSources(collectReviewCardAudioSources([card]));
```

- [ ] **Step 5: Run the review client tests**

Run:

```bash
./scripts/with-node.sh pnpm test tests/review-page-client.test.ts tests/review-page-controller.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Stage only these files:

```bash
git add src/components/review/review-page-helpers.ts src/components/review/use-review-queued-card-prefetch.ts tests/review-page-client.test.ts
git commit -m "feat: prewarm prefetched review audio"
```

## Task 5: Full Local Verification

**Files:**
- No source edits unless a verification failure exposes a bug.

- [ ] **Step 1: Run focused tests**

Run:

```bash
./scripts/with-node.sh pnpm test tests/audio-preload.test.ts tests/consolidation-service.test.ts tests/consolidation-meaning-audio.test.ts tests/consolidation-session-client.test.ts tests/review-page-client.test.ts tests/review-page-controller.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the required application gate**

Run:

```bash
./scripts/with-node.sh pnpm check
```

Expected: PASS.

- [ ] **Step 3: Run the release gate**

Run:

```bash
./scripts/with-node.sh pnpm release:check
```

Expected: PASS. This is required because the change touches user-facing consolidation/review flows and browser-side behavior.

- [ ] **Step 4: Commit any verification fixes**

If Steps 1-3 required fixes, stage only the files changed for those fixes:

```bash
git status --short
git commit -m "fix: stabilize consolidation audio playback"
```

Before running `git commit`, stage the exact fixed paths shown by
`git status --short` with an explicit `git add` command. Do not use
`git add .`. If no fixes were needed, do not create an empty commit.

## Task 6: Independent Reviewer Subagents

**Files:**
- No source edits unless reviewers find issues.

- [ ] **Step 1: Capture the diff range**

Run:

```bash
BASE_SHA=$(git rev-parse HEAD~4)
HEAD_SHA=$(git rev-parse HEAD)
printf '%s\n' "$BASE_SHA" "$HEAD_SHA"
```

If the number of implementation commits differs, set `BASE_SHA` to the commit before Task 1.

- [ ] **Step 2: Dispatch the functional/spec reviewer subagent**

Spawn an independent reviewer subagent with this exact brief:

```text
You are an independent functional reviewer. Review the diff from BASE_SHA to HEAD_SHA for the Japanese Custom Study repo.

Spec:
- Consolidation should automatically play pronunciation audio during the 2 second retrieval phase only for the meaning step.
- No visible audio controls or start gate should be added.
- Playback failures from browser autoplay policy should be swallowed.
- Consolidation should use the same media asset URLs as review/textbook so browser cache is shared.
- Do not add URL versioning in this slice.
- Review queued-card prefetch may prewarm audio URLs already present in prefetched card payloads.

Focus on missed behavior, regressions in reading/meaning flow, stale audio playback, and whether tests prove the behavior.
Return findings first, with file/line references and severity. If no issues, say so explicitly and mention residual risk.
```

- [ ] **Step 3: Dispatch the quality/performance reviewer subagent**

Spawn a second independent reviewer subagent with this exact brief:

```text
You are an independent quality and performance reviewer. Review the diff from BASE_SHA to HEAD_SHA for the Japanese Custom Study repo.

Focus on React hook correctness, cleanup behavior, browser audio API safety, TypeScript strictness, cache/preload behavior, overfetch risk, test quality, and adherence to repo instructions.

Important constraints:
- Do not recommend service workers or URL versioning for this slice.
- Do not require a start gate for audio.
- Audio preload should stay bounded and should not fetch unrelated media.

Return findings first, with file/line references and severity. If no issues, say so explicitly and mention residual risk.
```

- [ ] **Step 4: Apply reviewer fixes if needed**

For each Critical or Important finding:

1. Confirm whether the finding is valid against the spec.
2. Apply a focused fix.
3. Run the smallest affected test command.
4. Re-run `./scripts/with-node.sh pnpm check`.
5. Commit the fix:

```bash
git status --short
git commit -m "fix: address audio review feedback"
```

Before running `git commit`, stage the exact fixed paths shown by
`git status --short` with an explicit `git add` command. Do not use
`git add .`.

- [ ] **Step 5: Re-run final gates after reviewer fixes**

Run:

```bash
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

Expected: PASS.

- [ ] **Step 6: Final push**

Run:

```bash
git status --short
git push
```

Expected: only unrelated pre-existing user changes remain unstaged; implementation commits are pushed to the current branch.

## Self-Review

- Spec coverage: Tasks 2 and 3 implement consolidation audio payload and meaning-step playback. Task 4 covers shared browser cache benefits in review without URL versioning. Task 5 covers required gates. Task 6 covers independent subagent review.
- Ambiguity scan: Planned implementation steps are concrete. Reviewer-driven fix steps instruct the worker to stage exact paths from `git status --short` because those paths are unknowable before review.
- Type consistency: The plan consistently uses `PronunciationData`, `ConsolidationSessionSubject.pronunciation`, `useConsolidationMeaningAudio`, `preloadAudioSources`, and `collectReviewCardAudioSources`.
