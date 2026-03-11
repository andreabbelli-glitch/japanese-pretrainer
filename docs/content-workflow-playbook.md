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
- preferisci nuove entry canoniche in `cards/`, non in `textbook/`.

### 2. Richiedi l'output all'LLM esterno

La richiesta deve esplicitare:

- file da produrre o correggere;
- ID da preservare;
- segmento reale da continuare;
- obbligo di restituire solo Markdown;
- obbligo di usare YAML sicuro per `notes_it`, `summary`, `description`, `notes`;
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
- ID duplicati;
- riferimenti mancanti;
- bundle incompleti;
- altri errori parser/schema/reference/integrity.

### 5. Correggi in modo iterativo

Se la validazione fallisce:

1. non lanciare l'import;
2. raccogli solo i file coinvolti e gli errori rilevanti;
3. rimanda all'LLM esterno un correction batch mirato;
4. ribadisci che gli ID stabili non vanno rinominati;
5. richiedi output sostitutivo solo per i file che hanno fallito.

Formato minimo del correction batch:

- file da correggere;
- issue list con `code`, file e riga;
- istruzione a non toccare file gia validi;
- istruzione a usare `>-` per i campi YAML descrittivi fragili.

### 6. Importa solo dopo validazione verde

Import scoped al bundle:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25
```

Import completo:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content
```

### 7. Verifica il risultato

Dopo l'import verifica almeno:

- che l'import completi senza issue;
- che i file scansionati siano quelli attesi;
- che non ci siano archive/prune inattesi;
- che il bundle resti validabile con `content:validate`.

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
2. eventuale correzione iterativa
3. `content:import`
