# Task 04 - Caching e Invalidazione

## Ruolo

Sei l'agente responsabile del rollout cache per il P0 performance.
Questo task parte solo dopo che i refactor di glossary e review sono stati
integrati o almeno rebasati, perche devi appoggiarti ai loro nuovi boundary.

## Missione

Reintrodurre caching utile e sicuro nel progetto:

- cacheare dataset stabili o quasi stabili;
- lasciare live queue, selected card e contatori dipendenti da `now`;
- introdurre invalidazione esplicita via tag;
- rimuovere `noStore()` e `force-dynamic` solo dove il nuovo boundary lo rende
  sicuro.

## Contesto utile

- Oggi il caching e bloccato in due modi:
  - `force-dynamic` sulle route critiche
  - `noStore()` tramite `markDataAsLive()` nei loader
- Non esiste ancora uso di `unstable_cache`, `cache`, `revalidateTag` o helper
  equivalenti nel repo.
- Le action gia fanno `revalidatePath`, quindi c'e gia un punto centrale per
  introdurre invalidazione piu precisa.
- I candidati migliori alla cache sono:
  - lista media
  - segmenti glossary
  - aggregate stats glossary
  - entry summaries glossary/review
  - review launch candidates
- I settings vanno trattati con prudenza: cacheali solo se la chiave e corretta
  per il modello utente reale dell'app.

## Ownership

Sei proprietario di questi file e aree:

- `src/lib/app-shell.ts`
- eventuali nuovi helper cache sotto `src/lib/`
- `src/actions/review.ts`
- `src/actions/settings.ts`
- `src/actions/textbook.ts`
- `src/app/page.tsx`
- `src/app/media/page.tsx`
- `src/app/media/[mediaSlug]/page.tsx`
- `src/app/review/page.tsx`
- `src/app/glossary/page.tsx`
- `src/app/api/glossary/autocomplete/route.ts`

Puoi toccare anche:

- `src/lib/glossary.ts`
- `src/lib/review.ts`

ma solo per agganciarti ai boundary dati gia stabilizzati dai task precedenti,
non per riaprire i refactor strutturali di quei task.

## Obiettivi concreti

1. Introdurre helper cacheati per i dataset stabili.
2. Definire una strategia di tag coerente, ad esempio:
   - `media-list`
   - `glossary-summary`
   - `glossary-summary:<mediaId>`
   - `review-summary`
   - `review-summary:<mediaId>`
   - `settings`
3. Aggiornare le action per usare `revalidateTag` oltre a `revalidatePath`
   durante la transizione, senza perdere freshness.
4. Rimuovere o restringere `markDataAsLive()` nei loader che ora possono essere
   composti da sottoparti cacheabili.
5. Rimuovere `force-dynamic` solo dalle route che non dipendono piu da loader
   interamente live.
6. Fare in modo che anche dashboard, home e media library beneficino del nuovo
   caching se riusano summary e snapshot stabili.

## Vincoli

- Non cacheare l'intero `ReviewPageData`.
- Non cacheare direttamente la queue finale o la selected card finale.
- Non introdurre staleness visibile dopo:
  - grade review
  - reset
  - status change entry
  - update settings
  - update textbook/import che influiscono su review o glossary
- Se non sei sicuro della correttezza del caching dei settings, lasciali live.

## Criteri di accettazione

- Esistono dataset chiaramente cacheati e invalidati a tag.
- Le route principali non sono piu dinamiche per default dove non serve.
- Le action invalidano in modo mirato oltre ai path.
- Home/media/glossary/review beneficiano del nuovo boundary cacheato senza
  regressioni funzionali evidenti.

## Validazione minima

Esegui e riporta i risultati di:

- `pnpm typecheck`
- `pnpm test`
- benchmark mirato o full benchmark definito dal Task 01

Se aggiungi test specifici per invalidazione o freshness, riportali
esplicitamente.

## Output atteso nel tuo handoff

Restituisci solo:

- conclusione
- evidenze
- file modificati
- rischi
- passo successivo raccomandato

Nel punto "evidenze" includi almeno:

- quali dataset hai cacheato
- quali tag hai introdotto
- quali route hanno perso `force-dynamic`
- come hai garantito la freshness delle parti live
