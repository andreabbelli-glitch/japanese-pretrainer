# Change Plan — Canonical Japanese Layer, Delta Learning, Multi-Game

Versione: 1.0  
Data: 2026-03-08  
Stato: approvato come refactor pre-launch  
Audience: product owner, agenti Codex, futuri contributor

---

## 🎯 Executive summary

La webapp non deve più essere pensata come:

> “app per studiare il giapponese di Duel Masters SD1/SD2”.

Deve diventare:

> **un sistema per imparare giapponese attraverso giochi che ti interessano, dove Duel Masters è il primo contesto implementato.**

La regola fondante del nuovo modello è questa:

> **il progresso vive sull’item linguistico canonico, non sul deck e non sul gioco.**

Quindi:

- impari una volta **出る** e quel progresso resta tuo ovunque;
- un nuovo deck non ti re-insegna ciò che sai già;
- un nuovo gioco non crea duplicati artificiali degli stessi item;
- deck e giochi diventano **contesti** e **obiettivi di lettura**, non silos separati.

Questo cambio è appropriato **adesso**, perché l’app non è ancora stata usata da utenti reali. Possiamo quindi fare un refactor strutturale forte, anche con breaking changes, senza pagare il costo di retrocompatibilità prodotto.

---

## 🧠 Problema da risolvere

L’architettura V1 attuale è molto buona per partire, ma ha un bias naturale:

- è centrata su **Duel Masters**;
- usa i deck come unità mentale molto forte;
- rischia di diventare troppo specifica per **SD1/SD2**;
- rischia di trattare il “giapponese appreso” come dipendente dal contesto invece che come competenza trasferibile.

Questo contrasta con il vero obiettivo del prodotto:

> **imparare giapponese in modo cumulativo, motivato e trasferibile.**

Serve quindi un cambio di modello:

- da **deck-first** a **language-first**;
- da **single-game vertical app** a **multi-context learning system**;
- da **coverage per deck hardcodata** a **coverage per goal generica**.

---

## 📌 Decisione di prodotto

### Decisione principale

La webapp diventa un **learning system di giapponese** con tre strati:

1. **Core Japanese layer**  
   Kanji, vocaboli, verbi, pattern, espressioni, keyword e micro-frasi canoniche.

2. **Game layer**  
   Un gioco spiega come usa il giapponese, quali keyword ha, quali pattern ricorrono, quali convenzioni di wording adotta.

3. **Product layer**  
   Un prodotto concreto del gioco, per esempio un deck, usa un sottoinsieme di item e permette di calcolare il delta rispetto a ciò che l’utente sa già.

### Nuovo principio guida

> **Learn once, reuse everywhere.**

### Corollari operativi

- il progresso dell’utente è **globale sugli item**;
- i giochi e i deck fanno solo riferimento agli item;
- la review è globale ma filtrabile per obiettivo;
- il textbook è a strati: core → gioco → prodotto;
- il sistema deve sempre poter rispondere alla domanda:
  - “cosa mi manca per leggere questo nuovo deck?”
  - “cosa so già che si trasferisce a questo nuovo gioco?”

---

## 🪓 Breaking changes consentiti

Poiché l’app è pre-launch e non è ancora stata usata, sono consentiti senza remore:

1. **rinomina e rifattorizzazione profonda delle cartelle content**;
2. **rinomina di route e pagine** per renderle più generiche;
3. **migrazioni DB breaking**;
4. **drop di tabelle/cache troppo specifiche**;
5. **nuove convenzioni ID**, purché da questo momento in poi diventino stabili;
6. **eliminazione di hardcode legati solo a SD1/SD2**;
7. **sostituzione di metriche deck-specific con metriche goal-based**.

Non serve mantenere compatibilità con:

- URL precedenti non ancora pubblicati;
- ID contenuto interni non ancora consumati da utenti;
- snapshot DB provvisori usati solo in sviluppo.

---

## 🧱 Principi architetturali vincolanti

### 1. Canonical item first
Ogni concetto linguistico esiste una volta sola nel sistema.

Esempi:

- `jp.v.deru`
- `jp.v.erabu`
- `jp.pat.x_ga_deta_toki`
- `tcg.n.decktop`
- `dm.kw.shinryaku`

### 2. Nessun duplicato di progresso per contesto
Se l’utente ha già progresso su `jp.v.deru`, quel progresso vale anche quando `deru` appare in un altro deck o gioco.

### 3. Contesto separato da conoscenza
Il fatto che un item compaia in Duel Masters, in un deck specifico o in un altro gioco è **metadato di contesto**, non una nuova unità di apprendimento.

