# Kanji Clash

## Obiettivo

`Kanji Clash` e un workspace separato da `/review` pensato per discriminare
velocemente vocaboli che condividono almeno un kanji oppure differiscono per un
solo kanji visivamente confondibile e che quindi rischiano di essere
riconosciuti male al volo.

Non sostituisce la review standard. In v1:

- non modifica `review_subject_state` o `review_subject_log`;
- non riusa la coda `/review`;
- il pool automatico non include `grammar`;
- non crea o deduce contenuto editoriale runtime.

Da questa estensione in poi il workspace ha anche un ingresso esplicito dalla
Review: il flusso `forced manual contrast`. Quando l'utente segnala due cose
che confonde, `Kanji Clash` deve accettarle anche se non passano i guardrail del
pool automatico.

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
- Nella stessa sessione una pair key unordered automatica non puo ricomparire,
  ne nello stesso ordine ne invertita.
- I `forced manual contrast` usano invece una dedupe unita al round
  direzionale: le due direzioni della stessa coppia possono comparire entrambe
  nella stessa sessione.
- Una risposta errata deve fermare l'auto-advance finche l'utente non conferma.
- Una risposta corretta deve avanzare rapidamente senza attrito extra.
- Un contrasto manuale archiviato non deve ricomparire ne dalla queue manuale
  ne dalla generazione automatica equivalente.

## Query Contract

La pagina legge solo query params semplici:

- `mode=automatic|manual`
- `media=<slug>`
- `size=<multiplo-di-10>` solo per `manual`

Regole applicate in `src/lib/kanji-clash/page-data.ts`:

- `mode` diverso da `manual` viene normalizzato a `automatic`;
- `media` entra in vigore solo se corrisponde a un media attivo noto;
- `size` accetta multipli positivi di `10`; i preset visibili restano `10`,
  `20`, `40`, ma una sessione manuale completata puo` rilanciare lo stesso
  scope con top-up di `+10`; valori non validi usano il default da `Settings`;
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
- la card driver e` un target lessicale compatto: niente front solo
  hiragana/katakana, niente frammenti frasali con particelle o punteggiatura,
  niente compound con prefisso leggero in kana/katakana del tipo `カード交換`,
  `おすすめ編成`, `ストラテジー戦`, e niente compound misti con coda
  katakana del tipo `進化クリーチャー`, `タップ状態`.

La soglia e volutamente conservativa: Kanji Clash deve partire da materiale gia
stabile nella review standard, non da ricordi ancora fragili o appena
introdotti.

Questi vincoli valgono solo per il pool automatico. Un `forced manual contrast`
puo invece partire da qualsiasi card review corrente e da qualsiasi target
globale materializzabile, inclusi `term`, `grammar`, card `kana-only`, frasi o
card senza kanji. Il criterio non e` l'eligibility algoritmica: e`
semplicemente il fatto che l'utente abbia dichiarato quella confusione.

Il loader aggrega sia subject `entry` sia subject `group`, preservando:

- `subjectKey`;
- `source` (`entry` o `group`);
- members cross-media;
- surface forms e reading forms deduplicate;
- kanji condivisi e swap di kanji simili usati per pairing e scoring.

## Pairing

Il pairing canonico vive in `src/lib/kanji-clash/pairing.ts` e usa una pair key
unordered costruita con `leftSubjectKey::rightSubjectKey` in ordine
lessicografico stabile.

Una coppia viene costruita se passa almeno una delle due route:

- `shared-kanji`: la surface condivide almeno un kanji reale;
- `similar-kanji`: le due surface hanno stessa lunghezza, differiscono in un
  solo slot e quel cambio `A <-> B` esiste nel dataset versionato dei kanji
  simili.

Il dataset degli swap si rigenera con
`./scripts/with-node.sh pnpm kanji-clash:generate-similar-kanji`, fondendo:

- tutti i pair White Rabbit;
- i pair `strokeEditDistance >= 0.75`;
- i pair `yehAndLiRadical >= 0.75`;
- override manuali include/exclude.

