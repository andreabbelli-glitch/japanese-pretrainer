# 08 — Domain Refactor / Generic Routes / Coverage & Gap Engine

## Cosa è stato implementato
- Introduzione di un nuovo dominio generico `learning` con target model `game/product/unit/goal` e servizi testabili non legati a componenti React.
- Aggiunta di engine riusabili per:
  - coverage target-aware
  - gap analysis target-aware
  - unlock/study-next recommendations
- Aggiornata la tassonomia route verso modello canonico multigame con nuove page shell minime.
- Route legacy `/cards` e `/decks` convertite a transitional redirects verso i nuovi percorsi `/games/...`.

## Nuovi domain types introdotti
- `GoalTargetType`: `game | product | unit | goal`
- `GoalTarget`
- `CoverageItem`
- `CoverageResult`
- `UnlockRecommendation`
- `GapAnalysisResult`
- `LearningTargetContext` (base context type)

File: `src/domain/learning/types.ts`

## Servizi aggiunti/refactor
### Nuovi servizi (`src/domain/learning`)
- `coverage.ts`
  - `getRequiredItemIdsForTarget(target)`
  - `computeCoverage(target, masteryByItemId)`
- `gap-analysis.ts`
  - `analyzeTargetGaps(target, masteryByItemId)`
  - `recommendUnlockNext(target, masteryByItemId, limit)`
- `selectors.ts`
  - page-level loaders/selectors per route nuove:
    - `loadGamesIndex`
    - `loadGamePage`
    - `loadProductPage`
    - `loadUnitPage`
    - `loadCoreLesson/loadGameLesson/loadProductLesson`
    - `loadCoreLessonsIndex`

### Refactor content queries (`src/domain/content/queries.ts`)
Aggiunti selector canonici per supportare route e servizi nuovi senza hardcode deck/card:
- `getLanguageItemById`
- `getCoreLessons`
- `getGameLessons`
- `getProductLessons`
- `getCanonicalLessonBySlug`
- `getGameById`
- `getProductsByGame`
- `getProductById`
- `getUnitsByProduct`
- `getUnitById`

## Route map nuovo (introdotto)
- `/`
- `/dashboard`
- `/goals`
- `/learn/core`
- `/learn/core/[slug]`
- `/items`
- `/items/[id]`
- `/games`
- `/games/[gameId]`
- `/games/[gameId]/learn/[slug]`
- `/games/[gameId]/products/[productId]`
- `/games/[gameId]/products/[productId]/learn/[slug]`
- `/games/[gameId]/products/[productId]/units/[unitId]`
- `/review`
- `/review/session`
- `/settings`

## Old-to-new route handling
- `/cards` -> redirect a `/games/game.duel-masters`
- `/cards/[slug]` -> redirect a `/games/[gameId]/products/[productId]/units/[unitId]`
- `/decks` -> redirect a `/games/game.duel-masters`
- `/decks/[slug]` -> redirect a `/games/[gameId]/products/[productId]`
- `/decks/dm25-sd1` -> redirect diretto a `product.dm25-sd1`
- `/decks/dm25-sd2` -> redirect diretto a `product.dm25-sd2`

## Altre modifiche correlate
- Main navigation aggiornata alla nuova tassonomia (`/goals`, `/learn/core`, `/games`).
- Route protection aggiornata includendo `/goals` (`src/lib/routes.ts`, `middleware.ts`).

## Test e quality checks
- Aggiunti unit test per coverage/gap engine:
  - `tests/learning-domain.test.ts`
- Aggiornati test route protection:
  - `tests/routes.test.ts`
- Eseguiti:
  - lint
  - typecheck
  - test
  - build

## Decisioni
- Non toccata la parte DB schema/migrazioni (vincolo richiesto).
- Non riscritta la review scheduling logic (vincolo richiesto).
- Mantenuti shim compatibilità legacy nel dominio content/progress per evitare rotture cross-wave.

## TODO per agenti successivi
1. Rifinire UI delle nuove route (oggi shell minime informative).
2. Migrare dashboard da metriche SD1/SD2 hardcoded a target/goal cards modulari.
3. Sostituire progressivamente i componenti `related-cards`/`deck` con naming unit/product.
4. Integrare obiettivi persistiti (`user_goals`) quando verrà introdotto il relativo layer applicativo.
