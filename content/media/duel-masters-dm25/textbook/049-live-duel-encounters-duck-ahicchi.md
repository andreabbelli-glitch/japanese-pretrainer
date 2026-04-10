---
id: lesson-duel-masters-dm25-live-duel-encounters-duck-ahicchi
media_id: media-duel-masters-dm25
slug: live-duel-encounters-duck-ahicchi
title: Carte incontrate - Duck Ahicchi
order: 77
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, fire-bird, attack-restriction, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke,
    lesson-duel-masters-dm25-live-duel-encounters-bauwauja-abyssal-three-roar
  ]
summary: >-
  Duck Ahicchi: focus su kotonaru, sul gruppo di elementi con costi diversi e
  sul vincolo negativo che blocca l'attacco finché la soglia non è raggiunta.
---

# ダック・アヒッチ

:::image
src: assets/cards/live-duel/duck-ahicchi.jpg
alt: "Duck Ahicchi card."
caption: >-
  ダック・アヒッチ。 Razza: ファイアー・バード. Riga centrale: una sola
  restrizione d'attacco che prima costruisce il gruppo
  `コストが{{異|こと}}なる{{自分|じぶん}}のエレメント` e poi controlla se quel
  gruppo arriva ad almeno `{{3|みっ}}つ{{以上|いじょう}}`.
:::

## Effetti da leggere

:::example_sentence
jp: >-
  [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru)
  [{{自分|じぶん}}](term:term-self)のエレメントが{{3|みっ}}つ{{以上|いじょう}}なければ、
  このクリーチャーは[{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Se non hai almeno 3 tuoi elementi con costi diversi, questa creatura non può
  attaccare.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. コストが異なる

- [{{異|こと}}なる](term:term-kotonaru) non vuol dire `strano` o `speciale`:
  vuol dire `essere diverso`, `non coincidere`.
- Qui il soggetto del confronto è [コスト](term:term-cost), quindi il testo sta
  dicendo che il valore numerico del costo cambia da un elemento all'altro.
- Il punto utile è che `異なる` resta dentro il sintagma nominale successivo:
  non commenta la creatura che legge l'effetto, ma filtra il gruppo degli
  elementi che verranno contati.

### 2. 自分のエレメントが3つ以上

- Il nucleo contato è
  `{{自分|じぶん}}のエレメントが{{3|みっ}}つ{{以上|いじょう}}`.
  `{{3|みっ}}つ{{以上|いじょう}}` fissa una soglia minima, non un numero
  esatto.
- Siccome davanti c'è `コストが{{異|こと}}なる`, i tre o più elementi validi non
  sono `qualunque tre elementi tuoi`, ma quelli che entrano nel gruppo
  costruito da quel filtro di costo.
- Operativamente conviene leggere la frase in questo ordine: prima individui il
  set dei tuoi elementi con costi differenti, poi controlli se quel set arriva
  almeno a tre.

### 3. なければ、このクリーチャーは攻撃できない

- [～なければ ... ない](grammar:grammar-nakereba) è il cancello negativo della
  frase: se la condizione minima non è soddisfatta, scatta la restrizione.
- `このクリーチャーは{{攻撃|こうげき}}できない` non parla di distruzione, tap o
  uscita dal campo. Blocca solo l'azione di attaccare.
- Il senso completo è quindi: finché non raggiungi quella soglia di elementi
  con costi diversi, Duck Ahicchi resta sul campo ma non può essere dichiarato
  come attaccante.

## Lessico utile in questa carta

- [{{異|こと}}なる](term:term-kotonaru) è il punto nuovo da fissare: in questo
  corpus serve a leggere confronti in cui due valori non coincidono.
- [～なければ ... ない](grammar:grammar-nakereba) qui non crea un effetto
  spettacolare: mette semplicemente una soglia obbligatoria prima
  dell'attacco.
- [{{攻撃|こうげき}}](term:term-attack) resta il verbo operativo finale: è
  l'azione negata quando la condizione non è ancora vera.