### 4. Contenuto nel repo, stato utente nel DB
Il contenuto didattico resta versionato nel repo. Il DB salva solo stato, progressi, goal, eventi e preferenze.

### 5. Goal-driven learning
L’utente non studia “tutto”. Studia per sbloccare un obiettivo reale:

- capire un deck;
- iniziare un nuovo gioco;
- rafforzare una macro-area del giapponese.

### 6. Explain-first resta valido
Le flashcard non sostituiscono il textbook. Il textbook spiega, la review consolida.

---

## 🧩 Nuovo dominio concettuale

### Entità canoniche

#### `LanguageItem`
Unità linguistica globale.

Tipi supportati:

- kanji
- vocab
- verb
- adjective
- pattern
- keyword
- counter
- phrase
- function-word

Campi minimi:

- `id`
- `kind`
- `surface`
- `reading`
- `meaning_it`
- `explanation_eli5`
- `scope` (`general`, `tcg`, `game-specific`)
- `priority` (`core`, `important`, `nice`)
- `senses[]`
- `relatedItemIds[]`
- `prerequisiteItemIds[]`
- `exampleIds[]`
- `sourceRefs[]`

#### `Example`
Frase o frammento reale che mostra un item in uso.

Campi minimi:

- `id`
- `jp`
- `reading`
- `translation_it`
- `breakdown`
- `itemIds[]`
- `sourceUnitId`
- `gameId`
- `productId`

#### `Lesson`
Unità didattica.

Tipi consigliati:

- `core`
- `game`
- `product`

Campi minimi:

- `id`
- `layer`
- `slug`
- `title`
- `summary`
- `itemIds[]`
- `unitIds[]`
- `gameId?`
- `productId?`

#### `Game`
Contesto di alto livello, per esempio Duel Masters.

Campi minimi:

- `id`
- `slug`
- `name`
- `language` (per ora: `ja`)
- `description_it`
- `status`

#### `Product`
Pacchetto concreto dentro un gioco.

Esempi:

- starter deck
- decklist guidata
- starter product
- beginner pack

Campi minimi:

- `id`
- `gameId`
- `slug`
- `name`
- `productType`
- `summary_it`
- `unitIds[]`
- `lessonIds[]`

#### `SourceUnit`
Unità concreta di lettura. Nella V1/V1.5 coincide quasi sempre con una carta.

Campi minimi:

- `id`
- `gameId`
- `productId`
- `unitType` (`card` per ora)
- `name`
- `jpText`
- `reading?`
- `paraphrase_it`
- `requiredItemIds[]`
- `recommendedLessonIds[]`
- `priorityWeight`

#### `Goal`
Obiettivo attivo dell’utente.

Tipi iniziali:

- `product_readability`
- `game_onboarding`
- `weak_area_repair`

Campi minimi:

- `id`
- `goalType`
- `targetType` (`game`, `product`, `lesson-set`)
- `targetId`
- `status`
- `priority`

---

## 🗂️ Nuova struttura contenuti nel repo

```text
/content
  /language
    /items
    /examples
    /lessons
      /core
    /meta

  /games
    /duel-masters
      /meta
      /lessons
      /products
        /dm25-sd1
          /meta
          /units
          /lessons
        /dm25-sd2
          /meta
          /units
          /lessons

    /<future-game>
      /meta
      /lessons
      /products
        /<product-id>
          /meta
          /units
          /lessons
```

### Regola forte

`/language` contiene il patrimonio riusabile.  
`/games` contiene i contesti che **referenziano** quel patrimonio.

### Cosa non fare più

- non duplicare item sotto i singoli giochi;
- non creare lo stesso vocab due volte con ID diversi;
- non usare il deck come fonte unica della verità linguistica.

---

## 🏷️ Nuova convenzione ID

### Item linguistici

- `jp.k.de`
- `jp.v.deru`
- `jp.v.erabu`
- `jp.n.aite`
- `jp.pat.x_ga_deta_toki`
- `jp.func.sonogo`
- `tcg.n.decktop`
- `dm.kw.shinryaku`

### Esempi

- `ex.dm.sd1.0001`
- `ex.dm.sd2.0007`

### Lessons

- `lesson.core.01`
- `lesson.core.02`
- `lesson.dm.01`
- `lesson.dm.sd1.01`

### Giochi e prodotti

- `game.duel-masters`
- `product.dm25-sd1`
- `product.dm25-sd2`

### Source units

- `unit.dm.sd1.001`
- `unit.dm.sd2.004`

### Regola

Gli ID diventano **stabili da questo refactor in poi**. Non vanno rinominati casualmente.

