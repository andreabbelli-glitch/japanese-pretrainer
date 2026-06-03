# Handoff Per LLM Esterno

## 1. Scopo

Questo documento definisce come un LLM esterno deve produrre contenuti
importabili per la webapp.

L'LLM esterno non deve decidere il formato. Deve riempire un formato gia
definito e rispettarlo in modo rigoroso.

## 1.1 Source of truth dei contenuti

La fonte autorevole dei contenuti e `content/media/**` nel repository. I file
Markdown versionati, dopo validazione, decidono quali lesson, entry, flashcard,
asset e workflow sidecar esistono davvero.

Il DB SQLite locale sotto `data/` non e una fonte editoriale: e una cache
runtime disposable usata da webapp, test manuali e import locali. Puo essere
stale, parziale o contenere residui/fixture. Se l'obiettivo e evitare
sovrapposizioni o riusare materiale gia presente, l'LLM deve ricevere i file
Markdown reali dell'area toccata, non un dump del DB locale.

## 2. Principio operativo

L'LLM esterno ha un ruolo preciso:

- ricerca il contenuto giapponese;
- seleziona vocaboli, frasi e pattern rilevanti;
- scrive spiegazioni in italiano;
- produce file Markdown conformi alla specifica.

Non deve:

- cambiare struttura file;
- inventare nuovi campi;
- rinominare ID esistenti;
- usare sintassi diversa da quella definita;
- lasciare riferimenti non risolti.

## 3. Workflow consigliato

### Modalita consigliata

Usare l'LLM esterno come `content drafter`, non come `source of truth`.

Pipeline:

1. gli fornisci la specifica del formato;
2. gli fornisci esempi validi;
3. gli chiedi di produrre solo i file richiesti;
4. un validatore locale controlla il risultato;
5. se ci sono errori, gli rimandi gli errori strutturati e lui corregge.

Questa collaborazione ha senso. Anzi, e il modo giusto di usarlo, purche il
processo sia validator-first.

## 4. Punto critico

Il problema non e far generare testo a un LLM. Il problema e fargli mantenere
coerenza strutturale su:

- ID stabili;
- riferimenti tra file;
- segmentazione coerente;
- alias di ricerca;
- furigana corretti;
- riuso di entita gia esistenti.

Per questo motivo la specifica da sola non basta. Servono:

- esempi validi;
- regole di naming;
- regole di serializzazione YAML sicura;
- checklist di output;
- validazione automatica.

### 4.1 Scope degli ID editoriali

Per `term` e `grammar`, l'ID che l'LLM vede nel Markdown non e piu globale al
workspace: e locale al media su cui sta lavorando.

Regole operative da assumere:

- dentro lo stesso media, `term.id` e `grammar.id` devono restare univoci;
- tra media diversi, lo stesso ID editoriale puo essere riusato;
- per `term` e `grammar`, il glossary e la review globali uniscono
  automaticamente le occorrenze con la stessa superficie grafica normalizzata;
- `cross_media_group` resta opzionale e documentativo: non sostituisce l'ID
  locale e non decide l'unione canonica;
- i link semantici `[...](term:...)` e `[...](grammar:...)` vengono risolti nel
  contesto del media corrente;
- il routing pubblico del detail e globale: `/glossary/term/<surface>` e
  `/glossary/grammar/<surface>`.

## 5. Modo piu intelligente di collaborare

Il modo piu intelligente non e "chiedi all'LLM di scrivere un textbook".

Il modo piu intelligente e separare il lavoro in due ruoli:

- LLM specializzato esterno: ricerca, traduzione, draft del contenuto.
- Agent immagini / automation: recupero screenshot, crop, normalizzazione asset.
- Pipeline locale / Codex: validazione, normalizzazione, import, correzione del
  formato.

In pratica:

- l'LLM esterno produce contenuti;
- l'agent immagini salva file reali sotto `content/media/<slug>/assets/`;
- la pipeline locale arricchisce in seguito audio e altri asset mancanti;
- il sistema locale decide se i contenuti sono accettabili.

Questo evita di fidarsi ciecamente dell'LLM sulla parte strutturale.

### 5.1 Regola pratica per le immagini

Non far inventare all'LLM contenuti un `src` immagine che non esiste ancora.

Workflow consigliato:

1. il content drafter usa screenshot forniti, immagini visibili nel prompt o
   asset gia presenti solo come fonte per trascrizione e contesto;
2. se esiste un file immagine reale, lo salva sotto
   `content/media/<slug>/assets/...`;
