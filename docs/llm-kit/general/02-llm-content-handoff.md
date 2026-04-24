# Handoff Per LLM Esterno

## 1. Scopo

Questo documento definisce come un LLM esterno deve produrre contenuti
importabili per la webapp.

L'LLM esterno non deve decidere il formato. Deve riempire un formato gia
definito e rispettarlo in modo rigoroso.

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
- se vuoi dichiarare che due entry locali appartengono allo stesso concetto
  cross-media, usa il campo opzionale `cross_media_group`;
- `cross_media_group` non sostituisce l'ID locale e non crea un routing
  globale;
- i link semantici `[...](term:...)` e `[...](grammar:...)` vengono risolti nel
  contesto del media corrente;
- il confronto runtime tra media esiste solo per entry con
  `cross_media_group` esplicito.

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

1. il content drafter decide se una immagine serve davvero, dove va nel flow e
   quale immagine specifica chiarirebbe il passaggio;
2. salva le richieste in `content/media/<slug>/workflow/image-requests.yaml`;
3. l'agent immagini recupera il file e aggiorna
   `content/media/<slug>/workflow/image-assets.yaml`;
4. solo dopo si inserisce nel textbook un blocco `:::image` con `src` reale.
5. dopo l'apply reale dei blocchi nel textbook, riesegui `content:import` prima
   di controllare la webapp: il reader legge il contenuto importato nel DB, non
   il markdown appena cambiato sul filesystem.

Il validatore fallisce se il file non esiste.

Tratta `image-requests.yaml` come piano editoriale, non come semplice TODO
tecnico. La request deve fissare almeno:

- il punto esatto del flow in cui l'immagine va inserita;
- la scena / schermata / crop scelto;
- che cosa l'immagine deve rendere leggibile;
- quali elementi devono essere visibili;
- quale tipo di fonte e preferibile per recuperarla.

### 5.2 Regola pratica per l'audio

Il formato supporta gia audio locale e manifest `pronunciations.json`, ma il
workflow standard non chiede all'LLM esterno di inventare questi campi.

Workflow consigliato:

1. l'LLM esterno produce `media.md`, `textbook/` e `cards/`;
2. eventuali campi audio restano assenti, salvo che esista gia un asset locale
   reale con provenance nota;
3. la pipeline locale prova in seguito il fetch offline delle pronunce;
4. se restano mancanti, il fallback Forvo completa il residuo;
5. i metadata audio vengono salvati con asset e provenance reali, non
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

## 7. Regole da comunicare all'LLM esterno

Quando gli chiedi contenuti, devi dirgli esplicitamente:

- quali file deve produrre;
- quali ID esistono gia e non possono cambiare;
- che per `term` e `grammar` l'unicita vale nel media corrente, non nel
  workspace intero;
- che `cross_media_group` e opzionale e va compilato solo per collegamenti
  editoriali certi tra media diversi;
- che, quando serve, il group id va nominato come slug leggibile e stabile,
  preferibilmente con prefisso del tipo (`term-shared-...`,
  `grammar-shared-...`);
- quali segmenti esistono gia;
- quali entry devono essere riusate;
- che deve restituire solo Markdown conforme;
- che i campi descrittivi in YAML devono usare una serializzazione sicura;
- che ogni blocco `:::card` deve includere sempre `example_jp` +
  `example_it`, con una frase giapponese completa e la sua traduzione italiana;
- che un blocco `:::image` e valido solo se `src` punta a un file gia esistente
  sotto `assets/`;
- che, se il task include il workflow immagini, il primo agente deve produrre
  `workflow/image-requests.yaml` invece di inventare direttamente `src`, e deve
  usarlo come piano editoriale completo della scelta visiva;
- che i campi audio sono supportati dal formato ma non vanno compilati a
  fantasia: si popolano solo con asset e provenance reali;
- che anche nel textbook l'obiettivo primario resta capire il giapponese:
  il gioco o il media vanno spiegati come contesto che chiarisce significato,
  funzione e conseguenza pratica, non come focus principale separato;
