# LLM Content Kit

> [!IMPORTANT]
> Questo e il punto di partenza operativo e la fonte di verita per il workflow
> con LLM esterni.

## Scopo

Questa cartella raccoglie in un solo posto tutto cio che serve per lavorare con
l'LLM esterno che produce contenuti importabili.

Serve come pacchetto operativo pronto da passare all'altro modello senza dover
cercare file in cartelle diverse.

## Source Of Truth Operativa

Per gli LLM, la fonte autorevole dei contenuti e sempre il filesystem
versionato `content/media/**`, insieme alle specifiche in questo kit. Il DB
SQLite locale in `data/` e un artefatto disposable di sviluppo: puo essere
stale, parziale o contenere dati fixture non presenti nei bundle reali.

Quando un LLM deve evitare sovrapposizioni, riusare entry esistenti o capire se
una flashcard e gia coperta, passagli i file Markdown reali del bundle/segmento
coinvolto, non uno snapshot del DB locale. `content:import` serve dopo la
validazione per aggiornare il runtime della webapp, non per decidere la
curation editoriale.

Quando l'agent locale ha accesso al repo, deve preferire i helper read-only ai
grep manuali lunghi:

```sh
./scripts/with-node.sh pnpm content:lookup -- --media-slug <media-slug> "<front-o-superficie>"
./scripts/with-node.sh pnpm content:lookup-batch -- --media-slug <media-slug> --query "<front-o-superficie>" --grammar "<pattern>"
./scripts/with-node.sh pnpm content:entry-brief -- --media-slug <media-slug> --entry-id <entry-id>
./scripts/with-node.sh pnpm content:entry-usage -- --media-slug <media-slug> --entry-id <entry-id>
./scripts/with-node.sh pnpm content:lesson-brief -- --media-slug <media-slug> --lesson-slug <lesson-slug>
./scripts/with-node.sh pnpm dm:live-card-scaffold -- --card-slug <card-slug> --title "<titolo lesson>"
./scripts/with-node.sh pnpm dm:official-text-compare -- --official-id <official-card-id> --visible-name "<visible-card-name>" --visible-card-line "<visible-card-line>"
./scripts/with-node.sh pnpm content:next-id -- --media-slug <media-slug> --slug <new-lesson-slug>
./scripts/with-node.sh pnpm content:scaffold -- --media-slug <media-slug> --slug <new-lesson-slug> --title "<titolo>"
./scripts/with-node.sh pnpm dm:card-fetch -- --official-id <official-card-id> --expect-name "<visible-card-name>"
./scripts/with-node.sh pnpm content:editorial-lint -- --media-slug <media-slug> --lesson-slug <lesson-slug>
./scripts/with-node.sh pnpm content:scope
./scripts/with-node.sh pnpm agent:verify
./scripts/with-node.sh pnpm forvo:preflight -- --mode targeted --media <media-slug> --entry <entry-id>
```

`content:lookup` risponde con un verdetto compatto su match esatti nei
Markdown (`covered-card`, `entry-only`, `new`). Quando ci sono piu candidati,
usa `content:lookup-batch` con `--query`, `--term`, `--grammar` o `--card`: il
parser gira una sola volta e l'output resta compatto, ordinato e riepilogato.
`content:entry-brief` stampa solo il contesto operativo di una entry esatta:
fonte, significato,
audio/accento, lesson, card e riferimenti collegati; fallisce chiuso se il
match e ambiguo. `content:entry-usage` e' il drilldown piu piccolo quando hai
gia l'ID: mostra card coverage e riferimenti semantici con file/linea, senza
aprire o greppare i Markdown completi. `content:lesson-brief` stampa solo il
contesto operativo di
una lesson nota: identita, file, headings, entry, card, immagini, warning
editoriali e comandi minimi di verifica/import. `content:next-id` calcola ID,
order e path per nuove lesson/card senza scrivere file. `content:scaffold`
scrive solo il nuovo textbook Markdown valido, lasciando il cards path come
piano finche esistono card reali da inserire. `content:scope` stampa i comandi
minimi di `content:validate` e `content:import` basandosi sui file modificati o
su path espliciti. Questi tool riducono il contesto da passare all'LLM.
`content:editorial-lint` segnala warning su meta-discorso, scorciatoie di stile
e frasi povere prima di importare o consegnare una lesson: l'LLM deve valutarli
come problemi editoriali reali e riscrivere il contenuto, non aggirarli con
modifiche cosmetiche. `agent:verify` sceglie i gate repo da eseguire dopo le
modifiche, ma non li esegue. `forvo:preflight` e opzionale:
usalo prima di batch Forvo incerti o grandi per capire se i target sono gia
audio-backed, known-missing o gia richiesti; saltalo per target piccoli e
chiari. Per Duel Masters TCG, `dm:card-fetch` riduce una pagina ufficiale
Takara Tomy a campi, testo abilita, immagine e check compatti; usalo solo come
helper di acquisizione e verifica sempre contro screenshot/testo utente,
soprattutto quando la carta puo essere da Duel Masters Play's o da una stampa
corretta nel tempo. Per nuove lesson live-card Duel Masters, usa
`dm:live-card-scaffold` come piano iniziale: e' vincolato a
`duel-masters-dm25`/`live-duel-encounters`, resta plan-only salvo `--write`,
scrive solo il textbook shell e non crea cards o asset. Quando hai gia testo
visibile trascritto, `dm:official-text-compare` confronta solo quei campi/righe
con la pagina ufficiale e segnala contraddizioni: un risultato `supported` non
rende il testo ufficiale ground truth. Questi helper non sostituiscono il
giudizio editoriale.