3. inserisce nel textbook un blocco `:::image` solo quando `src` punta a quel
   file reale;
4. se l'immagine non e disponibile come file, omette il blocco immagine e crea
   comunque la lesson;
5. non crea file di tracking per immagini mancanti;
6. dopo l'apply reale dei blocchi nel textbook, riesegui `content:import` prima
   di controllare la webapp: il reader legge il contenuto importato nel DB, non
   il markdown appena cambiato sul filesystem. Minimizza lo scope dell'import:
   lesson-scoped quando le lesson aggiornate sono note.

Il validatore fallisce se il file non esiste.

Non usare `workflow/image-requests.yaml` o `workflow/image-assets.yaml` come
placeholder per materiale non disponibile. I file legacy esistenti possono
restare nei bundle storici, ma i nuovi contenuti non devono introdurre request
di immagini mancanti.

### 5.2 Regola pratica per l'audio

Il formato supporta gia audio locale e manifest `pronunciations.json`, ma il
workflow standard non chiede all'LLM esterno di inventare questi campi.

Workflow consigliato:

1. l'LLM esterno produce `media.md`, `textbook/` e `cards/`;
2. eventuali campi audio restano assenti, salvo che esista gia un asset locale
   reale con provenance nota;
3. per ogni flashcard creata o revisionata, la pipeline locale deve chiudere il
   workflow pronunce: audio locale/riuso cross-media, poi fetch Forvo Anki-style
   tramite helper Anki dedicato e conversione OGG -> MP3, oppure richiesta
   `word-add` registrata quando Forvo non espone ancora la pronuncia;
   per entry ID esatti usa
   `./scripts/with-node.sh pnpm pronunciations:resolve-entries -- --media-slug <media-slug> --entry <new-term-or-grammar-id>`;
4. il download manuale Forvo resta solo fallback estremo per casi singoli in cui
   il fetch Anki-style o l'import diretto falliscono;
5. se la pipeline locale aggiunge o sostituisce audio sotto
   `content/media/<slug>/assets/audio/**`, riallinea la copia runtime generata
   con `./scripts/with-node.sh pnpm media-audio:sync` e verifica con
   `./scripts/with-node.sh pnpm media-audio:check`, salvo che il prossimo step
   sia gia `./scripts/with-node.sh pnpm dev` o
   `./scripts/with-node.sh pnpm build`;
6. i metadata audio vengono salvati con asset e provenance reali, non
   inventati.

Regola operativa:

- non far inventare all'LLM esterno `audio_src`, `audio_source`,
  `audio_speaker`, `audio_license`, `audio_attribution` o `audio_page_url` se
  non gli sono stati forniti asset e provenance reali.

## 6. Strategia consigliata per v1

### Regola generale

Far produrre all'LLM esterno file piccoli e ben delimitati.

Meglio:

- una lesson alla volta;
- un file cards alla volta;
- poche decine di entry per richiesta.

Peggio:

- un intero media in un solo output;
- centinaia di card in una sola risposta;
- aggiornamenti che riscrivono file gia stabilizzati senza istruzioni precise.

### Convenzione dominante

Per ridurre errori:

- le entita canoniche `term` e `grammar` vanno preferibilmente definite nei file
  `cards/`;
- il `textbook` dovrebbe soprattutto referenziare entita gia dichiarate;
- il `textbook` puo dichiarare nuove entita solo se strettamente necessario.

Questo riduce duplicazioni e inconsistenze.

### Convenzione di stile textbook

Ogni nuova lesson o revisione sostanziale del textbook deve seguire
`docs/llm-kit/general/10-textbook-lesson-style-standard.md`.

Non basta passare all'LLM esterno il solo brief media-specifico. Per textbook
nuovi o riscritture sostanziali, passa sempre anche:

- `docs/llm-kit/general/10-textbook-lesson-style-standard.md`
- `docs/llm-kit/general/04-template-textbook-lesson.md`
- `docs/llm-kit/general/09-editorial-quality-rubric.md`

Lo standard non riguarda solo la struttura delle sezioni. Riguarda soprattutto
come scrivere:

- voce naturale da tutor che legge il media insieme all'utente;
- spiegazioni dense che aprono forma giapponese, funzione e conseguenza;
- cluster tematici invece di liste di gloss scollegate;
- anatomia della frase per i passaggi grammaticalmente densi;
- contrasti operativi che evitano letture sbagliate;
- ganci cognitivi dichiarati come mnemonici quando non sono etimologia reale.
- sequenza meccanica del body e grammatica visiva dei blocchi quando il
  materiale lo permette.
