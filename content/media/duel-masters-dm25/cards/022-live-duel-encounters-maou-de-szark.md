---
id: cards-duel-masters-dm25-live-duel-encounters-maou-de-szark
media_id: media-duel-masters-dm25
slug: live-duel-encounters-maou-de-szark
title: Carte incontrate in partita 2 - De Szark, 無月の門 e Magic Tool
order: 51
segment_ref: live-duel-encounters
---

:::term
id: term-maou-de-szark
lemma: 魔凰 デ・スザーク
reading: まおう で すざーく
romaji: maou de suzaaku
meaning_it: De Szark / boss che sfrutta 無月の門
pos: proper-noun
aliases: [魔凰 デ・スザーク, デ・スザーク, maou de suzaaku, de szark]
notes_it: >-
  È il nome proprio del finisher principale di questo pacchetto oscuro. Quando
  leggi `デ・スザーク`, non stai guardando un mostro qualsiasi: stai guardando
  il payoff che entra sfruttando [無月の門](term:term-mugestsu-no-mon) e quattro
  [魔導具](term:term-madougu).
level_hint: custom
:::

:::term
id: term-madougu
lemma: 魔導具
reading: まどうぐ
romaji: madougu
meaning_it: Magic Tool / famiglia di carte oscure
pos: noun
aliases: [魔導具, madougu, Magic Tool]
notes_it: >-
  Nel rules text non significa un generico "oggetto magico". È il nome di un
  gruppo preciso di carte che viene usato come filtro, per esempio in
  `コスト4以下の魔導具` o nei trigger di [無月の門](term:term-mugestsu-no-mon).
level_hint: custom
:::

:::term
id: term-master-dolszak
lemma: マスター・ドルスザク
reading: ますたー どるすざく
romaji: masutaa dorusuzaku
meaning_it: Master Dolszak / razza boss dei De Szark
pos: noun
aliases: [マスター・ドルスザク, masutaa dorusuzaku, Master Dolszak]
notes_it: >-
  Compare nella riga `種族` delle carte De Szark. È una razza molto verticale,
  ma utile da riconoscere perché segnala subito che la carta appartiene al
  gruppo dei boss costruiti sopra i [魔導具](term:term-madougu).
level_hint: custom
:::

:::term
id: term-mafi-gang
lemma: マフィ・ギャング
reading: まふぃ ぎゃんぐ
romaji: mafi gyangu
meaning_it: Mafi Gang / razza di creature oscure
pos: noun
aliases: [マフィ・ギャング, mafi gyangu, Mafi Gang]
notes_it: >-
  È una razza ricorrente nell'area oscura del corpus. Quando compare insieme a
  [魔導具](term:term-madougu), spesso segnala carte che ruotano intorno a
  vantaggio sporco, cimitero e giocata obliqua.
level_hint: custom
:::

:::term
id: term-mugestsu-no-mon
lemma: 無月の門
reading: むげつのもん
romaji: mugetsu no mon
meaning_it: Gate of Moonless Night / keyword di evocazione gratis dei De Szark
pos: keyword
aliases: [無月の門, mugetsu no mon, Gate of Moonless Night]
notes_it: >-
  È la keyword che fa partire l'ingresso dei De Szark quando un tuo
  [魔導具](term:term-madougu) entra nel battle zone. Il blocco importante da
  leggere insieme è `2つずつ選び` + `それら4枚の上に` +
  `コストを払わずに召喚してもよい`.
level_hint: custom
:::

:::grammar
id: grammar-zutsu
pattern: ～ずつ
title: Quantità distribuita per ogni gruppo
reading: ずつ
meaning_it: N ciascuno / N per ciascun gruppo
aliases: [ずつ]
notes_it: >-
  Distribuisce la stessa quantità su ogni elemento o gruppo nominato. In
  `バトルゾーンと墓地から2つずつ選び`, il senso corretto è `due dal battle zone e
  due dal cimitero`, non `quattro in totale da dove vuoi`.
level_hint: n4
:::

:::card
id: card-maou-de-szark-recognition
entry_type: term
entry_id: term-maou-de-szark
card_type: recognition
front: '{{魔凰|まおう}} デ・スザーク'
back: De Szark / boss che entra con 無月の門
example_jp: >-
  {{魔凰|まおう}} デ・スザークは、{{4枚|よんまい}}の
  {{魔導具|まどうぐ}}の{{上|うえ}}に{{重|かさ}}なる。
