# Template Contenuti Per LLM Esterno

## Scopo

Questa cartella contiene template concreti da dare a un LLM esterno quando deve
produrre contenuti importabili.

La differenza rispetto alla sola specifica e semplice:

- `docs/content-format.md` spiega le regole;
- questi template mostrano la forma esatta dei file da compilare.

## File disponibili

- [Template media](./media.template.md)
- [Template lesson textbook](./textbook-lesson.template.md)
- [Template cards](./cards-file.template.md)

## Uso consigliato

Quando chiedi contenuti all'LLM esterno:

1. passa `docs/content-format.md`;
2. passa `docs/llm-content-handoff.md`;
3. passa il brief del contenuto richiesto;
4. passa uno o piu template di questa cartella;
5. chiedi di restituire solo file Markdown completi e validi.

## Regola pratica

Non chiedere all'LLM di inventare la struttura del file.

Chiedi invece di:

- prendere il template;
- sostituire i placeholder;
- mantenere gli ID stabili;
- non aggiungere campi fuori specifica.
