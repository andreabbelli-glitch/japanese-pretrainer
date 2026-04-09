# Kanji Clash

## Obiettivo

`Kanji Clash` e un workspace separato da `/review` pensato per discriminare
velocemente vocaboli che condividono almeno un kanji e che quindi rischiano di
essere riconosciuti male al volo.

Non sostituisce la review standard. In v1:

- non modifica `review_subject_state` o `review_subject_log`;
- non riusa la coda `/review`;
- non include `grammar`;
- non crea o deduce contenuto editoriale runtime.

La surface pubblica e:

- item primario separato in navbar: `Kanji Clash`;
- route top-level `/kanji-clash`;
- CTA dalla review globale;
- CTA dalle pagine media verso `/kanji-clash?media=<slug>`.

## Invarianti Di Prodotto

- Il nome pubblico resta `Kanji Clash`.
- Il workspace supporta modalita `automatic` e `manual`.
- Lo scope puo essere `global` o `media`.
- Uno scope `media` richiede sempre un media esplicito; se `Settings` indica
  `media` ma manca `media=<slug>`, il runtime fa fallback a `global`.
- Nella stessa sessione una pair key unordered non puo ricomparire, ne nello
  stesso ordine ne invertita.
- Una risposta errata deve fermare l'auto-advance finche l'utente non conferma.
- Una risposta corretta deve avanzare rapidamente senza attrito extra.

## Query Contract

La pagina legge solo query params semplici:

- `mode=automatic|manual`
- `media=<slug>`
- `size=10|20|40` solo per `manual`

Regole applicate in `src/lib/kanji-clash/page-data.ts`:

- `mode` diverso da `manual` viene normalizzato a `automatic`;
- `media` entra in vigore solo se corrisponde a un media attivo noto;
- `size` accetta solo i preset `10`, `20`, `40`, altrimenti usa il default da
  `Settings`;
- i setting user-facing vivono in `user_setting` con chiavi
  `kanji_clash_daily_new_limit`, `kanji_clash_default_scope`,
  `kanji_clash_manual_default_size`.

La route non espone un endpoint JSON dedicato: costruisce i dati server-side e
passa al client uno snapshot di queue gia materializzato.

## Pool Eleggibile

La query canonica vive in `src/db/queries/kanji-clash.ts`.

Un subject entra nel pool solo se:

- e un `term`;
- appartiene alla review reale del sistema;
- arriva da lesson `completed`;
- lo stato review e `review` oppure `relearning`;
- non ha `manual_override`;
- non e `suspended`;
- `stability >= 7`;
- `reps >= 2`;
- ha almeno un kanji nella superficie normalizzata.

La soglia e volutamente conservativa: Kanji Clash deve partire da materiale gia
stabile nella review standard, non da ricordi ancora fragili o appena
introdotti.

Il loader aggrega sia subject `entry` sia subject `group`, preservando:

- `subjectKey`;
- `source` (`entry` o `group`);
- members cross-media;
- surface forms e reading forms deduplicate;
- kanji condivisi usati per pairing e scoring.

## Pairing

Il pairing canonico vive in `src/lib/kanji-clash/pairing.ts` e usa una pair key
unordered costruita con `leftSubjectKey::rightSubjectKey` in ordine
lessicografico stabile.

Una coppia viene scartata se ricade in uno di questi casi:

- `same-subject`
- `same-entry`
- `same-group`
- `no-shared-kanji`
- `same-surface`
- `editorial-clone`

La normalizzazione usa `NFKC`, strip inline markdown e confronto su superfici
pulite. Questo evita di introdurre doppioni cosmetici o quasi-cloni editoriali
nel workspace.

Lo scoring privilegia:

- piu kanji condivisi;
- kanji condiviso in posizione iniziale saliente;
- forme visivamente vicine ma non identiche.

Penalizza invece reading condivisi troppo simili, per evitare bivi didattici
deboli.

## Guardrail Editoriali

Kanji Clash deve consumare materiale canonico, non creare duplicati studiati
apposta per aumentare il numero di coppie possibili.

