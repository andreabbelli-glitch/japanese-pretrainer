# 04 — Textbook UX / Lessons / Learning Pages

## Cosa è stato implementato
- Textbook V1 navigabile con:
  - indice lezioni `/lessons`
  - lesson page dinamica `/lessons/[slug]`
  - previous/next lesson navigation
  - progress UI aggregata (bar + count completate)
- Integrazione reale `lesson_progress` su DB (stati `not_started` / `in_progress` / `completed`) tramite server action in lesson page.
- Nuove pagine contenuto:
  - `/items` e `/items/[id]` complete per studio
  - `/cards` e `/cards/[slug]` complete per studio
  - `/decks`, `/decks/[slug]`, `/decks/dm25-sd1`, `/decks/dm25-sd2`
- Componenti didattici riusabili introdotti in `src/components/learning/`.
- Lezioni MDX L1–L8 completate in italiano con struttura didattica coerente al masterplan.

## Componenti creati
- `FuriganaToggle`
- `SentenceBreakdown`
- `RevealTranslation`
- `RelatedItemsList`
- `RelatedCardsList`
- `AttentionCallout`
- `QuickRecognitionBox`

## Lezioni completate
- L1 — Fondamenta del testo carta
- L2 — Zone e movimento
- L3 — Timing e trigger
- L4 — Numeri e limiti
- L5 — Vocabolario SD1
- L6 — Vocabolario SD2
- L7 — Leggere una carta SD1
- L8 — Leggere una carta SD2

## Punti didattici chiave
- Approccio explain-first con tono ELI5 ma operativo.
- Focus costante su riconoscimento di trigger/target/movimento/limiti/vincoli.
- Collegamenti bidirezionali runtime tra lezioni, item e carte.
- Item e card pages pensate per studio reale (lettura, esempi, parafrasi, prerequisiti).

## File principali toccati
- `app/lessons/page.tsx`
- `app/lessons/actions.ts`
- `app/lessons/[slug]/page.tsx`
- `app/lessons/[slug]/lesson-progress-controls.tsx`
- `app/items/page.tsx`
- `app/items/[id]/page.tsx`
- `app/cards/page.tsx`
- `app/cards/[slug]/page.tsx`
- `app/decks/page.tsx`
- `app/decks/[slug]/page.tsx`
- `app/decks/dm25-sd1/page.tsx`
- `app/decks/dm25-sd2/page.tsx`
- `src/components/learning/*`
- `src/domain/content/queries.ts`
- `src/domain/content/index.ts`
- `content/lessons/l-01-...mdx` fino a `content/lessons/l-08-...mdx`
- `tsconfig.json`
- `src/features/user-data/repository.ts`

## TODO contenutistici
- Raffinare ulteriormente i micro-drill con scoring/feedback automatico quando sarà disponibile il modulo review-session interattivo.
- Aggiungere una segmentazione ancora più dettagliata frase-per-frase per tutte le 24 card pages (attualmente è già presente, ma sintetica).