- H1 e heading italiani in sentence case, non Title Case all'inglese.
- campi frontmatter identitari preservati nelle riscritture; `title` è invece
  learner-facing e va reso naturale se contiene label da batch o workflow.
- furigana senza puntini e senza ruby su katakana puro; composti spezzati in
  blocchi semantici e letture verificate.

Il modello di riferimento e:

- `content/media/pokemon-scarlet-violet/textbook/029-sv-prestudy-l19b-reazioni-e-parlato-scarlet-violet.md`

## 7. Regole da comunicare all'LLM esterno

Quando gli chiedi contenuti, devi dirgli esplicitamente:

- quali file deve produrre;
- quali ID esistono gia e non possono cambiare;
- che per `term` e `grammar` l'unicita vale nel media corrente, non nel
  workspace intero;
- che `cross_media_group` e opzionale, documentativo e non necessario per
  creare la voce globale;
- che, quando viene usato, il group id va nominato come slug leggibile e
  stabile, preferibilmente con prefisso del tipo (`term-shared-...`,
  `grammar-shared-...`);
- quali segmenti esistono gia;
- quali entry devono essere riusate;
- che deve restituire solo Markdown conforme;
- che i campi descrittivi in YAML devono usare una serializzazione sicura;
- che ogni blocco `:::card` deve includere sempre `example_jp` +
  `example_it`, con una frase giapponese completa e la sua traduzione italiana;
- che un blocco `:::image` e valido solo se `src` punta a un file gia esistente
  sotto `assets/`;
- che, se l'immagine non e disponibile come file reale, il contenuto deve
  omettere il blocco immagine invece di creare request placeholder;
- che i campi audio sono supportati dal formato ma non vanno compilati a
  fantasia: si popolano solo con asset e provenance reali;
- che anche nel textbook l'obiettivo primario resta capire il giapponese:
  il gioco o il media vanno spiegati come contesto che chiarisce significato,
  funzione e conseguenza pratica, non come focus principale separato;
- che ogni lesson textbook deve seguire lo standard di stile in
  `docs/llm-kit/general/10-textbook-lesson-style-standard.md`, con voce
  tutor-like, cluster tematici, anatomia della frase e contrasti operativi;
- che gli H1 e heading italiani usano sentence case, non Title Case, salvo
  nomi propri, acronimi e label ufficiali;
- che nelle riscritture deve preservare `id`, `slug`, `order` e gli altri campi
  identitari, ma deve rendere naturale il `title` frontmatter se contiene label
  da batch, seed o workflow;
- che le spiegazioni devono esplicitare significato reale + conseguenza concreta
  nel media;
- che tutti i campi importabili sono learner-facing salvo eccezione tecnica
  esplicita: `summary`, `meaning_it`, `notes_it`, `back`, `example_it`, caption,
  alt text e corpo textbook non devono contenere note da autore, audit,
  reviewer, workflow o curation;
- che se c'e dubbio sulla naturalezza italiana o sulla fedelta di una resa
  JP->IT, l'agente deve chiedere una seconda opinione con DeepL MCP: usa
  `mcp__deepl__translate_text` sulla frase giapponese plain per una traduzione
  di confronto, oppure `mcp__deepl__rephrase_text` sull'italiano quando il dubbio
  e solo di naturalezza; il risultato e supporto decisionale e non va mai citato
  nei file importabili;
- che `notes_it` e paragrafi textbook non devono usare formule generiche come
  "Termine tipico di...", "Parola-cerniera utile", "Verbo ad alta frequenza",
  "ti aiuta a leggere" o "ti orienta" senza spiegare collocazione e funzione
  della forma giapponese;
- che ogni `example_jp` deve contenere il target della card e usare una
  collocazione naturale; sono da evitare esempi da dizionario come
  `これはXです`, `ここはXです` o `Xがだいじです`;
- che `example_it` deve tradurre la frase giapponese senza aggiungere lore,
  tono letterario o dettagli non presenti nel testo;
- che non deve aggiungere spiegazioni fuori dai file.

Per le immagini, chiedi esplicitamente che gli asset vengano referenziati solo
quando sono file reali sotto `assets/`. Screenshot visibili nel prompt ma non
salvabili come file possono essere usati per trascrivere frasi, parole e
contesto, senza generare file workflow di richiesta.

Regola editoriale addizionale:

- non deve aggiungere `cross_media_group` per decidere merge o split del
  glossary: il merge avviene sulla superficie grafica normalizzata.
