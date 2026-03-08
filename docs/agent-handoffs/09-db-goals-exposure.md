# 09 — DB Refactor / Goals / Context Exposure / Generic User State

## Schema changes
- Added migration `supabase/migrations/202603080002_user_goals_and_context_exposure.sql`.
- Introduced `public.user_goals` for goal-driven user learning state with generic target model:
  - `target_type`: `game | product | unit | custom`
  - optional `target_id` (required for non-`custom`)
  - `linked_item_ids[]` to map goals to canonical language item IDs
  - lifecycle fields: `status`, `started_at`, `completed_at`, `archived_at`, `archive_reason`
  - `priority`, `due_at`, and JSON `metadata`
- Introduced `public.user_item_context_exposure` for optional context exposure tracking per canonical item:
  - key dimensions: `user_id`, `item_id`, `context_type`, `context_id`
  - counters/timestamps: `exposure_count`, `first_exposed_at`, `last_exposed_at`
  - `source` metadata for attribution.
- `user_item_progress` remains unchanged and global by `(user_id, item_id)`; no game/product duplication was introduced.

## RLS policies
- Enabled RLS on both new tables.
- Added owner-only policies (`select/insert/update/delete`) for:
  - `user_goals`
  - `user_item_context_exposure`
- Policies enforce `auth.uid() = user_id` for all operations.

## Indexes added
- `user_goals_user_status_priority_idx` on `(user_id, status, priority desc, created_at desc)`.
- `user_goals_user_target_idx` on `(user_id, target_type, target_id)` filtered on `archived_at is null`.
- `user_goals_user_created_idx` on `(user_id, created_at desc)`.
- `user_item_context_exposure_user_item_idx` on `(user_id, item_id, last_exposed_at desc)`.
- `user_item_context_exposure_user_context_idx` on `(user_id, context_type, context_id, last_exposed_at desc)`.
- `user_item_context_exposure_user_created_idx` on `(user_id, created_at desc)`.

## Repositories/helpers added
- Extended `src/lib/supabase/database.types.ts` with typed tables:
  - `user_goals`
  - `user_item_context_exposure`
- Extended `src/features/user-data/repository.ts` with new typed aliases and helpers:
  - Goals:
    - `createUserGoal`
    - `updateUserGoal`
    - `archiveUserGoal`
    - `listActiveUserGoals`
    - `getGoalLinkedProgressView`
  - Context exposure:
    - `recordItemContextExposure` (insert-or-increment behavior per `(user,item,context_type,context_id)`)
- Added minimal server-side action helpers in `src/features/user-data/server-actions.ts`:
  - `createGoalAction`
  - `archiveGoalAction`
  - `listActiveGoalsAction`
  - `recordItemContextExposureAction`

## Generalization / dropped assumptions
- Persistence model now supports generic game/product/unit/custom goals without SD1/SD2-specific columns.
- No deck-hardcoded coverage cache table existed in schema, so no drop was required in this wave.
- User memory progress remains canonical-item based (`user_item_progress.item_id`) and globally reusable across contexts.

## Files changed
- `supabase/migrations/202603080002_user_goals_and_context_exposure.sql`
- `src/lib/supabase/database.types.ts`
- `src/features/user-data/repository.ts`
- `src/features/user-data/server-actions.ts`
- `docs/agent-handoffs/09-db-goals-exposure.md`

## Checks run
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
