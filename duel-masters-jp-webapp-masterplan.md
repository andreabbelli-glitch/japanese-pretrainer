# Masterplan — Webapp per studiare il giapponese di Duel Masters
Versione: 1.0  
Data: 2026-03-07  
Stato: blueprint di implementazione per agenti Codex

## 1. Obiettivo del prodotto

Costruire una webapp che unisca due cose, entrambe fondamentali:

1. **Textbook interattivo**: una guida ELI5 che insegna il giapponese presente nelle carte dei deck **DM25-SD1** e **DM25-SD2**, con logica didattica chiara, esempi reali dal gioco e focus su comprensione + lettura ad alta voce.
2. **Review engine tipo flashcard**: un sistema di studio e ripasso che tracci in modo affidabile cosa hai visto, cosa ricordi, cosa stai dimenticando e quanto sei vicino a capire davvero le carte dei tuoi due mazzi.

Il prodotto non deve essere una generica app di SRS.  
Deve essere una **learning app verticale** sul giapponese di Duel Masters, con una relazione stretta tra:

- lezione
- concetto linguistico
- frase reale
- carta reale
- progresso mnemonico
- copertura del deck

---

## 2. North Star

La North Star del prodotto è questa:

> “Apro una carta dei miei deck, leggo il testo giapponese e ne capisco a grandi linee il senso senza dipendere da una traduzione completa.”

Questo implica 4 capacità distinte:

- riconoscere i kanji ricorrenti
- capire i verbi e i pattern del testo carta
- leggere la frase con supporto in hiragana
- ricordare nel tempo ciò che si è studiato

---

## 3. Principi di prodotto

### 3.1 Content-first
Il valore principale non viene dal framework, ma dalla qualità del contenuto e dalle relazioni tra gli oggetti di studio.

### 3.2 Explain-first, not flashcards-first
Le flashcard servono a memorizzare.  
La comprensione iniziale deve arrivare dal textbook.

### 3.3 Una sola fonte canonica per il contenuto
Lezioni, item, esempi, mapping verso le carte e pattern devono vivere in una struttura contenuto unica, versionata in Git.

### 3.4 Database solo per stato utente e tracking
Il DB deve conservare soprattutto:
- autenticazione
- impostazioni utente
- stato di review
- eventi di studio
- progresso lezioni

Non deve diventare il posto dove si “scrive a mano” il contenuto didattico.

### 3.5 Progressi didattici e mnemonici sono diversi
- “Ho letto la lezione” non significa “me lo ricordo”.
- “Ho passato una flashcard” non significa “capisco una carta vera”.

La app deve tracciare entrambe le dimensioni.

### 3.6 Tutto deve tornare alle carte reali
Ogni concetto deve poter rispondere alla domanda:
> “In quale carta dei miei due deck lo vedo davvero?”

---

## 4. Risultato minimo di V1

La V1 è pronta solo se soddisfa tutti questi requisiti:

1. login funzionante
2. textbook navigabile con lezioni strutturate
3. glossario/item pages con collegamenti bidirezionali
4. review session con scheduling e tracking
5. dashboard progresso
6. pagine carta con testo, esempi e copertura
7. copertura completa dei deck DM25-SD1 e DM25-SD2
8. contenuto derivato dal file `.md` già creato, ma migrato in formato strutturato

---

## 5. Cosa entra in V1 e cosa no

## In V1
- UI in italiano
- contenuto giapponese con letture in hiragana
- deck focus: **DM25-SD1** e **DM25-SD2**
- lezioni ELI5
- glossario strutturato
- review engine con scheduler semplice ma serio
- tracking memoria + progresso lezioni
- copertura per carta e per deck
- bookmark/favorites
- supporto desktop e mobile web
- auth con email magic link o OAuth semplice

## Fuori da V1
- app mobile nativa
- OCR da foto fisiche delle carte
- parser automatico intelligente del giapponese
- audio/TTS
- multiplayer/social
- editing contenuto da CMS esterno
- import da Anki
- algoritmi di scheduling troppo sofisticati fin da subito

## Da tenere pronti per V1.5 / V2
- PWA/offline
- cloze cards e sentence cards
- quiz rapidi dentro le lezioni
- editor contenuti assistito
- audio della lettura
- import di nuovi deck / nuovi corpus
- agent tooling MCP in dev

---

## 6. Scelte architetturali

## Stack consigliato

### Frontend + BFF
- **Next.js App Router**
- **TypeScript**
- **Tailwind CSS**
- **MDX** per le lezioni
- React Server Components dove ha senso
- Client Components solo per interazione reale

### Backend applicativo
- Next.js come **Backend for Frontend**
- **Server Actions** per mutazioni semplici e forms
- **Route Handlers** per review engine, API di sessione, webhook e endpoint programmatici

### Backend dati
- **Supabase**
  - Auth
  - Postgres
  - Row Level Security
  - `supabase-js`
  - `@supabase/ssr`

### Testing
- **Vitest** per unit/integration light
- **Playwright** per end-to-end

### Dev workflow
- repo Git
- contenuto versionato nel repo
- migrations SQL via Supabase CLI
- type generation dal DB schema

