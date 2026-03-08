# 11 — Review Refactor: Global-First + Goal Review + Missing-Only

## Review modes supported
- `global`: queue standard globale (due + nuovi) su mastery canonica utente×item.
- `goal`: queue filtrata sugli item rilevanti per un goal attivo (`user_goals`).
- `missing-only`: queue focalizzata solo sugli item mancanti (<50) del target del goal.
- `bridge` (opzionale, implementata): queue su item weak/missing già dovuti, senza nuovi.

## Queue rules
1. **Mastery resta globale** in `user_item_progress` (nessuna duplicazione per game/product).
2. **Global review**: priorità ai dovuti, poi nuovi entro i limiti giornalieri.
3. **Goal review**:
   - scope item = `linked_item_ids` del goal, oppure item richiesti dal target (game/product/unit) se `linked_item_ids` è vuoto;
   - dovuti e nuovi vengono filtrati allo scope del goal.
4. **Missing-only**:
   - usa gap analysis del target;
   - include solo item `missing` (mastery < 50), sia lato due che lato nuovi.
5. **Bridge**:
   - usa gap analysis del target;
   - include solo due item `weak` + `missing`, ordinati per mastery crescente.
6. **No fake-new bug**:
   - item già noto globalmente (>=80) non deve essere reintrodotto come nuovo in queue goal-scoped.
7. **Context exposure** resta metadato di supporto e non sostituisce mastery/scheduling.

## Known vs weak vs missing treatment
- `known` (>=80): esclusi dalla logica “new” goal-scoped.
- `weak` (50–79): candidati a bridge e a review goal standard se dovuti.
- `missing` (<50): priorità in missing-only; presenti anche in bridge/goal.

## UI / flow changes
- `/review` ora permette selezione modalità review e goal target (quando necessario).
- `/review/session` mantiene mode/goalId in query string e nelle submit form.
- session summary resta coerente e persistita su `review_sessions` + `review_events`.

## Tests added
- `tests/review-queue-modes.test.ts`
  - global review queue
  - goal review queue (scope filtering)
  - missing-only queue
  - fake-new guard via known-threshold logic
  - bridge queue behavior
- scheduler transition tests preesistenti mantenuti (`tests/review-domain.test.ts`).

## DB migration / persistence adjustments
- Nessuna nuova migrazione SQL in questo step.
- Nessun cambio schema necessario.
- Persistenza review rimane su:
  - `user_item_progress` (mastery globale)
  - `review_sessions`
  - `review_events`
- `user_goals` viene usata per risolvere i filtri di queue.
