# Review Domain Boundary

Review is one scheduling system with two presentation scopes:

- `/review` is the real global review queue. It deduplicates across media and uses the global daily limit.
- `/media/[mediaSlug]/review` is a local media filter over the same review system, not a launcher for a separate media-owned scheduler.
- Global dashboard and global CTAs must show real global numbers.
- Media surfaces may show local numbers only when they are clearly labeled as local to that media.
- Route, action, and component code should import review APIs through `@/features/review/{server,client,model}`.
- `src/lib/review-*` remains the implementation detail for now. Do not move review logic out of those modules in small boundary-only slices.