## Perché questa scelta

### Perché Next.js App Router
È il percorso moderno raccomandato nella documentazione Next.js; App Router è il router più recente, con supporto alle nuove feature React, mentre Pages Router è ancora supportato ma non è la direzione preferita per un progetto nuovo. [R1]

### Perché MDX
Le lezioni sono contenuto strutturato ma devono poter includere componenti interattivi; Next.js supporta MDX direttamente sia tramite file-based routing sia tramite import nelle pagine. [R2]

### Perché Supabase
Per questa app serve un backend semplice e solido con auth, Postgres, policy di sicurezza per utente e supporto SSR. Supabase documenta esplicitamente l’integrazione con Next.js App Router, il supporto SSR via cookie e l’uso di Auth + RLS insieme. [R8] [R9] [R10] [R11]

### Perché non usare un ORM in V1
In V1 conviene ridurre astrazione e parti mobili:
- un solo backend dati
- policy RLS chiare
- meno sincronizzazioni
- meno rischio di doppia logica auth/permessi

Se in futuro il dominio dati esplode, si potrà rivalutare un ORM. In V1: **Supabase JS + SQL migrations**.

---


### Bootstrap iniziale consigliato
Per accelerare la partenza, l’agent foundation può partire dal quickstart ufficiale Supabase per Next.js, che usa `create-next-app` con template `with-supabase` e include già cookie-based auth, TypeScript e Tailwind CSS. [R8]

## 7. Decisioni architetturali chiave

### ADR-01 — Contenuto canonico nel repo, non nel DB
**Decisione**: lezioni, item, esempi, mapping deck/carte e relazioni vivono in `/content`.  
**Ragione**: versionabilità, review umana, diff chiari, rollback facile, nessuna dipendenza da CMS.

### ADR-02 — DB solo per stato utente e tracking
**Decisione**: il DB memorizza progresso e stato, non il testo didattico primario.  
**Ragione**: separazione netta tra contenuto e memoria utente.

### ADR-03 — Scheduler semplice in V1
**Decisione**: usare uno scheduler stile SM-2 semplificato, con dati sufficienti per upgrade futuro.  
**Ragione**: meno rischio, più trasparenza, più controllabilità.

### ADR-04 — Nessun auto-parser NLP in V1
**Decisione**: niente tokenizzazione o gloss automatico come dipendenza core.  
**Ragione**: qualità didattica più alta con segmentazione curata a mano su un corpus piccolo.

### ADR-05 — Statico per contenuto, dinamico per progresso
**Decisione**:
- lezioni e contenuto serviti il più possibile come contenuto statico/build-time
- overlay utente e review come dati dinamici/authenticated

**Ragione**: performance migliori e architettura più pulita.

### ADR-06 — Deck coverage come feature core
**Decisione**: calcolare e mostrare la “copertura” di ogni carta e deck sulla base degli item studiati/memorizzati.  
**Ragione**: è la metrica che collega studio e obiettivo reale.

---

## 8. Modello didattico

## 8.1 I tre strati del learning model

### Strato A — Textbook
Spiega i concetti con logica semplice, progressiva, visiva e contestualizzata.

### Strato B — Study items
Unità atomiche:
- kanji
- verbi
- nomi
- espressioni
- keyword di gioco
- pattern di frase

### Strato C — Review cards
Rappresentazioni memorizzabili degli study item:
- recognition card
- reading card
- meaning card
- in futuro: cloze / sentence card

---

## 8.2 Lesson design ELI5

Ogni lezione deve seguire questa struttura:

1. **Cosa impari**
2. **Spiegazione ELI5**
3. **Come lo riconosci sulla carta**
4. **Esempi reali presi dal gioco**
5. **Errori comuni / falsi amici**
6. **Micro-drill**
7. **Item collegati da mettere in review**
8. **Carte dei deck dove questo concetto appare**

Il tono della lezione deve essere:
- semplice ma non infantile
- progressivo
- concreto
- sempre ancorato a testo reale

---

## 8.3 Tipi di lesson

### L1 — Fondamenta del testo carta
- chi fa l’azione
- cosa viene scelto
- dove va la carta
- quando avviene l’effetto

### L2 — Zone e movimento
- 山札
- 手札
- 墓地
- バトルゾーン
- 置く / 出す / 戻す / 加える / 捨てる

### L3 — Timing e trigger
- 〜時
- その後
- 〜の終わりに
- 〜してもよい
- 〜なければ

### L4 — Numeri e limiti
- １枚 / １体
- 以上 / 以下 / 以外
- 合計
- 残り
- 好きな順序で

### L5 — Lessico di SD1
Forte enfasi su:
- 墓地
- 破壊
- アビス
- シビルカウント
- 離れる

### L6 — Lessico di SD2
Forte enfasi su:
- 進化
- 侵略
- 攻撃
- 重ねる
- ブレイク
- アンタップ

### L7 — Leggere una carta SD1 dall’inizio alla fine

### L8 — Leggere una carta SD2 dall’inizio alla fine

---

## 9. User journeys principali

