# Task 09 - Review System And Manual Mastery

## Tipo

Backend + frontend

## Obiettivo

Implementare il review flow Anki-like e il controllo manuale "questa cosa la so
gia".

## Input

- `03`
- `06`

## Scope

- queue giornaliera;
- schermata review;
- grading `Again / Hard / Good / Easy`;
- scheduler iniziale;
- persistenza di `review_state` e `review_log`;
- `entry_status` con `known_manual`, `learning`, `ignored`;
- azioni per mark known, reset, suspend.

## Deliverable

- review session completa;
- log review persistente;
- modello di manual mastery che non rompe il legame tra entry e card;
- statistiche minime della sessione.

## Dipendenze

- `03`
- `06`

## Criteri di accettazione

- una card puo passare tra stati senza perdere storico;
- una entry marcata come `known_manual` influenza il comportamento delle card;
- la review session e chiara, veloce e non frustrante;
- il flusso e usabile anche da mobile.

## Note

Lo scheduler puo essere inizialmente semplice, purche il modello dati resti
compatibile con un raffinamento futuro.
