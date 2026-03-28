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

:::term
id: term-multicolor
lemma: 多色
reading: たしょく
romaji: tashoku
meaning_it: multicolore / carta di più colori
pos: noun
aliases: [多色, たしょく, multicolor, multicolore]
notes_it: >-
  Nel rules text di Duel Masters `多色` indica una carta con più di una
  civiltà. Su Momoking compare soprattutto nel filtro `多色ではない`, che
  restringe quali spell ed effetti di creatura possono scegliere questa
  creatura.
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

:::grammar
id: grammar-sono-kougeki-chuu-ni-shield-break-shite-ireba
pattern: その攻撃中にシールドをブレイクしていれば
title: Se ha rotto uno scudo durante quell'attacco
reading: そのこうげきちゅうにしーるどをぶれいくしていれば
meaning_it: se durante quell'attacco ha rotto uno scudo
aliases: [その攻撃中にシールドをブレイクしていれば]
notes_it: >-
  Qui il centro del chunk e` `{{攻撃中|こう.げき.ちゅう}}に`. `{{中|ちゅう}}`
  non vuol dire genericamente `mentre`, ma delimita l'interno di quella
  precisa finestra di attacco. Il controllo avviene alla fine con
  `{{攻撃|こうげき}}の{{終|お}}わりに`, ma la condizione deve essere gia`
  successa dentro quell'attacco; `していれば` la presenta quindi come fatto
  ormai verificato e controllato retrospettivamente.
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
id: card-multicolor-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-momoking-jonetsu-hero
entry_type: term
entry_id: term-multicolor
card_type: recognition
front: '{{多色|たしょく}}'
back: multicolore / carta di più colori
example_jp: >-
  [{{多色|たしょく}}](term:term-multicolor)ではない
  [{{呪文|じゅもん}}](term:term-spell)の[{{効果|こうか}}](term:term-effect)に
  よって、この[クリーチャー](term:term-creature)は{{選|えら}}べない。
example_it: >-
  Questa creatura non può essere scelta da effetti di spell non multicolori.
notes_it: >-
  Il punto da fissare è il composto `多色`: non descrive un colore generico, ma
  la categoria delle carte con più civiltà. In questa lezione lo incontri nella
  forma negativa `多色ではない`, che filtra le sorgenti autorizzate a
  sceglierla.
tags: [live-duel, compound, color, filter]
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

:::card
id: card-sono-kougeki-chuu-ni-shield-break-shite-ireba
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-momoking-jonetsu-hero
entry_type: grammar
entry_id: grammar-sono-kougeki-chuu-ni-shield-break-shite-ireba
card_type: concept
front: 'その{{攻撃中|こう.げき.ちゅう}}にシールドをブレイクしていれば'
back: Se durante quell'attacco ha rotto uno scudo.
example_jp: >-
  その[クリーチャー](term:term-creature)がその{{攻撃中|こう.げき.ちゅう}}に
  シールドをブレイクしていれば、このクリーチャーを
  {{6|ろく}}[{{支払|しはら}}って](term:term-harau)
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
example_it: >-
  Se quella creatura ha rotto uno scudo durante quell'attacco, puoi pagare 6
  per evocare questa creatura.
notes_it: >-
  `その{{攻撃中|こう.げき.ちゅう}}に` chiude la condizione dentro lo stesso
  attacco appena nominato: non basta che uno scudo sia stato rotto prima o in
  generale nel turno. `していれば` viene controllato alla fine dell'attacco e
  legge il break come un fatto gia` accaduto entro quella finestra.
tags: [live-duel, grammar, attack-window, shield-break]
:::