## 9.1 Primo accesso
1. l’utente apre l’app
2. vede pagina di onboarding semplice
3. crea account / entra
4. sceglie preferenze iniziali:
   - furigana di default on/off
   - obiettivo giornaliero review
   - nuove carte/giorno
5. atterra sulla dashboard

## 9.2 Sessione textbook
1. apre una lezione
2. legge spiegazione ELI5
3. apre esempi reali
4. clicca item collegati
5. aggiunge item alla review queue
6. marca la lezione come completata

## 9.3 Sessione review
1. apre review
2. riceve carte dovute
3. prova a rispondere
4. valuta: Again / Hard / Good / Easy
5. scheduler aggiorna il prossimo intervallo
6. dashboard si aggiorna

## 9.4 Sessione “capire una carta”
1. apre una carta del deck
2. vede il testo giapponese
3. attiva/disattiva supporti
4. clicca i segmenti difficili
5. vede item e pattern richiesti
6. osserva la propria coverage score

---

## 10. Feature set dettagliato

## 10.1 Dashboard
La dashboard deve mostrare:

- review dovute oggi
- nuovi item consigliati
- lezioni suggerite
- streak
- retention 7d / 30d
- item totali per stato:
  - new
  - learning
  - reviewing
  - mature
- deck coverage:
  - SD1
  - SD2
- ultime carte diventate “leggibili”

## 10.2 Textbook
Funzioni:
- indice lezioni
- progress bar per lezione
- componenti interattivi:
  - furigana toggle
  - reveal translation
  - breakdown per chunk
  - callout “attenzione”
  - box “riconoscilo in 2 secondi”
- link bidirezionali verso:
  - item page
  - card page
  - review queue

## 10.3 Item pages
Ogni item deve mostrare:
- giapponese
- lettura
- categoria
- spiegazione italiana
- uso specifico nel gioco
- esempi dal gioco
- pattern collegati
- carte dove appare
- stato memoria utente
- pulsante “aggiungi / rivedi”

## 10.4 Review
Funzioni minime:
- queue giornaliera
- sessione review
- grading
- storico risposte
- stato per item
- limite nuovi item/giorno
- requeue per item falliti

## 10.5 Card pages
Ogni carta deve mostrare:
- nome
- deck
- tipo
- testo giapponese
- lettura supportata
- segmentazione didattica
- traduzione/parafrasi italiana del senso
- item richiesti
- pattern richiesti
- coverage score
- “what to study next”

## 10.6 Deck coverage
Per ogni deck:
- numero di carte uniche
- quante hai già “coperte”
- copertura pesata
- top gap linguistici
- suggerimento automatico: “se studi questi 5 item, sblocchi altre 3 carte”

Questa è una feature distintiva e va trattata come core.

---

## 11. Content architecture

## 11.1 Regola fondamentale
Il file `.md` già creato è **materiale sorgente**, non formato runtime finale.

Non bisogna leggere quel markdown gigante direttamente in produzione.  
Bisogna trasformarlo in un set di file strutturati, con ID stabili.

## 11.2 Struttura contenuti proposta

```text
/content
  /lessons
    l01-how-card-japanese-works.mdx
    l02-zones-and-movement.mdx
    l03-timing-patterns.mdx
    ...
  /items
    kanji.json
    vocab.json
    patterns.json
    keywords.json
  /examples
    examples.json
  /cards
    dm25-sd1.json
    dm25-sd2.json
  /meta
    decks.json
    lesson-order.json
    content-version.json
```

## 11.3 Modelli dati contenuto

### `study item`
```json
{
  "id": "V-028",
  "kind": "verb",
  "jp": "破壊する",
  "reading": "はかいする",
  "it": "distruggere",
  "priority": "core",
  "explanation": "Verbo usato nel gioco per mandare una creatura o altro permanento fuori dal battle zone secondo l'effetto della carta.",
  "usageNotes": [
    "Spesso appare con un bersaglio esplicito",
    "È diverso da lasciare il battle zone in generale"
  ],
  "exampleIds": ["EX-0012"],
  "patternIds": ["P-001", "P-016"],
  "cardIds": ["CARD-SD1-004"],
  "lessonIds": ["L-03", "L-05"],
  "tags": ["sd1", "destruction", "core"]
}
```

### `example`
```json
{
  "id": "EX-0012",
  "jp": "相手のクリーチャーを1体、破壊する。",
  "reading": "あいての クリーチャーを 1たい、はかいする。",
  "it": "Distruggi 1 creatura dell'avversario.",
  "breakdown": [
    { "chunk": "相手の", "it": "dell'avversario" },
    { "chunk": "クリーチャーを1体", "it": "1 creatura" },
    { "chunk": "破壊する", "it": "distruggi" }
  ],
  "sourceCardId": "CARD-SD1-004",
  "sourceUrl": "https://dm.takaratomy.co.jp/..."
}
```

### `card`
```json
{
  "id": "CARD-SD1-004",
  "deckId": "DM25-SD1",
  "name": "ハンマ＝ダンマ",
  "nameReading": "はんま＝だんま",
  "kind": "creature",
  "officialUrl": "https://dm.takaratomy.co.jp/...",
  "jpText": [
    "（testo carta qui segmentato o a blocchi）"
  ],
  "itemIds": ["K-019", "K-020", "V-028", "P-001", "P-016"],
  "lessonIds": ["L-03", "L-05"],
  "quickParaphraseIt": "Quando entra, fa un effetto di rimozione ..."
}
```

