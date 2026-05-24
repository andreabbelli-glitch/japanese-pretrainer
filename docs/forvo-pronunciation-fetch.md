# Pronunce da Forvo

Lo script `pnpm pronunciations:forvo` e il layer low-level per recuperare
pronunce da Forvo e inserirle nel bundle locale. Il percorso operativo standard
non e il download manuale dal browser: replica la logica dell'addon Anki Forvo,
legge la pagina Forvo tramite un helper Anki, estrae i candidati audio dal
player `Play(...)`, scarica l'audio diretto e converte OGG -> MP3 quando serve.

Il download manuale dal browser normale e' solo un fallback estremo per casi
singoli in cui la logica Anki-style o l'import diretto falliscono pur avendo una
pronuncia visibile su Forvo. Non usarlo come normale alternativa e non usarlo per
batch reali.

Per richieste operative ad alto livello come `review`, `next-lesson` o
`lesson-url`, l'entry point standard e ora
`pnpm pronunciations:resolve`. `pnpm pronunciations:forvo` resta il comando
low-level per target espliciti del fetcher, debug e fallback manuale estremo.

## Ruolo nel workflow

Il fetch Forvo Anki-style e' l'unico recupero esterno standard delle pronunce
audio. Prima di aprire Forvo il workflow deve comunque filtrare gli audio gia
locali e riusare eventuali audio compatibili presenti in altri media. La source
of truth del processo completo e' `docs/pronunciation-workflow.md`.

Quando un workflow editoriale crea o revisiona flashcard, questo passaggio non e
opzionale: ogni entry toccata deve ottenere audio locale oppure una richiesta
Forvo `word-add` registrata se la pronuncia non esiste ancora.

## Quando usarlo

- hai gia lasciato che il workflow filtrasse gli audio locali e riusasse gli
  audio compatibili presenti in altri media;
- Anki e' installato e il profilo helper in `data/forvo-anki-profile/` puo
  avviarsi;
- vuoi passare una lista mirata di parole o entry invece di processare tutto il
  bundle.

Se invece vuoi che il repo scelga da solo le card giuste partendo da review,
prossima lesson o pagina textbook, usa `pnpm pronunciations:resolve`.

## Come funziona

- legge `content/` con lo stesso parser/validator dell'import;
- prima di aprire Forvo prova automaticamente a riusare audio gia presenti in
  altri media con stessa entry type, stesso label e stessa reading;
- nel flusso operativo standard avvia un helper Anki dedicato e applica la
  logica dell'addon: richiesta Forvo con user-agent browser, parse HTML e
  decodifica dei candidati `Play(...)`;
- estrae i candidati giapponesi dal player `Play(...)`, inclusi speaker, origine,
  voti e URL audio diretti;
- sceglie il candidato privilegiando gli speaker configurati, oggi
  `strawberrybrown` e poi `mezashi`, quindi voti/origine/ordine Forvo;
- scarica l'audio diretto, usa il fallback OGG quando l'MP3 diretto non e'
  disponibile e converte OGG -> MP3 prima di salvare l'asset;
- quando il fetcher classifica una entry come miss, apre anche l'URL
  `word-add/...` nel browser normale per chiedere la pronuncia e registra la
  richiesta in `data/forvo-requested-word-add.json` /
  `data/forvo-known-missing.json`;
- il registry `data/forvo-requested-word-add.json` e' storico: quando una entry
  ottiene poi un audio locale, il workflow la marca automaticamente come
  `resolved` nello stesso file, senza rimuovere la traccia della richiesta;
- quando Forvo ha poi soddisfatto richieste storiche, l'importer
  `pnpm pronunciations:forvo:import-requested` puo importare un indice audio
  estratto da una sessione browser autenticata, scaricare il file diretto e
  aggiornare lo stesso storico;
- gli URL `word-add` includono anche hint di prefill (`jcs_lang`, `jcs_phrase`,
  `jcs_person_name`, `jcs_autosubmit`) per lo userscript Tampermonkey locale;
