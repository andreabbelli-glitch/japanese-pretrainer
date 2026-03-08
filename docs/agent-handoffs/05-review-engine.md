# 05 — Review Engine / Flashcards / Memory Tracking

## Cosa è stato implementato
- Motore review V1 end-to-end con separazione dominio/UI in `src/domain/review/`.
- Flow completo implementato:
  1. start session
  2. fetch prossimo item (queue via query params)
  3. reveal answer
  4. submit grade (`Again/Hard/Good/Easy`)
  5. persistenza stato + evento + metriche sessione
  6. summary finale sessione
- Persistenza reale su tabelle:
  - `user_item_progress`
  - `review_sessions`
  - `review_events`
- CTA review aggiunte su:
  - lesson pages (`/lessons/[slug]`)
  - item pages (`/items/[id]`)
  - card pages (`/cards/[slug]`)
- Impostazioni utente `daily_new_limit` + `daily_review_goal` rispettate nella costruzione queue.

## Algoritmo scelto (SM-2-like semplificato)
Implementato in `src/domain/review/scheduler.ts`.

### Rating supportati
- `Again`
- `Hard`
- `Good`
- `Easy`

### Stati supportati
- `new`
- `learning`
- `review`
- `relearning`
- `mature`

### Regole principali
- `Again`:
  - passa a `learning` (se era `new`) o `relearning` (altrimenti)
  - `interval_days = 0`
  - due in 10 minuti
  - `lapses +1`, `streak = 0`, `ease_factor -0.2`
- `Hard/Good/Easy` su stati iniziali (`new/learning/relearning`):
  - intervalli bootstrap: `1 / 3 / 5` giorni
  - stato risultante `review` (o `mature` se intervallo >=21)
- `Hard/Good/Easy` su `review/mature`:
  - crescita intervallo basata su `ease_factor` + moltiplicatore rating
  - `Hard` crescita piccola e EF in calo
  - `Good` crescita standard
  - `Easy` crescita maggiore e EF in aumento
- Stato `mature` quando `interval_days >= 21`.

## Regole di transizione
- Transizioni isolate in `src/domain/review/transitions.ts`.
- Input scheduler derivato da snapshot DB (`toSnapshot` in `queries.ts`).
- Nessuna logica algoritmo dispersa in componenti React.

## Template review usati
- `kanji`: prompt kanji, risposta lettura + significato
- `vocab`: prompt parola/verbo, risposta lettura + spiegazione
- `keyword`: prompt keyword gioco, risposta effetto pratico
- `pattern`: prompt pattern, risposta riconoscimento + funzione

File: `src/domain/review/templates.ts`.

## File principali toccati
- Dominio review:
  - `src/domain/review/types.ts`
  - `src/domain/review/scheduler.ts`
  - `src/domain/review/transitions.ts`
  - `src/domain/review/queries.ts`
  - `src/domain/review/queue.ts`
  - `src/domain/review/templates.ts`
  - `src/domain/review/index.ts`
- Review flow/UI:
  - `app/review/page.tsx`
  - `app/review/actions.ts`
  - `app/review/session/page.tsx`
  - `app/review/session/review-card.tsx`
- Persistenza/repository:
  - `src/features/user-data/repository.ts`
- CTA review:
  - `src/components/learning/add-to-review-form.tsx`
  - `src/components/learning/index.ts`
  - `app/lessons/[slug]/page.tsx`
  - `app/items/[id]/page.tsx`
  - `app/cards/[slug]/page.tsx`
- Preferenze:
  - `app/settings/actions.ts`
  - `app/settings/page.tsx`
- Dashboard allineata al tracking:
  - `app/dashboard/page.tsx`

## Test coperti
- Unit test dominio review in `tests/review-domain.test.ts`:
  - caso base (`new` + rating)
  - lapse (`Again` da `review`)
  - relearning (`relearning` -> `review`)
  - avanzamento intervalli (`review` -> `mature`)

## TODO futuri
1. Queue più robusta server-side (token sessione persistito in DB invece di query params) per ripresa cross-device più elegante.
2. Eventi analytics prodotto (`review_session_started`, `review_graded`, `review_session_completed`) con pipeline dedicata.
3. UI keyboard shortcuts reali (listener tastiera) oltre al solo hint testuale.
4. Tipizzazione repository con client Supabase typed completo (rimozione `any`).
5. Possibile retry step intraseduta per `Again` immediati nella stessa sessione, mantenendo algoritmo debuggabile.
