# 12 — Goal-Centric Dashboard Finalization / Multi-Game Readiness / QA

## Final architecture summary
- Dashboard refactorato in chiave goal-first con moduli dedicati e metriche generic game/product/unit.
- Goal lifecycle esteso: list totale goal + set active unico + pause + complete + archive.
- Loader contenuti e script di validazione aggiornati per discovery multi-game/product dinamica, senza hardcode SD1/SD2 nel core loading.
- Product/unit pages aggiornate per esporre coverage, missing, weak-but-known e azioni study-next.

## Dashboard modules implemented
- `ActiveGoalCard`
- `GlobalMasteryOverview`
- `DueToday`
- `StudyNext`
- `MissingItemsByGoal`
- `UnlockNextUnits`
- `SharedKnowledgeReused`
- `WeakButKnown`

## Authoring workflow for new games/products
- Nuova documentazione:
  - `docs/new-product-onboarding.md`
  - `docs/new-game-onboarding.md`
- Nuovi template:
  - `content/templates/games/game.template.json`
  - `content/templates/products/product.template.json`
- Workflow consigliato:
  1. creare game/product/unit + lessons con template
  2. usare item canonici condivisi in `content/language/items/items.json`
  3. validare con `npm run content:validate`
  4. rigenerare index con `npm run content:build-index`

## Multi-game readiness achieved
- Content loader/scripting ora enumerano dinamicamente `content/games/*` e `products/*`.
- Dashboard e pagine non assumono SD1/SD2 come unica fonte di coverage.
- Goal parsing usa target_id generico (`game`, `game::product`, `game::product::unit`).
- Shared knowledge reuse evidenzia riuso linguistico cross-product.

## Files changed (high level)
- Dashboard/UI: `app/dashboard/page.tsx`, `src/components/dashboard/*`
- Goals UX/actions: `app/goals/page.tsx`, `app/goals/actions.ts`, `src/features/user-data/server-actions.ts`, `src/features/user-data/repository.ts`
- Domain metrics: `src/domain/goals/dashboard.ts`
- Multi-game content loading/validation: `src/domain/content/loader.ts`, `scripts/content-io.ts`, `scripts/validate-content.ts`
- Product/unit UX: `app/games/[gameId]/products/[productId]/page.tsx`, `app/games/[gameId]/products/[productId]/units/[unitId]/page.tsx`
- Docs/templates: onboarding docs + template JSON
- Test: `tests/goal-dashboard.test.ts`

## Short realistic backlog (next iteration)
1. UI creazione goal direttamente da product/unit pages (ora disponibile solo lifecycle su goal esistenti).
2. Insight dashboard più granulari per game-level bottleneck trend nel tempo.
3. Migrare route legacy `/decks` e `/cards` a naming fully canonical multi-game per evitare duplicazioni concettuali.
4. Aggiungere smoke E2E specifici goal management (set active/pause/complete).
5. Migliorare parser frontmatter MDX con parser robusto (attuale parser line-based volutamente semplice).
