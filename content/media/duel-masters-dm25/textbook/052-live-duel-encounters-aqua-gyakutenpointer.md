---
id: lesson-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
media_id: media-duel-masters-dm25
slug: live-duel-encounters-aqua-gyakutenpointer
title: Carte incontrate - Aqua Gyakutenpointer
order: 80
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, liquid-people, s-trigger, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-hanasaki-gelgranos,
    lesson-duel-masters-dm25-live-duel-encounters-infelstarge
  ]
summary: >-
  Aqua Gyakutenpointer: saidai e zutsu distribuiscono un massimo per giocatore,
  erabareta introduce una passiva relativa, e omotemuki ni shi concatena la
  rivelazione fino all'uscita di una creatura.
---

# アクア・ギャクテンポインター

:::image
src: assets/cards/live-duel/aqua-gyakutenpointer.jpg
alt: "Aqua Gyakutenpointer card."
caption: >-
  アクア・ギャクテンポインター。 Keyword:
  [S・トリガー](term:term-s-trigger) e [ブロッカー](term:term-blocker). La riga
  importante è lunga ma molto didattica: prima `{{最大|さいだい}}{{1体|いったい}}ずつ`
  distribuisce la scelta, poi `このようにして` restringe chi continua a
  risolvere, e infine `クリーチャーが{{出|で}}るまで{{表向|おもてむ}}きにし`
  mostra una catena con `し` che porta direttamente alla messa in campo della
  creatura rivelata.
:::

## Keyword presenti sulla carta

- [S・トリガー](term:term-s-trigger)
- [ブロッカー](term:term-blocker)

Qui però il vero valore della carta non è nelle keyword: è nella sintassi del
testo effetto. Le due difficoltà reali sono `{{選|えら}}ばれた`, che è una
passiva riferita al giocatore la cui creatura è stata scelta, e
`{{表向|おもてむ}}きにし`, dove `し` non è un finale sospeso vago ma una forma
connettiva che prepara il passo successivo `そのクリーチャーを{{出|だ}}す`.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが[{{召喚|しょうかん}}](term:term-summon)によって
  [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  [{{各|かく}}](term:term-kaku)プレイヤーの[クリーチャー](term:term-creature)を
  [{{最大|さいだい}}](term:term-saidai){{1体|いったい}}
  [ずつ](grammar:grammar-zutsu)[{{選|えら}}び](term:term-erabu)、
  [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi)の[{{山札|やまふだ}}](term:term-deck)の
  {{下|した}}に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando questa creatura entra tramite evocazione, scegli fino a una creatura
  per ciascun giocatore e mettila in fondo al mazzo del suo proprietario.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [このようにして](grammar:grammar-konoyounishite)
  [{{自身|じしん}}](term:term-jishin)の[クリーチャー](term:term-creature)が
  [{{選|えら}}ばれたプレイヤーは](grammar:grammar-erabareta-player)、
  [{{自身|じしん}}](term:term-jishin)の[{{山札|やまふだ}}](term:term-deck)の
  {{上|うえ}}から、[クリーチャー](term:term-creature)が
  [{{出|で}}る](term:term-deru)[まで](grammar:grammar-made)
  [{{表向|おもてむ}}きにし](grammar:grammar-deru-made-omotemuki-ni-shi)、その
  [クリーチャー](term:term-creature)を[{{出|だ}}す](term:term-dasu)。
translation_it: >-
  In questo modo, il giocatore la cui creatura è stata scelta gira carte a
  faccia in su dalla cima del proprio mazzo finché non esce una creatura, poi
  mette in campo quella creatura.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  その{{後|あと}}、そのプレイヤーは、
  [{{自身|じしん}}](term:term-jishin)の[{{山札|やまふだ}}](term:term-deck)をシャッフルする。
translation_it: >-
  Dopo di ciò, quel giocatore rimescola il proprio mazzo.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 最大1体ずつ選び

- [{{最大|さいだい}}](term:term-saidai) qui non vuol dire `il massimo` in
  astratto, ma `al massimo / fino a`.
- `{{1体|いったい}}` è il contatore per creature, mentre
  [ずつ](grammar:grammar-zutsu) distribuisce quel massimo su ogni giocatore.
- Quindi `{{最大|さいだい}}{{1体|いったい}}ずつ` non significa `scegline una in
  totale`: significa `per ciascun giocatore puoi sceglierne zero o una`.

### 2. このようにして

- [このようにして](grammar:grammar-konoyounishite) riprende la procedura appena
  completata, cioè la scelta e il ritorno in fondo al mazzo.
- Serve a restringere chi continua a risolvere l'effetto: non tutti i giocatori,
  ma solo quelli che in quel procedimento hanno visto scegliere una propria
  creatura.
- Una buona parafrasi mentale è: `in questo modo / in seguito a questa
  procedura`.

### 3. 自身のクリーチャーが選ばれたプレイヤーは

- Il pezzo difficile qui è `{{選|えら}}ばれた`: è il passivo di
  [{{選|えら}}ぶ](term:term-erabu), quindi `che è stata scelta`.
- `{{選|えら}}ばれた` modifica `プレイヤー` passando attraverso l'intero blocco
  `{{自身|じしん}}のクリーチャーが...`: il senso non è `il giocatore scelto`,
  ma `il giocatore la cui creatura è stata scelta`.
- [{{自身|じしん}}](term:term-jishin) resta ancorato a quel giocatore. Quindi
  la frase intera va letta come un'etichetta relativa molto compatta:
  `quanto ai giocatori per cui è stata scelta una propria creatura...`.

### 4. クリーチャーが出るまで表向きにし

- Qui [まで](grammar:grammar-made) non marca un numero massimo ma il punto di
  arresto della procedura: continui finché non compare una creatura.
- `{{表向|おもてむ}}きにし` viene da `{{表向|おもてむ}}きにする` e qui usa la
  forma in `し` per concatenare il passo successivo.
- Quindi non va letto come uno `shi` sospeso del tipo `e poi, sai...`: il
  senso operativo è `gira a faccia in su ..., e poi quella creatura la metti in
  campo`.

### 5. Come tenere insieme la seconda frase

- Prima identifichi quali giocatori proseguono:
  `{{自身|じしん}}のクリーチャーが{{選|えら}}ばれたプレイヤー`.
- Poi leggi la procedura dal loro mazzo:
  `クリーチャーが{{出|で}}るまで{{表向|おもてむ}}きにし`.
- Infine chiudi con l'azione risolutiva:
  `そのクリーチャーを{{出|だ}}す`.

Se la leggi a blocchi, la frase smette di sembrare lunga e diventa una sequenza
molto meccanica: scegli, controlla chi è stato colpito, gira carte finché trovi
una creatura, poi mettila in campo.

## Lessico utile in questa carta

- [{{最大|さいだい}}](term:term-saidai) qui vale come `al massimo`, non come
  sostantivo astratto.
- [このようにして](grammar:grammar-konoyounishite) collega la seconda metà
  dell'effetto alla procedura appena eseguita.
- `{{選|えら}}ばれたプレイヤー` è un ottimo chunk per fissare la passiva
  relativa applicata a una persona.
- `クリーチャーが{{出|で}}るまで{{表向|おもてむ}}きにし` va letto come una
  procedura continua, non come una frase interrotta.
