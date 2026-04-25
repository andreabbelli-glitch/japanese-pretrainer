# Fetch pronunce da Forvo

Lo script `pnpm pronunciations:forvo` supporta il fallback Forvo per scaricare
pronunce MP3 e inserirle nel bundle locale. Nel flusso operativo standard usa
`--manual` nel browser normale; il percorso browser dedicato resta per debug o
manutenzione del fetcher.

Per richieste operative ad alto livello come `review`, `next-lesson` o
`lesson-url`, l'entry point standard e ora
`pnpm pronunciations:resolve`. `pnpm pronunciations:forvo` resta il comando
low-level per batch espliciti di fallback manuale e debug.

## Ruolo nel workflow

Questo non e il primo step del workflow pronunce.

Forvo e un fallback da usare solo dopo il pass offline sulle sole entry rimaste
senza audio anche dopo il controllo di riuso cross-media. La source of truth
del processo completo e
`docs/pronunciation-workflow.md`.

## Quando usarlo

- hai gia eseguito il fetch offline e restano entry senza audio locale;
- hai gia lasciato che il workflow riusasse gli audio compatibili presenti in
  altri media;
- hai un account Forvo e puoi scaricare manualmente gli MP3 dal browser;
- vuoi passare una lista mirata di parole o entry invece di processare tutto il
  bundle.

Se invece vuoi che il repo scelga da solo le card giuste partendo da review,
prossima lesson o pagina textbook, usa `pnpm pronunciations:resolve`.

## Come funziona

- legge `content/` con lo stesso parser/validator dell'import;
- prima di aprire Forvo prova automaticamente a riusare audio gia presenti in
  altri media con stessa entry type, stesso label e stessa reading;
- nel flusso operativo standard apre l'URL Forvo nel browser normale e osserva
  il download locale del file scelto;
- quando marchi una entry come missing (`s` o `/skip`), apre anche l'URL
  `word-add/...` nel browser normale per chiedere la pronuncia e registra la
  richiesta in `data/forvo-requested-word-add.json`;
- il registry `data/forvo-requested-word-add.json` e' storico: quando una entry
  ottiene poi un audio locale, il workflow la marca automaticamente come
  `resolved` nello stesso file, senza rimuovere la traccia della richiesta;
- gli URL `word-add` includono anche hint di prefill (`jcs_lang`, `jcs_phrase`,
  `jcs_person_name`, `jcs_autosubmit`) per lo userscript Tampermonkey locale;
- quando il label contiene varianti separate da slash ASCII (`/`), l'URL
  `word-add` lo normalizza in `・` per evitare che Forvo prenda solo la prima
  meta' della stringa;
- il profilo browser dedicato in `data/forvo-profile/` resta disponibile per il
  percorso Playwright di debug o manutenzione del fetcher;
- se Cloudflare o il login richiedono intervento, ti lascia completare la
  pagina nel browser e poi riprende il batch;
- per ogni parola sceglie il candidato con ranking migliore, privilegiando:
  speaker dal Giappone, voto migliore e risultato piu alto nella lista;
- salva l'audio in `content/media/<slug>/assets/audio/...`;
- aggiorna `content/media/<slug>/pronunciations.json` con `audio_source: "forvo"`.
- aggiorna anche `content/media/<slug>/workflow/pronunciation-pending.json`
  con le entry ancora aperte e non marcate come missing.

## Comandi

```bash
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/duel-masters-dm25/textbook/tcg-core-overview
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:forvo -- --media duel-masters-dm25 --dry-run
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media gundam-arsenal-base --word 専用機 --word 戦艦
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25 --entry term-cost
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25 --words-file tmp/forvo-list.tsv
./scripts/with-node.sh pnpm pronunciations:forvo:request
./scripts/with-node.sh pnpm pronunciations:forvo:request -- --media duel-masters-dm25
```

## Modalita manuale consigliata

Per i batch reali usa sempre `--manual`:

- il comando apre l'URL Forvo nel browser normale;
- tu scarichi il file migliore dal tuo account;
- il comando osserva `~/Downloads`, prende l'ultimo audio nuovo e lo importa nel
  bundle corretto;
- se la parola non esiste su Forvo, puoi digitare `s` e premere Enter per
  marcarla come missing e saltarla nelle run future;
- subito dopo lo skip apre anche la pagina `word-add/...` della stessa entry,
  cosi puoi chiedere la pronuncia dal browser normale senza cercarla a mano;
- se hai installato lo userscript locale
  `scripts/forvo-word-add-helper.user.js`, la pagina `word-add` seleziona in
  automatico `Japanese`, decide `phrase yes/no` dagli hint del repo e lascia
  `personal name = no`;