### `lesson frontmatter`
```mdx
---
id: L-03
title: Timing e trigger
slug: timing-e-trigger
summary: Capire quando un effetto si attiva.
itemIds:
  - P-001
  - P-002
  - P-008
  - P-011
cardIds:
  - CARD-SD1-004
  - CARD-SD2-003
---
```

## 11.4 Convenzioni di ID
- `K-001` = kanji
- `V-001` = vocab / verbo / nome / aggettivo
- `P-001` = pattern
- `KW-001` = keyword di gioco se vuoi separarle
- `EX-0001` = example
- `L-01` = lesson
- `CARD-SD1-001` = card locale nell’app
- `DECK-SD1` / `DECK-SD2` = deck

Regola: **gli ID non cambiano mai** dopo la pubblicazione.

## 11.5 Pipeline di migrazione contenuto
1. congelare il markdown sorgente esistente
2. scrivere script di estrazione iniziale
3. generare JSON scaffold
4. revisionare a mano
5. aggiungere link tra item/example/card/lesson
6. validare tutto in CI

Non fare parsing “magico” in runtime.

---


## 11.6 Regola sui materiali ufficiali
Usare:
- testo ed esempi strettamente necessari per finalità di studio
- link ufficiali alle carte e alle fonti
- nomi, frasi e riferimenti contestuali

Evitare in V1:
- hosting di scansioni o immagini complete delle carte se non hai certezza dei diritti
- scraping massivo non necessario
- asset non indispensabili

Meglio usare contenuto testuale curato e linkare la fonte ufficiale.

## 12. Data architecture

## 12.1 Filosofia
Nel DB devono entrare:
- identità utente
- impostazioni
- progresso didattico
- progresso mnemonico
- eventi review

Il contenuto primario resta nel repo.

## 12.2 Tabelle principali

### `profiles`
- `user_id` UUID PK, reference `auth.users.id`
- `display_name`
- `created_at`
- `updated_at`

### `user_settings`
- `user_id` UUID PK
- `ui_language` text default `it`
- `furigana_default` boolean
- `daily_new_limit` integer
- `daily_review_goal` integer
- `timezone` text
- `created_at`
- `updated_at`

### `lesson_progress`
- `user_id`
- `lesson_id`
- `status` (`not_started`, `in_progress`, `completed`)
- `progress_percent`
- `last_opened_at`
- `completed_at`
- PK (`user_id`, `lesson_id`)

### `user_item_progress`
- `user_id`
- `item_id`
- `state` (`new`, `learning`, `review`, `relearning`, `mature`)
- `due_at`
- `last_reviewed_at`
- `interval_days`
- `ease_factor`
- `reps`
- `lapses`
- `streak`
- `mastery_score`
- `last_rating`
- `content_version`
- `created_at`
- `updated_at`
- PK (`user_id`, `item_id`)

### `review_sessions`
- `id`
- `user_id`
- `mode` (`daily`, `lesson_boost`, `cram`)
- `started_at`
- `ended_at`
- `items_seen`
- `again_count`
- `hard_count`
- `good_count`
- `easy_count`

### `review_events`
- `id`
- `session_id`
- `user_id`
- `item_id`
- `rating`
- `state_before`
- `state_after`
- `interval_before`
- `interval_after`
- `due_before`
- `due_after`
- `response_ms`
- `created_at`

### `bookmarks`
- `user_id`
- `entity_type` (`lesson`, `item`, `card`)
- `entity_id`
- `created_at`

### `daily_stats_cache` (opzionale)
- `user_id`
- `date`
- `reviews_done`
- `new_items_learned`
- `lessons_completed`
- `retention_estimate`
- `deck_sd1_coverage`
- `deck_sd2_coverage`

---

## 13. Scheduler / review engine

## 13.1 Obiettivo
Non serve partire con l’algoritmo “più sofisticato del mondo”.  
Serve un algoritmo:
- chiaro
- prevedibile
- facile da debuggare
- abbastanza buono per imparare davvero

## 13.2 Strategia consigliata in V1
Usare uno scheduler semplice, tipo SM-2 semplificato:

### Stati
- `new`
- `learning`
- `review`
- `relearning`
- `mature`

### Rating possibili
- `Again`
- `Hard`
- `Good`
- `Easy`

### Prime regole
- primo contatto: entra in `learning`
- errore: ritorna vicino nel tempo
- successo ripetuto: aumenta intervallo
- molti errori: abbassa ease e mastery

## 13.3 Dati da salvare
Anche se la logica è semplice, salvare dati abbastanza ricchi da poter fare upgrade futuro:
- ease factor
- reps
- lapses
- interval
- rating history
- content version

## 13.4 Separare scheduler da UI
Lo scheduler deve vivere in una cartella dominio dedicata, ad esempio:

```text
/src/domain/review
  scheduler.ts
  transitions.ts
  scoring.ts
  types.ts
  queries.ts
```

