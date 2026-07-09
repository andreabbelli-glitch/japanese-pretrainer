---
id: cards-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
media_id: media-duel-masters-dm25
slug: live-duel-encounters-kuromame-danshaku
title: Carte incontrate in partita 6 - Kuromame Danshaku e il filtro sulle abilita di ingresso
order: 55
segment_ref: live-duel-encounters
---

:::term
id: term-kuromame-danshaku
lemma: 黒豆だんしゃく
reading: くろまめだんしゃく
romaji: kuromame danshaku
meaning_it: Kuromame Danshaku / lato creatura del Twinpact che filtra i trigger di ingresso
pos: proper-noun
aliases: [黒豆だんしゃく, 黒豆だんしゃく/白米男しゃく, Kuromame Danshaku]
notes_it: >-
  E il lato creatura del Twinpact `{{黒豆|くろまめ}}だんしゃく /
  {{白米|はくまい}}{{男|だん}}しゃく`. Quando compare
  `{{黒豆|くろまめ}}だんしゃく`, la lettura utile da fissare e il blocco che
  filtra le abilita avversarie che iniziano con
  `このクリーチャーが{{出|で}}た{{時|とき}}`.
level_hint: custom
:::

:::term
id: term-ability
lemma: 能力
reading: のうりょく
romaji: nouryoku
meaning_it: abilita / testo di effetto che una carta possiede
pos: noun
aliases: [能力, のうりょく, nouryoku]
notes_it: >-
  Nel rules text `{{能力|のうりょく}}` nomina il testo che una carta possiede o
  attiva. In frasi come `～で{{始|はじ}}まる{{能力|のうりょく}}`, il punto non e
  la zona o il bersaglio, ma proprio il blocco di effetto che viene filtrato.
level_hint: n4
:::

:::grammar
id: grammar-de-hajimaru
pattern: ～で始まる
title: Si riconosce da come comincia
reading: ではじまる
meaning_it: che inizia con / che comincia con
aliases: [で始まる]
notes_it: >-
  Nel rules text serve a filtrare una frase in base alle sue parole iniziali.
  In `「このクリーチャーが{{出|で}}た{{時|とき}}」で{{始|はじ}}まる
  {{能力|のうりょく}}`, la carta controlla proprio l'apertura testuale
  dell'effetto, non un riassunto approssimativo del suo significato.
level_hint: n4
:::

:::card
id: card-kuromame-danshaku-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
entry_type: term
entry_id: term-kuromame-danshaku
card_type: recognition
front: '{{黒豆|くろまめ}}だんしゃく'
back: Kuromame Danshaku / Twinpact che manda nel mana le creature con abilità d'ingresso
example_jp: >-
  {{黒豆|くろまめ}}だんしゃくがいると、{{相手|あいて}}は
  このクリーチャーが{{出|で}}た{{時|とき}}の{{能力|のうりょく}}を{{持|も}}つ
  クリーチャーを{{出|だ}}す{{前|まえ}}に{{考|かんが}}える。
example_it: >-
  Se c'è Kuromame Danshaku, l'avversario ci pensa meglio prima di giocare
  creature con abilità d'ingresso.
notes_it: >-
  Il nome va fissato come nome proprio utile, non solo come battuta sul cibo:
  nel corpus indica una carta che punisce una famiglia precisa di trigger.
tags: [live-duel, proper-name, twinpact]
:::

:::card
id: card-duel-masters-ability-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
entry_type: term
entry_id: term-ability
card_type: recognition
front: '{{能力|のうりょく}}'
back: abilità / testo di effetto che la carta possiede
example_jp: >-
  このクリーチャーの{{能力|のうりょく}}で、{{相手|あいて}}のカードを
  {{墓地|ぼち}}に{{置|お}}く。
example_it: >-
  Con l'abilità di questa creatura, metti una carta avversaria nel cimitero.
notes_it: >-
  `{{能力|のうりょく}}` e una parola piccola ma centrale: molte frasi tecniche
  non filtrano il nome della carta, ma il tipo di effetto che quella carta ha.
tags: [live-duel, term, rules-text]
:::

:::card
id: card-de-hajimaru-ability-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
entry_type: grammar
entry_id: grammar-de-hajimaru
card_type: concept
front: >-
  「このクリーチャーが{{出|で}}た{{時|とき}}」で{{始|はじ}}まる
  {{能力|のうりょく}}
back: abilità che comincia con "quando questa creatura entra"
example_jp: >-
  この{{能力|のうりょく}}は「このクリーチャーが{{出|で}}た{{時|とき}}」で
  {{始|はじ}}まる。
example_it: >-
  Questa abilità comincia con «quando questa creatura entra».
notes_it: >-
  Questo e il vero pezzo da allenare: il filtro non dice soltanto "abilita di
  ingresso", ma ti costringe a riconoscere la formula con cui l'effetto si
  apre.
tags: [live-duel, grammar, filter, rules-text]
:::
