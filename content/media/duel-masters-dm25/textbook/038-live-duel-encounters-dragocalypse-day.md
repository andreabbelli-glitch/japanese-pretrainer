---
id: lesson-duel-masters-dm25-live-duel-encounters-dragocalypse-day
media_id: media-duel-masters-dm25
slug: live-duel-encounters-dragocalypse-day
title: Carte incontrate - Dragocalypse Day
order: 66
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, multiplayer, spell, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-crash-hadou,
    lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
  ]
summary: >-
  Dragocalypse Day: stato iniziale con due o più avversari, valore di joutai e
  catena hajimatte ite che collega il setup iniziale all'S-Trigger negli scudi.
---

# [ドラゴカリプス・デイ](term:term-dragocalypse-day)

:::image
src: assets/cards/live-duel/dragocalypse-day.webp
alt: "Dragocalypse Day card."
caption: >-
  [ドラゴカリプス・デイ](term:term-dragocalypse-day)。
  [{{呪文|じゅもん}}](term:term-spell) / ドラゴン di fuoco. Riga centrale: in
  partite iniziate con
  `futari ijou no aite ga iru joutai` la carta può ottenere
  [S・トリガー](term:term-s-trigger) nello
  [シールドゾーン](term:term-shield-zone), poi distrugge tutti i non-Dragon.
:::

## Keyword presenti sulla carta

- [S・トリガー](term:term-s-trigger)

La keyword è già coperta nella keyword bank. Qui il punto più utile per il
giapponese non è la keyword in sé, ma come la carta costruisce una condizione
composta: prima fissa il setup iniziale della partita, poi controlla la zona
attuale della carta, e solo dopo concede `S・トリガー`.

## Effetti da leggere

:::example_sentence
jp: >-
  このゲームが{{2人以上|ふたりいじょう}}の
  [{{相手|あいて}}](term:term-opponent)がいる
  [{{状態|じょうたい}}](term:term-state)で
  [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite)、この
  [{{呪文|じゅもん}}](term:term-spell)が
  [シールドゾーン](term:term-shield-zone)にあれば、この
  [{{呪文|じゅもん}}](term:term-spell)に「
  [S・トリガー](term:term-s-trigger)」を
  [{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Se la partita è iniziata in una situazione con due o più avversari e questa
  magia si trova nello shield zone, a questa magia viene conferito S-Trigger.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  ドラゴンではないクリーチャーを
  [すべて](term:term-subete)
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Distruggi tutte le creature che non sono Draghi.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 2人以上の相手がいる状態

- [{{状態|じょうたい}}](term:term-state) è un nome: `stato`, `condizione`,
  `situazione`.
- Il pezzo davanti, `{{2人以上|ふたりいじょう}}の{{相手|あいて}}がいる`, modifica
  proprio `状態`: non sono due frasi separate, ma un unico gruppo nominale,
  `lo stato in cui ci sono due o più avversari`.
- Qui `状態` è molto utile perché impacchetta una configurazione del tavolo come
  se fosse una cosa sola. La carta non dice solo `se ci sono molti avversari`;
  dice `se il gioco è partito in quello stato`.
- Il `で` dopo `状態` non indica un luogo. Qui marca la circostanza dentro cui
  si è verificato `{{始|はじ}}まる`: `iniziare in quella condizione`.

### 2. 始まっていて

- Il verbo base è `{{始|はじ}}まる`, `cominciare / iniziare`.
- `{{始|はじ}}まっている` non va letto come un progressivo tipo `sta iniziando in
  questo momento`. In questa carta vale piuttosto come stato risultante:
  `la partita è iniziata così, e questo fatto resta vero come premessa`.
- La forma [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) collega quel
  fatto iniziale alla condizione successiva. In italiano la resa più naturale è
  spesso `essendo iniziata così` oppure `se la partita è partita in quello
  stato`.
- Quindi la carta non controlla il numero attuale degli avversari in modo
  generico: richiama proprio il setup con cui la partita è cominciata e lo usa
  come filtro per la keyword successiva.

### 3. この呪文がシールドゾーンにあれば

- Dopo il setup iniziale, la carta aggiunge un secondo controllo separato:
  `questa magia si trova nello shield zone`.
- `あれば` guarda una condizione valida adesso, nel momento in cui l'effetto va
  letto.
- Il giapponese della carta mette quindi insieme due piani diversi:
  `come la partita è iniziata` + `dove si trova ora la carta`.

### 4. ドラゴンではないクリーチャーをすべて破壊する

- La seconda riga è molto più secca: costruisce prima il filtro
  `ドラゴンではないクリーチャー`, poi lo estende all'intero gruppo con
  [すべて](term:term-subete).
- Per questo il valore operativo di `すべて` è importante: non scegli un
  bersaglio, cancelli tutto ciò che passa quel filtro.

## Lessico utile in questa carta

- [ドラゴカリプス・デイ](term:term-dragocalypse-day) va associato subito a due
  idee: condizione multiplayer letta nel setup iniziale e rimozione totale dei
  non-Dragon.
- [{{状態|じょうたい}}](term:term-state) è il punto più trasferibile in
  giapponese generale: trasforma una situazione complessa in un nome che puoi
  poi agganciare ad altri verbi.
- [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) è prezioso perché
  mostra bene come un fatto già realizzato possa restare rilevante nel testo
  successivo.
