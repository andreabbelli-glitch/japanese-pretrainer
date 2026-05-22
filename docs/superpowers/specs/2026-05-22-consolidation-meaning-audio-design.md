# Consolidation Meaning Audio Design

## Scope

During pre-review consolidation, the app should automatically play the
pronunciation audio while a subject is in the 2 second retrieval window for the
`meaning` step.

The implementation should be seamless:

- no start gate or visible audio control is added to the consolidation UI;
- audio playback is best-effort for the rare first card that starts directly at
  `meaning` without a prior user gesture;
- after the user answers a `reading` step, the subsequent `meaning` audio should
  start as reliably as browser autoplay policy allows;
- if playback is blocked or fails, the session continues without user-visible
  errors.

## Out Of Scope

Do not add URL versioning such as `?v=...` in this slice.

The existing media asset route already sends:

```text
Cache-Control: public, max-age=31536000, immutable
```

That policy is kept as-is. Audio files are treated as effectively immutable for
the current product workflow.

## Architecture

Consolidation session data will expose the same pronunciation audio URL shape
already used by review, glossary, and textbook. The URL will continue to be
built with `mediaAssetHref`, so the browser cache is shared across surfaces.

The consolidation client will use a focused client hook to preload the current
subject audio as soon as the subject is visible. When the current step is
`meaning` and the phase is `retrieval`, the hook rewinds and plays the audio.
The hook catches playback errors and pauses stale audio during cleanup.

Review will get a small prewarm improvement for prefetched queue cards: once a
future card payload is already fetched, its pronunciation audio URLs are
preloaded through the same browser cache. This keeps the change small while
making review and consolidation benefit from the same asset cache.

## Testing

Minimum verification:

- consolidation service test proves session subjects carry pronunciation audio;
- consolidation audio hook tests prove audio is preloaded, only played during
  `meaning` retrieval, and playback rejection is swallowed;
- review prefetch helper test proves future card audio URLs are deduped and
  prewarmed;
- `./scripts/with-node.sh pnpm check`;
- `./scripts/with-node.sh pnpm release:check`, because user-facing
  consolidation/review flows are touched.

## Review Gates

After implementation and local verification, run two independent reviewer
subagents:

1. Functional reviewer: checks behavior against this spec and looks for missed
   consolidation/review flow cases.
2. Quality/performance reviewer: checks cache/preload behavior, overfetch risk,
   cleanup behavior, tests, and TypeScript/React quality.

Both reviewers must receive only the plan/spec and git diff range, not the main
agent's chat history.
