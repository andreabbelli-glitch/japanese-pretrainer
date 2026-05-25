# Workflow pronunce

Questo documento e' la source of truth del flusso operativo per aggiungere audio
alle flashcard che non hanno ancora una pronuncia locale.

Ogni workflow editoriale che crea o revisiona flashcard deve chiudere anche il
workflow pronunce sulle entry toccate. Una nuova card non e completa finche la
sua entry non ha un audio locale nel Markdown o in `pronunciations.json`, oppure
una richiesta Forvo `word-add` registrata in `data/forvo-requested-word-add.json`
quando Forvo non espone ancora la pronuncia.

## Obiettivo

Quando arriva una richiesta del tipo "aggiungi le pronunce mancanti",
"completa gli audio delle flashcard" o "riempi gli audio che non ci sono ancora",
usa il resolver del repo. Il workflow effettivo e':

1. selezionare i target dallo scope richiesto;
2. escludere le entry gia coperte da audio locale nel Markdown o in
   `pronunciations.json`;
3. riusare audio gia presenti in altri media compatibili: questo e' sempre il
   primo recupero effettivo e non viene bloccato dai miss Forvo noti;
4. importare dal dataset locale Tofugu/WaniKani quando esiste un match esatto;
5. mandare a Forvo solo il residuo tramite la logica Anki/addon: helper Anki
   dedicato, pagina Forvo letta con user-agent browser, candidati audio estratti
   da `Play(...)`, ranking speaker, download diretto e conversione OGG -> MP3
   quando serve;
6. per ogni entry senza pronuncia Forvo, aprire la richiesta `word-add`
   precompilata e registrarla in `data/forvo-requested-word-add.json` /
   `data/forvo-known-missing.json`;
7. importare periodicamente le richieste Forvo storiche che sono state
   soddisfatte;
8. aggiornare manifest, asset locali, pending list e storico word-add.

Per card appena create o revisionate, lo stesso ordine e obbligatorio ma lo
scope deve essere limitato alle entry toccate o alla lesson appena modificata.
I miss non sono uno stato finale silenzioso: devono aprire `word-add` e lasciare
una traccia nello storico richieste.

Il fetch Forvo standard non parte da `curl` o da script HTTP improvvisati: segue
la logica osservata nell'addon Anki dentro un helper dedicato, legge i candidati
dal player `Play(...)` e poi scarica l'audio diretto scelto. Il riuso interno
resta obbligatorio prima di qualsiasi recupero esterno.

Il dataset Tofugu/WaniKani vive localmente in
`data/tofugu-japanese-vocabulary-pronunciation-audio` e viene sincronizzato con:

```bash
./scripts/with-node.sh pnpm pronunciations:tofugu:sync
```

Il resolver puo anche clonarlo automaticamente durante una run reale, salvo
`--no-tofugu-download`. In `--dry-run` non clona e non copia file: usa il dataset
solo se e' gia presente. Il dataset completo resta sotto `data/` e non viene
versionato; nei bundle media finiscono solo gli MP3 effettivamente importati.

Il backfill da richieste Forvo gia soddisfatte passa invece da un indice audio
estratto da una sessione browser autenticata e importato con
`pnpm pronunciations:forvo:import-requested`. Non sostituisce il resolver: serve
solo a chiudere in massa entry gia passate da `word-add`.

## Entry point standard

Per la maggior parte delle richieste operative, usa direttamente il resolver:

```bash
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media <media-slug>
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media <media-slug>
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/<media-slug>/textbook/<lesson-slug>
```

Il resolver:

- seleziona card da review, prossima lesson o pagina textbook;
- deduplica le entry tramite `card_entry_link`;
- filtra le entry gia audio-backed;
- prova il riuso cross-media su stesso tipo entry, label e reading;
- importa dal dataset locale Tofugu/WaniKani sul residuo del riuso;
- esclude dal solo passaggio Forvo le entry in `data/forvo-known-missing.json`,
  salvo `--retry-known-missing`;
- usa il fetch Forvo Anki-style solo per il residuo finale;
- aggiorna `content/media/<slug>/workflow/pronunciation-pending.json`;
- sincronizza `data/forvo-requested-word-add.json` marcando come `resolved` le
  richieste storiche che ora hanno audio locale.

Non aggiungere mai un limite batch implicito. Usa `--limit` solo quando l'utente
chiede esplicitamente un numero massimo o uno smoke test; il limite si applica
al residuo Forvo, non al riuso cross-media o al dataset Tofugu/WaniKani.

Opzioni Tofugu utili:

- `--tofugu-dataset-dir /path`: usa un clone locale diverso;
- `--no-tofugu`: salta il dataset locale e passa dal riuso direttamente a Forvo;
- `--no-tofugu-download`: non clonare o aggiornare il dataset durante la run.

Per debug mirati del solo riuso interno, senza aprire Forvo, usa il comando
scopato e in dry-run:

```bash
./scripts/with-node.sh pnpm pronunciations:reuse -- --media-slug <media-slug> --dry-run
```

## Fetch Forvo Anki-style