---

## 🧮 Nuovo modello di progresso

### Principio

Il progresso utente non è più legato a SD1 o SD2, ma a:

```text
user × canonical language item
```

### Conseguenze

- `user_item_progress` resta una tabella globale;
- la review si basa su item canonici;
- una nuova fonte di contenuto può solo:
  - introdurre item nuovi;
  - riusare item esistenti;
  - cambiare il contesto in cui li incontri.

### Distinzioni utili da mantenere

Per ogni item l’app deve distinguere almeno tra:

- `never_seen`
- `seen`
- `learning`
- `review`
- `mature`
- `mastered`

E in parallelo, a livello contestuale:

- visto in Duel Masters
- visto in SD1
- visto in SD2
- visto in altro gioco

Il progresso contestuale **non deve** creare duplicati di mastery.

---

## 🗄️ Cambi DB richiesti

### Tabelle da mantenere

- `profiles`
- `user_settings`
- `lesson_progress`
- `user_item_progress`
- `review_sessions`
- `review_events`
- `bookmarks`

### Tabelle da aggiungere

#### `user_goals`
Tiene traccia degli obiettivi attivi dell’utente.

Campi consigliati:

- `id`
- `user_id`
- `goal_type`
- `target_type`
- `target_id`
- `title_override?`
- `status` (`active`, `paused`, `completed`, `archived`)
- `priority`
- `created_at`
- `updated_at`

#### `user_item_context_exposure` opzionale ma consigliata
Tiene traccia del fatto che l’utente abbia incontrato un item in un certo contesto.

Campi consigliati:

- `user_id`
- `item_id`
- `game_id`
- `product_id?`
- `unit_id?`
- `first_seen_at`
- `last_seen_at`
- `seen_count`
- PK composita coerente con il livello di granularità scelto

### Tabelle/campi da rimuovere o generalizzare

#### `daily_stats_cache`
Se contiene colonne tipo:

- `deck_sd1_coverage`
- `deck_sd2_coverage`

va rifatta o rimossa.

Sostituzioni possibili:

1. nessuna cache in V1.5, calcolo live; oppure
2. cache generica per goal; oppure
3. cache generica per product.

### Regole RLS

Restano owner-only. Le nuove tabelle user-specific devono seguire lo stesso modello.

---

## 🔁 Review engine: evoluzione richiesta

### Cosa non cambia

- review basata su item;
- scheduler semplice e trasparente;
- stati tipo `new`, `learning`, `review`, `relearning`, `mature`.

### Cosa cambia

La review deve diventare **globale per item ma filtrabile per obiettivo**.

### Modalità review da supportare

1. **Global review**  
   Ripasso quotidiano normale.

2. **Goal review**  
   Ripasso focalizzato su ciò che serve per un goal attivo.

3. **Missing-only review**  
   Mostra solo gli item mancanti per leggere un target.

4. **Bridge review**  
   Mostra item già noti globalmente ma ancora deboli o poco visti nel contesto del nuovo gioco/prodotto.

### Regola fondamentale

Un item noto **non deve rientrare come “new item”** solo perché appare in un nuovo gioco.

Può però rientrare come:

- esempio nuovo;
- contesto nuovo;
- richiamo leggero in textbook;
- review filtrata per goal se è ancora fragile.

---

## 📚 Textbook: nuova architettura didattica

### Layer 1 — Core textbook
Insegna il giapponese riusabile.

Esempi di lezioni:

- verbi ricorrenti
- timing e trigger
- numeri e limiti
- pattern di targeting
- kanji ad alta resa

### Layer 2 — Game textbook
Spiega come un gioco usa quel giapponese.

Per Duel Masters:

- zone e movimento
- wording tipico del testo carta
- keyword specifiche
- pattern storici e moderni

### Layer 3 — Product textbook
Spiega come leggere un prodotto concreto.

Per esempio:

- SD1 delta pack
- SD2 delta pack
- futuro starter deck
- futuro altro gioco starter deck

### Regola UX

Il textbook di prodotto deve sempre mostrare:

- cosa sai già;
- cosa ti manca;
- quali carte/unità sblocchi studiando il prossimo gruppo di item.

---

## 🧠 Gap engine e delta learning

Questa diventa una feature centrale.

### Input

Un target, per esempio:

- `product.dm25-sd1`
- `product.dm25-sd2`
- `game.duel-masters`
- futuro `product.<other-game>.starter-a`

### Dati usati

- item richiesti dal target;
- mastery globale dell’utente;
- priorità item;
- opzionalmente: esposizione contestuale.