La pair key resta unica anche quando una coppia passa entrambe le route: il
candidate conserva motivi multipli (`shared-kanji`, `similar-kanji`) ma non
duplica la pair nella queue.

Una coppia viene scartata se ricade in uno di questi casi:

- `same-subject`
- `same-entry`
- `same-group`
- `no-pairing-signal`
- `same-surface`
- `editorial-clone`
- `qualified-contained-clone`
- `shared-lexical-core`
- `shared-contextual-prefix`
- `contextualized-head-family`
- `cross-edge-mixed-stem`
- `same-kanji-core-reading`

La normalizzazione usa `NFKC`, strip inline markdown e confronto su superfici
pulite. Questo evita di introdurre doppioni cosmetici o quasi-cloni editoriali
nel workspace.

`qualified-contained-clone` copre i casi in cui una surface corta e` gia il
nucleo visivo dell'altra e il materiale extra, davanti o dietro, e` solo un
qualificatore breve: kana/katakana leggeri oppure un frammento misto molto
corto. Esempi da scartare: `一番下` vs `山札の一番下`, `購入` vs `カード購入`,
`期限` vs `受け取り期限`, `対戦` vs `対戦開始`, `状態` vs `タップ状態`.

`shared-lexical-core` copre invece i casi in cui due surface riusano lo stesso
nucleo lessicale finale, oppure la stessa derivazione mista kanji+kana, e
cambiano solo per modificatori brevi. Esempi da scartare: `おすすめ編成` vs
`パーティー編成`, `おすすめ編成` vs `デッキ編成`, `受け取る` vs `受け取り期限`,
`受け取り履歴` vs `受け取り期限`, `未受け取り` vs `一括受け取り`.

Il filtro non deve mangiare coppie contrastive reali che condividono solo una
cornice strutturale iniziale. Esempio da mantenere: `一番上` vs `一番下`.

`shared-contextual-prefix` copre invece i casi in cui due surface condividono
lo stesso contesto frasale iniziale, tipicamente un blocco come `山札の`, ma
poi divergono in due code sostanziali che non hanno senso come clash lessicale.
Esempio da scartare: `山札の上から1枚目` vs `山札の一番下`.

`contextualized-head-family` copre i casi in cui una surface contestualizzata
come `XのY` viene confrontata con una forma piu` nuda della stessa famiglia
lessicale, ad esempio `山札の一番下` vs `一番上`. Anche qui il confronto e`
didatticamente rumoroso perche` mescola livelli di granularita` diversi.

`cross-edge-mixed-stem` copre i casi in cui uno stesso stem misto kanji+kana
appare all'inizio di una forma e alla fine dell'altra, con solo un modificatore
breve e una piccola derivazione ai lati. Esempi da scartare: `受け取る` vs
`一括受け取り`, `一括受け取り` vs `受け取り履歴`, `未受け取り` vs
`受け取り期限`.

`same-kanji-core-reading` copre invece i casi in cui due surface condividono
lo stesso blocco kanji sullo stesso bordo, cambiano solo nei kana attorno e la
lettura di quel blocco kanji resta la stessa. Esempi da scartare: `ランク戦` vs
`ストラテジー戦`, `行く` vs `行こう`. Esempi da mantenere: `行う` vs `行く`,
`出す` vs `出る`.

Lo scoring privilegia:

- piu kanji condivisi;
- kanji condiviso in posizione iniziale saliente;
- forme visivamente vicine ma non identiche;
- swap `similar-kanji` con confidenza piu alta e posizione strutturale saliente.

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

### `kanji_clash_manual_contrast`

Rappresenta il contrasto canonico unordered segnalato manualmente:

- chiave `contrastKey` unordered, costruita sugli endpoint canonici dei due
  subject;
- estremi canonici della coppia;
- `source` (`review_confusion` / forced manual flow);
- `status` archivistico (`active` o `archived`);
- metadata di conferma (`timesConfirmed`, `lastConfirmedAt`, `lastForcedAt`).

