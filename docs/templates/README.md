# Template Contenuti Per LLM Esterno

## Scopo

Questa cartella contiene template concreti da dare a un LLM esterno quando deve
produrre contenuti importabili.

La differenza rispetto alla sola specifica e semplice:

- `docs/content-format.md` spiega le regole;
- questi template mostrano la forma esatta dei file da compilare.
- il template lesson mostra anche come inserire blocchi `:::image` quando gli
  asset esistono gia nel bundle.

## File disponibili

- [Template media](./media.template.md)
- [Template lesson textbook](./textbook-lesson.template.md)
- [Template cards](./cards-file.template.md)
- [Template image requests](./image-requests.template.yaml)
- [Template image assets](./image-assets.template.yaml)

## Uso consigliato

Quando chiedi contenuti all'LLM esterno:

1. passa `docs/content-format.md`;
2. passa `docs/llm-content-handoff.md`;
3. passa il brief del contenuto richiesto;
4. passa uno o piu template di questa cartella;
5. se usi il workflow immagini, passa anche i template YAML sidecar;
6. chiedi di restituire solo i file richiesti nel formato corretto.

## Regola pratica

Non chiedere all'LLM di inventare la struttura del file.

Chiedi invece di:

- prendere il template;
- sostituire i placeholder;
- mantenere gli ID stabili;
- non aggiungere campi fuori specifica.
