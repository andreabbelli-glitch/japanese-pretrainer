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

## Source of truth da assumere

Per contenuti e curation, la fonte autorevole e `content/media/**` validato. Il
DB SQLite locale sotto `data/` e un artefatto runtime disposable: puo essere
stale, parziale o contenere fixture residue e non va usato come inventario
editoriale per decidere sovrapposizioni tra flashcard o entry.

Quando prepari un batch per un LLM, allega i Markdown reali del bundle o del
segmento coinvolto. Usa `content:import` solo dopo validazione, per aggiornare
la webapp o il DB target con lo scope minimo sufficiente.

## Kit da passare all'LLM esterno

Per qualunque media, passa sempre il kit generale completo:

- `docs/llm-kit/general/01-content-format.md`
- `docs/llm-kit/general/02-llm-content-handoff.md`
- `docs/llm-kit/general/03-template-media.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- `docs/llm-kit/general/06-content-workflow-playbook.md`
- `docs/llm-kit/general/09-editorial-quality-rubric.md`
- `docs/llm-kit/general/10-textbook-lesson-style-standard.md`

In aggiunta, passa sempre anche:

- il brief media-specifico in `docs/llm-kit/media/<media-slug>/...`
- l'eventuale prompt batch-specifico in `docs/llm-kit/media/<media-slug>/...`

Per task che generano o riscrivono textbook, non usare mai solo il brief
media-specifico. Devono essere presenti almeno standard, template e rubrica:

- `docs/llm-kit/general/10-textbook-lesson-style-standard.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/09-editorial-quality-rubric.md`

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

Quando l'agent lavora dentro il repo, prima di chiedere o scrivere nuovo
contenuto deve usare i helper read-only invece di ricostruire tutto a mano:

```sh
./scripts/with-node.sh pnpm content:lookup -- --media-slug <media-slug> "<superficie-o-front-esatto>"
./scripts/with-node.sh pnpm content:lookup-batch -- --media-slug <media-slug> --query "<superficie-1>" --grammar "<pattern-1>"
./scripts/with-node.sh pnpm content:lookup -- --media-slug <media-slug> --list entries
./scripts/with-node.sh pnpm content:entry-brief -- --media-slug <media-slug> --entry-id <entry-id>
./scripts/with-node.sh pnpm content:entry-usage -- --media-slug <media-slug> --entry-id <entry-id>
./scripts/with-node.sh pnpm content:lesson-brief -- --media-slug <media-slug> --lesson-slug <lesson-slug>
./scripts/with-node.sh pnpm content:lesson-workflow-check -- --media-slug <media-slug> --lesson-slug <lesson-slug>
./scripts/with-node.sh pnpm dm:live-card-scaffold -- --card-slug <card-slug> --title "<titolo lesson>"
./scripts/with-node.sh pnpm dm:official-text-compare -- --official-id <official-card-id> --visible-name "<visible-card-name>" --visible-card-line "<visible-card-line>"
./scripts/with-node.sh pnpm content:next-id -- --media-slug <media-slug> --slug <new-lesson-slug>
./scripts/with-node.sh pnpm content:scaffold -- --media-slug <media-slug> --slug <new-lesson-slug> --title "<titolo>"
./scripts/with-node.sh pnpm dm:card-fetch -- --official-id <official-card-id> --expect-name "<visible-card-name>"
./scripts/with-node.sh pnpm pronunciations:resolve-entries -- --media-slug <media-slug> --entry <entry-id>
```

`content:lookup` controlla match esatti su Markdown e produce solo il verdetto
necessario all'agent. Quando il batch contiene piu possibili entry/card, usa
`content:lookup-batch` invece di ripetere comandi singoli: accetta `--query`,
`--term`, `--grammar` e `--card`, mantiene l'ordine di input e stampa un solo
riepilogo finale. La modalita `--list` e' una inventory mirata e compatta, non
un dump globale. `content:entry-brief` e' il passo successivo quando esiste
gia un candidato preciso: riassume una sola entry con card, lesson,
riferimenti e stato audio/accento, fallendo su ambiguita invece di tirare dentro
file interi. Se invece ti servono solo coverage e coordinate dei riferimenti
semantici di un ID noto, usa `content:entry-usage`: e' piu corto di
`entry-brief` e non fa ricerca raw. `content:lesson-brief` riassume una lesson
nota con entry, card,
immagini, warning editoriali e comandi minimi di verifica/import; usalo per
dare contesto compatto, non per sostituire il Markdown quando devi riscrivere
frasi esatte. `content:next-id` calcola il prossimo ID/path/order senza scrivere
file e senza rinumerare contenuti esistenti. `content:scaffold` usa lo stesso
piano per scrivere solo il file textbook iniziale: non inventa card, non crea
placeholder vuoti e trattiene l'import finche non esiste contenuto reale.
`content:lesson-workflow-check` chiude il workflow per lesson note: valida il
media, linta le lesson, verifica lo scope lesson-scoped e importa solo con
`--import`. Per
Duel Masters TCG, `dm:card-fetch` compatta una pagina ufficiale Takara Tomy in
campi, testo abilita, immagine e check `--expect-*`; resta un helper, quindi
usa screenshot/testo utente come controllo decisivo se emergono mismatch o se
la carta potrebbe essere Duel Masters Play's-only. Per nuove lesson live-card
Duel Masters, `dm:live-card-scaffold` e il piano iniziale piu stretto: fissa
media e segmento, resta plan-only salvo `--write`, scrive solo il textbook
shell e non crea cards o asset. Quando hai gia testo visibile trascritto,
`dm:official-text-compare` confronta solo quei campi/righe con la pagina
ufficiale e segnala contraddizioni: un risultato `supported` non rende il testo
ufficiale ground truth.
Per flashcard create o revisionate con entry ID esatti,
`pronunciations:resolve-entries` e il wrapper entry-only: riusa audio locali e
cross-media, importa match Tofugu/WaniKani e passa a Forvo solo il residuo. Per
scope review, lesson, URL o word-list resta il resolver generale documentato
nei workflow pronunce.

## Workflow operativo

### 1. Scegli un batch piccolo

Regole pratiche:

- chiedi solo i file strettamente necessari;
- preferisci una lesson o un file cards alla volta;
- evita richieste che riscrivono interi bundle gia stabili;
- se stai correggendo, limita il batch ai file davvero falliti;
- per `term` e `grammar`, considera valida l'unicita nel media corrente, non
  nel workspace intero;
- considera globale il glossary/review per superficie normalizzata: stesse
  grafie confluiscono in una sola voce e in un solo subject;
- usa `cross_media_group` solo come metadata documentativo opzionale quando il
  legame cross-media e intenzionale e certo; non serve per creare l'unione;
- nei rollout reali non usarlo per collegare modalita vagamente simili, nomi
  propri o entry di tipo diverso;
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
- obbligo che `example_jp` mostri uso vivo della entry: riusare una frase reale
  solo quando la entry compare li come unita naturale e la frase resta
  leggibile; altrimenti scrivere una parafrasi breve ma fedele al contesto del
  media;
- obbligo che, se la entry e ricavata da una locuzione piu lunga e non compare
  da sola nella fonte, `example_jp` venga scritto ex novo come frase naturale
  del dominio, non come spiegazione della parola;
- divieto di esempi meta-lessicali in `example_jp` come `XにYがつくと...`,
  `XはYの意味`, `Xという言葉は...` o simili;
- obbligo che ogni spiegazione chiarisca significato reale + effetto concreto
  nel media, non solo che l'elemento e "utile" o "importante";
- obbligo di tenere distinti textbook e flashcard: il textbook deve spiegare
  anche elementi molto verticali quando servono a capire la scena o a
  interagire correttamente con il media, mentre le flashcard devono
  privilegiare il giapponese piu spendibile e riusabile;
- obbligo di far puntare ogni flashcard all'entry della superficie che allena:
  se il `front` e un chunk piu lungo, una forma flessa o una locuzione, crea
  una entry dedicata a quel chunk; non riusare l'entry del lemma interno solo
  perche appare nel testo;
- obbligo di non trasformare in flashcard i nomi propri di cose o entita
  singole solo perche compaiono nel media: se servono, vanno spiegati nel
  textbook, e solo eventuali componenti giapponesi riusabili del nome possono
  diventare candidati review;
- obbligo che anche nel textbook il bersaglio primario resti il giapponese:
  il gioco o il media servono come contesto esplicativo, non come focus
  principale separato;
- obbligo che le lesson textbook seguano lo standard di stile:
  `docs/llm-kit/general/10-textbook-lesson-style-standard.md`;
- obbligo che la prosa sembri una spiegazione tutor-like e non un outline:
  apertura contestuale, inventario iniziale, cluster tematici, anatomia della
  frase, contrasti operativi e ganci cognitivi dichiarati quando aiutano;
- obbligo di seguire la sequenza meccanica attesa del body e la grammatica
  visiva dei blocchi quando il materiale lo permette;
- obbligo di usare sentence case per H1 e heading italiani: non trasformare i
  titoli in Title Case all'inglese;
- obbligo di preservare i campi identitari del frontmatter (`id`, `media_id`,
  `slug`, `order`, `segment_ref`, `difficulty`, `status`, `tags`,
  `prerequisites`) durante una riscrittura editoriale, salvo richiesta
  esplicita di migrazione;
- obbligo di rendere learner-facing il `title` frontmatter se contiene label da
  batch, seed o workflow;
- obbligo di evitare furigana con puntini interni (`もく.てき.ち`) e ruby su
  katakana puro; scomponi invece i composti in unita semantiche naturali e
  lascia senza ruby parole come `ポケモン`, `デッキコード` o nomi katakana gia
  leggibili;
- obbligo di non spezzare kanji-per-kanji i composti lessicali naturali:
  `{{言語|げんご}}{{学|がく}}`,
  `{{課外|かがい}}{{授業|じゅぎょう}}`,
  `{{興味|きょうみ}}{{深|ぶか}}い` sono piu reader-friendly di blocchi
  sillabati kanji per kanji;
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

- se esiste un file reale, salvalo sotto `content/media/<slug>/assets/...`;
- se l'immagine e solo visibile nel prompt o in chat, usala come fonte per
  trascrivere testo e contesto, ma non inserirla come asset;
- non creare o aggiornare `workflow/image-requests.yaml` /
  `workflow/image-assets.yaml` come placeholder per immagini mancanti;
- usa nomi stabili e descrittivi, per esempio
  `assets/ui/deck-edit.webp` o `assets/cards/abyss-bell.svg`;
- inserisci nel textbook un blocco `:::image` solo quando il file esiste gia;
- nel blocco `:::image`, `alt_it` deve restare testo semplice: evita kanji nudi
  e preferisci italiano o kana / katakana;
- nel blocco `:::image`, `caption_it` e testo visibile: se compaiono kanji,
  annotali con furigana; se richiama una entry glossary / flashcard, usa il link
  semantico e annota anche il label;
- non lasciare in `content/media/...` placeholder tipo `TODO`, URL remoti o
  `src` inventati.

Comandi pratici:

Usali solo quando ci sono asset immagine reali gia risolti da applicare. Non
creare manifest o request placeholder per immagini mancanti.

```sh
./scripts/with-node.sh pnpm image:status -- --media-slug <media-slug>
./scripts/with-node.sh pnpm image:apply -- --media-slug <media-slug> --dry-run
./scripts/with-node.sh pnpm image:apply -- --media-slug <media-slug>
```

Nota operativa:

- `image:apply` aggiorna i file textbook sul filesystem;
- la webapp renderizza il contenuto importato nel DB locale;
- quindi, dopo un apply reale, va rieseguito `content:import` prima di
  verificare il risultato nel reader;
- il DB locale resta derivato e disposable: se diverge dai Markdown validati,
  reimporta invece di trattarlo come fonte autorevole;
- lo scope dell'import va minimizzato: lesson-scoped quando le lesson aggiornate
  sono note.

### 3.2 Asset audio

Il formato del progetto supporta gia audio locale e `pronunciations.json`, ma
nel workflow con LLM esterno l'audio di norma non viene scritto nel primo batch
editoriale.

Regole pratiche:

- non chiedere all'LLM di inventare file audio o metadata di provenance;
- non chiedere all'LLM di popolare `audio_src` se l'asset non esiste davvero;
- dopo il batch editoriale, ogni nuova card o card revisionata deve passare dal
  workflow locale di pronunce: audio locale/riuso cross-media, poi fetch Forvo
  Anki-style tramite helper Anki dedicato, candidati `Play(...)`, ranking speaker
  e conversione OGG -> MP3; se Forvo non espone pronuncia, apri e registra la
  richiesta `word-add`;
- per entry ID esatti usa
  `./scripts/with-node.sh pnpm pronunciations:resolve-entries -- --media-slug <media-slug> --entry <new-term-or-grammar-id>`;
- il download manuale Forvo e solo fallback estremo per casi singoli in cui il
  fetch Anki-style o l'import diretto falliscono, non un percorso standard;
- se il batch crea o rivede flashcard, cerca anche il pitch accent solo per le
  entry appena create o aggiornate con
  `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --entry <new-term-or-grammar-id>`;
- se il fetch stampa `review_required`, valuta i candidati, consulta un'altra
  fonte se serve, e salva manualmente l'accento solo quando e giustificato;
- passa piu `--entry` per piu card nuove; usa `--word` o `--words-file` solo
  se non hai una lista affidabile di ID;
- salva metadata Forvo solo dopo aver creato asset e provenance reali.

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
- `cross_media_group` malformati o incoerenti quando presenti;
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
- non trattare pero come metadiscorso i termini reali del media: `デッキ`,
  `デッキコード`, deckbuilder, review di una carta o UI simili sono ammessi se
  appartengono alla scena o alla schermata;
- verifica che H1 e heading italiani siano in sentence case, che il `title`
  frontmatter non conservi label editoriali e che una riscrittura non abbia
  cambiato i campi identitari del frontmatter;
- verifica che i furigana non contengano letture puntinate, che i composti siano
  segmentati in unita semantiche naturali e che il katakana puro non abbia ruby;
- verifica anche che i composti lessicali non siano spezzati kanji-per-kanji
  quando un blocco naturale sarebbe piu leggibile;
- verifica che ogni `:::card` abbia `example_jp` e `example_it`, che
  `example_jp` sia una frase completa contestuale e che `example_it` traduca la
  stessa frase;
- verifica che `example_jp` non deragli in meta-lessico: niente frasi che
  spiegano come si forma la parola invece di usarla davvero nel contesto del
  media;
- se la entry deriva da una locuzione piu lunga, verifica che l'esempio nuovo
  la usi in modo naturale e plausibile per il dominio invece di simularne una
  definizione;
- verifica che la stessa spiegazione dica anche che cosa ti fa capire o fare
  nel media;
- verifica che la spiegazione non deragli in una guida al gioco: il focus
  principale deve restare il giapponese che quella scena, schermata o regola ti
  fa leggere;
- verifica che la voce del textbook sia naturale, densa e progressiva: non una
  lista di definizioni, ma una spiegazione che accompagna il lettore nel media;
- verifica che le frasi dense abbiano parsing o anatomia quando serve, e che i
  contrasti rischiosi siano espliciti;
- se due esempi consecutivi insegnano pattern diversi, verifica che ciascuno
  abbia la propria anatomia prima del contrasto o dell'esempio successivo;
- se una lesson usa esempi didattici ricostruiti, verifica che siano naturali e
  utili, ma non presentati come trascrizione esatta della scena se non lo sono;
- verifica che i termini troppo verticali necessari alla comprensione o
  all'interazione corretta con il media siano spiegati nel textbook anche
  quando non diventano flashcard;
- verifica che le flashcard selezionate non siano soprattutto sigle, acronimi,
  nomi interni, nomi propri di cose o entita singole o dettagli poco
  spendibili fuori da quel singolo media;
- verifica che la semplicita della prosa non abbia svuotato il contenuto:
  ogni paragrafo deve consegnare informazione concreta, non solo enfasi;
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
- le occorrenze locali restano risolte nel media del bundle importato, ma il
  detail pubblico e globale (`/glossary/term/<surface>` o
  `/glossary/grammar/<surface>`);
- se compili `cross_media_group`, usalo solo come annotazione documentativa e
  nominalo con uno slug stabile e leggibile, preferibilmente con prefisso del
  tipo: `term-shared-...` oppure `grammar-shared-...`.

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

Scegli sempre lo scope minimo sufficiente. Import scoped a una o piu lesson
dello stesso media, obbligatorio quando hai toccato solo quelle route textbook e
le card collegate:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug <media-slug> --lesson-slug <lesson-slug> [--lesson-slug <lesson-slug> ...]
```