- non deve usarlo per forzare gruppi tra superfici diverse, tra modalita solo
  analoghe, tra nomi propri o tra entry di tipo diverso.

### 7.1 Regola operativa fondamentale

Per ridurre i fallimenti di import:

- l'LLM esterno deve trattare `notes_it` come campo da serializzare sempre con
  `>-`;
- per ogni blocco `:::card`, `example_jp` e `example_it` sono obbligatori e
  vanno compilati sempre insieme;
- `example_jp` deve essere una frase completa e contestuale utile sul retro
  review, non una parola isolata, una pseudo-definizione o una semplice
  ripetizione del `front`;
- per `example_jp`, riusa una frase reale della fonte solo se la entry compare
  li come unita naturale e la frase intera resta leggibile; altrimenti scrivi
  una parafrasi breve ma fedele al contesto del media;
- se la entry e stata estratta da una locuzione piu lunga e da sola non
  compare in modo autonomo nella fonte, scrivi una frase nuova ma naturale che
  la usi bene nel dominio del media;
- `example_jp` deve mostrare uso vivo della entry, non spiegare la parola:
  vietate frasi meta-lessicali come `XにYがつくと...`, `XはYの意味`,
  `Xという言葉は...` o simili;
- se devi spiegare famiglia lessicale, composizione o rapporto con una
  locuzione piu lunga, fallo in `notes_it`, non in `example_jp`;
- per estensione, anche `summary`, `description` e `notes` vanno preferiti in
  `>-` quando compaiono in YAML;
- non deve usare plain scalar per testo che contiene `:` o `：`, furigana,
  link semantici, backtick o una frase completa di rules text.
- `front` e `back` delle `:::card` non fanno eccezione: se contengono furigana
  o testo giapponese annotato, vanno serializzati in modo sicuro;
- per lati flashcard corti e monoriga, il default consigliato e una stringa
  quotata, per esempio `front: '{{手|て}}{{持|も}}ち'`;
- non scrivere quindi `front: {{手持ち|てもち}}` o
  `front: ポケモン{{図鑑|ずかん}}` come plain scalar;
- **i furigana `{{kanji|kana}}` e i term link funzionano anche dentro i blocchi di codice inline (i backtick ` `), usali e mappali sempre**: es. `` `{{相手|あいて}}のクリーチャー` `` anziché `` `相手のクリーチャー` ``.
- **se il testo visibile di un term link o grammar link contiene kanji, annota
  anche il label del link**: scrivi
  `[{{報酬|ほうしゅう}}](term:term-reward)` e non `[報酬](term:term-reward)`.
- **se quel link punta a una entry con flashcard associata, il furigana nel
  label e obbligatorio in inventari, prime spiegazioni e riepiloghi**: non
  affidarti a tooltip, `reading` dell'entry o card front per insegnare la
  lettura del target review.
- **non assumere che la `reading` della entry basti nel reader**: il furigana va
  messo anche nelle spiegazioni, nelle note e in ogni altra stringa giapponese
  mostrata all'utente quando la lettura non e trasparente.
- **se usi `:::image`, `src` deve iniziare con `assets/` e non puo essere
  inventato**: usalo solo quando l'asset e gia presente nel bundle.
- **`alt` e obbligatorio per ogni `:::image`**; `caption`, se presente, va
  serializzato in `>-` quando contiene testo libero o riferimenti inline.
- **in `:::image`, `alt` non renderizza furigana o link**: descrivilo in
  italiano o con kana / katakana, senza lasciare kanji nudi.
- **in `:::image`, `caption` e testo visibile**: se compare un termine con
  kanji, usa furigana; se esiste gia una entry glossary / flashcard, collega il
  termine e annota anche il label del link quando contiene kanji.
- **nei composti misti non mettere kana gia visibili dentro il ruby**: scrivi
  `{{受|う}}け{{取|と}}る`, `{{手|て}}{{持|も}}ち`, `メイン{{枠|わく}}`,
  `{{2|ふた}}つ`, non `{{受け取る|うけとる}}`, `{{手持ち|てもち}}`,
  `{{メイン枠|めいんわく}}`, `{{2つ|ふたつ}}`.
- **non usare puntini dentro le letture dei ruby**: scrivi
  `{{目的|もくてき}}{{地|ち}}`, `{{課外|かがい}}{{授業|じゅぎょう}}`,
  `{{学生|がくせい}}{{寮|りょう}}`, non `{{目的地|もく.てき.ち}}`,
  `{{課外授業|か.がい.じゅ.ぎょう}}` o
  `{{学生寮|がく.せい.りょう}}`.
