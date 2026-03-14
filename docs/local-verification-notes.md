# Note Di Verifica Locale

Questo documento riassume i controlli locali e i limiti noti ancora utili come
promemoria operativo. Non rappresenta un sign-off di completezza del prodotto e
non sostituisce un audit completo e aggiornato del codice.

## Copertura Attuale Dei Controlli

- Suite E2E minima con Playwright su DB dedicato e import reale dell'intero workspace `content/`.
- Copertura dei flussi chiave: dashboard, media detail, textbook reader, tooltip, glossary, review, progress, settings.
- Smoke parametrica sulle route chiave di ogni media attivo presente in `content/media`.
- Verifica mobile del reader con sheet touch per termini e rail lesson.
- Redirect diretto di `/review` verso la review del media di focus.
- Loading state contestuali per glossary, textbook, lesson, review, progress e settings.
- Messaggio di errore comprensibile in `content:import` quando il DB target non è migrato.

## Comportamenti Da Verificare

- La nav review globale e la CTA review della dashboard portano entrambe alla sessione pertinente del media di focus.
- Le schermate di studio secondarie non ereditano più il loading generico “Caricamento media”, ma comunicano cosa si sta preparando.
- `content:import` non esplode più con stacktrace SQL opaco quando manca lo schema: ora indica di eseguire `db:migrate`.

## Comando E2E

`./scripts/with-node.sh pnpm test:e2e`

Il comando costruisce l'app, prepara un DB E2E temporaneo, importa tutti i
bundle reali presenti in `content/` e avvia un server locale su porta `3100`
per la suite.

## Gate Canonico Di Verifica

Per eseguire il controllo locale piu completo:

`./scripts/with-node.sh pnpm release:check`

Il gate canonico copre nell'ordine:

- `pnpm check` per lint, typecheck e test unit/integration;
- `pnpm build`;
- `pnpm content:validate`;
- runner E2E Playwright sul setup locale dedicato.

## Limiti Residui

- La suite E2E è intenzionalmente piccola: copre i flussi ad alto valore, non ogni variante di filtro o ogni card.
- I flussi E2E restano concentrati sul media di focus per textbook/review; il
  requisito multi-media è coperto anche da una smoke parametrica per ogni media
  attivo, ma il livello di profondità resta più alto sul media di focus.
- Le performance sono verificate solo a livello locale/percepito, non con budget automatizzati.
- Il prodotto resta single-user e locale-first; non include hardening per esposizione remota.
