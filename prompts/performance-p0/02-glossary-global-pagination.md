# Task 02 - Glossary Globale Paginato

## Ruolo

Sei l'agente responsabile del P0 glossary.
Il tuo obiettivo e trasformare `/glossary` da browse full-corpus a browse
paginato server-side, mantenendo semantica di ranking, grouping cross-media e
filtri.

## Missione

Implementa la paginazione server-side del glossary globale e alleggerisci la
pipeline di autocomplete, senza rompere UX o semantica dei risultati.

## Contesto utile

- Il browse attivo passa da `src/app/glossary/page.tsx`.
- `src/app/media/[mediaSlug]/glossary/page.tsx` fa redirect verso il portale
  globale con filtro `media`.
- Oggi `getGlobalGlossaryPageData()` in `src/lib/glossary.ts`:
  - senza query carica tutto il corpus via `loadGlossaryBaseEntries({ mode: "list" })`
  - costruisce segnali di studio e conteggi per tutti gli entry
  - raggruppa e ordina in JS
- L'attuale contratto `GlobalGlossaryPageData` presume dataset completo:
  - `results` non ha metadata di pagina
  - `resultSummary.filtered` oggi coincide con `results.length`
- La paginazione non puo avvenire a livello di righe `term` o
  `grammar_pattern`, perche romperebbe i result group cross-media.
- L'autocomplete oggi riusa una pipeline troppo pesante e il fallback romaji
  grammatica puo riesaminare tutta la grammatica.

## Ownership

Sei proprietario di questi file e aree:

- `src/lib/glossary.ts`
- `src/db/queries/glossary.ts`
- `src/lib/site.ts`
- `src/app/glossary/page.tsx`
- `src/app/api/glossary/autocomplete/route.ts`
- `src/components/glossary/glossary-portal-page.tsx`
- `src/components/glossary/glossary-portal-search-form.tsx`
- `src/components/glossary/global-glossary-result-card.tsx`
- `tests/glossary.test.ts`
- `tests/glossary-autocomplete.test.ts`
- `tests/e2e/glossary-portal.spec.ts`

Evita di toccare:

- `src/lib/review.ts`
- `src/lib/app-shell.ts`
- `src/actions/*`

## Obiettivi concreti

1. Estendi il contratto dati del glossary globale per supportare paginazione,
   ad esempio con `page`, `pageSize`, `totalPages`, `filteredTotal` o struttura
   equivalente.
2. Introduci un parametro URL di pagina in `buildGlossaryHref()` e in tutta la
   navigazione del portale.
3. Implementa la paginazione sul set dei result group, non sul set delle righe
   base.
4. Assicurati che:
   - ranking
   - grouping cross-media
   - `mediaHits`
   - `cardCount`
   - `mediaCount`
   - filtro `cards`
   mantengano la semantica attuale.
5. Se i filtri o la query cambiano, la pagina deve tornare alla prima pagina.
6. Rendi l'autocomplete indipendente dalla pipeline completa del portale e
   limita il numero di suggerimenti restituiti.
7. Elimina o limita il fallback romaji grammatica che oggi puo scansionare tutta
   la grammatica globale quando non trova hit SQL.

## Approccio raccomandato

- Introduci un boundary a due stadi:
  1. selezione server-side dei `resultKey` della pagina corrente e del totale
     filtrato;
  2. hydration completa solo dei gruppi necessari alla pagina corrente.
- Se ti serve una costante di pagina, rendila esplicita e facilmente
  modificabile.
- Mantieni il codice del portale leggibile: meglio un paio di helper nuovi che
  estendere eccessivamente una sola funzione gigantesca.

## Vincoli

- Non usare un `LIMIT/OFFSET` grezzo sulle query base del corpus globale.
- Non degradare il comportamento di ricerca locale o dei detail page.
- Non cambiare copy o design piu del necessario per introdurre i controlli di
  paginazione.
- Mantieni la UX no-query sfogliabile, ma paginata.

## Criteri di accettazione

- `/glossary` non costruisce piu il corpus completo per il browse no-query.
- La UI mostra e naviga pagine vere con metadata coerenti.
- `resultSummary.filtered` rappresenta il totale filtrato, non la lunghezza
  della pagina corrente.
- L'autocomplete e sensibilmente piu leggero e non usa la pipeline completa.
- Le route e i test esistenti su glossary restano verdi o vengono aggiornati in
  modo coerente.

## Validazione minima

Esegui e riporta i risultati di:

- `pnpm typecheck`
- `pnpm test -- glossary`
- `pnpm test -- glossary-autocomplete`
- `pnpm test:e2e:runner --grep glossary`

Se l'ultimo comando non e praticabile nel tuo ambiente, spiega cosa hai
eseguito al suo posto.

## Output atteso nel tuo handoff

Restituisci solo:

- conclusione
- evidenze
- file modificati
- rischi
- passo successivo raccomandato

Nel punto "evidenze" includi almeno:

- come hai implementato la paginazione a livello di result group
- come hai mantenuto la semantica di `mediaHits` e `cardCount`
- come hai alleggerito autocomplete