- **non spezzare i composti lessicali kanji-per-kanji** quando il blocco
  naturale e piu leggibile: scrivi `{{言語|げんご}}{{学|がく}}`,
  `{{課外|かがい}}{{授業|じゅぎょう}}`,
  `{{興味|きょうみ}}{{深|ぶか}}い`, non
  `{{言|げん}}{{語|ご}}{{学|がく}}`,
  `{{課|か}}{{外|がい}}{{授|じゅ}}{{業|ぎょう}}` o
  `{{興|きょう}}{{味|み}}{{深|ぶか}}い`.
- **non mettere furigana su katakana puro**: `ポケモン`,
  `チャンピオンランク`, `デッキコード` e simili possono essere linkati se
  hanno un'entry, ma restano senza ruby.
- **i campi audio sono opzionali ma reali**: se non ricevi un asset locale gia
  esistente e metadata attendibili, non scriverli.

Esempio corretto:

```md
notes_it: >-
  {{山札|やまふだ}} vuol dire deck; nelle carte indica il mazzo da cui peschi.
```

### 7.2 Regola operativa sulla qualita esplicativa

Una spiegazione non e accettabile se si limita a dire che un termine o un
pattern e "utile", "importante", "frequente" o "da fissare".

Ogni `notes_it` o paragrafo textbook deve chiarire almeno:

- che cosa vuol dire davvero l'elemento giapponese;
- che cosa cambia nella lettura o nell'azione quando compare nel media;
- se l'elemento compare in un composto, che cosa aggiunge il singolo componente
  e che cosa vuol dire il composto intero;
- per nomi propri opachi, quale ruolo ricorrente o quale parte del nome conviene
  riconoscere.

Anti-esempi:

- `{{編成|へんせい}}` e un kanji utile da fissare.
- `または` e importante nel rules text.

Forme consigliate:

- in `デッキ{{編成|へんせい}}`, `デッキ` nomina il mazzo e
  `{{編成|へんせい}}` aggiunge l'idea di organizzazione / composizione; il
  composto intero indica la schermata in cui costruisci la lista.
- `または` vuol dire "oppure", ma nelle carte collega due categorie che valgono
  entrambe per lo stesso filtro.

### 7.3 Regola anti-meta-editoriale

Il contenuto finale non deve descrivere il proprio processo editoriale o il
workflow di studio. Evita quindi:

- frasi che nominano la lesson, la pagina, la card o la entry come oggetto di
  curation;
- decisioni interne su cosa creare, non creare, deduplicare, rendere canonico o
  mandare in review;
- riferimenti a batch, seed, corpus iniziale, workflow, validazione, audit,
  reviewer, DeepL o tool usati per decidere;
- heading o note che classificano un pezzo come materiale utile invece di
  spiegare il giapponese;
- anti-esempi testuali completi: se devi ricordare un errore, descrivi la
  categoria dell'errore senza fornire una frase pronta da copiare.

Se una fonte ufficiale serve, usala per confermare un testo o una regola, ma
fai emergere nel contenuto finale soprattutto:

- il significato del giapponese;
- l'effetto concreto nel gioco / nell'interfaccia;
- il contrasto con letture sbagliate o troppo vaghe.

Queste formule sono sbagliate perche:

- parlano del corso, del batch o della curation invece del giapponese;
- giustificano perche una card o una entry esiste, invece di spiegarne il
  significato;
- descrivono l'utilita in astratto, invece di aprire forma, grammatica e
  conseguenza concreta.

### 7.4 Regola obiettivo flashcard

Le flashcard non sono mini-riassunti di game design o di ruling.

Questa e la priorita primaria:

- tutto il sistema serve al 100% per insegnare giapponese;
- quindi le flashcard devono nascere prima di tutto da parole giapponesi
  importanti e pattern grammaticali importanti;
- quando devi scegliere, privilegia il giapponese piu spendibile e riusabile
  possibile anche fuori dal singolo media;
- se c'e tensione tra chiarezza meccanica e valore linguistico, vince il valore
  linguistico.

Devono esistere per allenare il giapponese, quindi privilegia:

- kanji da riconoscere bene;
- lessico o chunk importanti che ricompaiono in altre frasi;
- pattern grammaticali importanti che aiutano a leggere altre carte o schermate;
- termini che tornano utili anche fuori da una singola scena, decklist, evento
  o schermata;
- chunk completi solo quando il vantaggio sta nel saper leggere quella forma
  giapponese.

Regola complementare fondamentale:

