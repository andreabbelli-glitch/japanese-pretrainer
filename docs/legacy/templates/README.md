# Template Contenuti Per LLM Esterno

> [!IMPORTANT]
> Questa cartella e legacy. Umani, agent e LLM non devono usarla per template
> o workflow operativi correnti. Per nuovi workflow con LLM esterni usa i
> template in `docs/llm-kit/general/`. Se un file qui differisce dal kit, vale
> il kit.

## Scopo

Questa cartella resta solo come mappa storica dei vecchi path.
I template operativi aggiornati vivono nel kit LLM.

## File disponibili

- `docs/legacy/templates/media.template.md` ->
  `docs/llm-kit/general/03-template-media.md`
- `docs/legacy/templates/textbook-lesson.template.md` ->
  `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/legacy/templates/cards-file.template.md` ->
  `docs/llm-kit/general/05-template-cards-file.md`
- `docs/legacy/templates/image-requests.template.yaml` ->
  `docs/llm-kit/general/07-template-image-requests.yaml`
- `docs/legacy/templates/image-assets.template.yaml` ->
  `docs/llm-kit/general/08-template-image-assets.yaml`

## Uso consigliato

Quando chiedi contenuti all'LLM esterno:

1. parti da `docs/llm-kit/README.md`;
2. passa i file aggiornati in `docs/llm-kit/general/`;
3. aggiungi brief e prompt in `docs/llm-kit/media/<media-slug>/`;
4. usa questa cartella solo se devi risolvere un vecchio riferimento storico.

## Regola pratica

Non usare questi path legacy come source of truth.
