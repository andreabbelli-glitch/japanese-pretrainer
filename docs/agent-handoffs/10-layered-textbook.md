# 10 — Layered Textbook Refactor / Goal-Aware Learning Pages

## Cosa è stato implementato
- Refactor UX del textbook su tassonomia a strati:
  - core language: `/learn/core`, `/learn/core/[slug]`
  - game layer: `/games/[gameId]`, `/games/[gameId]/learn/[slug]`
  - product layer: `/games/[gameId]/products/[productId]`, `/games/[gameId]/products/[productId]/learn/[slug]`
  - unit layer: `/games/[gameId]/products/[productId]/units/[unitId]`
- Le pagine lesson (core/game/product) ora espongono in modo esplicito i blocchi didattici richiesti (cosa impari, ELI5, riconoscimento, esempi, errori, micro-drill, item e unità collegate) con componenti riusabili.
- Product page resa goal-aware via gap engine + progress reale utente (se autenticato):
  - known / weak / missing / coverage
  - suggerimenti di sblocco (unlock next)
- Unit page migliorata con:
  - testo giapponese
  - supporto lettura
  - segmentazione didattica
  - paraphrase reveal in italiano
  - item canonici richiesti
  - lezioni collegate
  - coverage/gap summary della singola unit
- Item page rifatta in chiave canonical-first con:
  - surface/reading/meaning/explanation ELI5
  - contesti reali (examples + units + lessons)
  - link a product/unit/lesson

## Lessons create/migrate
### Core lessons
- `lesson.core.01` — Fondamenta del testo carta
- `lesson.core.02` — Timing e trigger
- `lesson.core.03` — Numeri e limiti
- `lesson.core.04` — Particelle e condizioni base (nuova)

### Game lessons (Duel Masters)
- `lesson.dm.01` — Zone e movimento
- `lesson.dm.02` — Keyword e wording Duel Masters (nuova)

### Product lessons SD1
- `lesson.dm.sd1.01` — Vocabolario SD1
- `lesson.dm.sd1.02` — Lettura completa SD1

### Product lessons SD2
- `lesson.dm.sd2.01` — Vocabolario SD2
- `lesson.dm.sd2.02` — Lettura completa SD2

## Route structure usata
- `/learn/core`
- `/learn/core/[slug]`
- `/games/[gameId]`
- `/games/[gameId]/learn/[slug]`
- `/games/[gameId]/products/[productId]`
- `/games/[gameId]/products/[productId]/learn/[slug]`
- `/games/[gameId]/products/[productId]/units/[unitId]`

## Key UI components creati/estesi
- Nuovi:
  - `RelatedUnitsList`
  - `GoalGapSummary`
  - `UnlockNextList`
- Riutilizzati nel layered textbook:
  - `FuriganaToggle`
  - `SentenceBreakdown`
  - `RevealTranslation`
  - `RelatedItemsList`
  - `AttentionCallout`
  - `QuickRecognitionBox`

## Goal-awareness sulle product pages
- Product page usa `analyzeTargetGaps` con target type `product`.
- Mastery caricata da `user_item_progress` se utente autenticato (`loadUserMasteryMap`), fallback vuoto per utenti anonimi.
- UI espone:
  - coverage complessiva
  - conteggio known/weak/missing
  - preview item mancanti/deboli
  - lista unlock-next con collegamento diretto alle unità che si avvicinano allo sblocco.

## Remaining UX gaps
1. Rendering lezioni ancora da markdown parsato manualmente (non MDX component runtime): sufficiente ora, ma migliorabile con component mapping nativo.
2. Goal management UI (`/goals`) non ancora con flusso completo create/activate direttamente dal product page.
3. Mancano indicatori visuali più ricchi (progress bar per unità nella lista prodotto).
4. Dashboard principale resta ibrida con metriche legacy SD-specific; da allineare pienamente al modello goal-first.
