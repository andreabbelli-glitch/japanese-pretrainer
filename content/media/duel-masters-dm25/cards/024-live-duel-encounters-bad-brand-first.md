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

:::term
id: term-ichiban-shita
lemma: 一番下
reading: いちばんした
romaji: ichiban shita
meaning_it: il punto piu in basso / il fondo
pos: noun
aliases: [一番下, いちばんした, bottom]
notes_it: >-
  `{{一番|いちばん}}` marca l'estremo e `{{下|した}}` indica la parte bassa.
  Insieme formano un chunk di posizione molto utile: `il punto piu in basso` o
  `il fondo`. In Duel Masters compare spesso con il mazzo per dire dove una
  carta viene rimessa quando non resta in cima.
level_hint: n4
:::

:::grammar
id: grammar-me-ordinal
pattern: ～目
title: Numero + contatore come posizione nell'ordine
reading: め
meaning_it: il numero -esimo / in posizione numero
aliases: [目, ～枚目, ～番目]
notes_it: >-
  `{{目|め}}` trasforma un numero o un contatore in una posizione ordinata.
  In `{{1枚目|いちまいめ}}`, `{{1枚|いちまい}}` non significa piu soltanto
  "una carta": con `{{目|め}}` diventa `la prima carta`. Nel rules text questo
  serve a bloccare un posto preciso nella sequenza, non una quantita generica.
level_hint: n4
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
id: card-ichimaime-me-concept
entry_type: grammar
entry_id: grammar-me-ordinal
card_type: concept
front: '{{1枚目|いちまいめ}}'
back: >-
  la prima carta; `目` marca la posizione nell'ordine
example_jp: >-
  `{{1枚目|いちまいめ}}`の`{{目|め}}`は、{{1枚|いちまい}}を
  「{{最初|さいしょ}}の{{1枚|いちまい}}」にする。
example_it: >-
  In `1枚目`, `目` trasforma `1枚` in "la prima carta" invece di "una carta".
notes_it: >-
  Questa e una distinzione molto utile: `{{1枚|いちまい}}` conta una carta,
  `{{1枚目|いちまいめ}}` indica quale carta nella fila o nella pila. Su Bad
  Brand il testo non prende una carta qualsiasi dal mazzo: prende proprio la
  prima.
tags: [live-duel, grammar, counters, order]
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
id: card-ichiban-shita-recognition
entry_type: term
entry_id: term-ichiban-shita
card_type: recognition
front: '{{一番下|いちばんした}}'
back: il punto piu in basso; il fondo
example_jp: >-
  {{山札|やまふだ}}の{{一番下|いちばんした}}に{{置|お}}くと、すぐには
  {{見|み}}えなくなる。
example_it: >-
  Se la metti sul fondo del mazzo, non la rivedi subito.
notes_it: >-
  Qui il valore utile e posizionale: `{{一番下|いちばんした}}` non significa una
  carta specifica, ma il punto finale della pila. Quando lo incontri, pensa a
  `fondo` o `parte piu bassa`.
tags: [live-duel, position, chunk]
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