- il textbook deve comunque spiegare anche termini, keyword, sigle o nomi molto
  verticali quando servono per capire il testo o il contesto del media, oppure
  per interagire correttamente con esso;
- se un elemento e necessario per leggere la scena o per compiere l'azione
  giusta nel media ma non ha abbastanza valore di memoria attiva, spiegalo nel
  textbook e non trasformarlo per forza in una nuova flashcard.
- se l'elemento e soprattutto un nome proprio di una cosa o entita singola,
  non trasformarlo in flashcard solo perche compare nel corpus: spiegalo nel
  textbook e, se il nome contiene componenti giapponesi davvero riusabili,
  valuta quelli invece del nome completo.

### 7.5 Regola di correttezza dell'italiano

Tutto il testo italiano finale deve essere grammaticalmente corretto e
ortograficamente rifinito.

Regole minime:

- usa gli accenti corretti (`è`, `può`, `più`, `già`, `cioè`, `così`,
  `perché`);
- non sostituire gli accenti con apostrofi o forme ASCII degradate;
- questa regola vale per `summary`, `meaning_it`, `notes_it`, `example_it`,
  caption, alt text e prosa libera del textbook.

Una spiegazione contenutisticamente giusta ma scritta in italiano scorretto non
è accettabile.

Evita invece:

- card create solo per ricordare "cosa succede in partita";
- parafrasi italiane del regolamento senza una forma giapponese forte da
  fissare;
- duplicati concettuali che non aumentano la capacita di leggere il testo
  originale.
- flashcard di puro katakana se il loro unico contenuto e una parola gia
  trasparente o facilmente traslitterabile.
- flashcard su acronimi, sigle prodotto, codici set, nomi evento, nomi propri
  di cose o entita singole, nomi interni o dettagli troppo verticali se non
  costruiscono vera literacy.
- scelte che ignorano un pattern grammaticale importante o una parola
  importante del corpus per aggiungere invece una card piu "comoda" ma meno
  utile per il giapponese.

Eccezione:

- usa una card di katakana puro solo quando il termine e ricorrente, poco
  trasparente o importante per la lettura del corpus, e quando la card allena
  anche il suo ruolo nel testo, non soltanto la sua lettura.

## 8. Prompt template consigliato

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown conformi alla specifica fornita.

Vincoli obbligatori:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa solo la sintassi prevista per furigana, link semantici e blocchi strutturati. **MAPPA I KANJI CON FURIGANA ANCHE E SOPRATTUTTO DENTRO LE CITAZIONI IN CODICE (`` `{{kanji|kana}}` ``)**.
- Un blocco `:::image` e ammesso solo se ricevi un `src` reale gia disponibile
  sotto `assets/`; non inventare path immagine.
- I campi audio sono supportati dal formato, ma non vanno compilati se non
  ricevi un asset reale e metadata attendibili.
- Se il label visibile di un link semantico contiene kanji, metti il furigana
  direttamente nel label: `[{{単語|たんご}}](term:term-id)`.
- Se il link punta a una entry con flashcard associata, questa non e opzionale:
  il textbook deve mostrare la stessa leggibilita della review surface.
- Annota tutti i numeri visibili con la lettura corretta. Quando c'e un numero
  con contatore o qualificatore (`以下`, `以上`, `未満`, ecc.), annota i
  segmenti necessari con la pronuncia corretta verificata:
  `{{1枚|いちまい}}`, `{{1体|いったい}}`, `{{2|ふた}}つ`,
  `{{2回|にかい}}`, `{{4以下|よんいか}}`,
  `{{4|よっ}}つ{{以上|いじょう}}`.
- Non scrivere `1{{枚|まい}}`, `4{{以下|いか}}` o
  `{{4つ|よっつ}}{{以上|いじょう}}`, e non indovinare le letture dei
  contatori per composizione.
- Quando il numero e poco trasparente, grande o con segni/unita, metti
  furigana sul composto intero: `{{-3000|マイナスさんぜん}}`,
  `{{2000以下|にせんいか}}`, `{{3000円|さんぜんえん}}`.
- Per i campi descrittivi in YAML usa `>-` invece di plain scalar quando c'e
  testo libero, markdown inline o una frase completa di rules text.
- Ogni blocco `:::card` deve includere sempre `example_jp` + `example_it`.
  `example_jp` deve essere una frase giapponese completa e contestuale utile
  sul retro review, non una parola isolata o una ripetizione del `front`.
- Per `example_jp`, riusa una frase reale della fonte solo se la entry compare
  li come unita naturale e la frase intera resta leggibile; altrimenti scrivi
  una parafrasi breve ma fedele al contesto del media.
