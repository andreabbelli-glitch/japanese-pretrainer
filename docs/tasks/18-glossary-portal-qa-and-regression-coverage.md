# Task 18 - Glossary Portal QA And Regression Coverage

## Tipo

QA / test automation

## Obiettivo

Mettere in sicurezza il rollout del portale glossary globale con test unitari,
regressioni mirate ed eventuali e2e sui flussi chiave.

## Input

- [Masterplan Glossary Portal](../glossary-portal-masterplan.md)
- `12`
- `14`
- `15`
- `16`
- `17`

## Scope

- ampliare i test del glossary per coprire la query globale;
- coprire i filtri `with_cards` e `without_cards`;
- verificare active state della navbar;
- preservare i test critici sul dettaglio locale cross-media;
- aggiungere e2e essenziali sul portale globale se il setup lo consente.

## Fuori scope

- refactor funzionali non necessari ai test;
- data cleanup editoriale;
- redesign della pagina.

## Deliverable

- suite test aggiornata per il glossary portal;
- checklist di verifica manuale minima;
- eventuali test e2e sui flussi core;
- nota finale su rischi residui o gap ancora non automatizzati.

## Dipendenze

- `12`
- `14`
- `15`
- `16`
- `17`

## File probabili da toccare

- `tests/glossary.test.ts`
- eventuali `tests/app-shell.test.ts`
- eventuali test Playwright / e2e
- documentazione QA se necessaria

## Criteri di accettazione

- esistono test per risultati globali multi-media;
- esistono test per il badge o filtro relativo alle flashcard;
- esiste almeno una verifica per la navbar aggiornata;
- le regressioni gia coperte sui detail page locali restano verdi;
- il pacchetto di verifiche e sufficiente per fare rollout senza testare tutto a mano.

## Verifiche minime richieste

- `pnpm test -- --runInBand tests/glossary.test.ts tests/app-shell.test.ts`
- `pnpm typecheck`
- eventuale `pnpm test:e2e` o subset equivalente se aggiornato
