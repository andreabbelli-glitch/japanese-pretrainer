# Playbook Workflow Contenuti LLM

## Scopo

Questo playbook definisce il workflow operativo con cui usare un LLM esterno per
produrre contenuti importabili nella webapp.

Non definisce il formato dei file: quello e gia coperto da specifica, handoff e
template.

Questo documento serve invece a chiarire:

- come scegliere il batch da chiedere;
- quali file passare all'LLM;
- come validare l'output;
- come gestire le correzioni;
- quando importare davvero i contenuti.

## Quando serve davvero

Questo file e utile soprattutto per chi orchestra il lavoro con l'LLM esterno.

L'LLM non ha accesso autonomo alla repository: vede solo i file, gli estratti e
le istruzioni che gli vengono passati nella richiesta.

Quindi il valore di questo playbook e operativo:

- ti ricorda che contesto allegare;
- ti aiuta a evitare batch troppo grandi;
- riduce il rischio di ID duplicati, riferimenti rotti e sovrapposizioni.

## Input minimo da passare all'LLM esterno

Per qualunque media, passa sempre almeno:

- `docs/llm-kit/general/01-content-format.md`
- `docs/llm-kit/general/02-llm-content-handoff.md`
- `docs/llm-kit/general/03-template-media.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- il brief media-specifico in `docs/llm-kit/media/<media-slug>/...`
- l'eventuale prompt batch-specifico in `docs/llm-kit/media/<media-slug>/...`

## Regola chiave di contesto

Se l'LLM deve creare il primo batch di un media nuovo, di solito bastano:

- kit generale;
- brief media-specifico;
- prompt batch-specifico;
- eventuali note fonti o linee guida aggiuntive.

Se invece l'LLM deve estendere o correggere contenuto gia esistente, non basta
passargli brief e template.

Passa sempre anche i file reali dell'area che stai toccando, per esempio:

- `content/media/<media-slug>/media.md`
- i file `textbook/` coinvolti nel segmento da continuare;
- i file `cards/` coinvolti nella stessa area.

Questo serve a far vedere all'LLM:

- quali ID esistono gia;
- quali entry canoniche vanno riusate;
- quale naming dei segmenti e gia in uso;
- che cosa e gia stato spiegato e non va duplicato.

Senza questi file, il rischio principale e che l'LLM:

- reinventi ID o segmenti;
- duplici term o grammar gia presenti;
- sovrapponga lesson diverse;
- usi terminologia incoerente rispetto al bundle reale.

## Workflow operativo

### 1. Scegli un batch piccolo

Regole pratiche:

- chiedi solo i file strettamente necessari;
- preferisci una lesson o un file cards alla volta;
- evita richieste che riscrivono interi bundle gia stabili;
- se stai correggendo, limita il batch ai file davvero falliti;
- preferisci nuove entry canoniche in `cards/`, non in `textbook/`, salvo
  necessita reale.

Esempi di batch sani:

- `media.md` + 1 lesson + 1 file cards per il seed iniziale;
- 1 lesson aggiuntiva su un segmento gia avviato;
- 1 correction batch con solo i file invalidi.

Esempi di batch rischiosi:

- tutto un media in una sola richiesta;
- decine di lesson e centinaia di card insieme;
- richiesta vaga del tipo "migliora tutto".

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
- eventuali priorita tra fonti ufficiali e fonti fan;
- eventuali file reali da considerare come base da continuare, non da riscrivere
  liberamente.

Nota pratica:

- se usi una sezione finale `CHECKLIST:`, tienila fuori dai file reali;
- non copiare testo operativo dentro `content/media/...`.

### 3. Applica solo i file richiesti

Quando ricevi l'output:

- copia solo i blocchi file reali nel bundle target;
- non mischiare un batch nuovo con draft vecchi in altre cartelle;
- non spostare contenuto reale dentro fixture di test o cartelle temporanee;
- se l'LLM ha prodotto file non richiesti, ignorali.

Distinzione da mantenere:

- contenuto reale: `content/media/...`
- kit LLM: `docs/llm-kit/...`
- fixture test: `tests/fixtures/content/...`

### 4. Valida localmente prima dell'import

Valida il singolo bundle:

```sh
./scripts/with-node.sh pnpm content:validate -- --media-slug <media-slug>
```

Valida tutto il content root:

```sh
./scripts/with-node.sh pnpm content:validate -- --content-root ./content
```

Il check puo fallire per:

- YAML invalido o scalar plain fragili in campi come `notes_it`;
- ID duplicati;
- riferimenti mancanti;
- bundle incompleti;
- errori parser/schema/reference/integrity.

### 4.1 QA didattica minima

Oltre alla validazione strutturale, fai sempre un controllo editoriale rapido:

- se una frase dice che un termine o un pattern e "utile", "importante" o "da
  fissare", verifica che spieghi subito che cosa significa davvero;
- verifica che ogni `:::card` abbia `example_jp` e `example_it`, che
  `example_jp` sia una frase completa contestuale e che `example_it` traduca la
  stessa frase;
- verifica che la stessa spiegazione dica anche che cosa ti fa capire o fare
  nel media;
- se la spiegazione riguarda un nome proprio opaco o una label UI compatta,
  verifica che chiarisca almeno quale ruolo, schermata o decisione segnala;
- verifica che non ci siano sovrapposizioni inutili tra lesson vicine.

Se questo check fallisce, il batch va corretto anche se `content:validate` e
verde.

### 5. Correggi in modo iterativo

Se la validazione fallisce:

1. non lanciare l'import;
2. raccogli solo i file coinvolti e gli errori rilevanti;
3. rimanda all'LLM esterno un correction batch mirato;
4. ribadisci che gli ID stabili non vanno rinominati;
5. richiedi output sostitutivo solo per i file che hanno fallito.

Formato minimo del correction batch:

- file da correggere;
- issue list con `code`, file e riga se disponibili;
- istruzione a non toccare file gia validi;
- istruzione a usare `>-` per i campi YAML descrittivi fragili;
- istruzione a sostituire spiegazioni tautologiche con spiegazioni semantiche +
  contestuali.

### 6. Importa solo dopo validazione verde

Import scoped al bundle:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug <media-slug>
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
  Caso tipico: `notes_it` scritto come plain scalar con furigana o markdown
  inline fragile.
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
