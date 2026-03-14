# Fetch pronunce offline

Lo script `pnpm pronunciations:fetch` arricchisce i bundle locali con audio
umano gratuito, senza introdurre chiamate live nell'app runtime.

## Ruolo nel workflow

Questo e il primo step del workflow pronunce.

Quando una nuova chat chiede di completare le pronunce mancanti:

1. si parte da questo comando;
2. si riporta un riepilogo di cio che e stato trovato e di cio che manca;
3. solo dopo, se serve, si passa al fallback Forvo.

La view completa del processo e in `docs/pronunciation-workflow.md`.

## Cosa fa

- legge `content/` con lo stesso parser/validator usato dall'import;
- salta le entry che hanno gia audio locale valido nel Markdown o nel manifest;
- cerca prima candidate Lingua Libre su Wikimedia Commons;
- usa `en.wiktionary` e `ja.wiktionary` solo come indice per ricavare eventuali file Commons gia
  collegati;
- scarica gli audio sotto `content/media/<slug>/assets/audio/...`;
- aggiorna `content/media/<slug>/pronunciations.json`.

## Comandi

```bash
pnpm pronunciations:fetch
pnpm pronunciations:fetch -- --media duel-masters-dm25
pnpm pronunciations:fetch -- --media gundam-arsenal-base --limit 10 --dry-run
pnpm pronunciations:fetch -- --media gundam-arsenal-base --refresh
pnpm pronunciations:fetch -- --media duel-masters-dm25 --request-delay-ms 1500 --max-retries 6 --retry-base-delay-ms 10000
```

Per una passata lenta e one-shot, usa un delay tra richieste e retry piu lunghi:

- `--request-delay-ms`: pausa minima tra richieste HTTP;
- `--max-retries`: quante volte ritentare su `429` o `5xx`;
- `--retry-base-delay-ms`: base del backoff esponenziale quando `Retry-After`
  non e disponibile.

## Policy di matching

- matching conservativo: meglio nessun match che un match sbagliato;
- priorita a corrispondenza esatta su `reading`, poi `lemma`, poi alias;
- preferenza a file Lingua Libre (`LL-Q188 (jpn)`) con metadata completi;
- se il candidato non combacia esattamente con lemma/reading/alias, viene
  scartato.

## Cache locale

- le risposte di Commons e delle due Wiktionary vengono cache-ate in
  `data/pronunciations-cache/`;
- la cartella `data/` e gia ignorata da git;
- il runtime dell'app non legge mai questa cache: usa solo DB, manifest e asset
  locali nel bundle.

## Output operativo atteso

Dopo il run, il comando stampa un riepilogo per bundle:

- `<media-slug>: X matched, Y missing`
- una riga `matched ...` per ogni entry trovata
- una riga `miss ...` per ogni entry ancora senza audio

Questo riepilogo e l'input per decidere se lanciare o meno il fallback Forvo.
