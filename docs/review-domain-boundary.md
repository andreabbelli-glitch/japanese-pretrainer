# Review Domain Boundary

Review is one scheduling system with two presentation scopes:

- `/review` is the real global review queue. It deduplicates across media and uses the global daily limit.
- `/media/[mediaSlug]/review` is a local media filter over the same review system, not a launcher for a separate media-owned scheduler.
- All scoreable due subjects, including intraday learning and relearning steps, are ordered by current FSRS retrievability, highest first; new cards stay after due cards. The queue is ranked in memory from persisted scheduling state and active task-specific FSRS weights; retrievability is never persisted.
- The canonical order is fixed for the active session. Prefetch and optimistic rendering may reduce latency, but they must never promote a later card ahead of the next canonical subject.
- Global dashboard and global CTAs must show real global numbers.
- Media surfaces may show local numbers only when they are clearly labeled as local to that media.
- Route, action, and component code should import review APIs through `@/features/review/{server,client,model}`.
- Review implementation lives under `src/features/review/`. Do not reintroduce
  `src/lib/review-*` compatibility modules or wrappers.
