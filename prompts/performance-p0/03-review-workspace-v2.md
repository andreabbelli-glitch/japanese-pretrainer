# Task 03 - Review Workspace V2

## Ruolo

Sei l'agente responsabile del P0 review.
Il tuo lavoro e rifare il loader review in modo che lavori sui dati davvero
necessari alle card eleggibili, senza alterare la semantica della queue.

## Missione

Implementa un nuovo boundary dati per la review:

1. carica card + lesson linkage;
2. filtra le eligible cards;
3. deriva solo gli entry ref necessari;
4. carica summary compatti solo per quegli entry;
5. costruisce queue, subject state e selected card a partire da quel set ridotto.

## Contesto utile

- Oggi `getReviewPageData()` e `loadGlobalReviewPageWorkspace()` caricano
  `listTermEntryReviewSummaries()` e `listGrammarEntryReviewSummaries()` per
  l'intero scope prima di sapere quali card servono davvero.
- L'eleggibilita delle card dipende da card + lesson linkage, non dai summary
  term/grammar.
- `buildReviewPageDataFromWorkspace()` oggi fa:
  - `loadReviewSubjectStateLookup()`
  - nuovo grouping
  - ulteriore idratazione pronunce per la selected card
- Il client consuma soprattutto:
  - `queueCount` e count per bucket
  - `queueCardIds`
  - `selectedCard`
  - `selectedCardContext`
  - `settings`
  - `session`
  Non usa liste complete della queue nel payload finale.
- Il fallback legacy puo aggiungere costo notevole quando mancano
  `review_subject_state`.
- Gli overview loader e `getReviewQueueSnapshotForMedia()` replicano buona parte
  del pattern corrente e dovrebbero beneficiare dello stesso boundary dati.

## Ownership

Sei proprietario di questi file e aree:

- `src/lib/review.ts`
- `src/db/queries/review.ts`
- `src/db/queries/review-subject.ts`
- `tests/review.test.ts`
- `tests/review-global-queue.test.ts`
- eventuali nuovi test review dedicati

Evita di toccare:

- `src/lib/glossary.ts`
- `src/lib/app-shell.ts`
- `src/actions/settings.ts`
- `src/actions/textbook.ts`

Se devi toccare `src/actions/review.ts`, fallo solo se strettamente necessario e
documentalo chiaramente.

## Obiettivi concreti

1. Introduci un loader condiviso review "workspace v2" che:
   - carica card e linkage lesson
   - filtra le eligible cards
   - raccoglie unique `termIds` e `grammarIds` dalle card eleggibili
   - carica summary compatti solo per quegli ID
2. Fai riusare questo loader a:
   - `getReviewPageData()`
   - `getGlobalReviewPageData()`
   - `getReviewQueueSnapshotForMedia()`
   - `loadReviewOverviewSnapshots()`
   - `loadGlobalReviewOverviewSnapshot()`
3. Riduci il doppio lavoro CPU dove possibile, ad esempio facendo restituire a
   `loadReviewSubjectStateLookup()` anche strutture riusabili come i
   `subjectGroups`.
4. Riduci il costo della selected card:
   - scegli se rendere le pronunce lazy
   - oppure arricchisci i summary compatti con i soli campi pronunciation
     necessari
   Mantieni la UX invariata o quasi invariata.
5. Se possibile, rendi piu evidente il costo del fallback legacy, almeno a
   livello di struttura interna o di punti di estensione, senza introdurre
   logging rumoroso permanente.

## Vincoli

- Non rompere `subjectKey`, grouping cross-media, queue order o session flow.
- Non cambiare le regole di eligibilita.
- Mantieni il payload esterno compatibile, salvo aggiunte strettamente utili.
- Evita refactor gratuiti fuori dallo scope performance.

## Criteri di accettazione

- La review non carica piu summary term/grammar per tutto lo scope.
- Il boundary dati ottimizzato viene riusato anche dagli overview loader
  principali.
- Il comportamento di queue e selected card resta coerente con i test esistenti.
- Il costo della selected card si riduce o viene spostato in modo controllato.

## Validazione minima

Esegui e riporta i risultati di:

- `pnpm typecheck`
- `pnpm test -- review`
- `pnpm test -- review-global-queue`

Se aggiungi test nuovi o selettori diversi, riportali esplicitamente.

## Output atteso nel tuo handoff

Restituisci solo:

- conclusione
- evidenze
- file modificati
- rischi
- passo successivo raccomandato

Nel punto "evidenze" includi almeno:

- la nuova sequenza del loader
- quali consumer sono stati migrati al boundary v2
- come hai gestito la selected card e le pronunce