- le query Forvo e le richieste `word-add` vengono derivate solo da testo
  giapponese pulito: markup editoriale, placeholder grammaticali e descrizioni
  italiane/inglesi vengono scartati o ridotti alla parte giapponese
  pronunciabile;
- quando il label contiene varianti separate da slash ASCII (`/`), l'URL
  `word-add` lo normalizza in `・` per evitare che Forvo prenda solo la prima
  meta' della stringa;
- il profilo Anki dedicato in `data/forvo-anki-profile/` contiene l'add-on
  helper e una collection minima isolata dal profilo Anki personale;
- salva l'audio in `content/media/<slug>/assets/audio/...`;
- aggiorna `content/media/<slug>/pronunciations.json` con `audio_source: "forvo"`.
- aggiorna anche `content/media/<slug>/workflow/pronunciation-pending.json`
  con le entry ancora aperte e non marcate come missing.

## Comandi

```bash
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/duel-masters-dm25/textbook/tcg-core-overview
./scripts/with-node.sh pnpm pronunciations:forvo -- --media duel-masters-dm25 --dry-run
./scripts/with-node.sh pnpm pronunciations:forvo -- --media gundam-arsenal-base --word 専用機 --word 戦艦
./scripts/with-node.sh pnpm pronunciations:forvo -- --media duel-masters-dm25 --entry term-cost
./scripts/with-node.sh pnpm pronunciations:forvo -- --media duel-masters-dm25 --words-file tmp/forvo-list.tsv
./scripts/with-node.sh pnpm pronunciations:forvo:request
./scripts/with-node.sh pnpm pronunciations:forvo:request -- --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:forvo:import-requested -- --audio-index /tmp/forvo-requested-audio-index.json
```

## Miss e richiesta word-add

Quando Forvo non espone una pronuncia giapponese per la parola/frase:

- il workflow registra il miss in `data/forvo-known-missing.json`;
- apre anche la pagina `word-add/...` della stessa entry,
  cosi puoi chiedere la pronuncia dal browser normale senza cercarla a mano;
- se una entry non produce nessuna query giapponese pronunciabile, il workflow
  la marca missing ma non apre una richiesta `word-add` spazzatura;
- se la pagina `word-add` rifiuta esplicitamente il termine dopo la selezione di
  `Japanese` (per esempio `not allowed` o limite 40 caratteri), la entry resta
  in `data/forvo-known-missing.json` con metadata `wordAddBlocked*` e non va
  marcata come richiesta in `data/forvo-requested-word-add.json`;
- se hai installato lo userscript locale
  `scripts/forvo-word-add-helper.user.js`, la pagina `word-add` seleziona in
  automatico `Japanese`, decide `phrase yes/no` dagli hint del repo e lascia
  `personal name = no`;
- con `jcs_autosubmit=1` prova anche a premere `Add` in automatico senza che tu
  debba portare in primo piano la tab;
- se Forvo mostra che la voce e' gia definita in `Japanese [ja]`, lo script non
  forza il submit e segnala `Already in Japanese`.
- il prefill `word-add` e obbligatorio: i miss devono sempre aprire la
  richiesta gia precompilata e registrarla nello storico.

Opzioni utili:

- `--anki-base-dir /path`: isola il profilo Anki helper;
- `--anki-app /path/to/launcher`: usa un launcher Anki diverso dal default
  `/Applications/Anki.app/Contents/MacOS/launcher`;
- `--anki-python /path/to/python`: usa un runtime Python Anki diverso dal
  default locale per inizializzare il profilo quando e' vuoto;
- `--browser-timeout-ms 120000`: cambia il timeout massimo del batch Anki;
- `--known-missing-file /path`: file JSON dove salvare i miss persistenti;
- `--request-registry-file /path`: file JSON dove salvare le richieste
  `word-add` gia aperte;
- `--retry-known-missing`: riprova anche le voci gia marcate come missing; vale
  sia per `pnpm pronunciations:forvo` sia per `pnpm pronunciations:resolve`.

Il vecchio flag `--no-open-word-add-on-skip` non e piu un flusso valido: se
viene passato, il comando fallisce invece di saltare il prefill della richiesta.

