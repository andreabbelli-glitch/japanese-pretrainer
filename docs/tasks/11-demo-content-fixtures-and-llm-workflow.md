# Task 11 - Demo Content, Fixtures And LLM Workflow

## Tipo

Content pipeline + DX

## Obiettivo

Creare un set minimo di contenuti demo e il workflow pratico per collaborare con
l'LLM esterno.

## Input

- `04`
- `05`
- `docs/llm-content-handoff.md`

## Scope

- creare un media demo minimo ma realistico;
- includere almeno:
  - `media.md`
  - 2 lesson
  - 1 file cards
  - term e grammar sufficienti a esercitare import, glossary e review;
- produrre fixture valide e fixture volutamente invalide;
- documentare il ciclo:
  - richiesta a LLM esterno
  - validazione
  - correzione
  - import

## Deliverable

- cartella `content/media/<demo-slug>/...`;
- casi di test per parser/importer;
- playbook operativo per usare l'LLM esterno in piccoli batch.

## Dipendenze

- `04`
- `05`

## Criteri di accettazione

- il media demo viene importato con successo;
- le fixture invalide rompono il validatore nei modi attesi;
- un nuovo agente puo capire dal playbook come richiedere contenuti al LLM.

## Note

Non serve contenuto finale di qualita editoriale. Serve contenuto abbastanza
realistico da validare il sistema.
