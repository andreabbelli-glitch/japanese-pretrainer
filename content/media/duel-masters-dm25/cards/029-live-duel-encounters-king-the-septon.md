---
id: cards-duel-masters-dm25-live-duel-encounters-king-the-septon
media_id: media-duel-masters-dm25
slug: live-duel-encounters-king-the-septon
title: Carte incontrate in partita 9 - King the Septon e il filtro sui 3 topdeck
order: 58
segment_ref: live-duel-encounters
---

:::grammar
id: grammar-to-onaji
pattern: ～と同じ
title: Uguale a X / lo stesso di X
reading: とおなじ
meaning_it: uguale a X / lo stesso di X
aliases: [と同じ]
notes_it: >-
  In giapponese generale `～と{{同|おな}}じ` serve a dire che una cosa coincide
  con un'altra per identita o proprieta: la stessa persona, lo stesso colore,
  lo stesso costo. Nel rules text di Duel Masters il nucleo non cambia, ma il
  chunk diventa un filtro operativo. In `それと{{同|おな}}じコスト`, `それ`
  riprende la creatura appena messa nel battle zone e `と{{同|おな}}じ` ti
  obbliga a prendere solo le carte che condividono proprio quel costo.
level_hint: n4
:::

:::term
id: term-junban
lemma: 順番
reading: じゅんばん
romaji: junban
meaning_it: ordine / sequenza / turno nella fila
pos: noun
aliases: [順番, じゅんばん, junban, order]
notes_it: >-
  In giapponese generale `{{順番|じゅんばん}}` e l'ordine in cui le cose si
  susseguono: la fila, l'ordine dei turni, la sequenza di passi. Nel rules text
  di Duel Masters questo valore resta uguale, ma diventa procedurale. In
  `ランダムな{{順番|じゅんばん}}で`, il testo non ti lascia scegliere come
  rimettere le carte: l'ordine finale deve essere casuale.
level_hint: n4
:::

:::card
id: card-sorera-subete-jokers-condition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-king-the-septon
entry_type: grammar
entry_id: grammar-sorera
card_type: concept
front: 'それらが{{すべて|すべて}}ジョーカーズなら'
back: se tutte quelle carte sono Jokerz
example_jp: >-
  それらが{{すべて|すべて}}ジョーカーズなら、その{{中|なか}}から
  クリーチャー{{1枚|いちまい}}を[バトルゾーン](term:term-battle-zone)に
  {{出|だ}}す。
example_it: >-
  Se tutte quelle carte sono Jokerz, ne mette una creatura nel battle zone.
notes_it: >-
  `それら` richiama il gruppo appena rivelato; `すべて` impone un controllo
  totale. Basta un solo non-Jokerz per far saltare questo ramo.
tags: [live-duel, grammar, scope, condition]
:::

:::card
id: card-sono-naka-kara-selection
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-king-the-septon
entry_type: grammar
entry_id: grammar-sorera
card_type: concept
front: 'その{{中|なか}}からクリーチャー{{1枚|いちまい}}をバトルゾーンに{{出|だ}}す'
back: scegli una creatura da quel gruppo e mettila nel battle zone
example_jp: >-
  その{{中|なか}}からクリーチャー{{1枚|いちまい}}を
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}す](term:term-dasu)。
example_it: >-
  Da quel gruppo mette una creatura nel battle zone.
notes_it: >-
  `その中から` restringe la scelta al gruppo appena passato nel filtro. Qui è
  il ponte tra il controllo totale e la scelta del singolo pezzo.
tags: [live-duel, grammar, selection]
:::

:::card
id: card-sore-to-onaji-cost
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-king-the-septon
entry_type: grammar
entry_id: grammar-to-onaji
card_type: concept
front: 'それと{{同|おな}}じコスト'
back: costo uguale a quello
example_jp: >-
  その{{後|あと}}、{{残|のこ}}りの{{中|なか}}から、それと{{同|おな}}じ
  コストのカードを{{すべて|すべて}}{{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Poi, tra le carte rimaste, aggiunge in mano tutte le carte con lo stesso
  costo di quella.
notes_it: >-
  In giapponese generale `それと{{同|おな}}じ` vuol dire semplicemente `uguale a
  quello`. In questa carta `それ` non e vago: punta alla creatura appena messa
  nel battle zone, e `と{{同|おな}}じ` copia proprio il suo costo per usarlo come
  filtro sulle carte rimaste.
tags: [live-duel, grammar, filter, reference]
:::

:::card
id: card-junban-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-king-the-septon
entry_type: term
entry_id: term-junban
card_type: recognition
front: '{{順番|じゅんばん}}'
back: ordine / sequenza
example_jp: >-
  {{残|のこ}}りをランダムな{{順番|じゅんばん}}で
  {{山札|やまふだ}}の{{一番下|いちばんした}}に{{置|お}}く。
example_it: >-
  Mette il resto in fondo al mazzo in ordine casuale.
notes_it: >-
  In giapponese generale `{{順番|じゅんばん}}` e l'ordine in cui le cose si
  susseguono. In questa carta conta perche il testo ti toglie il controllo
  sull'ordine finale: non scegli tu come sistemare le carte rimaste, devono
  finire sotto al mazzo in un ordine casuale.
tags: [live-duel, term, procedure, order]
:::
