---
id: lesson-duel-masters-dm25-live-duel-encounters-bad-brand-first
media_id: media-duel-masters-dm25
slug: live-duel-encounters-bad-brand-first
title: Carte incontrate - Bad Brand 1st
order: 53
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, beat-jockey, topdeck, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-dama-vaishingu
  ]
summary: >-
  Bad Brand 1st: trigger di attacco, rivelazione della prima carta del mazzo e
  bivio tra ingresso diretto di un Beat Jockey non evoluzione o fondo del
  mazzo.
---

# [“{{罰怒|バッド}}”ブランド 1st](term:term-bad-brand-first)

:::image
src: assets/cards/live-duel/bad-brand-first.png
alt: "Bad Brand 1st card."
caption: >-
  [“{{罰怒|バッド}}”ブランド 1st](term:term-bad-brand-first)。 Razza:
  [ビートジョッキー](term:term-beat-jockey)。 Riga centrale: quando attacca,
  rivela la prima carta del mazzo; se è un Beat Jockey non evoluzione la mette
  subito nel battle zone, altrimenti la manda in fondo al mazzo.
:::

## Keyword presenti sulla carta

- [{{B・A・D 2|びーえーでぃーつー}}](term:term-b-a-d-two)
- [スピードアタッカー](term:term-speed-attacker)
- [W・ブレイカー](term:term-w-breaker)

Le keyword stanno già nella keyword bank. Qui conviene concentrarsi sul trigger
di attacco e sul doppio controllo che decide il destino della carta rivelata.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが[{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を
  [{{表向|おもてむ}}き](term:term-face-up)にする。
translation_it: >-
  Quando questa creatura attacca, metti scoperta la prima carta del tuo mazzo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  それが[{{進化|しんか}}](term:term-evolution)でない
  [ビートジョッキー](term:term-beat-jockey)なら
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}し](term:term-dasu)、
  [それ{{以外|いがい}}なら](grammar:grammar-soreigai-nara){{自分|じぶん}}の
  [{{山札|やまふだ}}](term:term-deck)の{{一番下|いちばんした}}に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Se quella carta è un Beat Jockey non evoluzione, la metti nel battle zone;
  altrimenti la metti sul fondo del tuo mazzo.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーが攻撃する時

- Il trigger qui parte dall'attacco, non dall'ingresso nel battle zone.
- [{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki) riusa il pattern base dei timing:
  l'effetto si legge solo nel momento in cui questa creatura dichiara
  l'attacco.
- `このクリーチャーが` chiarisce che il soggetto del trigger resta la carta
  stessa, mentre il bersaglio operativo arriverà soltanto dopo.

### 2. 自分の山札の上から1枚目を表向きにする

- [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}
  fissa una carta molto precisa: proprio quella in cima in questo momento.
- [{{表向|おもてむ}}き](term:term-face-up)にする non vuol dire pescare né
  aggiungere alla mano: vuol dire rendere pubblica quell'informazione durante
  la risoluzione.
- Il giapponese quindi costruisce prima la rivelazione e solo dopo il filtro:
  prima guardi quale carta è, poi leggi che cosa succede a quella carta.

### 3. それが進化でないビートジョッキーなら

- `それが` riprende esattamente la carta appena rivelata dalla cima del mazzo.
- `{{進化|しんか}}でない` esclude la categoria delle evoluzioni: non basta essere
  un [ビートジョッキー](term:term-beat-jockey), bisogna anche non essere una
  creatura evoluzione.
- Il blocco intero è quindi un filtro doppio: tribù corretta e assenza della
  proprietà `{{進化|しんか}}`.

### 4. それ以外なら自分の山札の一番下に置く

- [それ{{以外|いがい}}なら](grammar:grammar-soreigai-nara) apre il ramo alternativo sullo
  stesso referente appena controllato.
- `{{一番下|いちばんした}}に[{{置|お}}く](term:term-oku)` non lascia la carta
  dov'è: la sposta in fondo al mazzo, quindi fuori dalla pescata immediata.
- Il testo chiude così un bivio completo: `passa il filtro -> battle zone`,
  `non passa -> fondo del mazzo`.

## Lessico utile in questa carta

- [ビートジョッキー](term:term-beat-jockey) è il filtro tribale decisivo:
  quando compare nella seconda frase, stai controllando la famiglia della carta
  rivelata.
- [{{表向|おもてむ}}き](term:term-face-up) segnala informazione pubblica durante
  la risoluzione, non movimento di zona.
- `{{上|うえ}}から{{1枚目|いちまいめ}}` e `{{一番下|いちばんした}}` sono due
  chunk molto utili perché descrivono posizioni precise del mazzo, non carte
  generiche.
