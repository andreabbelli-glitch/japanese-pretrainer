# Fetch pronunce offline

Lo script `pnpm pronunciations:fetch` arricchisce i bundle locali con audio
umano gratuito, senza introdurre chiamate live nell'app runtime.

## Cosa fa

- legge `content/` con lo stesso parser/validator usato dall'import;
- salta le entry che hanno gia audio locale valido nel Markdown o nel manifest;
- cerca prima candidate Lingua Libre su Wikimedia Commons;
- usa Wiktionary solo come indice per ricavare eventuali file Commons gia
  collegati;
- scarica gli audio sotto `content/media/<slug>/assets/audio/...`;
- aggiorna `content/media/<slug>/pronunciations.json`.

## Comandi

```bash
pnpm pronunciations:fetch
pnpm pronunciations:fetch -- --media frieren
pnpm pronunciations:fetch -- --media frieren --limit 10 --dry-run
pnpm pronunciations:fetch -- --media frieren --refresh
```

## Policy di matching

- matching conservativo: meglio nessun match che un match sbagliato;
- priorita a corrispondenza esatta su `reading`, poi `lemma`, poi alias;
- preferenza a file Lingua Libre (`LL-Q188 (jpn)`) con metadata completi;
- se il candidato non combacia esattamente con lemma/reading/alias, viene
  scartato.

## Cache locale

- le risposte di Commons e Wiktionary vengono cache-ate in
  `data/pronunciations-cache/`;
- la cartella `data/` e gia ignorata da git;
- il runtime dell'app non legge mai questa cache: usa solo DB, manifest e asset
  locali nel bundle.
