# Fetch pronunce da Forvo

Lo script `pnpm pronunciations:forvo` supporta il fallback Forvo per scaricare
pronunce MP3 e inserirle nel bundle locale. Nel flusso operativo standard usa
`--manual` nel browser normale; il percorso browser dedicato resta per debug o
manutenzione del fetcher.

## Ruolo nel workflow

Questo non e il primo step del workflow pronunce.

Forvo e un fallback da usare solo dopo `pnpm pronunciations:fetch`, sulle sole
entry rimaste senza audio anche dopo il controllo di riuso cross-media. La
source of truth del processo completo e
`docs/pronunciation-workflow.md`.

## Quando usarlo

- hai gia eseguito il fetch offline e restano entry senza audio locale;
- hai gia lasciato che il workflow riusasse gli audio compatibili presenti in
  altri media;
- hai un account Forvo e puoi scaricare manualmente gli MP3 dal browser;
- vuoi passare una lista mirata di parole o entry invece di processare tutto il
  bundle.

## Come funziona

- legge `content/` con lo stesso parser/validator dell'import;
- prima di aprire Forvo prova automaticamente a riusare audio gia presenti in
  altri media con stessa entry type, stesso label e stessa reading;
- nel flusso operativo standard apre l'URL Forvo nel browser normale e osserva
  il download locale del file scelto;
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
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25 --limit 10
./scripts/with-node.sh pnpm pronunciations:forvo -- --media duel-masters-dm25 --dry-run --limit 5
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media gundam-arsenal-base --word 専用機 --word 戦艦
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25 --entry term-cost
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25 --words-file tmp/forvo-list.tsv
```

## Modalita manuale consigliata

Per i batch reali usa sempre `--manual`:

- il comando apre l'URL Forvo nel browser normale;
- tu scarichi il file migliore dal tuo account;
- il comando osserva `~/Downloads`, prende l'ultimo audio nuovo e lo importa nel
  bundle corretto;
- se la parola non esiste su Forvo, puoi digitare `s` e premere Enter per
  marcarla come missing e saltarla nelle run future.
- mentre aspetta espone anche un URL locale, di default
  `http://127.0.0.1:3210/skip`, che puoi richiamare da browser per saltare senza
  tornare al terminale.

Opzioni utili:

- `--downloads-dir /path`: cartella download diversa;
- `--control-port 3210`: porta del comando locale `/skip`;
- `--no-open`: non apre automaticamente l'URL nel browser;
- `--known-missing-file /path`: file JSON dove salvare gli skip persistenti;
- `--retry-known-missing`: riprova anche le voci gia marcate come missing.

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

- default: browser headed, perche Forvo passa da Cloudflare e sessione login;
- `--headless` esiste ma non e consigliato per il flusso reale;
- `--manual` e la modalita operativa standard per questo repo; usa il browser Playwright solo per debug mirato o manutenzione del fetcher;
- se una voce esiste gia in un altro media compatibile, il comando deve
  collegarla e non proportela su Forvo;
- batch operativo consigliato: `10` entry alla volta;
- gli skip persistenti finiscono di default in `data/forvo-known-missing.json`;
- il residuo operativo corrente vive in
  `content/media/<slug>/workflow/pronunciation-pending.json`;
- `--refresh` forza il rimpiazzo anche se l'entry ha gia audio locale;
- `--profile-dir` permette di isolare un profilo browser diverso;
- `--keep-browser-open` lascia Chrome aperto a fine batch per debug.
