# Task 14 - Glossary Portal Navigation And Routing

## Tipo

Frontend / navigation

## Obiettivo

Promuovere il glossary a destinazione primaria dell'app introducendo il nuovo
entry point globale `/glossary` e integrandolo nella navbar.

## Input

- [Masterplan Glossary Portal](../glossary-portal-masterplan.md)
- `06`
- `08`

## Scope

- aggiungere `Glossary` alla navigazione primaria;
- introdurre la route top-level `/glossary`;
- aggiornare il calcolo della voce attiva in navbar;
- mantenere compatibilita con le route locali `/media/[mediaSlug]/glossary`;
- predisporre il wiring minimo per condividere componenti tra vista globale e
  vista locale.

## Fuori scope

- nuova query globale completa;
- redesign approfondito della result list;
- backfill dei dati cross-media.

## Deliverable

- item `Glossary` visibile nella navbar primaria;
- route `/glossary` funzionante;
- active state corretto su route globali e locali del glossary;
- nessuna regressione sui deep-link glossary gia esistenti.

## Dipendenze

- `06`
- `08`

## File probabili da toccare

- `src/lib/site.ts`
- `src/components/site-shell-primary-nav.tsx`
- `src/components/site-shell.tsx`
- `src/app/glossary/page.tsx`
- eventuali componenti wrapper del glossary condiviso

## Criteri di accettazione

- la navbar mostra `Glossary` tra `Media` e `Review`;
- visitando `/glossary` la voce `Glossary` risulta attiva;
- visitando `/media/[mediaSlug]/glossary` la voce `Glossary` risulta ancora
  attiva;
- i link esistenti verso detail page e glossary locale non si rompono;
- il codice lascia spazio a una page data globale senza duplicare la shell.

## Note implementative

- Preferire un entry point globale leggero che possa inizialmente appoggiarsi a
  un placeholder o a una page data minima, purche il contratto di routing resti
  stabile.
- Non introdurre branch UX separati se basta riusare il glossary esistente come
  base.
