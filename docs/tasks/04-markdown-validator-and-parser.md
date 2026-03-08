# Task 04 - Markdown Validator And Parser

## Tipo

Content pipeline

## Obiettivo

Implementare il parser e il validatore dei file Markdown conformi alla spec.

## Input

- `docs/content-format.md`
- `docs/llm-content-handoff.md`

## Scope

- leggere `media.md`, `textbook/*.md`, `cards/*.md`;
- validare frontmatter e campi obbligatori;
- validare blocchi `:::term`, `:::grammar`, `:::card`;
- validare riferimenti semantici inline;
- validare sintassi furigana `{{base|reading}}`;
- generare un output normalizzato consumabile dall'importer;
- produrre errori leggibili e orientati alla correzione.

## Deliverable

- parser modulare;
- validatore con errori strutturati;
- fixture di file validi e invalidi;
- test unitari su parsing e validazione.

## Dipendenze

- `02`

## Criteri di accettazione

- input validi vengono parse-ati in modo deterministico;
- input invalidi falliscono con messaggi chiari;
- duplicate ID e riferimenti rotti sono intercettati;
- il parser espone AST o payload normalizzato riutilizzabile dall'importer.

## Note

Questo task non importa ancora nel DB. Deve solo trasformare file in dati
verificati.
