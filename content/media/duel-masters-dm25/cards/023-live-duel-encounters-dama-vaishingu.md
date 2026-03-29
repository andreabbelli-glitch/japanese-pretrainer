---
id: cards-duel-masters-dm25-live-duel-encounters-dama-vaishingu
media_id: media-duel-masters-dm25
slug: live-duel-encounters-dama-vaishingu
title: Carte incontrate in partita 3 - Dama e il bivio soreigai nara
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
  Compare all'inizio di molti nomi del pacchetto
  [{{魔導具|ま.どう.ぐ}}](term:term-madougu). Va letto come prefisso d'archetipo:
  quando vedi `{{堕魔|だーま}}`, è probabile che la carta entri nello stesso
  ecosistema di cimitero, filtro e De Szark.
level_hint: custom
:::

:::grammar
id: grammar-sorega-nara
pattern: それが～なら
title: Se quella carta soddisfa la condizione
reading: それがなら
meaning_it: se quella carta e / se quella carta soddisfa il filtro
aliases: [それが～なら]
notes_it: >-
  `それが` riprende la carta appena scelta; `なら` controlla se proprio quella
  carta passa il filtro indicato dopo. Non cambia bersaglio: verifica lo stesso
  oggetto gia nominato.
level_hint: n4
:::

:::grammar
id: grammar-soreigai-nara
pattern: それ以外なら
title: Ramo alternativo dopo il filtro
reading: それいがいなら
meaning_it: altrimenti / se non è così
aliases: [それ以外]
notes_it: >-
  Apre il ramo "else" dopo un controllo precedente. In
  `それがコスト{{4以下|よんいか}}の{{魔導具|ま.どう.ぐ}}なら ...
  それ{{以外|いがい}}なら ...`, il testo non introduce un nuovo bersaglio:
  decide solo l'uscita diversa dello stesso bersaglio già scelto.
level_hint: n3
:::

:::card
id: card-sorega-nara-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-dama-vaishingu
entry_type: grammar
entry_id: grammar-sorega-nara
card_type: concept
front: >-
  それがコスト{{4以下|よんいか}}の{{魔導具|ま.どう.ぐ}}なら
back: se quella carta è un Magic Tool di costo 4 o meno
example_jp: >-
  {{選|えら}}んだクリーチャーを{{見|み}}て、それがコスト{{4以下|よんいか}}の
  {{魔導具|ま.どう.ぐ}}なら{{場|ば}}に{{出|だ}}す。
example_it: >-
  Guardi la creatura scelta e, se è un Magic Tool di costo 4 o meno, la metti
  in campo.
notes_it: >-
  Questo ramo positivo non introduce un nuovo soggetto: `それ` continua a
  indicare la carta appena scelta e `なら` decide se passa il filtro.
tags: [live-duel, grammar, branching, filter]
:::

:::card
id: card-dama-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-dama-vaishingu
entry_type: term
entry_id: term-dama
card_type: recognition
front: '{{堕魔|だーま}}'
back: prefisso delle creature Magic Tool oscure
example_jp: >-
  {{堕魔|だーま}}の{{名前|なまえ}}が{{見|み}}えたら、{{魔導具|ま.どう.ぐ}}の
  {{仲間|なかま}}だと{{考|かんが}}えやすい。
example_it: >-
  Quando vedi il prefisso `{{堕魔|だーま}}`, è facile pensare a una carta del
  gruppo Magic Tool.
notes_it: >-
  Non è ancora la funzione della carta, ma un indizio molto utile di famiglia:
  `{{堕魔|だーま}}` compare proprio dove il nome ti sta già segnalando il
  pacchetto giusto.
tags: [live-duel, archetype, naming]
:::

:::card
id: card-soreigai-nara-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-dama-vaishingu
entry_type: grammar
entry_id: grammar-soreigai-nara
card_type: concept
front: >-
  それ{{以外|いがい}}なら{{手札|てふだ}}に{{加|くわ}}える
back: altrimenti la aggiungi alla mano
example_jp: >-
  {{条件|じょうけん}}を{{満|み}}たさないなら、`それ{{以外|いがい}}なら`で
  {{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Se non soddisfa la condizione, il ramo `それ{{以外|いがい}}なら` la manda in mano.
notes_it: >-
  `それ{{以外|いがい}}なら` è il modo compatto con cui il rules text chiude un
  bivio: stesso bersaglio, uscita alternativa.
tags: [live-duel, grammar, branching]
:::
