---
id: cards-tcg-generale-vanguard-tutorial-ride-deck-and-starting-order
media_id: media-tcg-generale
slug: vanguard-tutorial-ride-deck-and-starting-order
title: Vanguard - Tutorial ride deck e ordine di turno
order: 10
segment_ref: vanguard
---

:::term
id: term-ride-deck
lemma: ライドデッキ
reading: らいどでっき
romaji: raido dekki
meaning_it: ride deck / mazzo separato per la ride
notes_it: >-
  Nel tutorial Vanguard indica il mazzo separato da cui parte la progressione
  iniziale. Non è il deck principale da cui peschi durante la partita.
level_hint: custom
:::

:::term
id: term-grade-zero
lemma: グレード0
reading: ぐれーどぜろ
romaji: gureedo zero
meaning_it: grado 0
notes_it: >-
  Nel setup iniziale è il grado della carta che il gioco colloca per prima dal
  ride deck. Il numero specifica il punto di partenza della progressione.
level_hint: custom
:::

:::term
id: term-jidouteki
lemma: 自動的
reading: じどうてき
romaji: jidouteki
meaning_it: automatico / automaticamente
pos: adjectival noun
notes_it: >-
  Con `に` diventa un avverbio: `{{自動|じどう}}{{的|てき}}に` descrive un'azione
  eseguita automaticamente. Nel tutorial segnala che il sistema piazza la carta
  senza una scelta manuale del giocatore.
level_hint: n4
:::

:::term
id: term-janken
lemma: じゃんけん
reading: じゃんけん
romaji: janken
meaning_it: morra cinese
notes_it: >-
  Nel tutorial è la procedura usata per assegnare primo e secondo turno. Con
  `で` diventa il mezzo della decisione: `じゃんけんで{{決|き}}める`.
level_hint: n5
:::

:::term
id: term-katta-hou
lemma: 勝った方
reading: かったほう
romaji: katta hou
meaning_it: la parte che ha vinto
notes_it: >-
  `{{勝|か}}った` modifica `{{方|ほう}}`: il chunk indica il lato, player o gruppo
  che ha vinto il confronto appena fatto. Nella schermata Vanguard è il lato che
  ottiene il primo turno.
level_hint: n4
:::

:::term
id: term-senkou
lemma: 先攻
reading: せんこう
romaji: senkou
meaning_it: primo turno / andare per primi
aliases: [先攻, せんこう, going first]
notes_it: >-
  Nei TCG indica il lato che apre la partita. In questa schermata viene
  assegnato a chi vince a janken.
level_hint: custom
:::

:::term
id: term-koukou
lemma: 後攻
reading: こうこう
romaji: koukou
meaning_it: secondo turno / andare per secondi
aliases: [後攻, こうこう, going second]
notes_it: >-
  È il ruolo opposto a `{{先攻|せんこう}}`: il giocatore agisce dopo il lato che
  ha aperto la partita.
level_hint: custom
:::

:::card
id: card-jidouteki-recognition
lesson_id: lesson-tcg-generale-vanguard-tutorial-ride-deck-and-starting-order
entry_type: term
entry_id: term-jidouteki
card_type: recognition
front: '{{自動|じどう}}{{的|てき}}'
back: 'automatico; con `に`, automaticamente'
example_jp: >-
  ゲームではライドデッキのグレード{{0|ゼロ}}のカードが{{自動|じどう}}{{的|てき}}に{{置|お}}かれるよ。
example_it: >-
  Nel gioco, la carta di grado 0 del ride deck viene messa automaticamente.
notes_it: >-
  `{{自動|じどう}}{{的|てき}}に` modifica il verbo: non descrive la carta, ma il
  modo in cui viene collocata. Qui il piazzamento è eseguito dal sistema.
tags: [vanguard, tutorial, setup]
:::

:::card
id: card-katta-hou-recognition
lesson_id: lesson-tcg-generale-vanguard-tutorial-ride-deck-and-starting-order
entry_type: term
entry_id: term-katta-hou
card_type: recognition
front: '{{勝|か}}った{{方|ほう}}'
back: 'la parte / il giocatore che ha vinto'
example_jp: >-
  {{勝|か}}った{{方|ほう}}が{{先攻|せんこう}}だよ。
example_it: >-
  Chi ha vinto va per primo.
notes_it: >-
  `{{方|ほう}}` qui non è una direzione fisica: dopo `{{勝|か}}った` indica il
  lato o player vincente, quello a cui viene assegnato `{{先攻|せんこう}}`.
tags: [vanguard, tutorial, starting-order]
:::