In questo modo, se in futuro si passa a FSRS o altro, la UI non si rompe.

---

## 14. Mastery score e deck coverage

## 14.1 Perché servono due metriche
L’utente vuole sapere:
1. cosa ricorda
2. quanto ormai capisce i due deck

Queste non sono la stessa cosa.

## 14.2 Mastery score item
Proposta V1:
- range 0–100
- derivato da:
  - stato review
  - intervallo attuale
  - recency
  - lapses
  - streak

Esempio qualitativo:
- mai visto: 0
- learning: 20–40
- review giovane: 50–70
- matura stabile: 80–95
- mastered: 95–100

## 14.3 Peso degli item
Per la coverage:
- `core` = 3
- `important` = 2
- `nice` = 1

## 14.4 Formula coverage carta
```text
coverage(card) =
  somma(peso_item * mastery_score_item) / somma(peso_item * 100)
```

## 14.5 Formula coverage deck
Media pesata delle coverage delle carte uniche del deck.

## 14.6 Insight pratico
La UI deve poter dire:
- “Ti manca poco per capire questa carta”
- “Studia questi 4 item per sbloccare 2 nuove carte”
- “Il tuo collo di bottiglia non è il lessico SD2, ma i pattern di timing”

Questa parte è molto importante: trasforma lo studio in strategia.

---

## 15. Frontend architecture

## 15.1 Route map proposta

```text
/
 /login
 /dashboard
 /lessons
 /lessons/[slug]
 /items
 /items/[id]
 /cards
 /cards/[id]
 /decks
 /decks/dm25-sd1
 /decks/dm25-sd2
 /review
 /review/session
 /settings
```

## 15.2 Scelta rendering

### Statico o semi-statico
- landing
- deck pages
- lesson pages
- item pages
- card pages pubbliche / contenuto

### Dinamico autenticato
- dashboard
- review
- progress overlay
- settings
- bookmarks

## 15.3 Componenti principali
- `LessonLayout`
- `LessonStep`
- `FuriganaToggle`
- `SentenceBreakdown`
- `RevealTranslation`
- `ItemBadge`
- `CardCoverageBar`
- `DeckCoveragePanel`
- `ReviewCard`
- `ReviewControls`
- `MasteryPill`
- `RelatedItemsList`

## 15.4 Design system minimo
Basta un design system leggero, non serve over-engineering.  
Obiettivi:
- leggibilità alta
- focus sul testo giapponese
- ottimo su mobile
- zero distrazioni

---

## 16. Backend architecture

## 16.1 Next.js come BFF
Next.js supporta esplicitamente il pattern Backend for Frontend tramite Route Handlers e logica server-side. Questo è perfetto per una webapp come questa, dove frontend e backend applicativo devono restare vicini. [R7]

## 16.2 Quando usare Server Actions
Usarle per:
- completare una lezione
- cambiare una preferenza
- bookmark
- cambiare furigana default
- start rapido di una review lesson-specific

## 16.3 Quando usare Route Handlers
Usarli per:
- start review session
- submit grade
- fetch next review card
- analytics events
- eventuali integrazioni future
- webhook

## 16.4 Modulo dati
Organizzare il codice così:

```text
/src/lib/supabase
  browser.ts
  server.ts
  middleware.ts

/src/domain
  /content
  /review
  /progress
  /coverage
  /lessons
```

---

## 17. Security model

## 17.1 Auth
Supabase Auth offre integrazione con Next.js e supporta flussi SSR con cookie. [R8] [R9]

## 17.2 RLS
RLS va abilitato su tutte le tabelle utente. Supabase la presenta come difesa “defense in depth” e la integra naturalmente con Auth. [R10]

## 17.3 Regola non negoziabile
Mai esporre `service_role` nel browser.  
La documentazione Supabase è esplicita: le API admin richiedono `service_role` e vanno usate solo su server trusted. [R12]

## 17.4 Politiche base
Ogni tabella user-specific deve permettere accesso solo all’owner:
- select own rows
- insert own rows
- update own rows
- delete own rows where applicable

---

## 18. Repo structure consigliata

```text
/
  app/
  content/
  public/
  src/
    components/
    domain/
      content/
      coverage/
      lessons/
      progress/
      review/
    lib/
      supabase/
      utils/
    styles/
    types/
  supabase/
    migrations/
    seed/
  scripts/
    migrate-study-guide.ts
    validate-content.ts
    build-content-index.ts
  tests/
    e2e/
    unit/
```

---

## 19. Content validation

Deve esistere uno script CI che controlli:

- nessun ID duplicato
- nessun link rotto tra item/example/card/lesson
- ogni example abbia source card
- ogni item abbia almeno un example oppure una lesson
- ogni card abbia itemIds non vuoti
- ogni lesson abbia itemIds validi
- nessuna lezione pubblicata senza summary e outcome

Questo riduce tantissimo la fragilità.

---

## 20. Strategia di implementazione

## Fase 0 — Foundation
Obiettivo: repo pronto, auth pronta, contenuto statico di prova, DB pronto.

Deliverable:
- bootstrap app
- Supabase project
- auth base
- layout base
- routing base
- CI base
- migrazione iniziale DB

