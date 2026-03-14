# Masterplan - Glossary Portal Globale

## Obiettivo

Trasformare il glossary da area locale per singolo media a portale unico di
consultazione e ricerca cross-media, raggiungibile dalla navbar primaria e in
grado di dire subito se per una voce esiste almeno una flashcard collegata.

## Audit sintetico

### 1. Stato UI e routing

- La navbar primaria non espone il glossary. Oggi contiene solo `Home`,
  `Media`, `Review`, `Settings` in
  [`src/lib/site.ts`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/lib/site.ts#L3)
  e viene renderizzata da
  [`src/components/site-shell-primary-nav.tsx`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/components/site-shell-primary-nav.tsx#L12).
- Esiste solo il glossary locale sotto
  [`src/app/media/[mediaSlug]/glossary/page.tsx`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/app/media/[mediaSlug]/glossary/page.tsx#L1).
  Non esiste una route top-level `/glossary`.
- La pagina attuale del glossary e gia ben strutturata come workspace di
  ricerca, ma e esplicitamente media-centrica: header col titolo del media,
  filtro segmento locale, statistiche locali, ritorno al media corrente in
  [`src/components/glossary/glossary-page.tsx`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/components/glossary/glossary-page.tsx#L25).
- La detail page mostra gia card collegate, lesson collegate e sibling
  cross-media se esistono, in
  [`src/components/glossary/glossary-detail-page.tsx`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/components/glossary/glossary-detail-page.tsx#L16).

### 2. Stato query layer e dominio

- Il dominio e gia buono: esistono `term`, `grammar_pattern`,
  `cross_media_group`, `entry_link`, `entry_status`, `card_entry_link` in
  [`src/db/schema/glossary.ts`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/db/schema/glossary.ts#L17).
- Il glossary supporta gia ranking per kanji, kana, romaji, significato,
  alias, note e pattern grammaticale in
  [`src/lib/glossary.ts`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/lib/glossary.ts#L233).
- Il layer attuale carica pero solo le entry di un media tramite
  `listTermEntriesByMediaId` e `listGrammarEntriesByMediaId`, sempre dentro
  [`src/lib/glossary.ts`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/lib/glossary.ts#L228).
- Le detail page sono volutamente locali al media, anche quando l'ID editoriale
  viene riusato in media diversi; i test di regressione lo coprono in
  [`tests/glossary.test.ts`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/tests/glossary.test.ts#L649).
- Il task originario del glossary copriva solo l'indice per media e il dettaglio
  locale; non includeva un portale globale in
  [`docs/tasks/08-glossary-search-and-entry-pages.md`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/docs/tasks/08-glossary-search-and-entry-pages.md#L18).

### 3. Stato dei dati reali

Snapshot locale del `2026-03-14` su `data/japanese-custom-study.db`:

- `3` media
- `190` termini
- `26` pattern grammaticali
- `196` card
- `224` link entry-card
- `4` gruppi cross-media

Osservazioni:

- Il segnale "esiste una flashcard" e gia derivabile oggi da `card_entry_link`.
  Non manca il dato; manca la sua esposizione come feature prodotto.
- La copertura card e molto alta: `169/190` termini hanno almeno una card,
  `26/26` pattern grammaticali hanno almeno una card.
- Il cross-media reale e ancora molto poco popolato: esistono solo `4` gruppi
  cross-media e sono tutti di tipo `term`; nessun pattern grammaticale reale e
  ancora raggruppato cross-media.
- Il portale va validato sempre contro un DB rigenerato dal contenuto corrente,
  per evitare drift locale e garantire che il workspace rifletta solo i media
  realmente presenti in `content/`.

## Diagnosi

Il progetto non ha un problema di fondamenta. Ha soprattutto un problema di
surface area prodotto e di aggregazione:

- la navigazione primaria non rende il glossary una destinazione di primo
  livello;
- la ricerca e potente ma confinata a un solo media per volta;
- il dato flashcard esiste ma non viene mostrato come risposta esplicita;
- il layer cross-media e supportato a schema ma ancora poco alimentato dal
  corpus editoriale.

## Direzione consigliata

### Decisione chiave

Implementare un solo "Glossary Portal" con due entry point:

- `/glossary`: vista globale cross-media, raggiungibile dalla navbar.
- `/media/[mediaSlug]/glossary`: vista filtrata dello stesso portale, con
  `media=<slug>` preimpostato e copy contestuale.

Questo evita di mantenere due prodotti diversi e consente di riusare ranking,
filtri, card signal e pannelli di dettaglio.

### Principio di prodotto

La risposta primaria del portale non deve essere solo "questa voce esiste", ma:

- in quali media compare;
- se ha almeno una flashcard;
- quante flashcard ha;
- se e gia in review / learning / known;
- qual e il miglior punto di ingresso per studiarla.

## Target UX

### Navbar

- Aggiungere `Glossary` come item primario tra `Media` e `Review`.
- Evidenziare `Glossary` come voce attiva sia su `/glossary` sia sulle route
  `/media/[mediaSlug]/glossary`.

### Ricerca globale

Filtri minimi:

- query
- tipo entry: `all | term | grammar`
- media: `all | <media>`
- stato studio: `all | known | review | learning | new | available`
- flashcard: `all | with_cards | without_cards`

Filtri utili ma opzionali per una wave successiva:

- solo cross-media
- segmento
- solo voci con audio

### Result card globale

Ogni risultato dovrebbe mostrare subito:

- lemma/pattern
- lettura/romaji se presenti
- significato breve
- tipo entry
- badge `Ha flashcard` oppure `Senza flashcard`
- conteggio card
- conteggio media in cui compare
- badge di stato studio
- media primario o media di match

### Dettaglio portale

Per il dettaglio ci sono due opzioni sane:

1. V1 consigliata: mantenere i detail page locali esistenti e usare il portale
   globale come discovery, con deep-link verso il dettaglio locale migliore.
2. V2: introdurre un dettaglio globale aggregato per `cross_media_group` quando
   esiste, con fallback a entry locale quando non esiste.

La V1 e molto meno rischiosa e sblocca subito il valore richiesto.

## Masterplan implementativo

### Fase 0 - Riallineamento dati e decisioni

- Rigenerare il DB locale dal contenuto corrente prima di usare metriche di
  acceptance.
- Decidere che il portale globale e discovery-first, mentre il dettaglio locale
  resta la fonte primaria di contesto.
- Formalizzare il naming UX: usare sempre `Glossary` in navbar e `Portale
  Glossary` solo nei documenti interni, non nella UI.

### Fase 1 - Routing e navbar

- Estendere `NavItem["href"]` con `/glossary` in
  [`src/lib/site.ts`](/Users/abelli/Library/CloudStorage/OneDrive-Microsoft/Documents/Japanese Custom Study/src/lib/site.ts#L3).
- Aggiornare `primaryNav` e `resolveActivePrimaryNavHref` per supportare:
  - `/glossary`
  - `/glossary/...`
  - `/media/[mediaSlug]/glossary/...`
- Introdurre `src/app/glossary/page.tsx`.
- Mantenere le route locali esistenti per non rompere i deep-link gia presenti.

### Fase 2 - Rifattorizzazione query layer

- Estrarre da `src/lib/glossary.ts` un loader comune che sappia lavorare con:
  - `mediaSlug` opzionale
  - aggregazione multi-media
  - metadati card espliciti
- Separare tre livelli logici:
  - caricamento entry base
  - ranking/matching
  - shaping della response per UI locale o globale
- Aggiungere un tipo query globale, per esempio:
  - `media: string | "all"`
  - `cards: "all" | "with_cards" | "without_cards"`
  - `crossMediaOnly: boolean`
- Esporre nel risultato almeno:
  - `hasCards`
  - `cardCount`
  - `mediaCount`
  - `mediaHits`
  - `bestLocalHref`

Nota: per la dimensione attuale del corpus non serve una migrazione DB ne un
indice FTS. La query puo restare applicativa in memoria dopo il fetch iniziale.
Se il corpus cresce molto, si potra introdurre una tabella/materialized view o
FTS in una wave successiva.

### Fase 3 - UI del portale globale

- Costruire una nuova page data `getGlobalGlossaryPageData`.
- Riutilizzare il piu possibile componenti esistenti del glossary locale.
- Rendere il filtro `media` visibile nella pagina globale e nascosto/prefissato
  nella pagina locale.
- Rendere il filtro `flashcard` esplicito.
- Introdurre una summary header globale con:
  - numero totale entry
  - numero entry con flashcard
  - numero entry cross-media
  - numero media coperti

### Fase 4 - Integrazione con i detail page

- Da un risultato globale, linkare al dettaglio locale "migliore" secondo
  priorita:
  1. media che ha fatto match
  2. media con card collegate
  3. primo media alfabetico
- Nella result card globale, offrire un expander o un secondario "Vedi media"
  per mostrare tutte le occorrenze locali.
- Nelle detail page locali, mantenere il pannello sibling cross-media gia
  esistente.

### Fase 5 - Workstream editoriale sui dati

- Backfill dei `cross_media_group` per i pattern grammaticali veramente condivisi.
- Revisione delle voci term/grammar senza card per decidere se:
  - creare una card
  - marcarle come lookup-only
  - tenerle senza card ma renderlo esplicito
- Allineamento dei bundle media effettivamente presenti nel repo con il DB di
  sviluppo.

Questa fase non blocca la release del portale globale, ma ne aumenta molto il
valore percepito.

### Fase 6 - QA e regressioni

Test unitari:

- query globale cross-media
- filtro `with_cards` / `without_cards`
- ranking invariato per kana/romaji/italiano
- route attiva della navbar
- scelta del `bestLocalHref`

Test di regressione da preservare:

- dettaglio locale corretto quando `source_id` e riusato tra media diversi
- sibling cross-media mostrati solo quando esiste `cross_media_group`

Test e2e consigliati:

- da navbar apro `/glossary`
- cerco un termine presente in due media
- vedo subito che ha flashcard
- apro il dettaglio locale corretto
- filtro per `Senza flashcard` e vedo solo voci senza card

## Scelte tecniche raccomandate

### Da fare subito

- Nessuna migrazione schema obbligatoria
- Nessun cambio al formato Markdown obbligatorio
- Nessun cambio ai detail page locali obbligatorio

### Da evitare nella prima iterazione

- dettaglio globale canonico obbligatorio per tutte le entry
- dipendenza esclusiva da `cross_media_group` per mostrare risultati globali
- indicizzazione full-text prematura
- unificazione forzata dei significati tra media diversi

## Rischi principali

### Rischio 1 - "Cross-media" percepito ma dati ancora poco collegati

Mitigazione:

- il portale globale deve cercare in tutto il corpus anche senza group
- il badge `compare in N media` va mostrato solo quando il dato e reale

### Rischio 2 - Confusione tra "ha card" e "e in review"

Mitigazione:

- separare chiaramente i segnali:
  - `Ha flashcard / Senza flashcard`
  - `Nuova / In studio / In review / Gia nota`

### Rischio 3 - Doppio prodotto locale/globale

Mitigazione:

- un solo query layer
- una sola famiglia di componenti
- la vista locale deve essere solo una variante filtrata della globale

## Outcome atteso

Al termine della prima release utile dovresti ottenere:

- `Glossary` nella navbar primaria
- un portale unico `/glossary` per cercare termini e pattern grammaticali in
  tutto il corpus
- un filtro esplicito per vedere subito se una voce ha o non ha flashcard
- collegamento immediato al media e al dettaglio locale piu utile
- continuita totale con il glossary locale gia esistente

## Sequenza di delivery consigliata

1. Navbar + route `/glossary`
2. Query layer globale con `hasCards`
3. UI globale e filtri media/flashcard
4. Deep-link ai detail page locali
5. Backfill editoriale dei `cross_media_group`

Questa sequenza massimizza valore rapido e minimizza il rischio di rifare il
lavoro due volte.
