---
id: cards-duel-masters-dm25-live-duel-encounters-dama-vaishingu
media_id: media-duel-masters-dm25
slug: live-duel-encounters-dama-vaishingu
title: Carte incontrate in partita 3 - 堕魔 e il bivio それ以外なら
order: 52
segment_ref: live-duel-encounters
---

:::term
id: term-dama
lemma: 堕魔
reading: だーま
romaji: daama
meaning_it: prefisso delle creature Magic Tool oscure
pos: noun
aliases: [堕魔, daama]
notes_it: >-
  Compare all'inizio di molti nomi del pacchetto [魔導具](term:term-madougu). Va
  letto come prefisso d'archetipo: quando vedi `堕魔`, è probabile che la carta
  entri nello stesso ecosistema di cimitero, filtro e De Szark.
level_hint: custom
:::

:::grammar
id: grammar-soreigai-nara
pattern: それ以外なら
title: Ramo alternativo dopo il filtro
meaning_it: altrimenti / se non è così
aliases: [それ以外]
notes_it: >-
  Apre il ramo "else" dopo un controllo precedente. In `それがコスト4以下の魔導具なら
  ... それ以外なら ...`, il testo non introduce un nuovo bersaglio: decide solo
  l'uscita diversa dello stesso bersaglio già scelto.
level_hint: n3
:::

:::card
id: card-dama-recognition
entry_type: term
entry_id: term-dama
card_type: recognition
front: '{{堕魔|だーま}}'
back: prefisso delle creature Magic Tool oscure
example_jp: >-
  {{堕魔|だーま}}の{{名前|なまえ}}が{{見|み}}えたら、{{魔導具|まどうぐ}}の
  {{仲間|なかま}}だと{{考|かんが}}えやすい。
example_it: >-
  Quando vedi il prefisso `堕魔`, è facile pensare a una carta del gruppo Magic
  Tool.
notes_it: >-
  Non è ancora la funzione della carta, ma un indizio molto utile di famiglia:
  `堕魔` compare proprio dove il nome ti sta già segnalando il pacchetto giusto.
tags: [live-duel, archetype, naming]
:::

:::card
id: card-soreigai-nara-concept
entry_type: grammar
entry_id: grammar-soreigai-nara
card_type: concept
front: >-
  それ以外なら{{手札|てふだ}}に{{加|くわ}}える
back: altrimenti la aggiungi alla mano
example_jp: >-
  {{条件|じょうけん}}を{{満|み}}たさないなら、`それ以外なら`で
  {{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Se non soddisfa la condizione, il ramo `それ以外なら` la manda in mano.
notes_it: >-
  Questo chunk vale la pena di essere fissato perché è il modo compatto con cui
  il rules text chiude un bivio: stesso bersaglio, uscita alternativa.
tags: [live-duel, grammar, branching]
:::