Questa tabella non e` un log di risposta: esiste per dedupe, archivio,
riattivazione e soppressione del candidate automatico equivalente.

### `kanji_clash_manual_contrast_round_state`

Rappresenta invece il round direzionale schedulato:

- chiave `contrastCardKey` / `roundKey` distinta per direzione;
- `contrastKey` unordered di appartenenza;
- `targetEndpointKey` e `distractorEndpointKey`;
- stato SRS e `dueAt` per singola direzione;
- eventuale `forcedDueAt` o reset `due-now` quando il contrasto viene appena
  segnalato o ripristinato.

La separazione e` intenzionale: una sola pair state unordered non basta a
modellare il requisito forte "mostra entrambe le direzioni".

### `kanji_clash_manual_contrast_round_log`

Registra solo i round manuali effettivamente giocati:

- chiave del round direzionale;
- target, corretto e scelto;
- transizione di stato precedente e nuova;
- `answeredAt`, `scheduledDueAt`, `responseMs`, `schedulerVersion`.

La segnalazione dalla Review non crea log Kanji Clash. Il log nasce solo quando
l'utente gioca davvero quel round nel workspace dedicato.

## Scheduling

Lo scheduler vive in `src/lib/kanji-clash/scheduler.ts` e usa `ts-fsrs` con:

- namespace separato `kanji_clash_fsrs_v1`;
- `request_retention = 0.9`;
- fuzz disabilitato;
- grading ridotto a soli esiti `again` e `good`.

La prima risposta su una pair usa `createEmptyCard()` e crea lo stato iniziale
dedicato della coppia. Le transizioni future aggiornano solo la pair state.

Per i `forced manual contrast` lo stesso scheduler si applica invece alla round
state direzionale. Le due direzioni evolvono in modo indipendente.

## Queue E Sessione

La queue viene caricata in `src/lib/kanji-clash/session.ts` e ordinata in
`src/lib/kanji-clash/queue.ts`.

### Modalita automatica

- usa pair `due` piu pair `new`;
- rispetta il daily new limit dedicato;
- conta le nuove introdotte oggi con `kanji_clash_pair_log`;
- non mostra pair `reserve` non ancora dovute.

### Forced Manual Contrast

La queue finale fonde due famiglie diverse:

- pair automatiche generate dal pool eligibile;
- round direzionali dei `forced manual contrast` attivi.

Ordine pratico:

- manual `due-now` o appena riconfermati dalla Review;
- manual `due`;
- automatic `due`;
- automatic `new`;
- eventuali `reserve` della modalita drill.

Regole aggiuntive:

- i manuali bypassano completamente l'eligibility automatica;
- la dedupe di sessione per i manual usa `roundKey`, non `contrastKey`;
- se esiste un contrasto manuale `active` o `archived` con la stessa
  `contrastKey`, il candidate automatico equivalente viene soppresso;
- un contrasto appena segnalato dalla Review deve entrare subito in queue con
  priorita alta in entrambe le direzioni.

Default v1:

- daily new limit `5`

### Modalita Drill

- usa lo stesso pool eleggibile come base, ma lo esplora tramite una frontiera
  deterministica e bounded;
- preserva le coppie `due` gia tracciate prima di riempire il resto della
  sessione;
- pesca `new` e `reserve` dalla stessa frontiera, dimensionata in funzione
  della `size` richiesta;
- non promette piu una scansione esaustiva dell'intero corpus eleggibile.

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
- metadata compatto sul motivo del confronto (`chip` shared oppure `Kanji simili:
  A / B`);
- `roundKey` come identita del round; per i round automatici coincide con la
  `pairKey`, per i manuali e` direzionale;
- `pairKey` o `contrastKey`, piu `targetSubjectKey`, usati anche per verifica
  E2E;
- source `due`, `new` o `reserve`.

La disposizione sinistra/destra e il target corretto vengono derivati da un
seed stabile su `pairKey:index`, cosi la sessione resta deterministica senza
reintrodurre la stessa pair due volte.

Per i `forced manual contrast` la materializzazione conserva anche una pill di
origine tipo `Contrasto manuale` / `Segnalato dalla review`, cosi il round non
si confonde con una pair automatica del pool standard.

## Review -> Forced Contrast

Il flusso di ingresso canonico dalla Review e` questo:

