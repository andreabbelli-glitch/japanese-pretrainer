# Workflow pronunce

Questo documento e' la source of truth del flusso operativo per aggiungere audio
alle flashcard che non hanno ancora una pronuncia locale.

## Obiettivo

Quando arriva una richiesta del tipo "aggiungi le pronunce mancanti",
"completa gli audio delle flashcard" o "riempi gli audio che non ci sono ancora",
usa il resolver del repo. Il workflow effettivo e':

1. selezionare i target dallo scope richiesto;
2. escludere le entry gia coperte da audio locale nel Markdown o in
   `pronunciations.json`;
3. riusare audio gia presenti in altri media compatibili;
4. mandare a Forvo manuale solo il residuo senza audio e non known-missing;
5. importare periodicamente le richieste Forvo storiche che sono state
   soddisfatte;
6. aggiornare manifest, asset locali, pending list e storico word-add.

Forvo manuale e' l'unico meccanismo di recupero esterno delle pronunce audio.
Il riuso interno resta obbligatorio prima di aprire Forvo.

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
- esclude le entry in `data/forvo-known-missing.json`, salvo
  `--retry-known-missing`;
- prova il riuso cross-media su stesso tipo entry, label e reading;
- apre Forvo manuale nel browser normale per il residuo;
- aggiorna `content/media/<slug>/workflow/pronunciation-pending.json`;
- sincronizza `data/forvo-requested-word-add.json` marcando come `resolved` le
  richieste storiche che ora hanno audio locale.

Non aggiungere mai un limite batch implicito. Usa `--limit` solo quando l'utente
chiede esplicitamente un numero massimo o uno smoke test.

Per debug mirati del solo riuso interno, senza aprire Forvo, usa il comando
scopato e in dry-run:

```bash
./scripts/with-node.sh pnpm pronunciations:reuse -- --media-slug <media-slug> --dry-run
```

## Forvo manuale

Il Forvo manuale richiede un TTY interattivo. In Codex avvia il comando con
`tty: true`, cosi' il batch puo' esporre anche il controllo locale
`http://127.0.0.1:3210/skip`.

Per target espliciti puoi usare il wrapper repo-scoped:

```bash
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --entry <entry-id>
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --words-file /absolute/path/list.tsv
```

Durante il batch:

- scarica dal browser normale l'MP3 giapponese migliore in `~/Downloads`;
- se una entry non esiste su Forvo, usa `s` nel terminale o `/skip`;
- ogni skip viene registrato in `data/forvo-known-missing.json`;
- ogni skip apre anche `word-add/...` con gli hint `jcs_*` per lo userscript
  Tampermonkey e aggiorna `data/forvo-requested-word-add.json`;
- non disattivare il prefill word-add.

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
  media compatibile.
- I flag con valore (`--media`, `--media-slug`, `--known-missing-file` e
  simili) devono avere sempre un valore esplicito: il workflow deve fermarsi
  prima di partire se il valore manca o se al suo posto arriva un altro flag.
- Non usare `pnpm pronunciations:forvo` come entry point standard quando lo
  scope reale e' `review`, `next-lesson` o una pagina textbook: usa
  `pnpm pronunciations:resolve`.
- Non usare Playwright per batch reali Forvo; il browser normale in `--manual`
  e' il percorso operativo.
- Non lanciare Forvo manuale da una sessione non-TTY.
- Le entry gia marcate in `data/forvo-known-missing.json` vanno escluse di
  default; usa `--retry-known-missing` solo quando vuoi riprovarle.
