# Task 09 - Review System And Manual Mastery

## Tipo

Backend + frontend

## Obiettivo

Implementare il review flow FSRS-based e il controllo manuale "questa cosa la
so gia".

## Input

- `03`
- `06`

## Scope

- queue giornaliera;
- schermata review;
- grading `Again / Hard / Good / Easy`;
- scheduler FSRS versionato;
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

Lo scheduler deve restare compatibile con i record legacy, ma il comportamento
corrente va espresso come FSRS in modo esplicito. Se servono campi extra per
distinguere gli stati legacy, il modello dati li espone senza rompere la queue
esistente.

Le card collegate a piu entry driving restano intenzionalmente sbloccabili non
appena almeno una delle entry driving lesson-linked e stata completata. Questo
comportamento e voluto: serve a far emergere card di rinforzo o recap cross-
lesson appena esiste gia un ancoraggio didattico sufficiente, senza aspettare
che tutte le entry driving coinvolte abbiano completato l'intero percorso.
