---
id: lesson-duel-masters-dm25-live-duel-encounters-garchainsaw-dragon
media_id: media-duel-masters-dm25
slug: live-duel-encounters-garchainsaw-dragon
title: Carte incontrate - Garchainsaw Dragon
order: 60
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, armored-dragon, battle-trigger, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Garchainsaw Dragon: ingresso per ogni avversario, limite una volta per turno
  e trigger del primo break degli scudi.
---

# ガルチェンソ・ドラゴン

:::image
src: assets/cards/live-duel/garchainsaw-dragon.png
alt: "Garchainsaw Dragon card."
caption: >-
  ガルチェンソ・ドラゴン。{{文明|ぶんめい}}: {{火|ひ}} / {{自然|しぜん}}。
  {{種族|しゅぞく}}: アーマード・ドラゴン。
  Riga centrale: ingresso con [{{相手|あいて}}](grammar:grammar-aite-hitori-nitsuki){{1人|ひとり}}につき,
  limite [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido) e primo
  trigger sul break degli scudi con
  [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite)
  e [{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu).
:::

## Keyword presenti sulla carta

- [W・ブレイカー](term:term-w-breaker)

`W・ブレイカー` è già nella keyword bank. Qui il valore didattico sta nei
blocchi procedurali: `[{{相手|あいて}}](grammar:grammar-aite-hitori-nitsuki){{1人|ひとり}}につき`,
`[{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido)`,
`[{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite)`
e `[{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu)` dentro
`はじめて[{{相手|あいて}}](term:term-opponent)のシールドをブレイクした{{時|とき}}`.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}、
  [{{相手|あいて}}](term:term-opponent){{1人|ひとり}}につき、
  [{{自分|じぶん}}](term:term-self)の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{1枚目|いちまいめ}}をタップして[マナゾーン](term:term-mana-zone)に{{置|お}}く。
  その{{後|あと}}、[マナゾーン](term:term-mana-zone)からドラゴンを{{1枚|いちまい}}
  [{{手札|てふだ}}](term:term-hand)に{{戻|もど}}す。
translation_it: >-
  Quando questa creatura entra, per ogni avversario metti tappata nella mana
  zone la prima carta del tuo mazzo. Poi fai tornare in mano un Dragone dalla
  mana zone.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{各|かく}}ターンに{{一度|いちど}}、
  [{{自分|じぶん}}](term:term-self)のドラゴン・クリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}、
  [{{相手|あいて}}](term:term-opponent)のクリーチャーを{{1体|いったい}}{{選|えら}}んでもよい。
  その{{2体|にたい}}を[バトルさせる](term:term-battle-saseru)。
translation_it: >-
  Una volta per turno, quando entra una tua creatura Dragon, puoi scegliere una
  creatura avversaria. Quelle due combattono.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{各|かく}}ターン、
  はじめて[{{相手|あいて}}](term:term-opponent)のシールドをブレイクした{{時|とき}}、
  [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite)
  のシールドも[{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu)ブレイクする。
translation_it: >-
  Ogni turno, quando questa creatura rompe per la prima volta gli scudi di un
  avversario, rompe anche gli altri scudi di ogni altro avversario uno a uno.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. [{{相手|あいて}}](term:term-opponent){{1人|ひとり}}につき

- `[{{相手|あいて}}](term:term-opponent){{1人|ひとり}}につき` distribuisce la stessa
  azione su ogni avversario.
- In una partita normale spesso lo leggi come `per l'avversario`, ma il chunk
  resta valido anche se gli avversari sono più di uno.
- `{{1枚目|いちまいめ}}` indica proprio la prima carta del mazzo, non una carta
  qualsiasi fra quelle in cima.

### 2. [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido)

- `[{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido)` limita
  l'effetto a una sola risoluzione per turno.
- Il blocco governa la frase che segue fino al punto finale.
- `その{{2体|にたい}}` riprende la coppia appena scelta prima di
  `[バトルさせる](term:term-battle-saseru)`.

### 3. はじめて[{{相手|あいて}}](term:term-opponent)のシールドをブレイクした{{時|とき}}

- `はじめて[{{相手|あいて}}](term:term-opponent)のシールドをブレイクした
  {{時|とき}}` restringe l'effetto al primo break del turno, non a ogni break.
- `{{時|とき}}` apre un trigger d'evento: il testo si accende nel momento della
  prima rottura.
- `[{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite)`
  esclude l'avversario già colpito e redistribuisce il risultato sui restanti.
- `[{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu)` chiarisce che il break extra
  procede uno scudo alla volta per ciascun avversario rimasto, non come una
  rottura indistinta in blocco.

## Lessico utile in questa carta

- `[{{山札|やまふだ}}](term:term-deck)`, `[マナゾーン](term:term-mana-zone)` e
  `[{{手札|てふだ}}](term:term-hand)` sono le tre zone che il primo effetto collega
  in sequenza.
- `[バトルさせる](term:term-battle-saseru)` è il chunk causativo già noto: non
  descrive un attacco normale, ma forza il battle fra due creature precise.
