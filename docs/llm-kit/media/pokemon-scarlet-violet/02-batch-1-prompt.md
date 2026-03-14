# Prompt - Pokemon Scarlet / Violet Batch 1

Usa questo prompt con l'LLM esterno specializzato.

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown conformi alla specifica fornita.

Contesto del progetto:
- Il media visibile e Pokemon Scarlet / Violet.
- Lo slug tecnico resta `pokemon-scarlet-violet`.
- Il focus del media e il giapponese dei videogiochi Pokemon, con percorso
  verticale principale su `Pokemon Scarlet / Violet`.
- Il livello attuale dell'utente e circa N5/N4.
- Le spiegazioni devono essere in italiano.

Obiettivo editoriale generale:
- costruire prima una base generale sui videogiochi Pokemon;
- poi sviluppare un percorso verticale su `Pokemon Scarlet / Violet` come
  pre-training prima di ogni capitolo di gioco reale;
- grande focus su vocabolario, grammatica, pattern ricorrenti e comprensione
  dei dialoghi;
- evitare di sprecare troppe flashcard su termini in katakana se non sono
  davvero indispensabili.

Regola didattica importante:
- N5/N4 e il livello di partenza dell'utente, non il limite massimo dei
  contenuti.
- Se un termine o pattern e piu avanzato ma ricorre spesso o e necessario per
  capire menu, tutorial, dialoghi o story progression, includilo e spiegalo.
- Non riempire il corpus di katakana autoesplicativi o poco formativi.
- Se un termine in katakana e quasi trasparente e non sblocca comprensione
  reale, non trasformarlo in una entry canonica salvo necessita concreta.
- Privilegia sempre vocaboli, pattern e formule che ricorrono davvero.
- Non scrivere spiegazioni valutative vuote del tipo "X e utile/importante":
  ogni spiegazione deve dire che cosa significa davvero X e che cosa ti fa
  capire o fare nel gioco.

Obiettivo di questo batch:
Creare solo il seed iniziale del media, cioe la base generale sui videogiochi
Pokemon. In questo batch non devi ancora produrre i capitoli verticali completi
di `Pokemon Scarlet / Violet`, ma devi preparare la base che verra riusata in
quei capitoli.

Fonti da cercare online con priorita:
- fonti ufficiali Pokemon quando servono per nomenclatura UI, menu, sistema e
  terminologia stabile;
- guide giapponesi affidabili sui videogiochi Pokemon per identificare lessico
  ricorrente di menu, battle flow, team management e tutorial;
- materiale giapponese vicino all'esperienza reale del giocatore, non solo
  glossari generici;
- se individui gia walkthrough completi o pagine dialogiche solide per
  `Pokemon Scarlet / Violet`, puoi usarli come contesto preparatorio, ma non
  devi ancora segmentare tutta la storia in questo batch.

Vincoli didattici obbligatori:
- `001-pokemon-videogame-core-ui-and-menus` deve spiegare le UI e i menu
  davvero ricorrenti nei videogiochi Pokemon, con focus su parole ad alta
  frequenza, conferme, navigazione, salvataggio, squadra, borsa, stato,
  selezione e schermate di base;
- `002-pokemon-videogame-core-battle-and-progression` deve spiegare il lessico
  ricorrente di lotta, mosse, stato, oggetti, cattura, crescita, progressione e
  i pattern linguistici che aiutano a capire cosa sta succedendo;
- `003-pokemon-videogame-core-dialogue-and-tutorial-patterns` deve spiegare i
  pattern ricorrenti di tutorial, istruzioni, dialoghi guidati e frasi che
  tornano spesso nei giochi Pokemon;
- le tre lesson non devono sovrapporsi troppo: menu/UI, battle/progression e
  dialogue/tutorial devono restare distinte ma complementari;
- il focus non e elencare ogni termine possibile, ma selezionare cio che ha
  alto valore di riuso.

Vincoli di formato obbligatori:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa solo la sintassi prevista per furigana, link semantici e blocchi
  strutturati.
- Usa `:::image` solo se ti viene fornito un `src` reale sotto `assets/`; non
  inventare path immagine.
- Se il label visibile di un link semantico contiene kanji, metti il furigana
  direttamente nel label: `[{{単語|たんご}}](term:term-id)`.
- Se usi inline code con giapponese non trasparente, annota anche li:
  `` `{{未開放|みかいほう}}` ``.
- Per composti numerici con contatori o qualificatori usa un solo furigana sul
  blocco intero: `{{1個|いっこ}}`, `{{3人|さんにん}}`, `{{4つ以上|よっついじょう}}`.
