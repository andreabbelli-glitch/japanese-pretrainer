# Task 16 - Global Glossary Portal UI

## Tipo

Frontend

## Obiettivo

Costruire la UI del portale glossary globale come workspace di ricerca unico
cross-media, leggibile e orientato allo studio.

## Input

- [Masterplan Glossary Portal](../glossary-portal-masterplan.md)
- `01`
- `06`
- `08`
- `14`
- `15`

## Scope

- pagina `/glossary` con hero, filtri e summary globale;
- filtri UI per query, tipo entry, media, stato studio e flashcard;
- result card globale con segnali espliciti su card e presenza cross-media;
- stati vuoti, zero-results e responsive behavior coerenti con la shell;
- riuso dei componenti glossary esistenti quando sensato.

## Fuori scope

- backfill dei dati editoriali;
- logica di routing avanzata al miglior dettaglio locale se richiede query
  aggiuntive non ancora disponibili;
- redesign completo dei detail page locali.

## Deliverable

- pagina globale del glossary usabile da desktop e mobile;
- visualizzazione esplicita del segnale `Ha flashcard` / `Senza flashcard`;
- summary header con metriche globali utili;
- interfaccia consistente con il linguaggio visuale esistente.

## Dipendenze

- `01`
- `06`
- `08`
- `14`
- `15`

## File probabili da toccare

- `src/components/glossary/glossary-page.tsx`
- eventuali nuovi componenti in `src/components/glossary/`
- `src/app/glossary/page.tsx`
- `src/app/globals.css`

## Criteri di accettazione

- l'utente puo cercare nel corpus completo da `/glossary`;
- ogni risultato rende evidente se esiste almeno una flashcard;
- i filtri globali sono chiari e non sembrano un catalogo amministrativo;
- la pagina resta usabile bene su mobile;
- la UI locale del glossary non peggiora in leggibilita o coerenza.

## Note UX

Il portale deve rispondere a una domanda di studio, non a una domanda da
database. Il contenuto chiave di ogni card risultato e:

- che cos'e;
- dove compare;
- se ho una flashcard;
- dove conviene aprirla.
