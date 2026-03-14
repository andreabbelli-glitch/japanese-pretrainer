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

### Wave 5

- [14 - Glossary Portal Navigation And Routing](./14-glossary-portal-navigation-and-routing.md)
- [15 - Global Glossary Query Layer And Contract](./15-global-glossary-query-layer-and-contract.md)
- [16 - Global Glossary Portal UI](./16-global-glossary-portal-ui.md)
- [17 - Global Results To Local Detail Integration](./17-global-results-to-local-detail-integration.md)
- [18 - Glossary Portal QA And Regression Coverage](./18-glossary-portal-qa-and-regression-coverage.md)
- [19 - Glossary Cross-Media Data Backfill And Alignment](./19-glossary-cross-media-data-backfill-and-alignment.md)

## Dipendenze ad alto livello

- `01` informa tutti i task frontend.
- `02` e base comune per setup e tooling.
- `03` e `04` abilitano `05`.
- `05` alimenta `07`, `08`, `11`.
- `06` definisce shell e layout per `07`, `08`, `09`, `10`.
- `09` e `10` condividono dati di review e progress.
- `12` dipende dal completamento minimo di `05`, `07`, `08`, `09`, `10`, `11`.
- `14` apre il nuovo entry point globale del glossary.
- `15` generalizza il query layer e sblocca `16` e `17`.
- `16` costruisce la UI del portale globale sopra il contratto dati di `15`.
- `17` completa il collegamento tra discovery globale e detail locale.
- `18` consolida il rollout di `14`-`17`.
- `19` migliora la qualita dei dati e puo procedere in parallelo ai task
  applicativi.

## Definizione di done globale

Ogni task va considerato chiuso solo se:

- il codice e integrato nel progetto senza rompere il resto;
- la documentazione minima del task e aggiornata;
- esistono test o verifiche coerenti con la natura del task;
- il risultato rispetta la direzione UX/UI definita;
- non introduce deviazioni dalla specifica Markdown e dal blueprint.
