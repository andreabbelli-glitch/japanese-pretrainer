---
id: cards-duel-masters-dm25-live-duel-encounters-crys-ze-bub
media_id: media-duel-masters-dm25
slug: live-duel-encounters-crys-ze-bub
title: Carte incontrate in partita 58 - 比べて e ではなく
order: 109
segment_ref: live-duel-encounters
---

:::term
id: term-ookisa
lemma: 大きさ
reading: おおきさ
romaji: ookisa
meaning_it: grandezza / entità / valore numerico
pos: noun
aliases: [大きさ, おおきさ, ookisa, grandezza, entità]
notes_it: >-
  `{{大|おお}}きさ` nominalizza `{{大|おお}}きい`: descrive la grandezza o entità
  di qualcosa. Nel chunk [コスト](term:term-cost)の{{大|おお}}きさ, il testo
  guarda quanto è alto il costo come numero confrontabile.
level_hint: n4
:::

:::term
id: term-kurabete
lemma: 比べて
reading: くらべて
romaji: kurabete
meaning_it: confrontando / comparando
pos: verb-form
aliases: [比べて, くらべて, kurabete, confrontando]
notes_it: >-
  `{{比|くら}}べて` è la forma in て di `{{比|くら}}べる`, "confrontare". Nel
  rules text collega il confronto al passo successivo: prima metti a paragone
  i valori indicati da `を`, poi risolvi il [バトル](term:term-battle).
level_hint: n4
:::

:::grammar
id: grammar-dewanaku
pattern: ～ではなく
title: Invece di X / escluso X come criterio
reading: ではなく
meaning_it: invece di / anziché / escluso come criterio
aliases: [ではなく, では無く]
notes_it: >-
  `ではなく` è una forma negativa continuativa della copula. Chiude il blocco
  prima di `では` come criterio escluso e lascia proseguire la frase verso il
  valore usato davvero. In `パワーではなくコストの{{大|おお}}きさ`, il criterio
  escluso è [パワー](term:term-power); quello che segue è
  [コスト](term:term-cost)の{{大|おお}}きさ.
level_hint: n4
:::

:::grammar
id: grammar-power-dewanaku-cost-no-ookisa-o-kurabete-battle-suru
pattern: クリーチャーは、パワーではなくコストの大きさを比べてバトルする
title: Le creature fanno battle confrontando il costo
reading: くりーちゃーは、ぱわーではなくこすとのおおきさをくらべてばとるする
meaning_it: le creature fanno battle confrontando la grandezza del costo invece della power
aliases:
  [
    クリーチャーは、パワーではなくコストの大きさを比べてバトルする,
    パワーではなくコストの大きさを比べてバトルする,
    コストの大きさを比べてバトルする
  ]
notes_it: >-
  La frase mette [クリーチャー](term:term-creature) come tema generale, usa
  `ではなく` per escludere [パワー](term:term-power) dal confronto, poi porta
  [コスト](term:term-cost)の{{大|おお}}きさを{{比|くら}}べて davanti a
  [バトル](term:term-battle)する. Il battle rimane lo scontro; il numero letto
  dentro quello scontro diventa il costo.
level_hint: custom
:::

:::card
id: card-ookisa-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-crys-ze-bub
entry_type: term
entry_id: term-ookisa
card_type: recognition
front: '{{大|おお}}きさ'
back: grandezza / entità / valore numerico
example_jp: >-
  [コスト](term:term-cost)の{{大|おお}}きさを{{比|くら}}べて
  [バトル](term:term-battle)する。
example_it: >-
  Fai battle confrontando la grandezza del costo.
notes_it: >-
  `{{大|おお}}きさ` prende l'aggettivo `{{大|おお}}きい` e lo trasforma in nome:
  "grandezza", "entità". Con [コスト](term:term-cost), la frase guarda il valore
  numerico del costo.
tags: [live-duel, term, kanji, comparison]
:::

:::card
id: card-kurabete-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-crys-ze-bub
entry_type: term
entry_id: term-kurabete
card_type: recognition
front: '{{比|くら}}べて'
back: confrontando / comparando
example_jp: >-
  [クリーチャー](term:term-creature)は、[パワー](term:term-power)ではなく
  [コスト](term:term-cost)の{{大|おお}}きさを{{比|くら}}べて
  [バトル](term:term-battle)する。
example_it: >-
  Le creature fanno battle confrontando la grandezza del costo invece della
  power.
notes_it: >-
  `{{比|くら}}べて` collega il confronto al verbo successivo. Qui `を` marca
  [コスト](term:term-cost)の{{大|おお}}きさ come ciò che viene confrontato, e
  [バトル](term:term-battle)する è l'azione che si risolve dopo quel confronto.
tags: [live-duel, term, verb-form, comparison]
:::

:::card
id: card-dewanaku-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-crys-ze-bub
entry_type: grammar
entry_id: grammar-dewanaku
card_type: concept
front: 'パワーではなくコスト'
back: invece della power, il costo come criterio
example_jp: >-
  [クリーチャー](term:term-creature)は、[パワー](term:term-power)
  [ではなく](grammar:grammar-dewanaku)[コスト](term:term-cost)の
  {{大|おお}}きさを{{比|くら}}べる。
example_it: >-
  Le creature confrontano la grandezza del costo invece della power.
notes_it: >-
  In `パワーではなくコスト`, il blocco prima di `では` viene escluso come criterio
  e il nome successivo prende il ruolo operativo. Questa forma è molto utile
  nei rules text perché sposta la lettura da un valore atteso a un altro valore
  dichiarato dalla carta.
tags: [live-duel, grammar, contrast, comparison]
:::

:::card
id: card-power-dewanaku-cost-no-ookisa-o-kurabete-battle-suru-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-crys-ze-bub
entry_type: grammar
entry_id: grammar-power-dewanaku-cost-no-ookisa-o-kurabete-battle-suru
card_type: concept
front: 'クリーチャーは、パワーではなくコストの{{大|おお}}きさを{{比|くら}}べてバトルする。'
back: 'Le creature fanno battle confrontando la grandezza del costo invece della power.'
example_jp: >-
  クリーチャーは、パワーではなくコストの{{大|おお}}きさを{{比|くら}}べてバトルする。
example_it: >-
  Le creature fanno battle confrontando la grandezza del costo invece della
  power.
notes_it: >-
  La frase intera separa tema, criterio e azione. `クリーチャーは` mette le
  creature come tema generale; `パワーではなく` esclude la power come misura;
  `コストの{{大|おお}}きさを{{比|くら}}べて` dice quale valore confrontare prima di
  arrivare a `バトルする`.
tags: [live-duel, grammar, battle, comparison, cost]
:::
