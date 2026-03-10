# Task Index Per Agenti Implementatori

## Scopo

Questo backlog traduce il blueprint operativo in task assegnabili ad agenti
implementatori. Ogni task e scritto per essere eseguibile con poco contesto
aggiuntivo e con criteri di accettazione chiari.

## Ordine consigliato

### Wave 0

- [01 - UX/UI Direction](./01-ux-ui-direction.md)

### Wave 1

- [02 - Project Foundation](./02-project-foundation.md)
- [03 - Data Model And Persistence](./03-data-model-and-persistence.md)
- [04 - Markdown Validator And Parser](./04-markdown-validator-and-parser.md)

### Wave 2

- [05 - Importer And Sync Pipeline](./05-importer-and-sync-pipeline.md)
- [06 - App Shell, Media Library And Dashboard](./06-app-shell-media-library-and-dashboard.md)

### Wave 3

- [07 - Textbook Reader, Furigana And Tooltips](./07-textbook-reader-furigana-and-tooltips.md)
- [08 - Glossary Search And Entry Pages](./08-glossary-search-and-entry-pages.md)
- [09 - Review System And Manual Mastery](./09-review-system-and-manual-mastery.md)

### Wave 4

- [10 - Progress, Settings And Study Controls](./10-progress-settings-and-study-controls.md)
- [11 - Demo Content, Fixtures And LLM Workflow](./11-demo-content-fixtures-and-llm-workflow.md)
- [12 - QA, E2E And Launch Polish](./12-qa-e2e-and-launch-polish.md)
- [13 - Regression Fixes From Audit](./13-regression-fixes-from-audit.md)

## Dipendenze ad alto livello

- `01` informa tutti i task frontend.
- `02` e base comune per setup e tooling.
- `03` e `04` abilitano `05`.
- `05` alimenta `07`, `08`, `11`.
- `06` definisce shell e layout per `07`, `08`, `09`, `10`.
- `09` e `10` condividono dati di review e progress.
- `12` dipende dal completamento minimo di `05`, `07`, `08`, `09`, `10`, `11`.

## Definizione di done globale

Ogni task va considerato chiuso solo se:

- il codice e integrato nel progetto senza rompere il resto;
- la documentazione minima del task e aggiornata;
- esistono test o verifiche coerenti con la natura del task;
- il risultato rispetta la direzione UX/UI definita;
- non introduce deviazioni dalla specifica Markdown e dal blueprint.
