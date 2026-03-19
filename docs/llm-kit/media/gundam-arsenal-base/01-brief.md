# Brief Contenuti - Mobile Suit Gundam Arsenal Base

## Scopo

Media di studio dedicato al gioco arcade giapponese `機動戦士ガンダム アーセナルベース`.

Il primo obiettivo non e il meta competitivo, ma la comprensione pratica del
giapponese che serve per:

- orientarsi davanti al cabinato;
- capire la schermata di battaglia;
- leggere i ruoli base delle unita;
- capire cosa fare nelle prime sessioni;
- distinguere modalita, progressione, deck e My Page.

## Fonti di partenza gia raccolte

Le fonti prioritarie da trattare come base di ricerca sono:

- sito ufficiale, soprattutto la sezione `遊び方` / HOW TO PLAY;
- PDF ufficiale `遊び方マニュアル`;
- wiki fan `機動戦士ガンダム アーセナルベース Wiki (swiki)`, in particolare
  `初心者用ガイド`;
- guide fan giapponesi su note orientate ai principianti, alla lettura della
  schermata e al deckbuilding iniziale.

Le fonti ufficiali hanno priorita per:

- nomenclatura UI;
- flusso reale di utilizzo del cabinato;
- componenti fisici;
- terminologia delle schermate;
- modalita e sistemi ufficiali.

Le fonti fan hanno priorita per:

- chiarire cosa guardare davvero in partita;
- spiegare la logica dei ruoli;
- spiegare cosa conviene fare nelle prime 1-3 sessioni;
- rendere leggibile il flusso del match e dell'onboarding.

## Obiettivo didattico

Il bundle deve insegnare:

- componenti del cabinato e loro funzione;
- flusso iniziale: card, account, avvio partita, deck, conferme;
- elementi principali della schermata di battaglia;
- verbi e label UI ricorrenti;
- ruoli base `殲滅`, `制圧`, `防衛`;
- concetti pratici di cost, SP gauge, abilita e tattiche;
- modalita principali, rank, missioni, My Page e progressione;
- pattern compatti di linguaggio UI e di spiegazione gioco.

## Livello target

- utente circa N5/N4;
- spiegazioni in italiano;
- priorita alla comprensione funzionale di interfaccia e battaglia;
- si possono includere termini piu avanzati se ricorrono spesso o se sono
  indispensabili per capire il flusso di gioco.

## Regole didattiche importanti

- il focus iniziale e capire `cosa vedo`, `cosa significa`, `cosa devo fare`;
- non riempire le lesson di lore Gundam o dettagli di meta non necessari;
- i termini UI stabili valgono piu di copy promozionale o stagionale;
- le spiegazioni devono sempre unire significato giapponese e azione concreta;
- non basta dire che una label e "utile" o "importante": bisogna spiegare che
  cosa segnala e quale decisione abilita;
- non trasformare in flashcard i nomi propri di unita, campagne, eventi o
  altre cose singole solo per memorizzarli; se servono, spiegali nel textbook
  e semmai isola i componenti giapponesi riusabili del nome;
- quando un ruolo o un comando ha una funzione tattica, spiegare anche cosa
  cambia nella lettura della schermata.

## Struttura didattica consigliata

### Asse 1 - Cabinet And First Session Onboarding

Serve a capire:

- componenti fisici del cabinato;
- uso di IC card / Banapassport e account iniziale;
- card slot, touch panel, card reader, button, headphone jack, card outlet;
- primo flusso da sedersi alla macchina fino all'avvio.

### Asse 2 - Battle Screen And Core Actions

Serve a capire:

- gauge alleati e nemici;
- units, minimap, battlefield, tactics cards;
- azioni base come `出撃`, abilita, `戦術技`;
- cost, SP gauge, tempi e ritorno delle unita;
- cosa osservare per non perdersi durante il match.

### Asse 3 - Roles And Match Reading

Serve a capire:

- funzioni di `殲滅`, `制圧`, `防衛`;
- lane e priorita;
- target e tipi di composizione avversaria;
- ordine mentale con cui leggere il caos della schermata.

### Asse 4 - Modes, Deck, Progression

Serve a capire:

- deck iniziale;
- struttura base `MS + PL`;
- shop, missioni, challenge, rank match, EX battle, My Page;
- reward e progressione delle prime sessioni.

## Segmentazione consigliata

Per questo media usare `segment_kind: custom`.

Segmenti iniziali consigliati:

- `arcade-onboarding`
- `battle-core`
- `match-reading`
- `modes-and-progression`

## Batch iniziale consigliato

Per il primo batch ha senso creare:

- `content/media/gundam-arsenal-base/media.md`
- `content/media/gundam-arsenal-base/textbook/001-arcade-onboarding.md`
- `content/media/gundam-arsenal-base/textbook/002-battle-screen-and-core-actions.md`
- `content/media/gundam-arsenal-base/textbook/003-modes-and-progression.md`
- `content/media/gundam-arsenal-base/cards/001-arcade-core.md`

## Tipi di contenuto da privilegiare

- label UI stabili e ricorrenti;
- termini essenziali per capire interfaccia e partita;
- micro-pattern giapponesi che sbloccano un'azione concreta;
- ruoli, risorse e indicatori che compaiono davvero sullo schermo;
- frasi modello brevi e realistiche vicine al lessico del gioco.

## Tipi di contenuto da evitare

- spiegazioni generiche su Gundam non collegate all'uso del gioco;
- meta avanzato o ottimizzazione competitiva non necessaria all'onboarding;
- dettagli stagionali o promozionali poco riutilizzabili;
- duplicazione tra lesson onboarding, battle e progression;
- gloss troppo astratti senza aggancio a una schermata o a una decisione.

## Convenzione ID consigliata

- media tecnico: `media-gundam-arsenal-base` / `gundam-arsenal-base`
- lesson onboarding: `lesson-gundam-arsenal-base-arcade-onboarding-...`
- lesson battle: `lesson-gundam-arsenal-base-battle-core-...`
- lesson progression: `lesson-gundam-arsenal-base-modes-and-progression-...`
- term: `term-...`
- grammar: `grammar-...`
- card: `card-...`

## Nota importante per l'LLM esterno

Il textbook deve spiegare e referenziare.
Le entry canoniche per glossary/review dovrebbero vivere preferibilmente nei
file `cards/`.

Quindi:

- se un termine o pattern UI e importante, dichiaralo esplicitamente in `cards/`;
- nel textbook, referenzialo via `[label](term:...)` o `[label](grammar:...)`;
- se una fonte fan contraddice l'ufficiale su nomenclatura o flusso, prevale la
  fonte ufficiale;
- se una fonte fan aggiunge chiarezza pratica senza confliggere con l'ufficiale,
  integrala nelle spiegazioni in italiano.
