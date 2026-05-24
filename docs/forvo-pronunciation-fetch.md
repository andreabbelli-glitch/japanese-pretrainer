# Pronunce da Forvo

Lo script `pnpm pronunciations:forvo` scarica pronunce MP3 da Forvo e le
inserisce nel bundle locale. Nel flusso operativo standard usa `--manual` nel
browser normale; il percorso browser dedicato resta per debug o manutenzione
del fetcher.

La modalita manuale richiede un TTY interattivo. In Codex il comando va avviato
con `tty: true`, altrimenti viene rifiutato prima di aprire Forvo: senza TTY non
puo esporre in modo affidabile il controllo browser `/skip`.

Per richieste operative ad alto livello come `review`, `next-lesson` o
`lesson-url`, l'entry point standard e ora
`pnpm pronunciations:resolve`. `pnpm pronunciations:forvo` resta il comando
low-level per batch espliciti di fallback manuale e debug.

## Ruolo nel workflow

Forvo manuale e' l'unico recupero esterno effettivo delle pronunce audio. Prima
di aprire Forvo il workflow deve comunque filtrare gli audio gia locali e
riusare eventuali audio compatibili presenti in altri media. La source of truth
del processo completo e' `docs/pronunciation-workflow.md`.

## Quando usarlo

- hai gia lasciato che il workflow filtrasse gli audio locali e riusasse gli
  audio compatibili presenti in altri media;
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
- il prefill `word-add` e obbligatorio: gli skip devono sempre aprire la
  richiesta gia precompilata e registrarla nello storico.

Opzioni utili:

- `--downloads-dir /path`: cartella download diversa;
- `--control-port 3210`: porta del comando locale `/skip`;
- `--no-open`: non apre automaticamente l'URL nel browser;
- `--known-missing-file /path`: file JSON dove salvare gli skip persistenti;
- `--request-registry-file /path`: file JSON dove salvare le richieste
  `word-add` gia aperte;
- `--retry-known-missing`: riprova anche le voci gia marcate come missing; vale
  sia per `pnpm pronunciations:forvo` sia per `pnpm pronunciations:resolve`.

Il vecchio flag `--no-open-word-add-on-skip` non e piu un flusso valido: se
viene passato, il comando fallisce invece di saltare il prefill della richiesta.

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
- `--manual` richiede stdin/stdout TTY; in Codex usare `exec_command` con
  `tty: true` e verificare che l'output mostri `browser skip URL:`;
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

## Esperimento Anki addon 1784714388

Il 2026-05-24 e' stato testato l'addon AnkiWeb `1784714388` in un profilo Anki
temporaneo (`ANKI_BASE=/tmp/anki-forvo-test`) con target `食べる` e lingua `ja`.
L'addon scarica effettivamente audio: il test ha prodotto
`/tmp/anki-forvo-test/User 1/collection.media/pronunciation_ja_食べる.mp3`, un
MP3 mono 44.1 kHz, e ha lasciato anche la copia temporanea in
`/tmp/anki-forvo-test/addons21/1784714388/temp/pronunciation_ja_食べる.mp3`.

La logica utile da replicare e' in `src/Forvo.py` dell'addon:

- apre `https://forvo.com/word/<word>` dentro `QWebEngineView`;
- aspetta l'HTML renderizzato con JavaScript e poi lo passa al parser;
- legge i blocchi `language-container-...`, estrae utente, origine e voti;
- decodifica dal gestore `Play(...)` il token base64 dell'audio;
- costruisce URL diretti `https://audio00.forvo.com/audios/mp3/...` o fallback
  OGG;
- scarica il file con `urllib.request.urlopen()` e lo importa nella media
  collection Anki.

Questo non e' un vero bypass Cloudflare: l'addon si appoggia a un browser Qt
headed, quindi JavaScript e cookie funzionano meglio di una richiesta HTTP
diretta. Se Forvo presenta una challenge, va comunque risolta nella finestra
browser. Nel test del 2026-05-24 la pagina `食べる` non ha mostrato challenge e
l'estrazione e' arrivata fino al download.