- Se la entry e stata estratta da una locuzione piu lunga e da sola non
  compare in modo autonomo nella fonte, scrivi una frase nuova ma naturale che
  la usi bene nel dominio del media.
- `example_jp` deve mostrare uso vivo della entry, non spiegare la parola:
  niente frasi meta-lessicali come `XにYがつくと...`, `XはYの意味`,
  `Xという言葉は...` o simili.
- Se devi spiegare famiglia lessicale, composizione o rapporto con una
  locuzione piu lunga, fallo in `notes_it`, non in `example_jp`.
- Le flashcard devono avere un obiettivo linguistico chiaro: allenare kanji,
  lessico o grammatica giapponese. Non creare card che servono solo a
  memorizzare una meccanica di gioco in astratto.
- Se il contenuto introduce una parola giapponese importante o un pattern
  grammaticale importante ancora scoperto, trattalo come candidato primario a
  nuova flashcard.
- Tra piu candidati, privilegia il giapponese con migliore spendibilita:
  parole e pattern che puoi reincontrare anche fuori da questo singolo media
  valgono piu di acronimi, sigle e dettagli ultra-verticali.
- Non creare flashcard sul nome proprio completo di una cosa o entita singola:
  se serve al contesto, spiegalo nel textbook e isola semmai i componenti
  giapponesi riusabili del nome.
- Non creare flashcard di puro katakana per parole banali o trasparenti: di
  default non aggiungono vero valore di studio.
- Se un termine verticale serve per capire il testo corrente o per interagire
  correttamente con il media ma non ha vero valore di riuso, spiegalo bene nel
  textbook e fermati li: non promuoverlo per forza a flashcard.
- Non scrivere spiegazioni tautologiche del tipo "X e utile/importante":
  ogni spiegazione deve dire che cosa significa davvero X e che cosa ti fa
  capire o fare nel media.
- Non usare la semplicita come alibi per togliere informazione: il testo deve
  restare lineare ma denso di concetti utili.
- Per i textbook, segui `10-textbook-lesson-style-standard.md`: voce naturale
  da tutor, apertura contestuale, inventario iniziale, cluster tematici,
  anatomia della frase per le frasi dense, contrasti operativi e ganci
  cognitivi dichiarati quando aiutano.
- Non scrivere meta-discorso nel contenuto finale: niente "questa lesson",
  "qui facciamo review", "per questo batch", "conviene fissare" o "verifica
  ufficiale" come contenuto principale della spiegazione.
- Il divieto non riguarda termini reali del media: se la UI parla di deck,
  deckbuilder o `デッキコード`, spiega quel testo. Evita invece deck di studio,
  flashcard, review, batch e workflow come metadiscorso.
- Gli esempi possono essere frasi didattiche costruite sul contesto, ma non
  presentarli come transcript ufficiali se non sono citazioni puntuali.
- Non scrivere formule che raccontano la storia editoriale della pagina o che
  dichiarano l'importanza di un blocco senza analizzarlo. Sono sbagliate perche
  parlano della pagina o dell'importanza del punto, ma non spiegano il
  giapponese.
- Quando spieghi un punto, preferisci questa sequenza: forma giapponese ->
  significato letterale o tecnico -> effetto concreto nel gioco /
  nell'interfaccia -> contrasto con la lettura sbagliata piu probabile.
- Per nomi propri poco trasparenti, spiega almeno quale ruolo ricorrente
  segnalano o quali componenti del nome vale la pena riconoscere.
- Mantieni stabili gli ID esistenti.
- Se riusi una entry esistente, referenzia il suo ID invece di ridefinirla.
- Per `term` e `grammar`, tratta gli ID come locali al media corrente: non
  rinominare un ID solo perche esiste gia in un altro media.
- Se una entry nuova e importante per glossary/review, dichiarala esplicitamente
  con un blocco `:::term` o `:::grammar`.
- Tutte le spiegazioni devono essere in italiano.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.

Campi descrittivi da compilare sempre:
- Per i grammar pattern: se il `pattern` contiene kanji (es. `～時`), compila
  sempre il campo `reading` con la lettura completa in hiragana (es. `とき`).
  Se invece e tutto in kana (es. `かわりに`), ometti il campo.
- Per media.md: compila il campo `description` nel frontmatter (>-) con 1-2
  frasi che descrivono il contenuto visibile e che cosa l'utente imparera a
  leggere o capire. Non descrivere il curriculum, il seed, il batch o la
  struttura del bundle. Questo testo viene mostrato direttamente nell'UI; se
  assente, viene usato un excerpt automatico troncato del corpo del documento.
  Se contiene giapponese learner-facing, puo usare furigana
  `{{base|reading}}`.