- con `jcs_autosubmit=1` prova anche a premere `Add` in automatico senza che tu
  debba portare in primo piano la tab;
- se Forvo mostra che la voce e' gia definita in `Japanese [ja]`, lo script non
  forza il submit e segnala `Already in Japanese`.
- mentre aspetta espone anche un URL locale, di default
  `http://127.0.0.1:3210/skip`, che puoi richiamare da browser per saltare senza
  tornare al terminale.

Opzioni utili:

- `--downloads-dir /path`: cartella download diversa;
- `--control-port 3210`: porta del comando locale `/skip`;
- `--no-open`: non apre automaticamente l'URL nel browser;
- `--known-missing-file /path`: file JSON dove salvare gli skip persistenti;
- `--request-registry-file /path`: file JSON dove salvare le richieste
  `word-add` gia aperte;
- `--retry-known-missing`: riprova anche le voci gia marcate come missing; vale
  sia per `pnpm pronunciations:forvo` sia per `pnpm pronunciations:resolve`.
- `--no-open-word-add-on-skip`: registra la richiesta ma non apre la tab
  `word-add` quando salti una entry.

## Userscript Tampermonkey

Lo userscript locale da usare e':

`scripts/forvo-word-add-helper.user.js`

Installazione pratica:

- apri Tampermonkey;
- crea un nuovo script;
- incolla il contenuto di `scripts/forvo-word-add-helper.user.js`;
- salva e lascia lo script attivo per `forvo.com`.

Comportamento:

- aggiunge due pulsanti vicino all'`Add` normale: `Fill Forvo` e `Fill + Add`;
- se l'URL contiene i parametri del repo (`jcs_lang=ja`, `jcs_phrase=0/1`,
  `jcs_person_name=0/1`, `jcs_autosubmit=0/1`), prova anche un auto-fill
  iniziale;
- usa una regola esplicita del workflow per `phrase yes/no`:
  grammatica => frase, pattern con `〜`, spazi o punteggiatura => frase,
  termini semplici => parola.

## Formato lista parole

`--words-file` accetta testo UTF-8, una riga per item:

```text
# parola
食べる

# parola<TAB>reading
設定	せってい

# parola<TAB>reading<TAB>entry_id
ている	ている	grammar-teiru

# entry_id diretto
term-taberu
```

## Note operative

- `pnpm pronunciations:resolve` e il percorso standard per richieste orientate
  al prodotto; `pnpm pronunciations:forvo` resta il low-level manuale;
- default: browser headed, perche Forvo passa da Cloudflare e sessione login;
- `--headless` esiste ma non e consigliato per il flusso reale;
- `--manual` e la modalita operativa standard per questo repo; usa il browser Playwright solo per debug mirato o manutenzione del fetcher;
- se una voce esiste gia in un altro media compatibile, il comando deve
  collegarla e non proportela su Forvo;
- nessun batch implicito: `--limit` va passato solo quando l'utente chiede
  esplicitamente un numero massimo o uno smoke test;
- gli skip persistenti finiscono di default in `data/forvo-known-missing.json`;
- le richieste `word-add` gia aperte finiscono di default in
  `data/forvo-requested-word-add.json`; le entry risolte restano nello storico
  ma vengono annotate con `resolvedAt` e metadata dell'audio trovato;
- il residuo operativo corrente vive in
  `content/media/<slug>/workflow/pronunciation-pending.json`;
- `--refresh` forza il rimpiazzo anche se l'entry ha gia audio locale;
- `--profile-dir` permette di isolare un profilo browser diverso;
- `--keep-browser-open` lascia Chrome aperto a fine batch per debug.

## Batch one-shot per il backlog known missing

Quando vuoi coprire in blocco il backlog gia segnato come `not_found_on_forvo`,
usa:

```bash
./scripts/with-node.sh pnpm pronunciations:forvo:request
```

Questo comando:

- legge `data/forvo-known-missing.json`;
- esclude di default le voci gia richieste e registrate in
  `data/forvo-requested-word-add.json`;
- apre gli URL `https://forvo.com/word-add/...` nel browser normale;
- salva subito nel registry quali richieste sono gia state lanciate.

Opzioni utili:

- `--media <slug>`: limita il batch a un media;
- `--entry <entry-id>`: limita il batch a una entry precisa;
- `--limit N`: quante tab aprire;
- `--no-open`: stampa/registra senza aprire il browser;
- `--retry-requested`: include anche le voci gia richieste in passato;
- `--request-delay-ms 3000`: pausa tra le tab aperte. Questo e' ora il default
  prudente consigliato per non aprire troppe richieste in sequenza troppo
  aggressiva.
