---
id: cards-duel-masters-dm25-live-duel-encounters-momoking-jonetsu-hero
media_id: media-duel-masters-dm25
slug: live-duel-encounters-momoking-jonetsu-hero
title: Carte incontrate in partita 13 - Momoking, Jonetsu Hero e Kirifudash
order: 62
segment_ref: live-duel-encounters
---

:::term
id: term-kirifudash
lemma: キリフダッシュ
reading: きりふだっしゅ
romaji: kirifudasshu
meaning_it: keyword che permette di evocare questa creatura pagando il costo stampato se una tua creatura ha rotto uno scudo durante il suo attacco
pos: keyword
aliases: [キリフダッシュ, Kirifudash, kirifudash, kirifudasshu]
notes_it: >-
  È una keyword a finestra: si controlla alla fine dell'attacco, ma la
  condizione deve essersi verificata durante lo stesso attacco. In questa carta
  il numero `{{6|ろく}}` è parte della lettura operativa del blocco, non un
  dettaglio decorativo.
level_hint: custom
:::

:::grammar
id: grammar-kaku-turn-hajimete-attack
pattern: 各ターン、このクリーチャーがはじめて攻撃する時
title: Primo attacco in ogni turno
reading: かくターン、このクリーチャーがはじめてこうげきするとき
meaning_it: quando questa creatura attacca per la prima volta in ogni turno
aliases: [各ターン、このクリーチャーがはじめて攻撃する時]
notes_it: >-
  `各ターン` apre uno scope che si resetta a ogni nuovo turno. `はじめて`
  segnala il primo attacco di quel turno, e `その攻撃の後` porta subito al
  raddrizzamento.
level_hint: custom
:::

:::card
id: card-kirifudash-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-momoking-jonetsu-hero
entry_type: term
entry_id: term-kirifudash
card_type: recognition
front: キリフダッシュ
back: keyword che sblocca un'evocazione dopo un attacco che ha rotto uno scudo
example_jp: >-
  キリフダッシュ{{6|ろく}}。
example_it: >-
  Kirifudash 6.
notes_it: >-
  La parola chiave è il vero target di memoria: non basta riconoscere il costo
  `6`, bisogna collegarlo alla finestra `攻撃の終わりに` e alla condizione già
  verificata nello stesso attacco.
tags: [live-duel, keyword, kirifudash, attack-window]
:::

:::card
id: card-first-attack-each-turn-untap
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-momoking-jonetsu-hero
entry_type: grammar
entry_id: grammar-kaku-turn-hajimete-attack
card_type: concept
front: '{{各|かく}}ターン、このクリーチャーがはじめて[{{攻撃|こうげき}}](term:term-attack)する{{時|とき}}'
back: In ogni turno, quando questa creatura attacca per la prima volta.
example_jp: >-
  {{各|かく}}ターン、このクリーチャーがはじめて
  [{{攻撃|こうげき}}](term:term-attack)する{{時|とき}}、
  その[{{攻撃|こうげき}}](term:term-attack)の{{後|あと}}、
  このクリーチャーをアンタップする。
example_it: >-
  In ogni turno, quando questa creatura attacca per la prima volta, la
  raddrizzi dopo quell'attacco.
notes_it: >-
  `各ターン` indica un reset per-turno, `はじめて` restringe l'effetto al
  primo attacco di quel turno, e `その攻撃の後` dice che il raddrizzamento
  arriva subito dopo quella singola risoluzione.
tags: [live-duel, grammar, attack-window, untap]
:::
