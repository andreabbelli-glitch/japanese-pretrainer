---
id: cards-duel-masters-dm25-live-duel-encounters-bandasuperu-zogujigusu
media_id: media-duel-masters-dm25
slug: live-duel-encounters-bandasuperu-zogujigusu
title: Carte incontrate in partita 59 - 含まれる, 数える e その数だけ
order: 110
segment_ref: live-duel-encounters
---

:::term
id: term-fukumareru
lemma: 含まれる
reading: ふくまれる
romaji: fukumareru
meaning_it: essere incluso / essere contenuto
pos: verb-form
aliases: [含まれる, ふくまれる, fukumareru, incluso, contenuto]
notes_it: >-
  `{{含|ふく}}まれる` descrive qualcosa che sta dentro un gruppo, una categoria
  o un contenitore. Nel rules text di ゾグジグス, `そのエレメントに
  {{含|ふく}}まれるカード` indica le carte che fanno parte dell'Element appena
  scelto.
level_hint: n3
:::

:::term
id: term-kazoeru
lemma: 数える
reading: かぞえる
romaji: kazoeru
meaning_it: contare
pos: ichidan-verb
aliases: [数える, かぞえる, kazoeru, contare]
notes_it: >-
  `{{数|かぞ}}える` prende un gruppo e lo trasforma in un numero. Nel rules text
  di Duel Masters compare quando il risultato del conteggio diventa una
  quantità da pescare, distruggere, rimbalzare o usare come soglia.
level_hint: n4
:::

:::grammar
id: grammar-sono-kazu-dake
pattern: その数だけ
title: In quantità pari a quel numero
reading: そのかずだけ
meaning_it: in quantità pari a quel numero / tante volte quanto quel numero
aliases: [その数だけ, そのかずだけ, sono kazu dake]
notes_it: >-
  `その{{数|かず}}だけ` riprende il conteggio appena calcolato. `だけ` significa
  "nella misura di" e crea una proporzione uno a uno: l'effetto della carta si
  applica un numero esatto di volte pari al totale contato nell'azione
  precedente.
level_hint: n4
:::

:::grammar
id: grammar-x-wo-motsu-y
pattern: Xを持つY
title: Y che possiede la caratteristica X
reading: XをもつY
meaning_it: Y possiede la caratteristica X / Y che ha X
aliases: [Xを持つY, 〜を持つY, コストを持つ呪文]
notes_it: >-
  `Xを{{持|も}}つY` è una relativa attributiva: `Xを{{持|も}}つ` descrive il
  nome che arriva dopo. Nel rules text `{{手札|てふだ}}の{{枚数|まいすう}}
  {{以下|いか}}の[コスト](term:term-cost)を{{持|も}}つ[呪文](term:term-spell)`
  significa "spell che hanno un costo pari o inferiore al numero di carte in
  mano".
level_hint: n4
:::

:::card
id: card-fukumareru-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bandasuperu-zogujigusu
entry_type: term
entry_id: term-fukumareru
card_type: recognition
front: '{{含|ふく}}まれる'
back: essere incluso / essere contenuto
example_jp: >-
  そのエレメントに{{含|ふく}}まれるカードを{{数|かぞ}}える。
example_it: >-
  Conta le carte incluse in quell'Element.
notes_it: >-
  `{{含|ふく}}まれる` guarda dal punto di vista della cosa inclusa. In
  `そのエレメントに{{含|ふく}}まれるカード`, il nome finale è `カード`: il testo
  conta le carte che stanno dentro l'Element scelto.
tags: [live-duel, term, inclusion, count]
:::

:::card
id: card-kazoeru-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bandasuperu-zogujigusu
entry_type: term
entry_id: term-kazoeru
card_type: recognition
front: '{{数|かぞ}}える'
back: contare
example_jp: >-
  そのエレメントに{{含|ふく}}まれるカードを{{数|かぞ}}える。
example_it: >-
  Conta le carte incluse in quell'Element.
notes_it: >-
  `{{数|かぞ}}える` crea il numero che le frasi successive useranno. Dopo il
  conteggio, `その{{数|かず}}だけ` può dire quante carte pescare o quante volte
  applicare un effetto.
tags: [live-duel, term, counting, action]
:::

:::card
id: card-sono-kazu-dake-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bandasuperu-zogujigusu
entry_type: grammar
entry_id: grammar-sono-kazu-dake
card_type: concept
front: 'その{{数|かず}}だけ'
back: >-
  in quantità pari a quel numero. だけ (dake): "nella misura di" (crea una
  proporzione 1:1). Indica che l'effetto della carta, come pescare,
  distruggere, infliggere danni o rimbalzare creature, si applica un numero
  esatto di volte pari al totale contato nell'azione precedente.
example_jp: >-
  その{{数|かず}}だけ、カードを{{引|ひ}}いてもよい。
example_it: >-
  Puoi pescare carte in quantità pari a quel numero.
notes_it: >-
  `その{{数|かず}}だけ` riprende il conteggio appena creato e lo usa come misura
  dell'azione successiva. In ゾグジグス, lo stesso numero governa sia la pesca
  sia il rimbalzo delle creature.
tags: [live-duel, grammar, quantity, proportional-effect]
:::

:::card
id: card-x-wo-motsu-y-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bandasuperu-zogujigusu
entry_type: grammar
entry_id: grammar-x-wo-motsu-y
card_type: concept
front: 'Xを{{持|も}}つY'
back: Y possiede la caratteristica X
example_jp: >-
  {{自分|じぶん}}の{{手札|てふだ}}の{{枚数|まいすう}}{{以下|いか}}の
  [コスト](term:term-cost)を{{持|も}}つ[{{呪文|じゅもん}}](term:term-spell)を、
  {{相手|あいて}}は{{唱|とな}}えられない。
example_it: >-
  L'avversario non può lanciare spell che hanno un costo pari o inferiore al
  numero di carte nella tua mano.
notes_it: >-
  In `Xを{{持|も}}つY`, il nome finale Y è ciò che possiede la caratteristica X.
  Qui Y è [呪文](term:term-spell), mentre X è il filtro lungo
  `{{手札|てふだ}}の{{枚数|まいすう}}{{以下|いか}}の[コスト](term:term-cost)`.
tags: [live-duel, grammar, modifier, property]
:::
