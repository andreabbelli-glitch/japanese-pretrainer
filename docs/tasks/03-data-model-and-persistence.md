# Task 03 - Data Model And Persistence

## Tipo

Backend / database

## Obiettivo

Implementare schema SQLite e layer di accesso dati coerenti con il blueprint.

## Input

- `docs/schema-dati-iniziale.md`
- `docs/blueprint-operativo.md`

## Scope

- creare schema DB con Drizzle;
- definire migrazioni iniziali;
- modellare tabelle core:
  - media
  - segment
  - lesson
  - lesson_content
  - term
  - term_alias
  - grammar_pattern
  - grammar_alias
  - entry_link
  - card
  - card_entry_link
  - entry_status
  - review_state
  - review_log
  - lesson_progress
  - media_progress
  - user_setting
  - content_import
- creare helper di query per i casi piu frequenti.

## Deliverable

- schema tipizzato;
- migrazioni versionate;
- seeding minimo di sviluppo;
- utility di accesso dati per media, lesson, glossary e review.

## Dipendenze

- `02`

## Criteri di accettazione

- il DB si crea da zero via script;
- le migrazioni sono ripetibili;
- esistono query minime per leggere media, lesson, entry e card;
- `entry_status` e `review_state` sono modellati separatamente.

## Fuori scope

- parser Markdown;
- logica UI;
- scheduler review avanzato.