### Output richiesti

- `requiredItems`
- `knownItems`
- `weakItems`
- `missingItems`
- `coverageScore`
- `unlockNextRecommendations`

### UI minima da ottenere

Il sistema deve saper dire frasi del tipo:

- “Per leggere questo deck ti mancano 18 item.”
- “Ne conosci già 42 grazie a ciò che hai studiato altrove.”
- “Se studi questi 7 item, sblocchi 5 nuove carte.”
- “Il tuo vero collo di bottiglia è il timing, non il vocabolario.”

---

## 📈 Coverage: da deck-specific a goal/product-specific

### V1 attuale
Coverage centrata su SD1 e SD2.

### Nuovo modello
Coverage generica su qualunque target.

### Formula concettuale

```text
coverage(target) =
  somma(peso_item × mastery_item) / somma(peso_item × 100)
```

### Target supportati

- unit/card
- product
- game
- goal

### Pesi item
Restano validi:

- `core = 3`
- `important = 2`
- `nice = 1`

### Insight richiesti

Per ogni target la UI deve poter mostrare:

- copertura totale;
- item mancanti più pesanti;
- item fragili già noti;
- “study next” più efficiente.

---

## 🖥️ Route e IA di navigazione

### Problema
Le route V1 sono troppo centrate su deck e carte isolate.

### Nuova tassonomia consigliata

```text
/
/dashboard
/goals
/learn/core
/learn/core/[slug]
/items
/items/[id]
/games
/games/[gameId]
/games/[gameId]/learn/[slug]
/games/[gameId]/products/[productId]
/games/[gameId]/products/[productId]/learn/[slug]
/games/[gameId]/products/[productId]/units/[unitId]
/review
/review/session
/settings
```

### Nota pragmatica
Se il codice corrente ha già `/cards` e `/decks`, puoi:

- eliminarle direttamente; oppure
- tenerle come alias/transitional routes interne.

Dato che siamo pre-launch, la soluzione preferibile è:

> **passare subito alla tassonomia nuova e pulita.**

---

## 🪄 Dashboard: cosa deve mostrare dopo il refactor

La dashboard non deve più chiedere solo:

- quante review ho oggi?
- quanto capisco SD1 e SD2?

Deve chiedere anche:

- qual è il mio obiettivo attivo?
- cosa so già a livello globale?
- cosa mi manca per il prossimo target?
- cosa si trasferisce da un gioco all’altro?

### Moduli consigliati

- `ActiveGoalCard`
- `GlobalMasteryOverview`
- `DueToday`
- `StudyNext`
- `MissingItemsByGoal`
- `UnlockNextUnits`
- `SharedKnowledgeReused`
- `WeakButKnown`

---

## 🔍 Regole di authoring per nuovi giochi e nuovi deck

### Aggiungere un nuovo deck nello stesso gioco
Workflow desiderato:

1. crei il nuovo product package;
2. aggiungi le unità reali del deck;
3. mappi ogni unità ai canonical item richiesti;
4. il sistema calcola automaticamente il delta utente.

### Aggiungere un nuovo gioco
Workflow desiderato:

1. crei `content/games/<new-game>`;
2. aggiungi meta, lessons e products;
3. riusi quanti più `LanguageItem` possibili;
4. introduci solo gli item realmente nuovi;
5. ottieni textbook, gap analysis e review filtrata senza duplicare i progressi.

### Regola anti-duplicato

Se trovi un item già esistente nel layer globale, **non crearne un altro**. Referenzia quello.

---

## 🧪 Acceptance criteria del refactor

Il refactor è completo solo se tutte queste condizioni sono vere.

### A. Canonical language layer
- esiste una struttura `/content/language` separata da `/content/games`;
- gli item globali hanno ID canonici nuovi e stabili;
- SD1 e SD2 referenziano item globali, non copie locali.

### B. Global progress
- `user_item_progress` usa item canonici;
- lo stesso item non viene duplicato tra giochi diversi;
- un item già noto non appare come nuovo in un altro target.

### C. Goal system
- l’utente può avere almeno un goal attivo;
- esiste il calcolo `missing / weak / known / coverage` per un goal;
- il dashboard usa dati goal-based reali.

### D. Layered textbook
- esiste almeno un core textbook globale;
- Duel Masters ha il suo game textbook;
- SD1 e SD2 hanno product lessons o delta lessons.

### E. Review
- la review globale continua a funzionare;
- la review per goal funziona;
- la review missing-only funziona almeno in forma base.

### F. Extensibility
- aggiungere un nuovo product nello stesso gioco non richiede cambiare lo schema;
- aggiungere un nuovo gioco non richiede duplicare il modello di progresso.

