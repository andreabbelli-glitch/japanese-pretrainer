# Playbook Workflow Contenuti LLM

## Scopo

Questo playbook rende operativo il workflow contenuti per il primo bundle reale
del progetto:

- `content/media/duel-masters-dm25`

L'obiettivo non e generare tutto in una volta, ma lavorare per batch piccoli,
validare localmente e importare solo quando il bundle passa i controlli.

## Input minimo da passare all'LLM esterno

Per Duel Masters DM25 passa sempre:

- `docs/llm-kit/general/01-content-format.md`
- `docs/llm-kit/general/02-llm-content-handoff.md`
- `docs/llm-kit/general/03-template-media.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- `docs/llm-kit/general/06-content-workflow-playbook.md`
- `docs/llm-kit/media/duel-masters-dm25/01-brief.md`
- `docs/llm-kit/media/duel-masters-dm25/02-batch-1-prompt.md`

## Workflow operativo

### 1. Scegli un batch piccolo

Per `duel-masters-dm25` il batch iniziale canonico e:

- `content/media/duel-masters-dm25/media.md`
- `content/media/duel-masters-dm25/textbook/001-tcg-core-overview.md`
- `content/media/duel-masters-dm25/textbook/002-tcg-core-patterns.md`
- `content/media/duel-masters-dm25/cards/001-tcg-core.md`

Regole pratiche:

- non chiedere piu file del necessario;
- non chiedere riscritture globali di file gia stabilizzati;
- riusa sempre gli ID esistenti del bundle, se presenti;
- preferisci nuove entry canoniche in `cards/`, non in `textbook/`.

### 2. Richiedi l'output all'LLM esterno

Usa il prompt batch gia presente nel kit media-specifico. La richiesta deve
esplicitare:

- file da produrre;
- ID da preservare;
- segmenti disponibili;
- obbligo di restituire solo Markdown;
- obbligo di usare YAML sicuro per `notes_it`, `summary`, `description`, `notes`.

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

## Regola finale sul Codice e i Template

L'LLM esterno produce draft che dipendono dalle istruzioni fornite. 
**Regola d'oro: Se modifichi il codice parser, il database o la struttura prevista per i markdown, devi obbligatoriamente aggiornare la documentazione e i template in `docs/llm-kit/general/`.** Non dare per scontato che l'LLM "capisca" i cambiamenti del codice se non sono documentati in questi file markdown.

Il repository accetta solo output che passa:

1. `content:validate`
2. eventuale correzione iterativa
3. `content:import`