- Per ogni file textbook: compila il campo `summary` nel frontmatter (>-) con
  una frase breve (max 160 caratteri) che descrive l'obiettivo della lesson.
  Viene mostrata nella card del textbook e nell'header della pagina; se assente,
  il sistema usa un excerpt automatico troncato.

Obiettivo del task:
<descrizione del media / segmento / lesson>

File da produrre:
<elenco preciso dei file>

ID gia esistenti da riusare:
<lista IDs>

Segmenti disponibili:
<lista segmenti>

Livello target:
<es. N5/N4>

Specifica formato:
<incollare o allegare la specifica rilevante>

Esempi validi:
<incollare 1-2 esempi corretti>
```

## 9. Checklist di qualita dell'output

Prima di accettare l'output, bisogna verificare:

- frontmatter presente e completo;
- nessun ID duplicato dentro lo stesso media;
- nessun cambio di ID esistente;
- tutti i riferimenti inline validi;
- romaji coerenti;
- reading presenti dove obbligatori;
- ogni `:::card` ha `example_jp` e `example_it`;
- gli esempi delle card sono frasi complete e contestuali, non placeholder o
  definizioni camuffate;
- niente termini importanti lasciati solo nel testo libero;
- textbook scritto con voce naturale e spiegazione progressiva, non come
  outline o lista di definizioni;
- cluster tematici, anatomia della frase e contrasti operativi presenti quando
  il materiale li richiede;
- niente spiegazioni tautologiche o solo valutative ("utile", "importante",
  "da fissare") senza contenuto semantico e operativo;
- nessun campo YAML fragile, come `notes_it` o una frase completa in
  `front/back`, scritto come plain scalar ambiguo;
- niente testo fuori formato.

## 10. Suggerimento pratico importante

Chiedere all'LLM esterno di emettere anche una breve sezione finale di
autoverifica machine-friendly, ma separata dai file reali, ad esempio:

```text
CHECKLIST:
- files_generated: 2
- new_terms: 12
- new_grammar: 3
- reused_terms: 7
- unresolved_references: 0
```

Questa parte non va importata, ma e utile nel ciclo di controllo.

## 11. Criticita da prevenire

### 11.1 ID instabili

Se l'LLM rigenera un file e cambia gli ID, rompi glossary, progress e review.

Regola:

- una volta assegnato, un ID non cambia piu.

### 11.2 Ridefinizioni incompatibili

Se `term-taberu` oggi ha certi campi e domani viene ridefinito in modo
incompatibile, il validatore deve fallire.

Nota di scope:

- questo vale per ridefinizioni incompatibili nello stesso media;
- la presenza dello stesso ID editoriale in un altro media e consentita.

### 11.3 Glossary incompleto

Se un termine importante appare solo in testo libero, non entra bene nel modello.

Regola:

- le entry importanti vanno dichiarate esplicitamente.

### 11.4 Output troppo grande

Su output grandi i modelli peggiorano in coerenza.

Regola:

- lavorare per batch piccoli.

## 12. Raccomandazione finale

Si, ha senso usare un altro LLM specializzato per creare textbook e flashcard.

Pero non gli affiderei mai direttamente il ruolo di "autore libero". Gli
affiderei il ruolo di "fornitore di contenuto dentro un contratto rigido".

La collaborazione migliore e:

- specifica stretta;
- esempi validi;
- validator locale;
- correzione iterativa sugli errori;
- import solo dopo validazione.

## 13. Playbook operativo

Per la procedura concreta del repository usare:

- `docs/llm-kit/general/06-content-workflow-playbook.md`

Il playbook fissa il ciclo reale da seguire:

1. richiesta batch piccola;
2. output LLM esterno;
3. validazione locale con `content:validate`;
4. correzione iterativa sui file che falliscono;
5. eventuale `image:apply` se hai risolto asset immagini;
6. import con `content:import` per aggiornare il DB che alimenta la webapp.
   Minimizza sempre lo scope: usa
   `--media-slug <media-slug> --lesson-slug <lesson-slug>` quando il batch tocca
   solo una o piu lesson specifiche dello stesso media; media/full solo per
   cambi piu ampi o riallineamenti intenzionali. Questo passaggio aggiorna il
   runtime della webapp; non sostituisce `content/media/**` come source of truth
   editoriale.