## Fallback manuale estremo

Usa il download manuale solo quando un caso specifico resta bloccato dopo il
fetch Anki-style o l'import diretto, ma Forvo mostra una pronuncia utile. Il
fallback manuale puo osservare `~/Downloads` e importare il file scelto, ma non e
un percorso standard e non va proposto per batch ordinari. Nel riepilogo indica
sempre perche e' stato necessario. Opzioni come `--downloads-dir` e
`--control-port` appartengono a questo fallback o a debug locali, non al flusso
standard.

## Import richieste Forvo gia soddisfatte

Quando vuoi riallineare il repo con la pagina account Forvo
`/account-info/pronunciations/requested-pronunciations/`, usa una sessione
browser autenticata per scandire la lista richieste e creare un indice audio
locale con le entry disponibili. L'indice deve contenere, per ogni entry, il
target locale (`mediaSlug`, `entryKind`, `entryId`) e il candidato Forvo scelto
con `audioCandidates` diretti.

Poi importa l'indice:

```bash
./scripts/with-node.sh pnpm pronunciations:forvo:import-requested -- --audio-index /tmp/forvo-requested-audio-index.json
```

L'importer:

- salta le entry che hanno gia audio locale, salvo `--refresh`;
- prova i candidati audio diretti in ordine;
- se il download disponibile e' OGG, lo converte automaticamente in MP3 con
  `ffmpeg`;
- salva il file come `forvo-<speaker>-<reading-or-label>.mp3`;
- aggiorna `pronunciations.json`, rimuove le entry risolte da
  `data/forvo-known-missing.json`, marca le richieste in
  `data/forvo-requested-word-add.json` con `resolvedAt` e aggiorna
  `workflow/pronunciation-pending.json`.

Usa prima `--dry-run` quando l'indice e' nuovo o costruito con euristiche
diverse:

```bash
./scripts/with-node.sh pnpm pronunciations:forvo:import-requested -- --audio-index /tmp/forvo-requested-audio-index.json --dry-run
```

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
- quando `jcs_autosubmit=1`, registra un marker temporaneo prima del submit e,
  quando Forvo naviga su `/word-add-success/<word>/`, chiude la tab dopo 5
  secondi con il grant Tampermonkey `window.close`;
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
  al prodotto; `pnpm pronunciations:forvo` resta il low-level per target espliciti
  del fetcher;
- il fetch Forvo standard deve usare l'helper Anki/addon-style e candidati
  estratti da `Play(...)`, non `curl` o script HTTP ad hoc fuori dall'helper;
- Playwright/browser automation non e il percorso standard per batch reali; puo
  restare solo come debug mirato o manutenzione del fetcher;
- `--manual` non e la modalita operativa standard: usala solo come fallback
  estremo per un caso specifico;
- se una voce esiste gia in un altro media compatibile, il comando deve
  collegarla e non proportela su Forvo;
- nessun batch implicito: `--limit` va passato solo quando l'utente chiede
  esplicitamente un numero massimo o uno smoke test;
- i miss persistenti finiscono di default in `data/forvo-known-missing.json`;
- le richieste `word-add` gia aperte finiscono di default in
  `data/forvo-requested-word-add.json`; le entry risolte restano nello storico
  ma vengono annotate con `resolvedAt` e metadata dell'audio trovato;
- se la normalizzazione corrente produce un URL diverso da quello registrato in
  storico, `pnpm pronunciations:forvo:request` non considera quella entry gia
  richiesta: la riapre con l'URL canonico e aggiorna il registry;
- le richieste storiche soddisfatte possono essere importate in batch con
  `pnpm pronunciations:forvo:import-requested` dopo aver estratto un indice
  dalla pagina account Forvo autenticata;
- il residuo operativo corrente vive in
  `content/media/<slug>/workflow/pronunciation-pending.json`;