example_it: >-
  De Szark si sovrappone sopra quattro Magic Tool.
notes_it: >-
  Il nome proprio vale la pena di essere fissato perché è il payoff centrale
  del pacchetto `無月の門`: quando lo riconosci al volo, leggi il resto della
  frase con molta meno fatica.
tags: [live-duel, proper-name, boss]
:::

:::card
id: card-madougu-recognition
entry_type: term
entry_id: term-madougu
card_type: recognition
front: '{{魔導具|まどうぐ}}'
back: Magic Tool / famiglia di carte oscure
example_jp: >-
  {{魔導具|まどうぐ}}が{{出|で}}た{{時|とき}}、{{無月|むげつ}}の{{門|もん}}が
  {{動|うご}}く。
example_it: >-
  Quando entra un Magic Tool, Gate of Moonless Night si mette in moto.
notes_it: >-
  `魔導具` è un filtro ricorrente, non un termine ornamentale. Riconoscerlo
  bene sblocca sia i trigger di De Szark sia frasi come `コスト4以下の魔導具`.
tags: [live-duel, tribe, filter]
:::

:::card
id: card-mugestsu-no-mon-recognition
entry_type: term
entry_id: term-mugestsu-no-mon
card_type: recognition
front: '{{無月|むげつ}}の{{門|もん}}'
back: keyword che evoca gratis De Szark sopra 4 Magic Tool
example_jp: >-
  {{無月|むげつ}}の{{門|もん}}で、{{墓地|ぼち}}の{{魔導具|まどうぐ}}まで
  {{素材|そざい}}にできる。
example_it: >-
  Con Gate of Moonless Night puoi usare come materiale perfino Magic Tool dal
  cimitero.
notes_it: >-
  Qui la keyword non va memorizzata come etichetta astratta: va collegata
  subito al suo chunk operativo, cioè scegliere `2つずつ` e poi evocare senza
  pagare il costo.
tags: [live-duel, keyword, boss]
:::

:::card
id: card-zutsu-concept
entry_type: grammar
entry_id: grammar-zutsu
card_type: concept
front: >-
  バトルゾーンと{{墓地|ぼち}}から2つずつ{{選|えら}}ぶ
back: scegli due dal battle zone e due dal cimitero
example_jp: >-
  `2つずつ`だから、{{片方|かたほう}}だけから{{4枚|よんまい}}は
  {{選|えら}}べない。
example_it: >-
  Siccome c'è `2つずつ`, non puoi sceglierne quattro tutte dalla stessa zona.
notes_it: >-
  `ずつ` distribuisce la quantità in modo rigido. Qui è il pezzo grammaticale
  che impedisce una lettura vaga del costo di [無月の門](term:term-mugestsu-no-mon).
tags: [live-duel, grammar, distribution]
:::

:::card
id: card-mugestsu-no-mon-operational-concept
entry_type: term
entry_id: term-mugestsu-no-mon
card_type: concept
front: >-
  {{自分|じぶん}}の{{魔導具|まどうぐ}}が{{出|で}}た{{時|とき}}、
  {{4枚|よんまい}}の{{魔導具|まどうぐ}}の{{上|うえ}}にコストを{{払|はら}}わずに
  {{召喚|しょうかん}}してもよい
back: >-
  Quando entra un tuo Magic Tool, puoi evocare questa carta senza pagare il
  costo sopra quattro Magic Tool scelti.
example_jp: >-
  {{無月|むげつ}}の{{門|もん}}は、{{出|で}}た{{時|とき}}の
  {{魔導具|まどうぐ}}をきっかけにして{{大型|おおがた}}を{{呼|よ}}ぶ。
example_it: >-
  Gate of Moonless Night usa l'ingresso di un Magic Tool come innesco per
  chiamare il boss.
notes_it: >-
  Il valore didattico del chunk sta nel montaggio: trigger d'ingresso,
  materiale distribuito con `ずつ` e payoff finale `払わずに召喚してもよい`.
tags: [live-duel, chunk, keyword, summon]
:::
