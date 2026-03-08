# Task 05 - Importer And Sync Pipeline

## Tipo

Backend / ingestione contenuti

## Obiettivo

Costruire il flusso che importa i contenuti Markdown validati nel database
senza perdere gli stati utente.

## Input

- `03`
- `04`

## Scope

- scansione dei file in `content/media`;
- esecuzione parser + validazione;
- upsert di media, segment, lesson, term, grammar, card e link;
- generazione di `lesson_content`;
- aggiornamento log `content_import`;
- preservazione di `review_state`, `review_log` e `entry_status`;
- comando CLI per import completo o incrementale.

## Deliverable

- comando `import-content`;
- strategia di sync documentata;
- log chiaro di file cambiati, creati, falliti;
- test di regressione per import ripetuti.

## Dipendenze

- `03`
- `04`

## Criteri di accettazione

- un import iniziale popola il DB correttamente;
- un reimport non duplica record gia esistenti;
- la modifica di testo non distrugge stati di review;
- errori di contenuto interrompono l'import in modo esplicito.

## Fuori scope

- UI per lanciare import;
- editing dei file dentro l'app.
