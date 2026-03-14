# Brief Contenuti - Pokemon Scarlet / Violet

## Scopo

Media di studio dedicato al giapponese dei videogiochi Pokemon, con focus
verticale iniziale su `Pokemon Scarlet / Violet`.

Il corpus deve avere due livelli complementari:

- una base iniziale trasversale sui videogiochi Pokemon in generale;
- un percorso verticale su `Pokemon Scarlet / Violet` costruito come
  pre-training prima di giocare davvero ogni capitolo della storia.

Il bundle deve insegnare:

- lessico UI molto ricorrente nei videogiochi Pokemon;
- vocabolario e pattern utili per menu, battaglie, gestione squadra e oggetti;
- grammatica e micro-pattern che ricorrono spesso nei dialoghi;
- formule ricorrenti del linguaggio di tutorial, quest, prompt e conferme;
- lessico davvero utile per capire il flusso di gioco e i dialoghi di storia;
- dialoghi e scene che vale la pena pre-studiare prima di giocare.

## Focus didattico

La priorita non e riempire il media di terminologia generica Pokemon o di
etichette in katakana poco formative.

La priorita e invece:

- far capire il giapponese che compare davvero mentre giochi;
- privilegiare vocaboli, pattern grammaticali e formule ricorrenti;
- aiutare a leggere i dialoghi della storia il piu possibile;
- selezionare solo i katakana che sono davvero inevitabili per giocare o
  ricorrono cosi spesso da diventare struttura operativa del corpus.

Regola editoriale forte:

- non creare troppe flashcard su termini in katakana se non sono davvero
  indispensabili;
- preferire entry che sbloccano comprensione reale di dialoghi, menu,
  tutorial, battle flow e story progression;
- se un termine in katakana e quasi autoesplicativo e non aggiunge molto
  valore didattico, meglio evitarlo o tenerlo solo come supporto secondario.

## Struttura didattica consigliata

### Asse 1 - Pokemon Videogame Core

Serve a creare una base comune prima di entrare in `Pokemon Scarlet / Violet`.

Queste lesson iniziali devono coprire:

- menu e UI molto ricorrenti;
- lessico di battaglia veramente frequente;
- parole ricorrenti per squadra, mosse, strumenti, stato, cura, salvataggio,
  conferme e navigazione;
- micro-pattern grammaticali e di dialogo/tutorial che ricorrono in molti
  giochi Pokemon;
- frasi compatte di sistema, prompt e tutorial che aiutano a orientarsi.

Prime lesson consigliate:

- `001-pokemon-videogame-core-ui-and-menus`
- `002-pokemon-videogame-core-battle-and-progression`
- `003-pokemon-videogame-core-dialogue-and-tutorial-patterns`

### Asse 2 - Pokemon Scarlet / Violet Story Pre-Training

Serve a pre-studiare il giapponese del gioco prima di giocare ogni blocco
reale della storia.

Ogni lesson verticale deve:

- corrispondere a un capitolo reale della progressione di gioco;
- anticipare lessico, dialoghi, formule ricorrenti e scelte linguistiche del
  blocco che il giocatore sta per affrontare;
- aiutare a leggere i dialoghi, non solo le schermate;
- restare fortemente ancorata a materiale testuale reale.

## Regola chiave per la struttura verticale

La parte verticale di `Pokemon Scarlet / Violet` non va segmentata in modo
arbitrario.

Va invece costruita seguendo una guida walkthrough in giapponese abbastanza
completa, stabile e leggibile, in modo che:

- i capitoli del textbook corrispondano ai capitoli del walkthrough scelto;
- il pre-training abbia un ordine pratico vicino al gioco reale;
- il lessico selezionato sia coerente con quello che l'utente incontrera poco
  dopo giocando.

Quando possibile, oltre al walkthrough, il lavoro deve usare anche risorse che
permettano di vedere il dialogo completo o quasi completo del segmento, per
esempio:

- transcript o raccolte dialoghi;
- pagine wiki/story logs;
- video con testo leggibile;
- database o guide che riportano le battute principali.

Il walkthrough serve a fissare struttura e progressione.
Le risorse dialogiche servono a decidere cosa vale davvero la pena studiare.

## Fonti di partenza da cercare online

L'LLM esterno deve cercare attivamente fonti online, non limitarsi a memoria
generica.

Fonti da cercare con priorita:

- guide walkthrough giapponesi complete o quasi complete per
  `Pokemon Scarlet / Violet`;
- pagine con dialoghi della storia, transcript, story logs o raccolte eventi;
- wiki giapponesi che documentano missioni, eventi, tutorial e sequenza
  narrativa;
- fonti ufficiali quando servono per nomenclatura UI, termini sistema e nomi
  standard;
- guide fan giapponesi quando servono per progressione, ordine dei capitoli e
  ricostruzione pratica delle scene.

Ordine di priorita pratico:

- fonti ufficiali per nomi UI, terminologia sistema e labels fisse;
- fonti fan ben strutturate per chapter breakdown e ordine pratico;
- risorse dialogiche per selezione di lessico, pattern e scene da pre-studiare.

## Obiettivo didattico

Il bundle deve aiutare l'utente a:

- orientarsi nei menu e nella UI senza dipendere troppo dall'inglese;
- capire istruzioni, tutorial e prompt ricorrenti;
- leggere piu dialoghi possibile durante la storia;
- entrare in ogni capitolo di `Pokemon Scarlet / Violet` con vocabolario e
  pattern gia pre-attivati;