## Fase 1 — Content system
Obiettivo: passare dal file `.md` attuale a contenuto strutturato.

Deliverable:
- parser/scaffold script
- schema file
- lesson pages base
- item pages
- card pages
- validazione contenuto
- seed dati deck/carte/example

## Fase 2 — Review engine
Obiettivo: review end-to-end con tracking reale.

Deliverable:
- scheduler
- queue builder
- session start / answer / finish
- user_item_progress
- review_events
- basic dashboard metrics

## Fase 3 — Deck coverage
Obiettivo: rendere visibile il collegamento tra studio e carte.

Deliverable:
- coverage calculator
- deck pages
- per-card readiness
- suggestions “study next”

## Fase 4 — UX polishing
Obiettivo: trasformare un prototipo in una learning app piacevole.

Deliverable:
- mobile polish
- fast navigation
- loading states
- empty states
- keyboard shortcuts review
- better dashboards

## Fase 5 — QA & hardening
Obiettivo: stabilità.

Deliverable:
- test coverage critica
- e2e
- RLS verification
- deploy checklist
- perf review

---

## 21. Workstream agentici

Qui sotto trovi i workstream ideali da dare ad agenti diversi, con dipendenze chiare.

## Agent A — Foundation / platform
### Missione
Creare lo scheletro tecnico del progetto.

### Output
- Next.js app iniziale
- auth wiring
- layout globale
- supabase client browser/server
- route skeleton
- env management
- README setup

### Dipende da
Nessuno.

### Prompt da mandare a Codex
```text
Sei l'agent foundation per una webapp di studio giapponese verticale su Duel Masters.

Stack obbligatorio:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- SSR auth con @supabase/ssr

Obiettivi:
1. Bootstrap del progetto.
2. Setup auth.
3. Setup cartelle dominio.
4. Layout base e route skeleton.
5. Utility Supabase per browser e server.
6. README di setup locale.

Vincoli:
- niente ORM in questa fase
- niente over-engineering
- codice pulito e commentato solo dove serve
- preparare la struttura per contenuto in /content e migrations in /supabase/migrations

Deliverable minimi:
- app avviabile
- login/logout funzionanti
- dashboard placeholder protetta
- routes placeholders: lessons, items, cards, review, settings
- middleware/auth guard
- file .env.example
- README setup

Criteri di accettazione:
- npm/pnpm install e run funzionano
- utente anonimo non può aprire dashboard
- utente loggato sì
- struttura progetto coerente con App Router
- nessuna chiave sensibile nel client
```

## Agent B — Database / auth / policies
### Missione
Costruire schema DB, RLS, migrations e typed integration.

### Output
- SQL migrations
- policy RLS
- tipi database
- helper query base
- seeds minimi

### Dipende da
Agent A.

### Prompt da mandare a Codex
```text
Sei l'agent database/security.

Contesto:
- contenuto didattico primario nel repo
- DB usato per auth, settings, progress, review, bookmarks
- backend Supabase Postgres con RLS

Progetta e implementa:
1. Tabelle: profiles, user_settings, lesson_progress, user_item_progress, review_sessions, review_events, bookmarks.
2. Indici sensati.
3. Trigger/updated_at dove utili.
4. Policy RLS per owner-only access.
5. SQL migrations in supabase/migrations.
6. File di documentazione schema.
7. Script o istruzioni per generare database.types.ts.

Vincoli:
- niente service_role nel browser
- schema pensato per estendere lo scheduler in futuro
- item_id e lesson_id come string stable IDs dal content repo

Criteri di accettazione:
- migrazioni idempotenti e leggibili
- policy RLS attive su tutte le tabelle user-specific
- utente A non vede dati utente B
- schema supporta review engine e dashboard
```

## Agent C — Content migration & content engine
### Missione
Trasformare il markdown sorgente in contenuto strutturato e renderizzabile.

### Output
- schema contenuto
- script migrazione/scaffold
- validator
- content index
- demo di 2 lezioni complete
- card pages + item pages con dati reali

### Dipende da
Agent A.

### Prompt da mandare a Codex
```text
Sei l'agent content system.

Input:
- esiste un file markdown sorgente con kanji, vocab, pattern, esempi e deck coverage per DM25-SD1 e DM25-SD2
- il contenuto finale NON deve essere servito come markdown grezzo unico
- deve essere migrato in una struttura /content versionata

Implementa:
1. Struttura /content con lessons, items, examples, cards, meta.
2. Tipi TypeScript per i content model.
3. Script scripts/migrate-study-guide.ts per generare scaffold strutturato dal markdown sorgente.
4. Script scripts/validate-content.ts.
5. Loader content lato app.
6. Pagine item e card con rendering reale da contenuto.
7. Due lezioni MDX complete come riferimento.

Vincoli:
- ID stabili
- nessun parsing runtime fragile
- validazione forte delle relazioni
- lezione con componenti didattici: furigana toggle, sentence breakdown, related items

Criteri di accettazione:
- contenuto builda senza errori
- item pages e card pages mostrano dati reali
- validator fallisce se mancano link o ci sono ID duplicati
```

