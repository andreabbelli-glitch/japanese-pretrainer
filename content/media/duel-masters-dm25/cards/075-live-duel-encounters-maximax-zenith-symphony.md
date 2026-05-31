---
id: cards-duel-masters-dm25-live-duel-encounters-maximax-zenith-symphony
media_id: media-duel-masters-dm25
slug: live-duel-encounters-maximax-zenith-symphony
title: Carte incontrate in partita 53 - 両方 e razza doppia
order: 103
segment_ref: live-duel-encounters
---

:::term
id: term-ryouhou
lemma: 両方
reading: りょうほう
romaji: ryouhou
meaning_it: entrambi / tutti e due
pos: noun
aliases: [両方, りょうほう, ryouhou, entrambi, tutti e due]
notes_it: >-
  `{{両方|りょうほう}}` indica entrambi i lati di una coppia. Dopo `AとB`, prende
  l'intera coppia come gruppo completo. In questa carta rende cumulativo il
  filtro: la creatura deve avere sia アンノウン sia ゼニス nella riga
  [{{種族|しゅぞく}}](term:term-race).
level_hint: n4
:::

:::grammar
id: grammar-unknown-to-zenith-ryouhou-wo-shuzoku-ni-motsu
pattern: アンノウンとゼニス両方を種族に持つ
title: Avere Unknown e Zenith come razze
reading: アンノウンとゼニスりょうほうをしゅぞくにもつ
meaning_it: avere sia Unknown sia Zenith come razze
aliases:
  [
    アンノウンとゼニス両方を種族に持つ,
    アンノウンとゼニス両方を種族に持つクリーチャー,
    アンノウンとゼニス両方
  ]
notes_it: >-
  `アンノウンとゼニス{{両方|りょうほう}}を{{種族|しゅぞく}}に{{持|も}}つ` è una
  relativa che modifica `クリーチャー`. `と` unisce i due nomi di razza, `両方`
  richiede la coppia completa, `を` marca ciò che la creatura possiede, e
  `{{種族|しゅぞく}}に` dice che quei nomi valgono come razze della carta.
level_hint: n3
:::

:::card
id: card-ryouhou-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-maximax-zenith-symphony
entry_type: term
entry_id: term-ryouhou
card_type: recognition
front: '{{両方|りょうほう}}'
back: entrambi / tutti e due
example_jp: >-
  アンノウンとゼニス{{両方|りょうほう}}を
  [{{種族|しゅぞく}}](term:term-race)に[{{持|も}}つ](term:term-motsu)
  [クリーチャー](term:term-creature)を{{1体|いったい}}、
  [コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni)
  [{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)から
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
example_it: >-
  Puoi evocare dalla tua mano, senza pagarne il costo, una creatura che abbia
  sia Unknown sia Zenith come razze.
notes_it: >-
  In giapponese generale `{{両方|りょうほう}}` indica "entrambi". Qui prende la
  coppia `アンノウンとゼニス` e la rende un requisito unico: la creatura valida
  deve portare tutte e due le razze nella riga
  [{{種族|しゅぞく}}](term:term-race).
tags: [live-duel, term, both, race-filter]
:::

:::card
id: card-unknown-to-zenith-ryouhou-wo-shuzoku-ni-motsu-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-maximax-zenith-symphony
entry_type: grammar
entry_id: grammar-unknown-to-zenith-ryouhou-wo-shuzoku-ni-motsu
card_type: concept
front: 'アンノウンとゼニス{{両方|りょうほう}}を{{種族|しゅぞく}}に{{持|も}}つ'
back: avere sia Unknown sia Zenith come razze
example_jp: >-
  アンノウンとゼニス{{両方|りょうほう}}を
  [{{種族|しゅぞく}}](term:term-race)に[{{持|も}}つ](term:term-motsu)
  [クリーチャー](term:term-creature)を{{1体|いったい}}、
  [{{手札|てふだ}}](term:term-hand)から
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
example_it: >-
  Puoi evocare dalla mano una creatura che abbia sia Unknown sia Zenith come
  razze.
notes_it: >-
  Il chunk funziona come una relativa prima di `クリーチャー`. `アンノウンとゼニス`
  nomina la coppia, `{{両方|りょうほう}}を` la mette come oggetto di
  [{{持|も}}つ](term:term-motsu), e `{{種族|しゅぞく}}に` chiarisce che la
  proprietà richiesta è la razza della carta.
tags: [live-duel, grammar, relative-clause, race-filter, both]
:::
