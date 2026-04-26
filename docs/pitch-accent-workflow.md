# Workflow pitch accent

Questo documento descrive il flusso automatico per popolare `pitch_accent`.

## Obiettivo

Popolare `pitch_accent` in modo semplice e sequenziale:

- si prova prima `Wiktionary`;
- se non risolve, si prova `OJAD`;
- ogni check viene salvato subito su `pronunciations.json`;
- quando una fonte risolve, si salva subito il valore;
- insieme al valore si salvano anche `fonte` e `link` della pagina usata.

## Comando

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug>
```

Comandi utili:

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --dry-run
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --limit 20
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --refresh
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --entry term-taberu
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --word 食べる --word 設定
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --words-file tmp/pitch-accent-targets.tsv
./scripts/with-node.sh pnpm pitch-accents:fetch -- --entry-delay-ms 300000 --request-delay-ms 5000
```

`--entry-delay-ms` inserisce una pausa tra una entry e la successiva. E utile
quando si vuole procedere molto lentamente, per esempio un termine ogni 5
minuti.

## Modalita mirata

Per i workflow editoriali locali, quando sono state appena create o riviste
solo alcune flashcard, non lanciare di default il fetch sull'intero media.
Passa invece solo le entry nuove o aggiornate:

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --entry <term-or-grammar-id>
```

Se non hai ancora una lista affidabile di ID, puoi passare le parole:

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --word 食べる --word 設定
```

`--words-file` accetta:

- una parola per riga, per esempio `食べる`;
- `word<TAB>reading`;
- `word<TAB>reading<TAB>entry_id`;
- un ID diretto `term-...` o `grammar-...` su una riga singola;
- un array JSON di stringhe o oggetti `{ "word": "...", "reading": "...",
  "entry_id": "..." }`.

Nel riepilogo, righe non risolte contro il glossary del bundle vengono
stampate come `skipped <raw> (...)` e non interrogano Wiktionary o OJAD.

## Ordine delle fonti

Per ogni entry:

1. si prova `Wiktionary`;
2. se non c'e un `acc=` univoco e coerente con la reading, si prova `OJAD`;
3. se una fonte risolve, si aggiorna `pronunciations.json`.

## Stati possibili

- `resolved`: una fonte ha risolto il valore; il manifest viene aggiornato.
- `miss`: la entry e stata controllata ma nessuna fonte ha risolto il valore.
- `source_error`: il check non e conclusivo per problemi di rete o risposta; la
  entry va ritentata.
- `skipped_existing`: l'entry ha gia un `pitch_accent` e non si e usato
  `--refresh`.

## Nota attuale

`pitch_accent` e indipendente dall'audio. Una entry in `pronunciations.json`
puo contenere:

- solo `pitch_accent`;
- `pitch_accent` con `pitch_accent_source` e `pitch_accent_page_url`;
- solo `pitch_accent_status` per tracciare `miss` o `source_error`;
- solo metadati audio;
- entrambi.

Quando il fetch riparte senza `--refresh`:

- le entry `resolved` vengono saltate;
- le entry `miss` vengono saltate, perche sono gia state controllate;
- le entry `source_error` vengono ritentate.