## Agent D — Review engine
### Missione
Implementare il dominio review end-to-end.

### Output
- scheduler
- queue builder
- review session UI
- route handlers o server actions necessari
- persistenza eventi
- test di dominio

### Dipende da
Agent A e B. Beneficia di C.

### Prompt da mandare a Codex
```text
Sei l'agent review engine.

Costruisci il dominio review per una learning app verticale.
Serve una V1 robusta, non un algoritmo sperimentale.

Implementa:
1. Tipi review domain.
2. Scheduler semplice stile SM-2.
3. Queue generation.
4. startReviewSession.
5. submitReviewGrade.
6. next due item selection.
7. Persistenza su user_item_progress, review_sessions, review_events.
8. UI review minimale ma usabile.
9. Unit test sullo scheduler e sulle transizioni.

Rating supportati:
- Again
- Hard
- Good
- Easy

Vincoli:
- separare dominio review dalla UI
- niente logica review sparsa dentro componenti React
- facile upgrade futuro a scheduler diverso
- error handling chiaro

Criteri di accettazione:
- sessione review completa funziona
- i voti aggiornano correttamente lo stato
- i dati persistono e riappaiono alla riapertura
- i test coprono casi base, lapse e relearning
```

## Agent E — Dashboard, mastery, coverage
### Missione
Rendere visibile il progresso vero.

### Output
- dashboard reale
- mastery score
- deck coverage
- suggestions “study next”
- progress widgets

### Dipende da
Agent B, C, D.

### Prompt da mandare a Codex
```text
Sei l'agent progress/coverage.

Obiettivo:
trasformare dati review + content graph in segnali comprensibili per l'utente.

Implementa:
1. mastery_score per item
2. coverage score per card
3. coverage score per deck
4. dashboard con:
   - due today
   - new today
   - streak
   - retention estimate
   - SD1 coverage
   - SD2 coverage
5. pannello “study next”
6. card page con coverage bar e linked gaps

Vincoli:
- la coverage deve dipendere da itemIds delle carte
- supportare pesi core/important/nice
- spiegare sempre perché una carta non è ancora coperta

Criteri di accettazione:
- dashboard non è fake
- i numeri cambiano davvero dopo review
- aprendo una card si vedono gli item mancanti
```

## Agent F — QA, test, CI, hardening
### Missione
Rendere il progetto verificabile e stabile.

### Output
- test setup
- test critical paths
- CI workflow
- lint/format/typecheck
- smoke tests auth/review/content

### Dipende da
Tutti gli altri.

### Prompt da mandare a Codex
```text
Sei l'agent QA/hardening.

Implementa:
1. setup Vitest
2. setup Playwright
3. test unit per review domain
4. test e2e per auth, lesson open, item page, review flow, dashboard
5. workflow CI con lint, typecheck, unit test, e2e o smoke
6. checklist regressioni

Vincoli:
- priorità ai path critici
- niente test fragili
- test dati seed realistici

Criteri di accettazione:
- una PR rotta viene bloccata
- i flow core hanno almeno uno smoke test affidabile
```

---

## 22. Ordine consigliato dei lavori

Ordine reale consigliato:

1. Agent A — Foundation
2. Agent B — Database/Auth/Policies
3. Agent C — Content System
4. Agent D — Review Engine
5. Agent E — Dashboard/Coverage
6. Agent F — QA/Hardening

### Handoff obbligatori
- A consegna struttura e auth a B/C/D
- B consegna schema e policy a D/E/F
- C consegna content graph a E
- D consegna eventi e progress state a E
- F testa tutto in coda ma va coinvolto presto per setup

---

## 23. Accettazione funzionale per V1

La V1 è accettata solo se passa questa checklist:

### Auth
- login funziona
- logout funziona
- route protette funzionano

### Content
- almeno 8 lezioni vere
- almeno 1 item page per ogni tipo di item
- tutte le carte uniche dei 2 deck hanno pagina propria
- ogni card page ha itemIds collegati

### Review
- review queue vera
- grading vero
- persistenza vera
- storico review vero

### Progress
- dashboard mostra numeri reali
- mastery score cambia
- coverage deck cambia
- “study next” suggerisce item reali

### Quality
- build green
- test core green
- RLS verificata
- mobile web accettabile

---

## 24. UI/UX requirements non negoziabili

1. Il giapponese deve essere leggibilissimo.
2. La UI non deve sembrare una dashboard enterprise.
3. Mobile first, pur restando ottima anche desktop.
4. Ogni pagina deve dire chiaramente:
   - cosa sto guardando
   - cosa ho già capito
   - cosa mi manca
   - cosa fare adesso

### Micro-UX importanti
- furigana toggle persistente
- pulsante rapido “manda in review”
- breadcrumb chiaro
- shortcut review:
  - 1 Again
  - 2 Hard
  - 3 Good
  - 4 Easy
- empty states utili, non generici

---

## 25. Analytics e osservabilità

## Eventi prodotto da tracciare
- lesson_started
- lesson_completed
- item_opened
- item_bookmarked
- review_session_started
- review_graded
- review_session_completed
- card_opened
- deck_opened
- suggestion_clicked

