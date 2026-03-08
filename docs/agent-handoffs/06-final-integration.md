# 06 — Final Integration / Dashboard / Mastery / Coverage / QA

## Cosa è stato implementato
- Modulo dominio `src/domain/progress/` introdotto per calcolo mastery/coverage/insight, separato dalla UI.
- Dashboard reale (`/dashboard`) ora mostra:
  - due today
  - new today
  - streak
  - retention estimate
  - conteggi item per stato
  - SD1 coverage / SD2 coverage
  - lezioni suggerite
  - carte leggibili/quasi leggibili
  - top gap linguistici SD1/SD2
- Card page (`/cards/[slug]`) arricchita con:
  - barra coverage carta
  - spiegazione gap reali (item mancanti + peso)
  - next best study actions
  - contesto coverage del deck
  - bookmark/favorites (aggiungi/rimuovi)
- Deck page (`/decks/[slug]`) arricchita con:
  - coverage complessiva
  - carte più vicine a sblocco
  - colli di bottiglia linguistici
  - suggerimenti “study next” con carte impattate
- Migliorie UX finali:
  - loading + error states su dashboard/card/deck
  - shortcut review 1/2/3/4 funzionanti in review session
- QA/Test/CI:
  - Vitest config dedicata (`vitest.config.ts`)
  - test unit nuovi per dominio progress/mastery/coverage
  - Playwright smoke setup (`playwright.config.ts`, `tests/e2e/smoke.spec.ts`)
  - GitHub Actions CI (`.github/workflows/ci.yml`) con lint/typecheck/test/build/e2e

## Formula mastery (V1)
Implementata in `computeMasteryFromProgress`.

### Output
- range clampato `0–100`

### Componenti formula
- Base per stato:
  - `new = 0`
  - `learning = 28`
  - `review = 58`
  - `relearning = 32`
  - `mature = 86`
- Bonus:
  - `intervalBonus = min(interval_days * 1.4, 14)`
  - `streakBonus = min(streak * 1.8, 10)`
- Penalità:
  - `lapsePenalty = min(lapses * 4, 20)`
  - `recencyPenalty = min(daysSinceLastReview * 1.2, 15)`
  - `duePenalty = min(daysOverdue * 6, 20)` (solo se overdue)

### Formula finale
`mastery = clamp(base + intervalBonus + streakBonus - lapsePenalty - recencyPenalty - duePenalty, 0, 100)`

## Formula coverage (V1)

### Peso item
- `core = 3`
- `important = 2`
- `nice = 1`

### Coverage carta
Per una carta:
- requisiti = `itemIds + keyItemIds + keyPatternIds` (deduplicati)
- formula:

`coverage(card) = sum(weight(item) * mastery(item)) / sum(weight(item) * 100) * 100`

### Coverage deck
- media delle coverage delle carte uniche del deck:

`coverage(deck) = avg(coverage(card_i))`

## Test implementati
- Unit tests Vitest:
  - `tests/review-domain.test.ts` (già presente)
  - `tests/routes.test.ts` (già presente)
  - `tests/progress-domain.test.ts` (nuovo)
- Smoke/E2E Playwright:
  - auth gate (redirect login)
  - apertura lezione + item page
  - card/deck coverage UI
- CI:
  - lint, typecheck, test, build, install browser, e2e

## Stato finale V1
- Review engine + content graph + deck goal ora collegati con metriche reali di mastery/coverage.
- Dashboard non è più cosmetica: mostra KPI derivati da dati user-state reali.
- Card/deck pages spiegano esplicitamente i gap e propongono studio concreto per sbloccare carte.
- Bookmark/favorites su card page completato.

## Backlog V1.5 (breve e realistico)
1. Stabilizzare e2e in ambienti con mirror browser Playwright (attuale limite: download Chromium 403 in questo environment).
2. Persistenza “unlock timeline” per mostrare davvero “ultime carte diventate leggibili” come evento storico.
3. Migliorare suggerimenti lesson con lesson_progress reale (not_started/in_progress/completed + mastery).
4. Esporre spiegazioni coverage anche in `/cards` e `/decks` list pages (preview-level).
5. Aggiungere retry intraseduta opzionale per item `Again` immediati.
