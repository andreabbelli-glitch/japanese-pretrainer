# 06 — Final Integration / Dashboard / Mastery / Coverage / QA

## Cosa è stato implementato
- Integrazione finale V1 tra contenuto canonico, review engine e obiettivo deck coverage.
- Dashboard reale (`/dashboard`) con metriche da dati utente effettivi:
  - in scadenza oggi
  - nuovi oggi
  - streak
  - retention estimate
  - conteggio item per stato
  - coverage SD1 / SD2
  - lezioni suggerite
  - carte leggibili / quasi leggibili
  - top gap linguistici SD1/SD2
  - pannello “study next” con impatto su carte reali
- Card page (`/cards/[slug]`) estesa con:
  - coverage bar e spiegazione soglia
  - gap collegati con mastery e peso
  - next best actions
  - suggerimenti di sblocco cross-carta dal deck
- Deck page (`/decks/[slug]`) estesa con:
  - coverage complessiva
  - carte più vicine allo sblocco
  - bottleneck linguistici con impatto
  - suggerimenti “study next” concreti
- Bookmark/favorites confermato operativo su card page.
- QA/CI consolidati:
  - Vitest unit test per review/progress/routes
  - Playwright smoke test multi-flow
  - workflow CI con lint/typecheck/test/build/e2e

## Formula mastery (V1)
Implementata in `src/domain/progress/coverage.ts` (`computeMasteryFromProgress`).

### Componenti
- `base` per stato review:
  - `new = 0`
  - `learning = 28`
  - `review = 58`
  - `relearning = 32`
  - `mature = 86`
- `intervalBonus = min(interval_days * 1.4, 14)`
- `streakBonus = min(streak * 1.8, 10)`
- `lapsePenalty = min(lapses * 4, 20)`
- `recencyPenalty = min(daysSinceLastReview * 1.2, 15)`
- `duePenalty = min(daysOverdue * 6, 20)` se overdue

### Formula finale
`mastery = clamp(base + intervalBonus + streakBonus - lapsePenalty - recencyPenalty - duePenalty, 0, 100)`

## Formula coverage (V1)

### Peso item
- `core = 3`
- `important = 2`
- `nice = 1`

### Coverage carta
`coverage(card) = sum(weight(item) * mastery(item)) / sum(weight(item) * 100) * 100`

Requisiti usati: `itemIds + keyItemIds + keyPatternIds` (deduplicati).

### Coverage deck
Media delle coverage delle carte uniche del deck.

## Test implementati
- Unit test:
  - `tests/review-domain.test.ts`
  - `tests/progress-domain.test.ts`
  - `tests/routes.test.ts`
- Smoke/E2E:
  - `tests/e2e/smoke.spec.ts` copre auth gate, apertura lezione, item page, review/session gate, card page, deck page, dashboard gate.
- CI:
  - `.github/workflows/ci.yml` con `npm ci`, lint, typecheck, unit test, build, install browser, e2e.

## Stato finale V1
- V1 ora ha ciclo completo: contenuto -> studio -> review -> mastery -> coverage -> insight pratici.
- Dashboard e pagine card/deck mostrano metriche non decorative, con motivazioni esplicite sui gap.
- Architettura resta coerente con principio content-first e separazione content repo / user state DB.

## Backlog V1.5 (breve, realistico)
1. E2E autenticati con utente seedato e scenario review completo end-to-end (oltre ai gate smoke).
2. Timeline storica “carte appena sbloccate” basata su eventi persistiti, non solo snapshot corrente.
3. Insight lezione più precisi combinando `lesson_progress` + mastery medio + impatto coverage deck.
4. Migliorare explainability in list pages (`/cards`, `/decks`) con preview dei gap principali.