## KPI utili
- first lesson completion
- first review completion
- 7-day retention
- items matured
- deck coverage delta/settimana
- tempo medio per completare una sessione review
- top lessons che sbloccano più coverage

Per V1 basta analytics semplici.  
Non serve una data warehouse.

---

## 26. Performance e caching

### Static/content
- lessons, items, card content: prerender o cache forte dove possibile

### Dynamic/user
- dashboard, review, settings: no-store o strategia dinamica

### Regola
Non mescolare troppo presto contenuto statico e stato utente nello stesso fetch pesante.

---

## 27. Deploy & ambienti

## Ambienti
- local
- preview/staging
- production

## Local dev
Supabase documenta chiaramente il flusso locale con CLI, stack locale, migrations e type generation. [R13] [R14]

## CI
Usare:
- lint
- typecheck
- unit tests
- e2e o smoke
- validate-content
- verify migrations

## Deploy target
Vercel + Supabase è una scelta molto naturale per questo progetto, ma il masterplan non dipende strettamente da Vercel.

---

## 28. Tooling agentico opzionale ma molto utile

Se userai davvero più agenti Codex, ha senso preparare due cose:

### Next.js DevTools MCP
Next.js documenta supporto MCP per agenti in Next.js 16+, per dare agli agenti accesso contestuale allo stato dell’app durante il debug. [R15]

### Supabase MCP
Supabase offre MCP, ma la documentazione avverte di non collegarlo ai dati di produzione e consiglia scope/feature restrictions. [R16]

## Regola
Usare MCP solo su ambienti local/dev/staging.  
Mai con dati production reali.

---

## 29. PWA e offline

Non metterlo in V1 core.  
Però conviene lasciare il progetto pronto per una V1.5, perché Next.js documenta anche una guida PWA ufficiale. [R6]

La roadmap giusta è:
- prima contenuto + review + coverage
- poi sessioni offline / app-like experience

---

## 30. Rischi principali e mitigazioni

## Rischio 1 — Contenuto non abbastanza strutturato
**Problema**: il markdown sorgente è ricco ma non è un formato applicativo.  
**Mitigazione**: content schema, IDs stabili, validator, review manuale.

## Rischio 2 — Review engine troppo complicato troppo presto
**Problema**: si perde tempo nell’algoritmo.  
**Mitigazione**: V1 semplice, dominio isolato.

## Rischio 3 — Duplicazione tra textbook e flashcard
**Problema**: due versioni della stessa conoscenza.  
**Mitigazione**: study item come unità canonica.

## Rischio 4 — Dashboard cosmetica
**Problema**: belle metriche ma non utili.  
**Mitigazione**: tutto deve legarsi a item, deck e carte reali.

## Rischio 5 — Sicurezza auth/permessi sottovalutata
**Problema**: leak dati utente.  
**Mitigazione**: RLS forte, no service_role nel client, test policy.

## Rischio 6 — Over-engineering UI
**Problema**: si perde il focus didattico.  
**Mitigazione**: design minimale, leggibilità al centro.

---

## 31. Definition of done finale

Il prodotto è “done” per V1 quando:

- puoi aprire l’app, loggarti e iniziare a studiare
- puoi leggere lezioni ELI5 reali
- puoi esplorare item e carte reali dei tuoi deck
- puoi fare review con tracking affidabile
- puoi vedere quali parti dei deck ormai capisci
- il codice è abbastanza pulito da poter passare a V1.5 senza rifondazione

---

## 32. Raccomandazione finale

La scelta giusta non è costruire “prima le flashcard e poi vedere”.

La sequenza giusta è:

1. **content model**
2. **textbook**
3. **review engine**
4. **coverage**
5. **ottimizzazione UX**

Per questa app il contenuto e il grafo concettuale sono il vero motore.  
Se questo pezzo viene costruito bene, tutto il resto — review, dashboard, deck readiness — diventa coerente.

---

## 33. Riferimenti tecnici ufficiali

- [R1] Next.js App Router docs: https://nextjs.org/docs/app
- [R2] Next.js MDX guide: https://nextjs.org/docs/app/guides/mdx
- [R3] Next.js Forms / Server Actions: https://nextjs.org/docs/app/guides/forms
- [R4] Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- [R5] Next.js Testing guides: https://nextjs.org/docs/app/guides/testing
- [R6] Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- [R7] Next.js Backend for Frontend guide: https://nextjs.org/docs/app/guides/backend-for-frontend
- [R8] Supabase Next.js Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- [R9] Supabase SSR auth guide: https://supabase.com/docs/guides/auth/server-side
- [R10] Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- [R11] Supabase JavaScript client: https://supabase.com/docs/reference/javascript/introduction
- [R12] Supabase Admin API / service_role warning: https://supabase.com/docs/reference/javascript/admin-api
- [R13] Supabase local development overview: https://supabase.com/docs/guides/local-development/overview
- [R14] Supabase generating TypeScript types: https://supabase.com/docs/guides/api/rest/generating-types
- [R15] Next.js MCP guide: https://nextjs.org/docs/app/guides/mcp
- [R16] Supabase MCP guide: https://supabase.com/docs/guides/getting-started/mcp