Se non sei sicuro dello scope minimo dopo le modifiche locali, chiedilo al
helper read-only invece di fare un import largo:

```sh
./scripts/with-node.sh pnpm content:scope
./scripts/with-node.sh pnpm content:scope -- content/media/<media-slug>/textbook/<file>.md content/media/<media-slug>/cards/<file>.md
```

Il tool non esegue validate/import e non tocca il DB: stampa solo i comandi
consigliati. Se indica `IMPORT none`, non trasformarlo in un import per
abitudine; valuta il warning/reason e importa solo se hai cambiato contenuto
che il runtime DB deve vedere.

Import scoped al bundle, solo quando vuoi riallineare tutto il media o applicare
archive/prune media-wide:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug <media-slug>
```

Usa lo slug della route textbook, non il nome del file. Il parser/validator
controlla comunque il bundle, ma il sync DB aggiorna solo le lesson richieste,
le card che puntano a quelle lesson e le entry collegate.

Import completo, solo per setup, recovery o riallineamento intenzionale
dell'intera content root:

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
- che nel reader compaiano davvero i nuovi blocchi `:::image`, se ne sono stati
  aggiunti;
- che `alt` non lasci kanji nudi e che `caption` annoti con furigana o link
  semantico ogni termine visibile che lo richiede.
- che i link `term:` / `grammar:` verso entry con flashcard associata non
  lascino kanji nudi nei label, soprattutto in inventari, prime spiegazioni e
  riepiloghi.
- che i furigana non usino letture puntinate e che il katakana puro resti senza
  ruby anche nei blocchi immagine e nelle caption.

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
4. `content:import` con lo scope minimo sufficiente, lesson-scoped quando le
   lesson toccate sono note
