# Workflow pitch accent

Questo documento descrive il flusso automatico per popolare `pitch_accent`.

## Obiettivo

Popolare `pitch_accent` in modo conservativo:

- si interrogano `Wiktionary` e `OJAD`;
- si scrive il valore solo se entrambe le fonti concordano;
- in caso di conflitto o mancanza di una delle due fonti, il manifest non viene
  modificato per quella entry.

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

## Regola di consenso

Per ogni entry:

1. si cercano i candidati su Wiktionary;
2. si cercano i candidati su OJAD;
3. si normalizzano i risultati come downstep numerico (`0`, `1`, `2`, ...);
4. si aggiorna `pronunciations.json` solo se i due valori coincidono.

## Stati possibili

- `confirmed`: entrambe le fonti concordano; il manifest viene aggiornato.
- `conflict`: entrambe rispondono, ma con valori diversi; non si scrive nulla.
- `miss`: non si e trovato un consenso sufficiente.
- `skipped_existing`: l'entry ha gia un `pitch_accent` e non si e usato
  `--refresh`.

## Nota attuale

`pitch_accent` e indipendente dall'audio. Una entry in `pronunciations.json`
puo contenere:

- solo `pitch_accent`;
- solo metadati audio;
- entrambi.
