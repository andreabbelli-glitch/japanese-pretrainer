---
id: cards-duel-masters-dm25-live-duel-encounters-babyponnosuke
media_id: media-duel-masters-dm25
slug: live-duel-encounters-babyponnosuke
title: Carte incontrate in partita 27 - Babyponnosuke, 大きい e 出る時
order: 76
segment_ref: live-duel-encounters
---

:::term
id: term-babyponnosuke
lemma: ベイビーポンの助
reading: べいびーぽんのすけ
romaji: beibiiponnosuke
meaning_it: Babyponnosuke / Joker che rimpiazza l'ingresso di creature avversarie troppo costose rispetto al mana avversario
pos: proper-noun
aliases: [ベイビーポンの助, Babyponnosuke, babyponnosuke]
notes_it: >-
  È il nome proprio della carta. Il valore didattico del nome non sta nel body
  da costo `{{1|いち}}`, ma nel collegarlo subito al blocco
  `{{枚数|まいすう}}よりコストが{{大|おお}}きい` e alla finestra
  `{{出|で}}る{{時|とき}}`, dove una soglia numerica diventa una sostituzione
  d'ingresso.
level_hint: custom
:::

:::term
id: term-ookii
lemma: 大きい
reading: おおきい
romaji: ookii
meaning_it: grande / alto; con costo = numericamente più alto
pos: i-adjective
aliases: [大きい, おおきい, ookii]
notes_it: >-
  In giapponese generale `{{大|おお}}きい` vuol dire `grande`. Nel rules text di
  Duel Masters, quando si lega a `コスト`, non descrive la dimensione fisica di
  una carta: indica che quel valore numerico è più alto del benchmark appena
  nominato. Per questo `Xよりコストが{{大|おお}}きい` va letto come `costo
  superiore a X`.
level_hint: n5
:::

:::card
id: card-babyponnosuke-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke
entry_type: term
entry_id: term-babyponnosuke
card_type: recognition
front: 'ベイビーポンの{{助|すけ}}'
back: Babyponnosuke / Joker che rimpiazza l'ingresso di creature sopra soglia
example_jp: >-
  ベイビーポンの{{助|すけ}}がいれば、
  {{枚数|まいすう}}よりコストが{{大|おお}}きいクリーチャーが
  {{出|で}}る{{時|とき}}に{{止|と}}められる。
example_it: >-
  Se c'è Babyponnosuke, una creatura che supera la soglia può essere fermata
  nel momento in cui entra.
notes_it: >-
  Il nome va legato subito al suo chunk distintivo: `より` fissa la soglia,
  `{{大|おお}}きい` segnala il superamento e `{{出|で}}る{{時|とき}}` apre la
  finestra in cui l'ingresso viene rimpiazzato.
tags: [live-duel, proper-name, jokers, replacement]
:::

:::card
id: card-ookii-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke
entry_type: term
entry_id: term-ookii
card_type: recognition
front: '{{大|おお}}きい'
back: grande / alto; con il costo = più alto numericamente
example_jp: >-
  コストが{{大|おお}}きいクリーチャーと{{言|い}}うとき、
  {{体|からだ}}が{{大|おお}}きいのではなく、
  コストの{{数字|すうじ}}が{{高|たか}}いという{{意味|いみ}}になる。
example_it: >-
  Quando una carta dice `creatura dal costo alto`, non parla della stazza ma
  del valore numerico del costo.
notes_it: >-
  È importante non tradurlo in automatico come `grossa creatura`. In una frase
  sui costi, `{{大|おお}}きい` prende il senso di `più alto`, `più grande come
  numero`.
tags: [live-duel, term, adjective, cost]
:::

:::card
id: card-yori-ookii-cost-threshold-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke
entry_type: grammar
entry_id: grammar-yori
card_type: concept
front: '{{枚数|まいすう}}よりコストが{{大|おお}}きい'
back: avere un costo superiore a quel numero di carte
example_jp: >-
  {{相手|あいて}}のマナゾーンにあるカードの{{枚数|まいすう}}より
  コストが{{大|おお}}きいクリーチャーが{{出|で}}る。
example_it: >-
  Entra una creatura il cui costo è più alto del numero di carte nel mana
  avversario.
notes_it: >-
  Qui il cuore è la coppia `より` + `{{大|おお}}きい`. `より` mette il
  benchmark; `{{大|おお}}きい` dice che il costo della creatura lo supera. È
  la lettura opposta di chunk come `よりコストが{{少|すく}}ない`, dove invece
  devi stare sotto la soglia.
tags: [live-duel, grammar, comparison, threshold]
:::

:::card
id: card-opponent-turn-bigger-than-mana-cost-enters-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke
entry_type: grammar
entry_id: grammar-toki
card_type: concept
front: >-
  {{相手|あいて}}のターン{{中|ちゅう}}に、
  {{枚数|まいすう}}よりコストが{{大|おお}}きい{{相手|あいて}}のクリーチャーが
  {{出|で}}る{{時|とき}}
back: quando, nel turno avversario, sta per entrare una creatura avversaria che supera quella soglia
example_jp: >-
  `{{出|で}}る{{時|とき}}`だから、
  {{入|はい}}ってからではなく{{入|はい}}る{{瞬間|しゅんかん}}に
  {{判定|はんてい}}する。
example_it: >-
  Siccome dice `quando entra`, il controllo avviene nel momento dell'ingresso,
  non dopo che la creatura è già rimasta sul campo.
notes_it: >-
  Questa è la card-sintesi del blocco completo. `{{相手|あいて}}のターン{{中|ちゅう}}に`
  chiude la finestra temporale, `{{枚数|まいすう}}よりコストが{{大|おお}}きい`
  definisce la soglia e `{{出|で}}る{{時|とき}}` marca il punto in cui la
  sostituzione può agganciarsi.
tags: [live-duel, grammar, timing, replacement]
:::