- `--refresh` forza il rimpiazzo anche se l'entry ha gia audio locale;
- `--anki-base-dir` permette di isolare un profilo Anki helper diverso;
- `--profile-dir` resta solo alias legacy di `--anki-base-dir`;
- `--keep-browser-open` lascia Anki aperto a fine batch per debug.

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
- `なんだろう`: `mezashi`, originariamente esposto in OGG e poi normalizzato a
  MP3 nel bundle;
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
  `だろうか` da `poyotan`, originariamente in OGG e poi normalizzato a MP3;
- `{{食|た}}べながら` e' stato il secondo miss. Il runner sperimentale ha
  mostrato un difetto da non portare nel workflow definitivo: la label con ruby
  markup e separatore `|` e' stata spezzata in query inutili (`{{食` e
  `た}}べながら`) prima di arrivare alla reading `たべながら`.

Quindi il fetcher Anki definitivo deve normalizzare le query prima di aprire
Forvo: usare prima la surface giapponese pulita della label, rimuovere markup
editoriale `{{...|...}}`, eliminare marker come `～`, spezzare pattern
editoriali in varianti giapponesi pronunciabili e usare `reading` come fallback.
La stessa normalizzazione serve per `word-add`: non bisogna inviare a Forvo
label editoriali con markup, placeholder o descrizioni italiane/inglesi.

Per il caso `{{食|た}}べながら`, la normalizzazione corretta per Forvo e'
`食べながら`, non solo `たべながら`: la richiesta deve preservare la surface con
kanji per poter poi recuperare correttamente la pronuncia quando viene aggiunta.

Il blocco osservato su `word-add` era compatibile con interferenza del banner
cookie/CMP. Quando Forvo ha gia una sessione cookie valida nel browser, lo
userscript Tampermonkey `Forvo Word Add Helper` 0.9 applica correttamente i
parametri `jcs_*`, incluso `jcs_lang=ja`; quindi non e' necessario cambiare lo
userscript solo per questo caso. Nel workflow definitivo bisogna mantenere
separati i profili operativi: browser normale persistente per `word-add` e
profilo Anki helper dedicato per il fetch Anki-style.

Lo userscript 0.10 aggiunge comunque un tentativo best-effort prima del fill:
se trova una banner CMP/cookie visibile, clicca il pulsante di consenso
riconoscibile e poi continua con lingua, phrase/person-name e autosubmit. Questo
serve solo a rendere piu stabile la richiesta `word-add`; il fetch Anki-style non
deve dipendere da Tampermonkey.

Lo userscript 0.11 aggiunge la chiusura automatica per-tab: dopo un submit
automatico registra un marker in `sessionStorage` e, quando la stessa tab arriva
su `/word-add-success/<word>/`, la chiude dopo pochi secondi. Non usa un marker
globale condiviso tra tab, cosi i batch grandi non lasciano tab aperte e una
navigazione manuale non correlata non viene chiusa.

Il formato OGG non rompe la validazione del repo: `.ogg` e `.oga` sono asset
audio supportati e vengono serviti come `audio/ogg`. Operativamente pero il
fetcher deve normalizzare a MP3 quando possibile: se lo speaker migliore esiste
solo in OGG, scarica quell'audio e convertilo automaticamente in MP3 prima di
salvarlo nel bundle. MP3 resta il formato meno rischioso per compatibilita e per
coerenza degli asset nuovi.

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
- salta di default le voci che Forvo ha gia rifiutato nel form `word-add`
  (`wordAddBlockedReason`);
- apre gli URL `https://forvo.com/word-add/...` nel browser normale;
- salva subito nel registry quali richieste sono gia state lanciate.

Opzioni utili:

- `--media <slug>`: limita il batch a un media;
- `--entry <entry-id>`: limita il batch a una entry precisa;
- `--limit N`: quante tab aprire;
- `--no-open`: stampa/registra senza aprire il browser;
- `--retry-requested`: include anche le voci gia richieste in passato;
- `--retry-blocked`: include anche le voci marcate come rifiutate dal form
  `word-add`, da usare solo per debug o dopo una modifica esplicita del termine;
- `--request-delay-ms 3000`: pausa tra le tab aperte. Questo e' ora il default
  prudente consigliato per non aprire troppe richieste in sequenza troppo
  aggressiva.
