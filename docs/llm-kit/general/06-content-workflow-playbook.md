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
- quando importare davvero i contenuti;
- come gestire il passaggio successivo di enrichment audio e immagini.

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

Se il batch include immagini, passa anche:

- `docs/llm-kit/general/07-template-image-requests.yaml`
- `docs/llm-kit/general/08-template-image-assets.yaml`

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
- per `term` e `grammar`, considera valida l'unicita nel media corrente, non
  nel workspace intero;
- usa `cross_media_group` solo quando il legame cross-media e intenzionale e
  certo; non come deduzione automatica;
- nei rollout reali collega solo voci con lo stesso nucleo didattico utile da
  confrontare; per esempio `mission`, `deck` o `ranked match`, ma non modalita
  vagamente simili, nomi propri o entry di tipo diverso;
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
- obbligo che il contenuto finale non parli del proprio processo editoriale o
  di studio ("questa lesson", "qui facciamo review", "per questo batch",
  "conviene fissare");
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
- enrichment successivo: audio e immagini recuperati da workflow locali.

### 3.1 Asset immagini

Se una lesson usa screenshot o immagini carte:

- salva i file sotto `content/media/<slug>/assets/...`;
- salva le richieste del primo agente in
  `content/media/<slug>/workflow/image-requests.yaml`;
- salva le risoluzioni del secondo agente in
  `content/media/<slug>/workflow/image-assets.yaml`;
- tratta `image-requests.yaml` come piano editoriale dell'immagine: non basta
  dire "qui serve uno screenshot", bisogna fissare scena scelta, punto del
  flow, obiettivo visivo e criteri di recupero;
- usa nomi stabili e descrittivi, per esempio
  `assets/ui/deck-edit.webp` o `assets/cards/abyss-bell.svg`;
- inserisci nel textbook un blocco `:::image` solo quando il file esiste gia;
- in `image-requests.yaml` / `image-assets.yaml`, `alt_it` deve restare testo
  semplice: evita kanji nudi e preferisci italiano o kana / katakana;
- in `image-requests.yaml` / `image-assets.yaml`, `caption_it` e testo visibile:
  se compaiono kanji, annotali con furigana; se richiama una entry glossary /
  flashcard, usa il link semantico e annota anche il label;
- in `image-requests.yaml`, compila anche `placement_rationale`,
  `visual_goal`, `source_preference`, `must_show` e `avoid` ogni volta che la
  lesson ha bisogno di una scelta visiva non banale;
- non lasciare in `content/media/...` placeholder tipo `TODO`, URL remoti o
  `src` inventati.

Comandi pratici:

```sh
./scripts/with-node.sh pnpm image:status -- --media-slug <media-slug>
./scripts/with-node.sh pnpm image:apply -- --media-slug <media-slug> --dry-run
./scripts/with-node.sh pnpm image:apply -- --media-slug <media-slug>
```

Nota operativa:

- `image:apply` aggiorna i file textbook sul filesystem;
- la webapp renderizza il contenuto importato nel DB locale;
- quindi, dopo un apply reale, va rieseguito `content:import` prima di
  verificare il risultato nel reader.

### 3.2 Asset audio

Il formato del progetto supporta gia audio locale e `pronunciations.json`, ma
nel workflow con LLM esterno l'audio di norma non viene scritto nel primo batch
editoriale.

Regole pratiche:

- non chiedere all'LLM di inventare file audio o metadata di provenance;
- non chiedere all'LLM di popolare `audio_src` se l'asset non esiste davvero;
- dopo il batch editoriale, usa il workflow locale di pronunce per cercare
  audio mancanti;
- prima esegui il fetch offline;
- poi, se restano mancanti, puoi usare il fallback Forvo.

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
- ID duplicati nello stesso media;
- riuso cross-media degli stessi `term.id` / `grammar.id` e ammesso se ogni
  bundle locale resta coerente;
- `cross_media_group` malformati o incoerenti;
- riferimenti mancanti;
- bundle incompleti;
- errori parser/schema/reference/integrity.

### 4.1 QA didattica minima

Oltre alla validazione strutturale, fai sempre un controllo editoriale rapido:

- se una frase dice che un termine o un pattern e "utile", "importante" o "da
  fissare", verifica che spieghi subito che cosa significa davvero;
- verifica che il testo finale non racconti il workflow editoriale o di studio
  al posto del contenuto: niente "questa lesson", "per questo test", "cosa
  mandare in review", "conviene mettere in review", "corpus iniziale",
  "entry canonica", "card canoniche", "in questo seed";
- verifica che ogni `:::card` abbia `example_jp` e `example_it`, che
  `example_jp` sia una frase completa contestuale e che `example_it` traduca la
  stessa frase;
- verifica che la stessa spiegazione dica anche che cosa ti fa capire o fare
  nel media;
- se una lesson contiene `:::image`, verifica che l'immagine mostri davvero il
  label, la schermata o la carta promessa dalla caption;
- se la spiegazione riguarda un nome proprio opaco o una label UI compatta,
  verifica che chiarisca almeno quale ruolo, schermata o decisione segnala;
- verifica che non ci siano sovrapposizioni inutili tra lesson vicine.

Se questo check fallisce, il batch va corretto anche se `content:validate` e
verde.

Nota di fase 2:

- textbook popup e tooltip restano locali al media corrente;
- i link semantici `term:...` e `grammar:...` vengono risolti nel media del
  bundle importato;
- il confronto cross-media compare solo per entry con `cross_media_group`
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

Se hai appena eseguito `image:apply`, questo passaggio non e opzionale: senza
reimport il reader continua a mostrare l'AST precedente salvato nel DB.

### 7. Verifica il risultato

Dopo l'import verifica almeno:

- che l'import completi senza issue;
- che i file scansionati siano quelli attesi;
- che non ci siano archive/prune inattesi;
- che il bundle resti validabile con `content:validate`;
- che nel reader compaiano davvero i nuovi blocchi `:::image`;
- che `alt` non lasci kanji nudi e che `caption` annoti con furigana o link
  semantico ogni termine visibile che lo richiede.

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
2. eventuale `image:apply` quando ci sono asset immagini risolti
3. eventuale correzione iterativa
4. `content:import`
