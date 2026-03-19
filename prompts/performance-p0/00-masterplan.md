# Masterplan P0 Performance

## Obiettivo

Risolvere i tre P0 emersi dall'audit con una sequenza che massimizzi impatto,
riduca il rischio di regressioni e permetta lavoro parallelo dove i write set
restano separati:

1. il browse di `/glossary` non deve piu caricare il corpus completo;
2. il loader di `/review` e `/media/[slug]/review` non deve piu caricare tutte
   le entry summary dello scope prima di sapere quali card sono davvero
   eleggibili;
3. il caching di Next deve tornare utilizzabile per i dataset stabili, senza
   cacheare l'intero `ReviewPageData`.

## Stato verificato

- Il browse glossary passa dal portale globale:
  - `src/app/glossary/page.tsx`
  - `src/app/media/[mediaSlug]/glossary/page.tsx` fa redirect verso
    `/glossary?...media=slug`
- Il loader glossary globale oggi carica tutto il corpus e poi filtra/raggruppa
  in memoria:
  - `src/lib/glossary.ts`
  - `src/db/queries/glossary.ts`
- Il loader review oggi carica summary per l'intero scope, poi filtra le card
  eleggibili:
  - `src/lib/review.ts`
  - `src/db/queries/review.ts`
- Il caching e bloccato sia dalle route sia da `noStore()` nei loader:
  - `src/app/review/page.tsx`
  - `src/app/glossary/page.tsx`
  - `src/app/page.tsx`
  - `src/app/media/page.tsx`
  - `src/app/media/[mediaSlug]/page.tsx`
  - `src/app/api/glossary/autocomplete/route.ts`
  - `src/lib/glossary.ts`
  - `src/lib/review.ts`
  - `src/lib/app-shell.ts`
- Nota importante: gli indici principali sulle colonne di ricerca normalizzate
  esistono gia in `src/db/schema/glossary.ts`. Gli indici restano lavoro utile,
  ma non sono il primo intervento P0.

## Criteri di completamento

Il P0 e chiuso quando tutte queste condizioni sono vere:

1. `/glossary` supporta paginazione server-side con `filteredTotal` corretto,
   senza costruire in memoria l'intero set di risultati aggregati per il browse.
2. L'autocomplete globale non riusa la pipeline completa del portale e restituisce
   solo top N suggerimenti rilevanti.
3. `getReviewPageData()` e `getGlobalReviewPageData()` non caricano piu summary
   term/grammar per tutto lo scope; caricano solo quelli necessari alle card
   eleggibili.
4. `getReviewQueueSnapshotForMedia()` e gli overview loader riusano lo stesso
   boundary dati ottimizzato della review.
5. I dataset stabili sono cacheati con invalidazione esplicita; queue, selected
   card e contatori dipendenti da `now` restano live.
6. I benchmark mostrano un miglioramento misurabile su `/glossary`, `/review`
   e almeno una route review per-media.

## Sequenza consigliata

### Task 01 - Benchmark e guardrail

Documento: [01-benchmark-and-guardrails.md](./01-benchmark-and-guardrails.md)

Scopo:
- allargare il benchmark esistente alle route che servono davvero per il P0;
- fissare il metodo di misura before/after;
- evitare che i task di implementazione procedano senza numeri comparabili.

Write set previsto:
- `scripts/perf-benchmark.ts`
- `docs/performance-baseline.md`
- eventuali helper o test dedicati al benchmark

Parallelizzazione:
- puo partire subito.

### Task 02 - Glossary globale paginato

Documento: [02-glossary-global-pagination.md](./02-glossary-global-pagination.md)

Scopo:
- introdurre paginazione server-side a livello di result group;
- aggiornare il contratto dati del portale;
- alleggerire autocomplete e fallback romaji.

Write set previsto:
- `src/lib/glossary.ts`
- `src/db/queries/glossary.ts`
- `src/lib/site.ts`
- `src/components/glossary/*`
- `src/app/glossary/page.tsx`
- `src/app/api/glossary/autocomplete/route.ts`
- test glossary correlati

Parallelizzazione:
- puo partire in parallelo con Task 03.

### Task 03 - Review workspace v2

Documento: [03-review-workspace-v2.md](./03-review-workspace-v2.md)

Scopo:
- rifare il loader review in due fasi;
- caricare summary solo per gli entry referenziati dalle card eleggibili;
- ridurre doppio grouping e costo della selected card.

Write set previsto:
- `src/lib/review.ts`
- `src/db/queries/review.ts`
- `src/db/queries/review-subject.ts`
- eventuali test review correlati

Parallelizzazione:
- puo partire in parallelo con Task 02.

### Task 04 - Caching e invalidazione

Documento: [04-caching-and-invalidation.md](./04-caching-and-invalidation.md)

Scopo:
- introdurre cache per dataset stabili;
- aggiungere invalidazione a tag;
- rimuovere `noStore()` e `force-dynamic` solo dove e davvero sicuro.

Write set previsto:
- `src/lib/glossary.ts`
- `src/lib/review.ts`
- `src/lib/app-shell.ts`
- `src/app/**/page.tsx` rilevanti
- `src/actions/review.ts`
- `src/actions/settings.ts`
- `src/actions/textbook.ts`
- eventuali helper cache dedicati

Dipendenze:
- deve partire dopo che Task 02 e Task 03 sono stati integrati o almeno
  rebasati, perche tocca boundary che quei task cambiano.

## Piano di parallelizzazione

- Task 01 puo partire subito.
- Task 02 e Task 03 possono lavorare in parallelo.
- Task 04 va eseguito dopo Task 02 e Task 03.
- La validazione finale e l'integrazione del diff restano al coordinatore
  principale.

## Ownership e conflitti

- Task 02 possiede tutta l'area glossary globale.
- Task 03 possiede tutta l'area review loader.
- Task 04 puo toccare `src/lib/glossary.ts` e `src/lib/review.ts`, quindi non va
  eseguito in parallelo agli altri due task implementativi.
- Se Task 01 ha bisogno di test o fixture condivise, deve evitare di toccare i
  file gia dichiarati come owned da Task 02 o Task 03.

## Validation matrix

Ogni task deve lasciare istruzioni precise per eseguire almeno:

- `pnpm test`
- test mirati dell'area toccata
- `pnpm typecheck`
- benchmark mirato o full benchmark quando rilevante

Il coordinatore finale dovra inoltre:

1. rileggere il diff complessivo;
2. verificare coerenza tra codice, test e documentazione;
3. eseguire i benchmark before/after definiti nel Task 01;
4. confermare che il comportamento utente non sia cambiato fuori dallo scope
   performance.

## Note operative

- Non introdurre `LIMIT/OFFSET` sulle righe base del glossary globale: la
  paginazione deve avvenire sui gruppi aggregati.
- Non cacheare l'intero `ReviewPageData`.
- Non rimuovere `force-dynamic` prima di avere rimosso o ristretto `noStore()`
  nei loader interessati.
- Se emergono lacune nei test, aggiungerle nello stesso task che cambia il
  comportamento.
