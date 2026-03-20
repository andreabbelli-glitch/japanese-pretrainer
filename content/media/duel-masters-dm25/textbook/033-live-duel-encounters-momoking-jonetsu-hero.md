---
id: lesson-duel-masters-dm25-live-duel-encounters-momoking-jonetsu-hero
media_id: media-duel-masters-dm25
slug: live-duel-encounters-momoking-jonetsu-hero
title: Carte incontrate - Momoking, Jonetsu Hero
order: 62
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, kirifudash, speed-attacker, t-breaker, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari
  ]
summary: >-
  Momoking, Jonetsu Hero: Kirifudash, primo attacco per turno che si raddrizza
  e protezione dalle scelte non multicolori.
---

# {{勝|しょう}}{{熱|ねつ}}{{英雄|えいゆう}} モモキング

:::image
src: assets/cards/live-duel/momoking-jonetsu-hero.jpg
alt: "Momoking, Jonetsu Hero card."
caption: >-
  {{勝|しょう}}{{熱|ねつ}}{{英雄|えいゆう}} モモキング。 Razze:
  ヒーロー・ドラゴン / ジョーカーズ / チーム{{切札|きりふだ}}. Riga centrale:
  [キリフダッシュ](term:term-kirifudash) 6, [スピードアタッカー](term:term-speed-attacker),
  [T・ブレイカー](term:term-t-breaker), primo attacco per turno che si
  raddrizza da solo e blocco finale che impedisce la scelta da effetti non
  multicolori.
:::

## Keyword presenti sulla carta

- [キリフダッシュ](term:term-kirifudash)
- [スピードアタッカー](term:term-speed-attacker)
- [T・ブレイカー](term:term-t-breaker)

`キリフダッシュ` è il chunk nuovo qui: non dice solo "attacca bene", ma lega
un attacco che ha già rotto uno scudo alla possibilità di evocare la carta alla
fine di quell'attacco.

## Effetti da leggere

:::example_sentence
jp: >-
  [キリフダッシュ](term:term-kirifudash){{6|ろく}}：
  {{自分|じぶん}}の[クリーチャー](term:term-creature)の{{攻撃|こうげき}}の
  {{終|お}}わりに、その[クリーチャー](term:term-creature)がその
  {{攻撃|こうげき}}{{中|ちゅう}}にシールドをブレイクしていれば、このクリーチャーを
  {{6|ろく}}[{{支払|しはら}}って](term:term-harau)
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  Kirifudash 6: alla fine dell'attacco di una tua creatura, se quella creatura
  ha rotto uno scudo durante quell'attacco, puoi pagare 6 per evocare questa
  creatura.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{各|かく}}ターン、このクリーチャーがはじめて
  [{{攻撃|こうげき}}](term:term-attack)する{{時|とき}}、
  その[{{攻撃|こうげき}}](term:term-attack)の{{後|あと}}、
  このクリーチャーをアンタップする。
translation_it: >-
  In ogni turno, quando questa creatura attacca per la prima volta, la
  raddrizzi dopo quell'attacco.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)は、
  {{多色|たしょく}}ではない[{{呪文|じゅもん}}](term:term-spell)の
  [{{効果|こうか}}](term:term-effect)、または、
  {{多色|たしょく}}ではない[クリーチャー](term:term-creature)の
  [{{能力|のうりょく}}](term:term-ability)によって、
  この[クリーチャー](term:term-creature)は{{選|えら}}べない。
translation_it: >-
  L'avversario non può scegliere questa creatura tramite effetti di spell non
  multicolori o abilità di creature non multicolori.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. キリフダッシュ 6

- `キリフダッシュ` è il nome del blocco effetto, ma il numero stampato accanto
  fa parte della lettura operativa: qui non stai solo riconoscendo una keyword,
  stai anche memorizzando il costo da pagare per far partire l'evocazione.
- `{{攻撃|こうげき}}の{{終|お}}わりに` mette il controllo alla fine
  dell'attacco, non all'inizio e non durante il battle.
- `その[クリーチャー](term:term-creature)がその{{攻撃|こうげき}}中に
  シールドをブレイクしていれば` lega la condizione al fatto già successo
  dentro quello stesso attacco: prima deve esserci il break, poi può partire
  l'evocazione.

### 2. 各ターン、このクリーチャーがはじめて攻撃する時

- `{{各|かく}}ターン` apre uno scope ripetuto: il controllo si resetta a ogni
  nuovo turno.
- `はじめて` non descrive il primo attacco dell'intera partita, ma il primo
  attacco di quel turno.
- `その[{{攻撃|こうげき}}](term:term-attack)の{{後|あと}}` sposta la
  raddrizzata subito dopo quel singolo attacco, non in una finestra più vaga.

### 3. 多色ではない呪文の効果、または、多色ではないクリーチャーの能力

- `{{多色|たしょく}}ではない` è la restrizione di filtro: il testo sta
  prendendo in considerazione solo effetti o abilità non multicolori.
- `[{{呪文|じゅもん}}](term:term-spell)の[{{効果|こうか}}](term:term-effect)` e
  `[クリーチャー](term:term-creature)の[{{能力|のうりょく}}](term:term-ability)`
  sono due sorgenti diverse, unite da `または`.
- `によって` lega la causa alla possibilità di scelta: il punto non è che la
  carta sia sempre intoccabile, ma che certi tipi di effetti non possono
  selezionarla.

## Lessico utile in questa carta

- [キリフダッシュ](term:term-kirifudash) è il chunk nuovo da fissare: la
  finestra è "fine dell'attacco", la condizione è "ha rotto uno scudo", il
  payoff è "puoi evocarla pagando il costo stampato".
- `{{各|かく}}ターン` e `はじめて` sono un altro blocco utile: ti dicono che
  l'effetto si resetta ogni turno e si applica solo al primo attacco di quel
  turno.
- `{{多色|たしょく}}ではない` è il filtro negativo che limita chi può
  scegliere questa creatura.
