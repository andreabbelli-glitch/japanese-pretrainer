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
./scripts/with-node.sh pnpm pitch-accents:fetch -- --entry-delay-ms 300000 --request-delay-ms 5000
```

`--entry-delay-ms` inserisce una pausa tra una entry e la successiva. E utile
quando si vuole procedere molto lentamente, per esempio un termine ogni 5
minuti.

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
