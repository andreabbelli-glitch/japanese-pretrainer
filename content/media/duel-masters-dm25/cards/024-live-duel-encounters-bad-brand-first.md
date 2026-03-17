---
id: cards-duel-masters-dm25-live-duel-encounters-bad-brand-first
media_id: media-duel-masters-dm25
slug: live-duel-encounters-bad-brand-first
title: Carte incontrate in partita 4 - Bad Brand 1st e il topdeck rivelato
order: 53
segment_ref: live-duel-encounters
---

:::term
id: term-bad-brand-first
lemma: “罰怒”ブランド 1st
reading: ばっどぶらんど ふぁーすと
romaji: baddo burando faasuto
meaning_it: Bad Brand First / aggressore Beat Jockey che converte la cima del mazzo in pressione
pos: proper-noun
aliases:
  [“罰怒”ブランド 1st, 罰怒ブランド 1st, バッドブランド 1st, Bad Brand First]
notes_it: >-
  È il nome proprio di un attaccante Beat Jockey del ramo Duel Masters PLAY'S.
  Quando compare `“{{罰怒|バッド}}”ブランド {{1st|ファースト}}`, il testo va letto
  come un nome completo: attacco, rivelazione della cima del mazzo e ingresso
  immediato se il filtro tribale passa.
level_hint: custom
:::

:::term
id: term-top-card-of-deck
lemma: 山札の上から1枚目
reading: やまふだのうえからいちまいめ
romaji: yamafuda no ue kara ichimaime
meaning_it: la prima carta del mazzo / top card of the deck
pos: noun
aliases: [山札の上から1枚目, 上から1枚目, top card]
notes_it: >-
  È un chunk molto utile nei testi che rivelano, controllano o spostano la
  carta in cima. Non vuol dire "una carta dal mazzo" in generale: indica
  proprio la carta che occupa adesso la posizione superiore.
level_hint: custom
:::

:::term
id: term-bottom-of-deck
lemma: 山札の一番下
reading: やまふだのいちばんした
romaji: yamafuda no ichiban shita
meaning_it: il fondo del mazzo / bottom of the deck
pos: noun
aliases: [山札の一番下, 一番下, bottom of deck]
notes_it: >-
  Segna una posizione precisa del mazzo. Quando una carta viene messa
  `{{山札|やまふだ}}の{{一番下|いちばんした}}`, non resta disponibile subito:
  esce dalla cima e viene spinta nella zona meno immediata della pescata.
level_hint: custom
:::

:::card
id: card-bad-brand-first-recognition
entry_type: term
entry_id: term-bad-brand-first
card_type: recognition
front: '“{{罰怒|バッド}}”ブランド {{1st|ファースト}}'
back: Bad Brand First / Beat Jockey aggressivo che controlla la cima del mazzo
example_jp: >-
  “{{罰怒|バッド}}”ブランド {{1st|ファースト}}が
  {{攻撃|こうげき}}すると、{{山札|やまふだ}}の{{上|うえ}}から
  {{1枚目|いちまいめ}}を{{表向|おもてむ}}きにする。
example_it: >-
  Quando Bad Brand 1st attacca, rende scoperta la prima carta del mazzo.
notes_it: >-
  Il nome va fissato come nome proprio completo. Qui quel nome coincide con una
  linea di gioco molto leggibile: attacco, rivelazione, filtro Beat Jockey.
tags: [live-duel, proper-name, beat-jockey]
:::

:::card
id: card-top-card-of-deck-recognition
entry_type: term
entry_id: term-top-card-of-deck
card_type: recognition
front: '{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}'
back: la prima carta del mazzo
example_jp: >-
  {{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}を
  {{見|み}}れば、いま{{何|なに}}が{{乗|の}}っているかすぐわかる。
example_it: >-
  Se guardi la prima carta del mazzo, capisci subito che cosa c'è in cima.
notes_it: >-
  Questo chunk blocca la posizione esatta della carta. Non è un prelievo
  casuale: è proprio la carta attualmente in cima.
tags: [live-duel, deck, position]
:::

:::card
id: card-face-up-top-card-concept
entry_type: term
entry_id: term-top-card-of-deck
card_type: concept
front: >-
  {{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}を
  {{表向|おもてむ}}きにする
back: rendi scoperta la prima carta del tuo mazzo
example_jp: >-
  {{攻撃|こうげき}}した{{時|とき}}、{{山札|やまふだ}}の{{上|うえ}}から
  {{1枚目|いちまいめ}}を{{表向|おもてむ}}きにすると、そのカードを
  みんなが{{確認|かくにん}}できる。
example_it: >-
  Quando attacchi, se metti scoperta la prima carta del mazzo, tutti possono
  verificarla.
notes_it: >-
  Il punto qui non è pescare la carta ma renderla informazione pubblica. La
  frase unisce posizione del mazzo e stato `{{表向|おもてむ}}き` nello stesso
  gesto.
tags: [live-duel, deck, reveal, chunk]
:::

:::card
id: card-bottom-of-deck-recognition
entry_type: term
entry_id: term-bottom-of-deck
card_type: recognition
front: '{{山札|やまふだ}}の{{一番下|いちばんした}}'
back: il fondo del mazzo
example_jp: >-
  {{山札|やまふだ}}の{{一番下|いちばんした}}にあるカードは、すぐには
  {{引|ひ}}きにくい。
example_it: >-
  Una carta che sta sul fondo del mazzo difficilmente verrà pescata subito.
notes_it: >-
  `{{一番下|いちばんした}}` è una posizione molto concreta: nel rules text
  cambia davvero il ritmo con cui quella carta potrà tornare disponibile.
tags: [live-duel, deck, position]
:::

:::card
id: card-put-on-bottom-of-deck-concept
entry_type: term
entry_id: term-bottom-of-deck
card_type: concept
front: >-
  {{自分|じぶん}}の{{山札|やまふだ}}の{{一番下|いちばんした}}に{{置|お}}く
back: metti sul fondo del tuo mazzo
example_jp: >-
  {{条件|じょうけん}}に{{合|あ}}わないなら、
  {{山札|やまふだ}}の{{一番下|いちばんした}}に{{置|お}}いて
  {{次|つぎ}}へ{{進|すす}}む。
example_it: >-
  Se non soddisfa la condizione, la metti sul fondo del mazzo e vai avanti.
notes_it: >-
  Questa è una formula molto ricorrente nei filtri del mazzo: la carta non
  entra in mano e non resta in cima, ma viene spostata nel punto meno
  immediato della pila.
tags: [live-duel, deck, filter, chunk]
:::