## Struttura

- `general/`
  contiene i documenti che vanno passati sempre, indipendentemente dal media.
- `media/<media-slug>/`
  contiene brief e prompt specifici di un singolo media o batch.

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
- `general/10-textbook-lesson-style-standard.md`

## Kit media-specifico attuale

Disponibile ora:

- `media/duel-masters-dm25/01-brief.md`
- `media/duel-masters-dm25/02-batch-1-prompt.md`
- `media/gundam-arsenal-base/01-brief.md`
- `media/gundam-arsenal-base/02-batch-1-prompt.md`
- `media/pokemon-scarlet-violet/01-brief.md`
- `media/pokemon-scarlet-violet/02-batch-1-prompt.md`
- `media/web-giapponese/01-brief.md`
- `media/web-giapponese/02-batch-prompt.md`

Nota pratica:

- il brief `media/duel-masters-dm25/01-brief.md` resta utile come contesto
  storico del seed iniziale, ma non descrive piu lo snapshot corrente del
  bundle reale; per estensioni o correzioni attuali passa sempre anche i file
  reali in `content/media/duel-masters-dm25/...`.

## Uso pratico

> [!IMPORTANT]
> Se il workflow immagini inserisce o aggiorna blocchi `:::image` nei textbook,
> dopo `image:apply` serve sempre `content:import`: la webapp legge il
> contenuto importato nel DB locale, non il markdown appena modificato. Questo
> non rende il DB locale source of truth: il Markdown validato resta l'autorita'
> editoriale. Usa sempre l'import lesson-scoped quando le lesson aggiornate sono
> note; allarga a media o full solo per cambi davvero piu ampi.

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

> [!IMPORTANT]
> Le flashcard devono allenare soprattutto giapponese generalizzabile. Di
> default non vanno spese su nomi propri di cose o entita singole: se quei
> nomi servono al contesto, spiegali nel textbook e valuta semmai i componenti
> giapponesi riusabili del nome.

> [!IMPORTANT]
> Le nuove lesson textbook devono seguire lo standard di stile in
> `general/10-textbook-lesson-style-standard.md`: voce naturale da tutor,
> spiegazioni dense, cluster tematici, anatomia della frase, contrasti
> operativi e ganci cognitivi dichiarati quando aiutano. La lezione modello e
> `content/media/pokemon-scarlet-violet/textbook/029-sv-prestudy-l19b-reazioni-e-parlato-scarlet-violet.md`.

> [!IMPORTANT]
> Per generare o riscrivere lesson non basta il brief media-specifico. Passa
> sempre almeno `general/10-textbook-lesson-style-standard.md`,
> `general/04-template-textbook-lesson.md` e
> `general/09-editorial-quality-rubric.md`, oltre al brief del media.

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
- `general/10-textbook-lesson-style-standard.md`
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
  `docs/content-format.md`; il gate agent-facing
  `./scripts/with-node.sh pnpm agent:check` fallisce se i due file divergono;
- il formato supporta gia `:::image`, metadata audio locali e
  `pronunciations.json`;
- il fatto che audio e immagini vengano spesso arricchiti dopo non significa
  che siano "non supportati": significa solo che di norma non vengono generati
  direttamente dall'LLM esterno.

## Nota Storica sulle Fixtures

Questa cartella e il kit operativo corrente per orchestrare LLM esterni. Il
bundle reale valido da usare come base operativa e
`content/media/duel-masters-dm25`.