- distinguere cio che e frequente e strutturale da cio che e episodico.

## Livello target

- utente circa N5/N4;
- spiegazioni in italiano;
- priorita alla comprensione funzionale e narrativa;
- si possono includere elementi piu avanzati se ricorrono spesso o se sono
  davvero necessari per leggere dialoghi o capire il flusso.

## Regole didattiche importanti

- il textbook deve aiutare a giocare e leggere, non fare lore encyclopedia;
- i dialoghi di storia hanno priorita alta, non solo menu e combattimento;
- privilegiare pattern e vocaboli riutilizzabili;
- non sprecare troppe entry su parole facili in katakana solo perche visibili;
- se un termine e ricorrente ma in katakana, includerlo solo se e davvero
  necessario per comprensione o azione;
- ogni spiegazione deve dire che cosa significa davvero l'elemento giapponese
  e che cosa ti fa capire o fare nel gioco;
- le lesson generali non devono sovrapporsi inutilmente ai capitoli verticali;
- i capitoli verticali devono essere progettati come pre-training del capitolo,
  non come recap dopo aver giocato;
- quando possibile, selezionare esempi e card da dialoghi reali del blocco
  narrativo corrispondente.

## Segmentazione consigliata

Per questo media usare `segment_kind: chapter`.

Segmenti iniziali consigliati:

- `pokemon-videogame-core`
- `scarlet-violet-story`

Nota operativa:

- il segmento `pokemon-videogame-core` copre le prime lesson generali;
- il segmento `scarlet-violet-story` ospita il percorso verticale capitolo per
  capitolo;
- la numerazione e i titoli dei capitoli verticali vanno allineati al
  walkthrough giapponese scelto come riferimento primario.

## Batch iniziale consigliato

Per il primo batch ha senso creare:

- `content/media/pokemon-scarlet-violet/media.md`
- `content/media/pokemon-scarlet-violet/textbook/001-pokemon-videogame-core-ui-and-menus.md`
- `content/media/pokemon-scarlet-violet/textbook/002-pokemon-videogame-core-battle-and-progression.md`
- `content/media/pokemon-scarlet-violet/textbook/003-pokemon-videogame-core-dialogue-and-tutorial-patterns.md`
- `content/media/pokemon-scarlet-violet/cards/001-pokemon-videogame-core.md`

Il primo batch non deve ancora esplodere l'intera storia di
`Pokemon Scarlet / Violet`.

Prima conviene costruire:

- una base robusta;
- una convenzione di naming stabile;
- un primo set di entry canoniche riutilizzabili nel textbook verticale.

## Batch successivi consigliati

Dopo il seed iniziale, i batch successivi dovrebbero seguire questa logica:

- scegliere un walkthrough giapponese di riferimento;
- fissare la lista dei capitoli verticali secondo quel walkthrough;
- per ogni capitolo, raccogliere anche una o piu risorse dialogiche;
- produrre una lesson textbook per quel capitolo;
- produrre o estendere un file cards coerente con quel capitolo solo con le
  entry davvero utili e ricorrenti.

Esempi di batch sani:

- un solo capitolo verticale alla volta;
- una lesson capitolo + un file cards associato;
- correzione di un solo capitolo se la validazione o la QA fallisce.

## Tipi di contenuto da privilegiare

- verbi e formule di azione davvero ricorrenti;
- pattern grammaticali che compaiono spesso nei dialoghi;
- parole e strutture che aiutano a capire tutorial, prompt e story scenes;
- lessico narrativo e operativo che torna in piu capitoli;
- frasi modello reali o molto vicine ai dialoghi effettivi;
- selezione mirata di termini di battaglia, squadra, quest e progressione;
- entry che rendono piu leggibili i dialoghi pre-boss, scuola, compagni, guide
  e scene di avanzamento.

## Tipi di contenuto da evitare

- accumulo di nomi propri poco utili;
- troppi katakana autoesplicativi;
- lore o trivia non necessari alla comprensione del giapponese;
- gloss troppo astratti senza aggancio a scene, UI o dialoghi reali;
- duplicazione tra primer generale e capitoli verticali;
- batch troppo grandi che mescolano molti capitoli insieme.

## Convenzione ID consigliata

- media tecnico: `media-pokemon-scarlet-violet` / `pokemon-scarlet-violet`
- lesson core: `lesson-pokemon-scarlet-violet-pokemon-videogame-core-...`
- lesson story: `lesson-pokemon-scarlet-violet-scarlet-violet-story-...`
- term: `term-...`
- grammar: `grammar-...`
- card: `card-...`

## Nota importante per l'LLM esterno

Il textbook deve spiegare e referenziare.
Le entry canoniche per glossary/review dovrebbero vivere preferibilmente nei
file `cards/`.

Quindi:

- se un termine o pattern e importante e ricorrente, dichiaralo in `cards/`;
- nel textbook, referenzialo via `[label](term:...)` o `[label](grammar:...)`;
- non creare troppe entry isolate per parole viste una sola volta;
- i capitoli verticali devono nascere da materiale reale: walkthrough +
  risorsa dialogica del blocco;
- se una scena ha dialoghi molto densi, la selezione deve privilegiare cio che
  sblocca piu comprensione, non tutto indistintamente.