Il percorso standard per ottenere audio esterno replica la parte utile
dell'addon Anki Forvo:

- avviare l'helper Anki dedicato e leggere
  `https://forvo.com/word/<word>/#ja` con la logica dell'addon Forvo;
- leggere i candidati giapponesi esposti dal player `Play(...)`;
- scegliere lo speaker con ranking configurato, oggi `strawberrybrown`, poi
  `mezashi`, poi piu voti;
- scaricare il candidato audio diretto;
- convertire OGG -> MP3 quando il candidato migliore non e' gia MP3;
- salvare il file sotto `content/media/<slug>/assets/audio/...`;
- aggiornare `pronunciations.json` e
  `workflow/pronunciation-pending.json`.

Questo percorso non va sostituito con `curl`, scraping HTTP ad hoc o Playwright
headless per batch reali. La logica standard resta Anki/addon-style; il browser
normale serve per aprire le richieste `word-add` dei miss.

Per target espliciti puoi usare il wrapper repo-scoped:

```bash
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --entry <entry-id>
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --words-file /absolute/path/list.tsv
```

Durante il batch:

- se una entry non esiste su Forvo, il workflow deve aprire `word-add`;
- ogni miss viene registrato in `data/forvo-known-missing.json`;
- ogni miss apre anche `word-add/...` con gli hint `jcs_*` per lo userscript
  Tampermonkey e aggiorna `data/forvo-requested-word-add.json`;
- lo userscript deve chiudere automaticamente le tab autosubmitted dopo la
  conferma Forvo, cosi i batch grandi non lasciano centinaia di tab aperte;
- se Forvo rifiuta il termine nel form `word-add` dopo la selezione di
  `Japanese`, non considerarlo richiesto: rimuovilo dallo storico richieste e
  mantienilo in `data/forvo-known-missing.json` con `wordAddBlockedReason`;
- le richieste `word-add` devono usare solo testo giapponese pulito. Se una
  grammar card contiene solo descrizioni italiane/inglesi o placeholder non
  pronunciabili, il workflow la marca missing ma non apre una richiesta
  spazzatura;
- non disattivare il prefill word-add.

## Fallback manuale estremo

Il download manuale dal browser normale e' ammesso solo come extrema ratio: un
caso specifico in cui il fetch Anki-style o l'import diretto hanno fallito, ma la
pagina Forvo mostra chiaramente un audio recuperabile. In quel caso documenta nel
riepilogo perche il percorso standard non ha funzionato e importa solo il file
necessario. Non presentarlo come alternativa normale e non usarlo per batch
ordinari.

La documentazione operativa dettagliata di Forvo e' in
`docs/forvo-pronunciation-fetch.md`.

## Richieste Forvo soddisfatte

Quando il backlog `word-add` e' stato pronunciato da altri utenti Forvo:

1. apri la pagina account Forvo delle requested pronunciations in una sessione
   autenticata;
2. scandisci tutte le pagine e incrocia le righe disponibili con
   `data/forvo-requested-word-add.json`;
3. costruisci un indice audio locale con il candidato scelto per ogni entry;
4. importa l'indice:

```bash
./scripts/with-node.sh pnpm pronunciations:forvo:import-requested -- --audio-index /tmp/forvo-requested-audio-index.json
```

L'importer scarica direttamente l'audio Forvo indicizzato, converte OGG in MP3,
aggiorna i manifest e marca risolte le richieste storiche. Usa `--dry-run`
prima di una nuova euristica di matching.

## Guardrail

- Non aprire Forvo per entry che possono riusare audio gia presente in un altro
  media compatibile o importare un match esatto dal dataset Tofugu/WaniKani.
- I flag con valore (`--media`, `--media-slug`, `--known-missing-file` e
  simili) devono avere sempre un valore esplicito: il workflow deve fermarsi
  prima di partire se il valore manca o se al suo posto arriva un altro flag.
- Non usare `pnpm pronunciations:forvo` come entry point standard quando lo
  scope reale e' `review`, `next-lesson` o una pagina textbook: usa
  `pnpm pronunciations:resolve`.
- Non usare `curl` o script HTTP ad hoc fuori dall'helper Anki come workflow
  Forvo.
- Non usare Playwright/browser automation come percorso standard per batch reali;
  puo restare solo come debug/manutenzione del fetcher.
- Non usare il download manuale come alternativa normale al fetch Anki-style: e'
  solo fallback estremo per casi singoli.
- Le entry gia marcate in `data/forvo-known-missing.json` vanno escluse di
  default solo dal passaggio Forvo; riuso cross-media e Tofugu/WaniKani restano
  eleggibili. Usa `--retry-known-missing` solo quando vuoi riprovarle su Forvo.
- Le entry con `wordAddBlockedReason` non vanno riaperte dal batch request
  ordinario; usa `--retry-blocked` solo per debug mirato o dopo avere corretto
  il testo giapponese da inviare a Forvo.
- Una richiesta `word-add` storica con URL non piu canonico non blocca il batch:
  va riaperta con l'URL prodotto dalla normalizzazione corrente e poi aggiornata
  in `data/forvo-requested-word-add.json`.