- Per i campi descrittivi YAML come `notes_it`, `summary`, `description`,
  `notes`, usa `>-` invece di plain scalar quando c'e testo libero o markdown
  inline.
- Ogni blocco `:::card` deve includere sempre `example_jp` + `example_it`.
  `example_jp` deve essere una frase giapponese completa e contestuale utile
  sul retro review, non una parola isolata o una ripetizione del `front`.
- Non scrivere `notes_it` o paragrafi textbook che si fermano a "X e utile da
  fissare": devi sempre esplicitare significato reale + effetto pratico nel
  gioco.
- Mantieni stabili gli ID.
- Se una entry nuova e importante per glossary/review, dichiarala
  esplicitamente con un blocco `:::term` o `:::grammar`.
- Non creare troppe entry canoniche per termini in katakana quasi
  autoesplicativi, salvo che siano davvero necessari per capire il gioco.
- Tutte le spiegazioni devono essere in italiano.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.
- Non aggiungere testo fuori dai file.

Media:
- id: media-pokemon-scarlet-violet
- slug: pokemon-scarlet-violet
- title: Pokemon Scarlet / Violet
- media_type: videogame
- segment_kind: chapter

Segmenti disponibili:
- pokemon-videogame-core
- scarlet-violet-story

Livello target:
- baseline di comprensione: N5/N4
- includi anche elementi piu avanzati se frequenti o necessari per leggere
  menu, tutorial e dialoghi

File da produrre in questo batch:
- content/media/pokemon-scarlet-violet/media.md
- content/media/pokemon-scarlet-violet/textbook/001-pokemon-videogame-core-ui-and-menus.md
- content/media/pokemon-scarlet-violet/textbook/002-pokemon-videogame-core-battle-and-progression.md
- content/media/pokemon-scarlet-violet/textbook/003-pokemon-videogame-core-dialogue-and-tutorial-patterns.md
- content/media/pokemon-scarlet-violet/cards/001-pokemon-videogame-core.md

Focus contenutistico richiesto:
- UI e menu ad altissima frequenza nei videogiochi Pokemon;
- lessico utile per squadra, box, strumenti, mosse, lotta, stato, cura,
  conferme, progressione e navigazione;
- grammatica e micro-pattern che ricorrono spesso in tutorial e dialoghi;
- formule che aiutano a leggere le scene e a seguire le istruzioni;
- esempi giapponesi realistici o ricostruiti in modo molto vicino al corpus
  reale dei giochi Pokemon;
- poco spazio ai katakana non necessari;
- nessuna deriva verso lore o trivia non utili.

Regola forte per il futuro percorso verticale:
- il percorso `scarlet-violet-story` dovra poi essere costruito seguendo una
  guida walkthrough in giapponese sufficientemente completa e stabile;
- ogni capitolo textbook dovra servire come pre-training prima del capitolo
  reale da giocare;
- per ogni capitolo dovranno essere cercate anche risorse che permettano di
  vedere il dialogo completo o abbastanza completo della sezione;
- la selezione di termini, pattern e card dovra partire da quei dialoghi reali,
  non da memoria generica.

Regola importante:
- preferisci dichiarare `term` e `grammar` nel file cards;
- il textbook dovrebbe soprattutto referenziare entita gia dichiarate;
- se nel textbook introduci una entry nuova davvero necessaria, dichiarala in
  modo esplicito e coerente;
- non creare card solo per riempire: ogni card deve avere forte valore di
  riuso.

Campi descrittivi da compilare sempre:
- in `media.md`, compila `description` in frontmatter (`>-`) con 1-2 frasi che
  descrivono il pacchetto di studio e il suo focus su videogiochi Pokemon,
  primer generale e futuro percorso verticale su `Pokemon Scarlet / Violet`;
- in ogni file textbook, compila `summary` in frontmatter (`>-`) con una frase
  breve che descrive l'obiettivo della lesson.

Documenti da seguire:
- docs/llm-kit/general/01-content-format.md
- docs/llm-kit/general/02-llm-content-handoff.md
- docs/llm-kit/general/03-template-media.md
- docs/llm-kit/general/04-template-textbook-lesson.md
- docs/llm-kit/general/05-template-cards-file.md
- docs/llm-kit/media/pokemon-scarlet-violet/01-brief.md

Checklist finale da emettere dopo i file, separata dai file stessi:
CHECKLIST:
- files_generated: <numero>
- new_terms: <numero>
- new_grammar: <numero>
- reused_terms: <numero>
- unresolved_references: <numero>
- unsafe_yaml_fields: <numero>
- explanation_tautologies: <numero>
- cards_missing_examples: <numero>
- unnecessary_katakana_cards: <numero>
```