- Reuse prima di duplicare: se una surface o un reading task e` gia coperto da
  una voce o card esistente, non creare un doppione solo per farlo entrare nel
  pool.
- Distinzione esplicita: quando due voci simili sono davvero separate, tenere
  entrambe distinte e documentare la differenza nella sorgente editoriale,
  invece di trasformarle in quasi-cloni confusi.
- Eligibility pulita: la superficie canonica deve restare stabile, leggibile e
  priva di varianti cosmetiche che non cambiano il task di lettura.

## Data Model

Le tabelle dedicate sono:

### `kanji_clash_pair_state`

Memorizza lo stato SRS della coppia:

- chiavi `pairKey`, `leftSubjectKey`, `rightSubjectKey`;
- stato FSRS pair-specific (`new`, `learning`, `review`, `relearning`,
  `suspended`, `known_manual`);
- `stability`, `difficulty`, `dueAt`, `lastReviewedAt`;
- contatori (`scheduledDays`, `learningSteps`, `lapses`, `reps`);
- namespace scheduler `kanji_clash_fsrs_v1`.

### `kanji_clash_pair_log`

Registra ogni risposta:

- `mode` (`automatic` o `manual`);
- target, lato corretto e lato scelto;
- transizione di stato precedente e nuova;
- `scheduledDueAt`, `elapsedDays`, `responseMs`;
- `answeredAt` e `schedulerVersion`.

L'isolamento e intenzionale: Kanji Clash non scrive mai nelle tabelle della
review standard.

## Scheduling

Lo scheduler vive in `src/lib/kanji-clash/scheduler.ts` e usa `ts-fsrs` con:

- namespace separato `kanji_clash_fsrs_v1`;
- `request_retention = 0.9`;
- fuzz disabilitato;
- grading ridotto a soli esiti `again` e `good`.

La prima risposta su una pair usa `createEmptyCard()` e crea lo stato iniziale
dedicato della coppia. Le transizioni future aggiornano solo la pair state.

## Queue E Sessione

La queue viene caricata in `src/lib/kanji-clash/session.ts` e ordinata in
`src/lib/kanji-clash/queue.ts`.

### Modalita automatica

- usa pair `due` piu pair `new`;
- rispetta il daily new limit dedicato;
- conta le nuove introdotte oggi con `kanji_clash_pair_log`;
- non mostra pair `reserve` non ancora dovute.

Default v1:

- daily new limit `5`

### Modalita manuale

- usa lo stesso pool eleggibile;
- puo pescare `due`, `new` e `reserve`;
- tronca la sessione alla size richiesta.

Preset v1:

- `10`
- `20`
- `40`

Default v1:

- `20`

### Materializzazione round

Ogni round include:

- target centrale: reading + significato;
- opzione sinistra e destra;
- `pairKey` e `targetSubjectKey` usati anche per verifica E2E;
- source `due`, `new` o `reserve`.

La disposizione sinistra/destra e il target corretto vengono derivati da un
seed stabile su `pairKey:index`, cosi la sessione resta deterministica senza
reintrodurre la stessa pair due volte.

## Mutazioni Ed Edge Case

La server action `src/actions/kanji-clash.ts` applica guardrail stretti:

- rifiuta submit senza scelta o senza `expectedPairKey`;
- rifiuta round stale se `expectedPairKey` non coincide col round corrente;
- rifiuta scelta non appartenente alle due opzioni mostrate;
- verifica coerenza interna del payload round prima di mutare lo stato.

La mutazione:

- legge o crea la pair state della coppia;
- applica la transizione FSRS pair-specific;
- scrive una riga di log;
- avanza la queue locale;
- imposta `awaitingConfirmation` dopo un errore.

Non aggiorna mai `review_subject_state`, `review_subject_log` o il daily limit
dei nuovi della review standard.

## QA E Casi Edge

Copertura automatizzata attuale:

- unit/integration su query, pairing, scheduler, queue, page data, action e
  sessione;
- E2E dedicato in `tests/e2e/kanji-clash.spec.ts`.

I casi edge gia coperti includono:

- filtro media esplicito e fallback globale;
- tap/click, `ArrowLeft`/`ArrowRight`, swipe mobile;
- stop-on-error con conferma `Continua`;
- dedupe della pair key per l'intera sessione;
- completamento pulito della sessione;
- protezione contro round payload incoerente o stale.

## File Chiave

- `src/app/kanji-clash/page.tsx`
- `src/actions/kanji-clash.ts`
- `src/db/schema/kanji-clash.ts`
- `src/db/queries/kanji-clash.ts`
- `src/db/queries/kanji-clash-session.ts`
- `src/lib/kanji-clash/page-data.ts`
- `src/lib/kanji-clash/pairing.ts`
- `src/lib/kanji-clash/queue.ts`
- `src/lib/kanji-clash/scheduler.ts`
- `src/lib/kanji-clash/session.ts`
- `tests/e2e/kanji-clash.spec.ts`
