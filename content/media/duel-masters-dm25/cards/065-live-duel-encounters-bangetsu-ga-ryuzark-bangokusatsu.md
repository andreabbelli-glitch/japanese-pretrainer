---
id: cards-duel-masters-dm25-live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
media_id: media-duel-masters-dm25
slug: live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
title: Carte incontrate in partita 44 - 無月の門・絶, 6つ e mana utilizzabile
order: 93
segment_ref: live-duel-encounters
---

:::term
id: term-mugestsu-no-mon-zetsu
lemma: 無月の門・絶
reading: むげつのもんぜつ
romaji: mugetsu no mon zetsu
meaning_it: Gate of Moonless Night Zetsu / versione che si controlla a fine turno su un totale di sei Magic Tool
pos: keyword
aliases:
  [
    無月の門・絶,
    むげつのもんぜつ,
    mugetsu no mon zetsu,
    Gate of Moonless Night Zetsu
  ]
notes_it: >-
  È la variante di `{{無月|むげつ}}の{{門|もん}}` che non si accende quando un
  [{{魔導具|ま.どう.ぐ}}](term:term-madougu) entra in campo, ma si controlla
  alla fine di ogni turno. Il blocco utile da fissare insieme alla keyword è
  `{{各|かく}}ターンの{{終|お}}わりに` +
  `{{合計6|ごうけいむっ}}つ` +
  `それら{{6枚|ろくまい}}の{{上|うえ}}に`.
level_hint: custom
:::

:::term
id: term-muttsu
lemma: 6つ
reading: むっつ
romaji: muttsu
meaning_it: sei cose / sei elementi contati con il contatore generico つ
pos: counter-expression
aliases: [6つ, むっつ, muttsu]
notes_it: >-
  `つ` è il contatore generico e `{{6|むっ}}つ` è la sua lettura lessicalizzata
  per `sei`. In questa carta non indica un numero astratto: fissa la quantità
  totale di [{{魔導具|ま.どう.ぐ}}](term:term-madougu) che devi raccogliere per
  aprire `{{無月|むげつ}}の{{門|もん}}・{{絶|ぜつ}}`.
level_hint: n4
:::

:::term
id: term-shiyou-kanou
lemma: 使用可能
reading: しようかのう
romaji: shiyou kanou
meaning_it: utilizzabile / disponibile all'uso
pos: na-adjective
aliases: [使用可能, しようかのう, shiyou kanou]
notes_it: >-
  In giapponese generale vuol dire `utilizzabile`, `che si può usare`. Nella
  resa app-side di Duel Masters diventa utile in espressioni come
  `{{使用可能|しようかのう}}マナ`, dove il punto non è quanta mana esiste in
  totale, ma quanta mana resta davvero spendibile in quel turno. Il blocco
  riusa [{{使用|しよう}}](term:term-use) già noto e lo restringe con
  `{{可能|かのう}}`.
level_hint: n4
:::

:::card
id: card-mugestsu-no-mon-zetsu-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
entry_type: term
entry_id: term-mugestsu-no-mon-zetsu
card_type: recognition
front: '{{無月|むげつ}}の{{門|もん}}・{{絶|ぜつ}}'
back: Gate of Moonless Night Zetsu / variante che si controlla a fine turno su sei Magic Tool totali
example_jp: >-
  {{各|かく}}ターンの{{終|お}}わりに、
  {{魔導具|ま.どう.ぐ}}が{{合計6|ごうけいむっ}}つあれば、
  {{無月|むげつ}}の{{門|もん}}・{{絶|ぜつ}}が{{動|うご}}く。
example_it: >-
  Alla fine di ogni turno, se ci sono sei Magic Tool in totale, si attiva
  Gate of Moonless Night Zetsu.
notes_it: >-
  Il punto utile non è solo riconoscere il nome della keyword, ma ricordare che
  qui il controllo arriva a fine turno e su un totale combinato, non su una
  ripartizione fissa `{{2|ふた}}つずつ`.
tags: [live-duel, keyword, magic-tool, timing]
:::