---

## 🛠️ Piano di implementazione consigliato

### Fase 1 — Stabilizzare il modello canonico

Obiettivo:
- separare language da games;
- fissare nuove convenzioni ID;
- convertire SD1/SD2.

Task chiave:
- creare nuovo content graph;
- mappare item V1 → canonical IDs;
- aggiornare loader e validator;
- rimuovere assunzioni DM-only dal dominio contenuto.

### Fase 2 — Generalizzare dominio prodotto/coverage

Obiettivo:
- passare da deck coverage a target coverage.

Task chiave:
- introdurre `Game`, `Product`, `SourceUnit`;
- rifare coverage engine in forma generica;
- sostituire hardcode SD1/SD2 nel dashboard.

### Fase 3 — Introdurre Goal system

Obiettivo:
- rendere first-class l’idea di “voglio sbloccare questo target”.

Task chiave:
- aggiungere `user_goals`;
- aggiungere view/queries per gap analysis;
- creare UI “Study next”.

### Fase 4 — Rifare il textbook a strati

Obiettivo:
- core textbook globale;
- game textbook Duel Masters;
- product textbook SD1/SD2.

Task chiave:
- spostare lezioni esistenti nei layer giusti;
- introdurre lesson metadata per layer;
- collegare lesson → goal → product.

### Fase 5 — Evolvere il review engine

Obiettivo:
- review globale + review filtrata per goal.

Task chiave:
- aggiungere queue builders per target;
- impedire che item già noti vengano trattati da “new”; 
- opzionalmente introdurre tracking di exposure contestuale.

### Fase 6 — Rendere l’import sostenibile

Obiettivo:
- poter aggiungere nuovi game/product package senza refactor futuri.

Task chiave:
- template authoring;
- validator nuovi pacchetti;
- checklist “new product onboarding”.

---

## 👷 Work packages consigliati per agenti Codex

### WP1 — Content canonicalization
- nuova struttura `/content/language` + `/content/games`
- rinomina ID
- mapping SD1/SD2
- validator aggiornato

### WP2 — Domain refactor
- tipi `Game`, `Product`, `SourceUnit`, `Goal`
- servizi `coverage`, `gap analysis`, `study next`
- rimozione naming troppo DM-specific

### WP3 — DB refactor
- `user_goals`
- eventuale `user_item_context_exposure`
- cleanup cache/tabelle troppo specifiche
- query e RLS

### WP4 — Textbook refactor
- core lessons globali
- game lessons Duel Masters
- product lessons SD1/SD2
- pagine e navigazione nuove

### WP5 — Review refactor
- global review
- goal review
- missing-only review
- bridge review opzionale

### WP6 — Dashboard and QA
- dashboard goal-centric
- coverage generiche
- test end-to-end su nuovo flusso
- CI aggiornata

---

## 🚫 Anti-pattern espliciti

1. duplicare lo stesso item linguistico sotto giochi diversi;
2. salvare progresso per “deck item” invece che per canonical item;
3. introdurre nuove colonne hardcoded tipo `deck_sd1_coverage`;
4. usare nomenclatura troppo stretta come se ogni game fosse Duel Masters;
5. confondere “visto in un contesto” con “masterizzato globalmente”;
6. far dipendere il runtime dal markdown sorgente gigante.

---

## ✅ Default decisions per evitare ambiguità

Se un agente deve scegliere e il documento non basta, deve assumere:

1. **lingua target unica per ora = giapponese**;
2. **tipo di unità concreto iniziale = card**;
3. **progresso sempre globale su item**;
4. **goal attivo principale = product readability**;
5. **coverage sempre calcolata da required item IDs**;
6. **nessuna retrocompatibilità necessaria con l’architettura precedente**;
7. **preferire naming generico (`game`, `product`, `unit`, `goal`) a naming deck-only**.

---

## 📍 Stato finale desiderato

Dopo questo refactor, la webapp deve poter fare queste 6 cose in modo naturale:

1. insegnare il giapponese di base una volta sola;
2. usare Duel Masters come primo contesto completo;
3. aggiungere nuovi deck senza ri-creare il sapere già acquisito;
4. aggiungere nuovi giochi senza duplicare il progresso;
5. calcolare il delta linguistico per ogni nuovo obiettivo;
6. trasformare il desiderio di giocare in un piano di studio concreto.

In una frase:

> **la webapp deve diventare un sistema di apprendimento del giapponese guidato da obiettivi, con giochi e deck come contesti motivanti e non come silos separati.**