- che le spiegazioni devono esplicitare significato reale + conseguenza concreta
  nel media;
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

Per il workflow immagini, chiedi esplicitamente anche:

- `placement_rationale`: perche l'immagine va proprio in quel punto;
- `visual_goal`: che cosa deve rendere leggibile;
- `source_preference`: che tipo di fonte e preferita;
- `must_show`: elementi che devono comparire nel frame finale;
- `avoid`: elementi da evitare per non prendere un'immagine sbagliata.

Regola editoriale addizionale:

- non deve aggiungere `cross_media_group` solo perche due entry condividono
  lemma, kanji, reading o traduzione simile.
- non deve forzare gruppi tra modalita solo analoghe, tra nomi propri o tra
  entry di tipo diverso anche se condividono lo stesso lessema.

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
  quotata, per esempio `front: '{{手持ち|てもち}}'`;
- non scrivere quindi `front: {{手持ち|てもち}}` o
  `front: ポケモン{{図鑑|ずかん}}` come plain scalar;
- **i furigana `{{kanji|kana}}` e i term link funzionano anche dentro i blocchi di codice inline (i backtick ` `), usali e mappali sempre**: es. `` `{{相手|あいて}}のクリーチャー` `` anziché `` `相手のクリーチャー` ``.
- **se il testo visibile di un term link o grammar link contiene kanji, annota
  anche il label del link**: scrivi
  `[{{報酬|ほうしゅう}}](term:term-reward)` e non `[報酬](term:term-reward)`.
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
workflow di studio.

Evita quindi formule come:

- "questa lesson";
- "qui il punto e";
- "conviene fissare / mettere in review";
- "per questo batch / per questo test";
- "corpus iniziale", "seed", "entry canonica", "card canoniche";
- "la fonte ufficiale dice..." come intera spiegazione.
- `Media dedicato al giapponese di Duel Masters. Il corpus iniziale combina una
  base minima di lettura del TCG, un asse operativo su デュエプレ e due
  verticali sugli starter deck...`
- `Pacchetto di studio sul giapponese dei videogiochi Pokemon: costruisce prima
  una base comune su UI, battaglie e tutorial, poi sviluppa un percorso
  verticale di pre-training...`
- `Non servono ancora come card canoniche in questo seed...`
- `[レッツゴー] e un ottimo esempio di katakana che qui merita una entry
  canonica.`
- `Qui il valore didattico sta nel doppio blocco giapponese...`
- `Questa card unisce nello stesso chunk tre cose che vale la pena leggere...`
- `## Flashcard utile`
- `Da qui in poi questa pagina non e piu una monografia su una sola carta:
  diventa l'archivio progressivo delle carte che incontro davvero durante il
  gioco.`
- `Il punto piu importante non e la keyword offensiva in se, ma il blocco
  タップ状態でいたら: qui non basta sapere cos'e タップ, bisogna riconoscere lo
  stato gia presente nel momento del controllo.`

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
- Quando c'e un numero con contatore o qualificatore (`以下`, `以上`, `未満`,
  ecc.), annota il blocco completo con la pronuncia corretta del chunk intero:
  `{{1枚|いちまい}}`, `{{1体|いったい}}`, `{{2つ|ふたつ}}`,
  `{{2回|にかい}}`, `{{4以下|よんいか}}`, `{{4つ以上|よっついじょう}}`.
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
- Non scrivere meta-discorso nel contenuto finale: niente "questa lesson",
  "qui facciamo review", "per questo batch", "conviene fissare" o "verifica
  ufficiale" come contenuto principale della spiegazione.
- Non scrivere nemmeno frasi come:
  `Da qui in poi questa pagina non e piu una monografia...`
  `Il punto piu importante non e la keyword offensiva in se...`
  Queste formule sono sbagliate perche parlano della pagina o dell'importanza
  del punto, ma non spiegano il giapponese.
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
