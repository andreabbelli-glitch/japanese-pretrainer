# LLM Content Kit

> [!IMPORTANT]
> Questo e il punto di partenza operativo e la fonte di verita per il workflow
> con LLM esterni. Se un documento in `docs/legacy/` dice qualcosa di diverso,
> vale questo kit. Umani, agent e LLM non devono usare `docs/legacy/` come
> input operativo corrente.

## Scopo

Questa cartella raccoglie in un solo posto tutto cio che serve per lavorare con
l'LLM esterno che produce contenuti importabili.

Serve come pacchetto operativo pronto da passare all'altro modello senza dover
cercare file in cartelle diverse.

## Struttura

- `general/`
  contiene i documenti che vanno passati sempre, indipendentemente dal media.
- `media/<media-slug>/`
  contiene brief e prompt specifici di un singolo media o batch.

## Mappa Rapida Dai Documenti Legacy

Se incontri riferimenti storici nel resto del repository, usa questa mappa:

- `docs/legacy/llm-content-handoff.md` ->
  `docs/llm-kit/general/02-llm-content-handoff.md`
- `docs/legacy/content-workflow-playbook.md` ->
  `docs/llm-kit/general/06-content-workflow-playbook.md`
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
- `docs/legacy/content-briefs/duel-masters-dm25.md` ->
  `docs/llm-kit/media/duel-masters-dm25/01-brief.md`
- `docs/legacy/prompts/duel-masters-dm25-batch-1.md` ->
  `docs/llm-kit/media/duel-masters-dm25/02-batch-1-prompt.md`

## Kit generale

Da passare sempre:

- `general/01-content-format.md`
- `general/02-llm-content-handoff.md`
- `general/03-template-media.md`
- `general/04-template-textbook-lesson.md`
- `general/05-template-cards-file.md`
- `general/06-content-workflow-playbook.md`
- `general/07-template-image-requests.yaml`
- `general/08-template-image-assets.yaml`
- `general/09-editorial-quality-rubric.md`

## Kit media-specifico attuale

Disponibile ora:

- `media/duel-masters-dm25/01-brief.md`
- `media/duel-masters-dm25/02-batch-1-prompt.md`
- `media/gundam-arsenal-base/01-brief.md`
- `media/gundam-arsenal-base/02-batch-1-prompt.md`
- `media/pokemon-scarlet-violet/01-brief.md`
- `media/pokemon-scarlet-violet/02-batch-1-prompt.md`

Nota pratica:

- il brief `media/duel-masters-dm25/01-brief.md` resta utile come contesto
  storico del seed iniziale, ma non descrive piu lo snapshot corrente del
  bundle reale; per estensioni o correzioni attuali passa sempre anche i file
  reali in `content/media/duel-masters-dm25/...`.

## Uso pratico

> [!IMPORTANT]
> Se il workflow immagini inserisce o aggiorna blocchi `:::image` nei textbook,
> dopo `image:apply` serve sempre `content:import`: la webapp legge il
> contenuto importato nel DB locale, non il markdown appena modificato.

> [!IMPORTANT]
> Audio e immagini sono gia supportati dal formato reale del progetto, ma il
> loro recupero avviene di norma in un secondo passaggio locale. L'LLM esterno
> non deve inventare file audio, metadata audio di provenance o `src` immagine
> inesistenti. Per le immagini usa il workflow
> `workflow/image-requests.yaml` / `workflow/image-assets.yaml`; per l'audio
> lascia i campi assenti salvo che asset e provenance reali siano gia stati
> forniti esplicitamente.

> [!IMPORTANT]
> `workflow/image-requests.yaml` non e una semplice lista tecnica di cose da
> scaricare. E il piano editoriale delle immagini: il producer contenuti deve
> decidere gia li dove va l'immagine, quale scena o schermata serve, che cosa
> deve rendere leggibile e quali criteri usera poi l'agent immagini per
> recuperarla correttamente.

### Se vuoi dare contesto completo

Passa:

- tutti i file di `general/`
- i file della cartella `media/<media-slug>/` su cui stai lavorando

### Se vuoi fare il seed batch Duel Masters

Passa almeno:

- `general/01-content-format.md`
- `general/02-llm-content-handoff.md`
- `general/03-template-media.md`
- `general/04-template-textbook-lesson.md`
- `general/05-template-cards-file.md`
- `general/06-content-workflow-playbook.md`
- `general/07-template-image-requests.yaml`
- `general/08-template-image-assets.yaml`
- `general/09-editorial-quality-rubric.md`
- `media/duel-masters-dm25/01-brief.md`
- `media/duel-masters-dm25/02-batch-1-prompt.md`

### Se vuoi estendere il bundle gia esistente

Oltre al kit, passa sempre anche i file reali del bundle coinvolti nella
modifica. Per esempio:

- Core: `content/media/duel-masters-dm25/media.md`,
  `textbook/001-tcg-core-overview.md`,
  `textbook/002-tcg-core-patterns.md`, `cards/001-tcg-core.md`
- Mazzo Abyss: `textbook/010-dm25-sd1-overview.md`,
  `cards/010-dm25-sd1-core.md`
- Mazzo Apollo / Red Zone: `textbook/020-dm25-sd2-overview.md`,
  `cards/020-dm25-sd2-core.md`

## Nota su Allineamento Template

> [!IMPORTANT]
> **Sincronizzazione Strutturale**
> Questo kit operativo e la fonte di verita per l'LLM quando deve produrre
> contenuti. Ogni volta che si modifica la struttura dei dati dell'app
> (es. nuovi campi opzionali a `:::card`, `:::term` o `:::grammar`, o
> cambiamenti in `media.md`), quelle modifiche devono essere replicate nei
> template di questa cartella. Se il kit non viene tenuto allineato al codice e
> ai parser dell'applicazione, l'LLM produrra contenuti obsoleti o non
> compatibili.

Nota pratica aggiornata:

- `general/01-content-format.md` deve restare allineato a
  `docs/content-format.md`;
- il formato supporta gia `:::image`, metadata audio locali e
  `pronunciations.json`;
- il fatto che audio e immagini vengano spesso arricchiti dopo non significa
  che siano "non supportati": significa solo che di norma non vengono generati
  direttamente dall'LLM esterno.

## Nota Storica sulle Fixtures

Questa cartella e il kit operativo corrente per orchestrare LLM esterni.
I documenti legacy raccolti in `docs/legacy/` restano utili come contesto
storico, ma non sono la fonte di verita per questo workflow. Il bundle reale
valido da usare come base operativa e `content/media/duel-masters-dm25`.