:::card
id: card-muttsu-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
entry_type: term
entry_id: term-muttsu
card_type: recognition
front: '{{6|むっ}}つ'
back: sei cose / sei elementi
example_jp: >-
  この{{効果|こうか}}では、
  {{魔導具|ま.どう.ぐ}}を{{6|むっ}}つ{{選|えら}}ぶ。
example_it: >-
  In questo effetto scegli sei Magic Tool.
notes_it: >-
  Vale la pena fissarlo perché qui `{{6|むっ}}つ` non è un numero neutro:
  decide esattamente quando la procedura della keyword può partire.
tags: [live-duel, quantity, counter, rules-text]
:::

:::card
id: card-goukei-muttsu-erabu-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
entry_type: term
entry_id: term-goukei
card_type: concept
front: '{{合計6|ごうけいむっ}}つ{{選|えら}}ぶ'
back: scegliere sei in totale
example_jp: >-
  {{合計6|ごうけいむっ}}つだから、バトルゾーンと
  {{墓地|ぼち}}の{{内訳|うちわけ}}は{{自由|じゆう}}でもよい。
example_it: >-
  Siccome è un totale di sei, la ripartizione fra battle zone e cimitero può
  essere libera.
notes_it: >-
  Qui [{{合計|ごうけい}}](term:term-goukei) è il pezzo che chiude il dubbio
  sulla distribuzione. A differenza di
  `{{2|ふた}}つずつ`, non impone `quanti per zona`, ma solo il totale
  finale richiesto.
tags: [live-duel, quantity, total, procedure]
:::

:::card
id: card-shiyou-kanou-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
entry_type: term
entry_id: term-shiyou-kanou
card_type: recognition
front: '{{使用可能|しようかのう}}'
back: utilizzabile / disponibile all'uso
example_jp: >-
  {{使用可能|しようかのう}}マナだけが、このターンに
  {{使|つか}}えるマナになる。
example_it: >-
  Solo la mana utilizzabile è davvero spendibile in questo turno.
notes_it: >-
  In generale vuol dire `utilizzabile`. Nella resa app-side di Duel Masters
  serve a separare la mana `presente` dalla mana che resta concretamente
  spendibile dopo il lock o dopo l'untap.
tags: [live-duel, term, app-wording, mana]
:::

:::card
id: card-sanmai-made-shika-untap-dekinai-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
entry_type: grammar
entry_id: grammar-shika
card_type: concept
front: '{{3枚|さんまい}}までしかアンタップできない'
back: non può stappare più di 3 carte
example_jp: >-
  {{相手|あいて}}は{{自身|じしん}}のマナゾーンのカードを
  {{3枚|さんまい}}までしかアンタップできない。
example_it: >-
  L'avversario non può stappare più di tre carte del proprio mana zone.
notes_it: >-
  Qui `しか ... ない` mette un tetto rigido. La formulazione stampata della
  carta parla di [アンタップ](term:term-untap) delle carte, quindi il blocco da
  fissare è il limite `non più di tre`.
tags: [live-duel, grammar, limit, mana-lock]
:::

:::card
id: card-shiyou-kanou-mana-san-shika-kaifuku-shinai-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-bangetsu-ga-ryuzark-bangokusatsu
entry_type: grammar
entry_id: grammar-shika
card_type: concept
front: '{{使用可能|しようかのう}}マナは{{3|さん}}しか{{回復|かいふく}}しない'
back: si recuperano solo 3 mana utilizzabili
example_jp: >-
  アプリ{{表示|ひょうじ}}では、
  {{使用可能|しようかのう}}マナは{{3|さん}}しか
  {{回復|かいふく}}しないと{{書|か}}かれることがある。
example_it: >-
  Nella resa dell'app può comparire la frase "si recuperano solo 3 mana
  utilizzabili".
notes_it: >-
  Questa è la parafrasi UI dello stesso lock espresso sulla carta con
  `{{3枚|さんまい}}までしかアンタップできない`. L'app mette a fuoco la mana
  `utilizzabile`, la carta stampata mette a fuoco l'[アンタップ](term:term-untap)
  delle carte.
tags: [live-duel, grammar, app-wording, mana-lock]
:::
