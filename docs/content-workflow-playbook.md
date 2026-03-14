# Playbook Workflow Contenuti LLM

## Scopo

Questo playbook rende operativo il workflow contenuti per il bundle reale del
progetto:

- `content/media/duel-masters-dm25`

Il media visibile e `Duel Masters`, mentre `duel-masters-dm25` resta lo slug
tecnico del bundle.

L'obiettivo non e generare tutto in una volta, ma lavorare per batch piccoli,
validare localmente e importare solo quando il bundle passa i controlli.

## Input minimo da passare all'LLM esterno

Per Duel Masters passa sempre:

- `docs/llm-kit/general/01-content-format.md`
- `docs/llm-kit/general/02-llm-content-handoff.md`
- `docs/llm-kit/general/03-template-media.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- `docs/llm-kit/general/06-content-workflow-playbook.md`
- `docs/llm-kit/media/duel-masters-dm25/01-brief.md`

Se stai ricreando il seed core iniziale, passa anche:

- `docs/llm-kit/media/duel-masters-dm25/02-batch-1-prompt.md`

Se il batch include immagini, passa anche:

- `docs/llm-kit/general/07-template-image-requests.yaml`
- `docs/llm-kit/general/08-template-image-assets.yaml`

## Regola chiave di contesto

Se l'LLM deve estendere contenuto gia esistente, non basta passargli brief,
template e prompt storico.

Passa sempre anche i file reali dell'area che stai toccando:

- App `デュエプレ`: `media.md`, `textbook/005-duel-plays-app-overview.md`,
  `textbook/006-duel-plays-app-decks-and-shop.md`,
  `textbook/007-duel-plays-app-modes-and-progression.md`,
  `cards/005-duel-plays-app-core.md`
- Core: `media.md`, `textbook/001-tcg-core-overview.md`,
  `textbook/002-tcg-core-patterns.md`, `cards/001-tcg-core.md`
- Mazzo Abyss: `textbook/010-dm25-sd1-overview.md`,
  `cards/010-dm25-sd1-core.md`
- Mazzo Apollo / Red Zone: `textbook/020-dm25-sd2-overview.md`,
  `cards/020-dm25-sd2-core.md`

Senza questi file, il rischio principale e che l'LLM reintroduca sovrapposizioni
tra lesson o usi segmenti/terminologia ormai superati.

## Workflow operativo

### 1. Scegli un batch piccolo

Seed batch storico:

- `content/media/duel-masters-dm25/media.md`
- `content/media/duel-masters-dm25/textbook/001-tcg-core-overview.md`
- `content/media/duel-masters-dm25/textbook/002-tcg-core-patterns.md`
- `content/media/duel-masters-dm25/cards/001-tcg-core.md`

Stato reale del bundle oggi:

- `content/media/duel-masters-dm25/media.md`
- `content/media/duel-masters-dm25/textbook/005-duel-plays-app-overview.md`
- `content/media/duel-masters-dm25/textbook/006-duel-plays-app-decks-and-shop.md`
- `content/media/duel-masters-dm25/textbook/007-duel-plays-app-modes-and-progression.md`
- `content/media/duel-masters-dm25/textbook/001-tcg-core-overview.md`
- `content/media/duel-masters-dm25/textbook/002-tcg-core-patterns.md`
- `content/media/duel-masters-dm25/textbook/010-dm25-sd1-overview.md`
- `content/media/duel-masters-dm25/textbook/020-dm25-sd2-overview.md`
- `content/media/duel-masters-dm25/cards/005-duel-plays-app-core.md`
- `content/media/duel-masters-dm25/cards/001-tcg-core.md`
- `content/media/duel-masters-dm25/cards/010-dm25-sd1-core.md`
- `content/media/duel-masters-dm25/cards/020-dm25-sd2-core.md`

Batch futuri sensati:

- `content/media/duel-masters-dm25/textbook/008-duel-plays-app-events-and-notices.md`
- `content/media/duel-masters-dm25/textbook/011-dm25-sd1-key-cards.md`
- `content/media/duel-masters-dm25/textbook/021-dm25-sd2-key-cards.md`

Regole pratiche:

- non chiedere piu file del necessario;
- non chiedere riscritture globali di file gia stabilizzati;
- riusa sempre gli ID esistenti del bundle, se presenti;
- per `term` e `grammar`, considera valida l'unicita nel media corrente, non
  nel workspace intero;
- usa `cross_media_group` solo quando il collegamento tra media diversi e
  intenzionale e certo; non come fallback automatico basato su omografia;
- nei rollout reali collega solo voci con lo stesso nucleo didattico utile da
  confrontare; per esempio `mission`, `deck` o `ranked match`, ma non modalita
  vagamente simili, nomi propri o entry di tipo diverso;
- preferisci nuove entry canoniche in `cards/`, non in `textbook/`.

### 2. Richiedi l'output all'LLM esterno

La richiesta deve esplicitare:

- file da produrre o correggere;
- ID da preservare;
- segmento reale da continuare;
- obbligo di restituire solo Markdown;
- obbligo di usare YAML sicuro per `notes_it`, `summary`, `description`, `notes`;
- obbligo che ogni blocco `:::card` includa sempre `example_jp` +
  `example_it`, con frase completa e contestuale utile sul retro review;
- obbligo che ogni spiegazione chiarisca significato reale + effetto concreto
  nel media, non solo che l'elemento e "utile" o "importante";
- differenza tra media visibile (`Duel Masters`) e slug tecnico
  (`duel-masters-dm25`), quando rilevante.

Nota pratica:

- la sezione finale `CHECKLIST:` va tenuta fuori dai file reali;
- non va copiata dentro `content/media/...`.

### 3. Applica solo i file richiesti

Quando ricevi l'output:

- copia solo i blocchi file reali nel bundle target;
- non mischiare un batch nuovo con vecchi draft in altre cartelle;
- non spostare il contenuto reale dentro `tests/fixtures/`.

Distinzione da mantenere:

- contenuto reale: `content/media/duel-masters-dm25`
- fixture test: `tests/fixtures/content/...`
- kit LLM: `docs/llm-kit/...`

### 3.1 Asset immagini

Se una lesson usa screenshot o immagini carte:

- salva i file sotto `content/media/<slug>/assets/...`;
- salva le richieste del primo agente in
  `content/media/<slug>/workflow/image-requests.yaml`;
- salva le risoluzioni del secondo agente in
  `content/media/<slug>/workflow/image-assets.yaml`;
- usa nomi stabili e descrittivi, per esempio
  `assets/ui/deck-edit.webp` o `assets/cards/abyss-bell.svg`;
- inserisci nel textbook un blocco `:::image` solo quando il file esiste gia;
- in `image-requests.yaml` / `image-assets.yaml`, `alt_it` deve restare testo
  semplice: evita kanji nudi e preferisci italiano o kana / katakana;
- in `image-requests.yaml` / `image-assets.yaml`, `caption_it` e testo visibile:
  se compaiono kanji, annotali con furigana; se richiama una entry glossary /
  flashcard, usa il link semantico e annota anche il label;
- non lasciare in `content/media/...` placeholder tipo `TODO`, URL remoti o
  `src` inventati.

Comandi pratici:

```sh
./scripts/with-node.sh pnpm image:status -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25 --dry-run
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25
```

Nota operativa:

- `image:apply` aggiorna i file textbook sul filesystem;
- la webapp renderizza il contenuto importato nel DB locale;
- quindi, dopo un apply reale, va rieseguito `content:import` prima di
  verificare il risultato nel reader.

### 4. Valida localmente prima dell'import

Valida il singolo bundle:

```sh
./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25
```

Valida tutto il content root:

```sh
./scripts/with-node.sh pnpm content:validate -- --content-root ./content
```

Il check fallisce se trova:

- YAML invalido o scalar plain fragili in campi come `notes_it`;
- ID duplicati nello stesso media;
- riuso cross-media degli stessi `term.id` / `grammar.id` e ammesso se ogni
  bundle locale resta coerente;
- `cross_media_group` malformati o incoerenti;
- riferimenti mancanti;
- bundle incompleti;
- altri errori parser/schema/reference/integrity.

### 4.1 QA didattica minima

Oltre alla validazione strutturale, fai sempre un controllo editoriale rapido:

- se una frase dice che un termine o un pattern e "utile", "importante" o "da
  fissare", verifica che spieghi subito che cosa significa davvero;
- verifica che ogni `:::card` abbia `example_jp` e `example_it`, che
  `example_jp` sia una frase completa contestuale e che `example_it` traduca la
  stessa frase;
- verifica che la stessa spiegazione dica anche che cosa ti fa capire o fare nel
  media;
- se una lesson contiene `:::image`, verifica che l'immagine mostri davvero il
  label, la schermata o la carta promessa dalla caption;
- verifica che `alt` delle immagini non lasci kanji nudi e che `caption`
  annoti con furigana o link semantico ogni termine visibile che lo richiede;
- se la spiegazione riguarda un nome proprio opaco, verifica che chiarisca
  almeno quale ruolo ricorrente segnala nel deck o nell'app.

Se questo check fallisce, il batch va corretto anche se `content:validate` e
verde.

Nota di fase 2:

- textbook popup e tooltip restano locali al media corrente;
- i link semantici `term:...` e `grammar:...` vengono risolti nel media del
  bundle importato;
- il confronto cross-media appare solo se esiste un `cross_media_group`
  esplicito.
- per nominare i gruppi usa uno slug stabile e leggibile, preferibilmente con
  prefisso del tipo: `term-shared-...` oppure `grammar-shared-...`.

### 5. Correggi in modo iterativo

Se la validazione fallisce:

1. non lanciare l'import;
2. raccogli solo i file coinvolti e gli errori rilevanti;
3. rimanda all'LLM esterno un correction batch mirato;
4. ribadisci che gli ID stabili non vanno rinominati;
   Per `term` e `grammar`, non chiedere rinomina solo per evitare collisioni
   con altri media.
5. richiedi output sostitutivo solo per i file che hanno fallito.

Formato minimo del correction batch:

- file da correggere;
- issue list con `code`, file e riga;
- istruzione a non toccare file gia validi;
- istruzione a usare `>-` per i campi YAML descrittivi fragili;
- istruzione a sostituire spiegazioni tautologiche con spiegazioni semantiche +
  contestuali.

### 6. Importa solo dopo validazione verde

Import scoped al bundle:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25
```

