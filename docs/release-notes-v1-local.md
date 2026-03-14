# Release Notes v1 Locale

## Stato

Questa milestone chiude la v1 locale del prodotto per uso personale su bundle reale `duel-masters-dm25`.

## Incluso in questa release

- Suite E2E minima con Playwright su DB dedicato e import reale del bundle DM25.
- Copertura dei flussi chiave: dashboard, media detail, textbook reader, tooltip, glossary, review, progress, settings.
- Verifica mobile del reader con sheet touch per termini e rail lesson.
- Redirect diretto di `/review` verso la review del media di focus.
- Loading state contestuali per glossary, textbook, lesson, review, progress e settings.
- Messaggio di errore comprensibile in `content:import` quando il DB target non è migrato.

## Bugfix reali inclusi

- La nav review globale e la CTA review della dashboard portano entrambe alla sessione pertinente del media di focus.
- Le schermate di studio secondarie non ereditano più il loading generico “Caricamento media”, ma comunicano cosa si sta preparando.
- `content:import` non esplode più con stacktrace SQL opaco quando manca lo schema: ora indica di eseguire `db:migrate`.

## Comando E2E

`./scripts/with-node.sh pnpm test:e2e`

Il comando costruisce l'app, prepara un DB E2E temporaneo, importa `duel-masters-dm25` e avvia un server locale su porta `3100` per la suite.

## Gate canonico pre-release

Prima di considerare la v1 locale davvero verde, eseguire:

`./scripts/with-node.sh pnpm release:check`

Il gate canonico copre nell'ordine:

- `pnpm check` per lint, typecheck e test unit/integration;
- `pnpm build`;
- `pnpm content:validate -- --media-slug duel-masters-dm25`;
- runner E2E Playwright sul setup locale di release.

## Limiti residui

- La suite E2E è intenzionalmente piccola: copre i flussi ad alto valore, non ogni variante di filtro o ogni card.
- Le performance sono verificate solo a livello locale/percepito, non con budget automatizzati.
- Il prodotto resta single-user e locale-first; non include hardening per esposizione remota.