L'addon non ha una preferenza configurabile per speaker specifici, ma il parser
espone gia `user`, `origin`, `votes`, `download_url` e `id` per ogni candidato.
Per il workflow del repo si puo quindi inserire un ranking prima dei voti, ad
esempio privilegiando una lista locale di utenti affidabili quando presenti e
poi ricadendo su voti/origine/ordine Forvo.

Nel batch sperimentale successivo sul media `web-giapponese`, la lista speaker
preferita e' stata:

1. `strawberrybrown`
2. `mezashi`

Il ranking ha scaricato e importato:

- `直前`: `usako_usagiclub`, fallback per voti perche nessuno speaker preferito
  era presente;
- `感じる`: `strawberrybrown`;
- `なんだろう`: `mezashi` in formato OGG;
- `へたれ`: `strawberrybrown`.

Il primo miss osservato e' stato `最近っぽい`. In questo caso l'addon non ha
restituito subito `NoResultsException`: `QWebEngineView.loadFinished` e'
arrivato con `success=false`, l'addon ha stampato l'errore ma non ha invocato la
callback. Per replicare la logica in modo robusto serve quindi un timeout per
query; allo scadere si prova la variante successiva (`reading`) e, se anche
quella scade o non ha risultati, si registra il miss. Per il miss e' stato aperto
l'URL `word-add` precompilato e registrata la voce nei registry locali
`data/forvo-known-missing.json` e `data/forvo-requested-word-add.json`.

Nel batch successivo:

- `～だろうか` ha fallito sulla label con marker `～`, poi ha scaricato
  `だろうか` da `poyotan` in OGG;
- `{{食|た}}べながら` e' stato il secondo miss. Il runner sperimentale ha
  mostrato un difetto da non portare nel workflow definitivo: la label con ruby
  markup e separatore `|` e' stata spezzata in query inutili (`{{食` e
  `た}}べながら`) prima di arrivare alla reading `たべながら`.

Quindi il fetcher Anki definitivo deve normalizzare le query prima di aprire
Forvo: preferire `reading` quando disponibile, rimuovere markup editoriale
`{{...|...}}`, eliminare marker come `～`, e usare la label pulita solo come
fallback. La stessa normalizzazione serve per `word-add`: non bisogna inviare a
Forvo label editoriali con markup.

Per il caso `{{食|た}}べながら`, la normalizzazione corretta per Forvo e'
`食べながら`, non solo `たべながら`: la richiesta deve preservare la surface con
kanji per poter poi recuperare correttamente la pronuncia quando viene aggiunta.

Il blocco osservato su `word-add` era compatibile con interferenza del banner
cookie/CMP. Quando Forvo ha gia una sessione cookie valida nel browser, lo
userscript Tampermonkey `Forvo Word Add Helper` 0.9 applica correttamente i
parametri `jcs_*`, incluso `jcs_lang=ja`; quindi non e' necessario cambiare lo
userscript solo per questo caso. Nel workflow definitivo bisogna riusare profili
persistenti: browser normale per `word-add` e profilo Qt WebEngine dedicato per
il fetch Anki-style, senza cancellare cookie/cache tra run.

Lo userscript 0.10 aggiunge comunque un tentativo best-effort prima del fill:
se trova una banner CMP/cookie visibile, clicca il pulsante di consenso
riconoscibile e poi continua con lingua, phrase/person-name e autosubmit. Questo
serve solo a rendere piu stabile la richiesta `word-add`; il fetch Anki-style non
deve dipendere da Tampermonkey.

Il formato OGG non rompe la validazione del repo: `.ogg` e `.oga` sono asset
audio supportati e vengono serviti come `audio/ogg`. Il compromesso operativo e'
di ranking: a parita' di speaker preferito/voti e' meglio MP3 per compatibilita'
browser piu ampia; se pero' lo speaker preferito esiste solo in OGG, il workflow
puo accettarlo. Browser moderni recenti supportano OGG/Vorbis meglio che in
passato, ma MP3 resta il formato meno rischioso.

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