Import completo:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content
```

Se hai appena eseguito `image:apply`, questo passaggio non e opzionale: senza
reimport il reader continua a mostrare l'AST precedente salvato nel DB.

### 7. Verifica il risultato

Dopo l'import verifica almeno:

- che l'import completi senza issue;
- che i file scansionati siano quelli attesi;
- che non ci siano archive/prune inattesi;
- che il bundle resti validabile con `content:validate`;
- che nel reader compaiano davvero i nuovi blocchi `:::image`.

## Errori LLM piu comuni da aspettarsi

- `yaml.unsafe-plain-scalar`
  Caso tipico: `notes_it` scritto come plain scalar con furigana o un
  `front/back` che contiene una frase completa di rules text.
- `structured-block.invalid-yaml`
  Caso tipico: chiave YAML malformata in `:::term`, `:::grammar`, `:::card`.
- `id.duplicate`
  Caso tipico: stessa entry ridefinita in piu file del batch.
- `reference.missing-target`
  Caso tipico: textbook che linka una entry non dichiarata.
- `card.missing-entry`
  Caso tipico: card che punta a un `entry_id` assente.
- `media.missing-directory` o `media.empty-directory`
  Caso tipico: bundle incompleto o batch salvato solo a meta.

## Regola finale

L'LLM esterno produce draft.
Il repository accetta solo output che passa:

1. `content:validate`
2. eventuale `image:apply` quando ci sono asset immagini risolti
3. eventuale correzione iterativa
4. `content:import`