1. l'utente rivela la risposta;
2. prima del grading puo` aprire `+ Contrasto` oppure usare la shortcut `C`;
3. compare una search globale tipo glossary, con supporto kanji, kana, romaji
   e significato italiano;
4. l'utente deve selezionare esplicitamente un risultato dal dropdown;
5. il grading `Again` / `Hard` / `Good` / `Easy` salva il voto e, se esiste una
   selezione valida, forza l'upsert del contrasto manuale.

Comportamenti voluti:

- il controllo e` chiuso di default e non appesantisce il flusso standard;
- `Esc` chiude il picker;
- la selezione appare come chip `Contrasto con: ...`, con `Cambia` e `Rimuovi`;
- se l'utente digita ma non seleziona nulla dal dropdown, il grading procede
  normalmente ignorando il testo;
- l'identita trasmessa al server non e` il testo libero, ma la chiave stabile
  del risultato glossary selezionato.

## Failure Semantics

Se il grading include un contrasto selezionato, la Review e l'inserimento del
forced manual contrast devono stare nella stessa transazione.

Ordine richiesto:

1. risolvere card corrente e target selezionato in endpoint canonici;
2. fare solo i check tecnici minimi;
3. upsertare contrasto unordered;
4. upsertare entrambe le round state direzionali;
5. applicare il grading Review;
6. commit.

Se un qualsiasi passo fallisce:

- la Review non deve avanzare silenziosamente;
- il contrasto non deve andare perso come best-effort fallito;
- l'utente deve restare sulla card corrente con errore chiaro.

## Mutazioni Ed Edge Case

La server action `src/actions/kanji-clash.ts` applica guardrail stretti:

- rifiuta submit senza scelta o senza `expectedRoundKey`;
- rifiuta round stale se `expectedRoundKey` non coincide col round corrente;
- rifiuta scelta non appartenente alle due opzioni mostrate;
- verifica coerenza interna del payload round prima di mutare lo stato.

La mutazione:

- legge o crea la pair state della coppia;
- applica la transizione FSRS pair-specific;
- scrive una riga di log;
- avanza la queue locale;
- imposta `awaitingConfirmation` dopo un errore.

Per i round `forced manual`:

- aggiorna solo la round state direzionale che l'utente ha appena giocato;
- non consuma o riscrive automaticamente anche la direzione inversa;
- lascia l'altra direzione indipendente e ancora dovuta se era stata forzata;
- rispetta `status=archived` sul contrasto unordered come kill-switch di
  visibilita` per entrambe le direzioni.

Non aggiorna mai `review_subject_state`, `review_subject_log` o il daily limit
dei nuovi della review standard.

## Archivio E Ripristino

I `forced manual contrast` hanno un lifecycle archivistico esplicito:

- `active`: il contrasto puo` entrare in queue;
- `archived`: entrambe le direzioni spariscono dalla queue;
- `restore`: il contrasto torna `active` e rientra `due-now`.

Regole operative:

- l'archivio vive sull'entita unordered, quindi nasconde entrambe le direzioni;
- un contrasto archiviato sopprime anche l'eventuale pair automatica con la
  stessa chiave canonica;
- se l'utente riseleziona dalla Review un contrasto archiviato, il runtime lo
  riattiva, incrementa `timesConfirmed` e forza di nuovo entrambe le direzioni
  a comparire subito.

## QA E Casi Edge

Copertura automatizzata attuale:

- unit/integration su query, pairing, scheduler, queue, page data, action e
  sessione;
- E2E dedicato in `tests/e2e/kanji-clash.spec.ts`.

I casi edge gia coperti includono:

- filtro media esplicito e fallback globale;
- tap/click, `ArrowLeft`/`ArrowRight`, swipe mobile;
- stop-on-error con conferma `Continua`;
- dedupe della pair key automatica per l'intera sessione;
- presenza di entrambe le direzioni per i `forced manual contrast`;
- grading Review con contrasto selezionato, senza perdita silenziosa su errore;
- testo digitato ma non selezionato che viene ignorato dal grading;
- archive/restore dei contrasti manuali;
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
