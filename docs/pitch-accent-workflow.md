# Workflow pitch accent

Questo documento descrive il flusso automatico per popolare `pitch_accent`.

## Obiettivo

Popolare `pitch_accent` in modo semplice e sequenziale:

- si prova prima `Wiktionary`;
- se non risolve, si prova `OJAD`;
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
```

## Ordine delle fonti

Per ogni entry:

1. si prova `Wiktionary`;
2. se non c'e un `acc=` univoco e coerente con la reading, si prova `OJAD`;
3. se una fonte risolve, si aggiorna `pronunciations.json`.

## Stati possibili

- `resolved`: una fonte ha risolto il valore; il manifest viene aggiornato.
- `miss`: nessuna fonte ha risolto il valore.
- `source_error`: una o piu fonti hanno fallito a livello di rete o risposta.
- `skipped_existing`: l'entry ha gia un `pitch_accent` e non si e usato
  `--refresh`.

## Nota attuale

`pitch_accent` e indipendente dall'audio. Una entry in `pronunciations.json`
puo contenere:

- solo `pitch_accent`;
- `pitch_accent` con `pitch_accent_source` e `pitch_accent_page_url`;
- solo metadati audio;
- entrambi.
