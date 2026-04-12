---
id: cards-duel-masters-dm25-live-duel-encounters-derzen-mondo-yume-no-ato
media_id: media-duel-masters-dm25
slug: live-duel-encounters-derzen-mondo-yume-no-ato
title: Carte incontrate in partita 34 - der`Zen Mondo e 残りのゲーム中
order: 83
segment_ref: live-duel-encounters
---

:::grammar
id: grammar-nokori-no-game-chuu
pattern: 残りのゲーム中
title: Per il resto della partita
reading: のこりのげーむちゅう
meaning_it: per il resto della partita / durante tutto ciò che resta della partita
aliases: [残りのゲーム中]
notes_it: >-
  In giapponese generale `{{残|のこ}}り` indica ciò che resta, mentre
  `ゲーム{{中|ちゅう}}` crea una durata `nel corso della partita`. Insieme il
  chunk non parla di un momento breve, ma di una cornice che resta attiva fino
  alla fine del match. Nel rules text questo è il segnale che la regola scritta
  dopo continua ad applicarsi per tutto il resto della partita.
level_hint: n3
:::

:::grammar
id: grammar-deck-empty-demo-makenai
pattern: 自分の山札にカードがなくなっても、自分はゲームに負けない
title: Non perdi anche se il mazzo si esaurisce
reading: じぶんのやまふだにかーどがなくなっても、じぶんはげーむにまけない
meaning_it: anche se nel tuo mazzo non restano carte, tu non perdi la partita
aliases:
  [
    自分の山札にカードがなくなっても、自分はゲームに負けない,
    山札にカードがなくなっても、自分はゲームに負けない
  ]
notes_it: >-
  Questo chunk vale la pena di essere fissato intero. In giapponese generale
  `なくなる` significa `sparire / esaurirsi`, mentre `～ても` costruisce una
  concessione: `anche se succede X`. Nel rules text di Duel Masters la frase
  riscrive una regola di sconfitta: anche se il tuo mazzo arriva a zero, il
  testo nega esplicitamente l'esito normale con
  `{{自分|じぶん}}はゲームに{{負|ま}}けない`.
level_hint: n3
:::

:::card
id: card-nokori-no-game-chuu-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-derzen-mondo-yume-no-ato
entry_type: grammar
entry_id: grammar-nokori-no-game-chuu
card_type: concept
front: '{{残|のこ}}りのゲーム{{中|ちゅう}}'
back: per il resto della partita
example_jp: >-
  `{{残|のこ}}りのゲーム{{中|ちゅう}}`と{{書|か}}かれていたら、
  その{{後|あと}}の{{文|ぶん}}は{{今|いま}}のターンだけでなく
  {{対戦|たいせん}}の{{最後|さいご}}まで{{続|つづ}}く。
example_it: >-
  Se trovi `nokori no game chuu`, la frase seguente non vale solo per questo
  turno ma continua fino alla fine della partita.
notes_it: >-
  Questo non è un semplice `durante il gioco`. `{{残|のこ}}り` aggiunge l'idea
  di `da qui in avanti, per tutto quello che resta`. In questa spell la frase
  apre la durata dentro cui la sconfitta da deck-out viene sospesa.
tags: [live-duel, grammar, duration, game-state]
:::

:::card
id: card-deck-empty-demo-makenai-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-derzen-mondo-yume-no-ato
entry_type: grammar
entry_id: grammar-deck-empty-demo-makenai
card_type: concept
front: >-
  {{自分|じぶん}}の{{山札|やまふだ}}にカードがなくなっても、
  {{自分|じぶん}}はゲームに{{負|ま}}けない
back: anche se il tuo mazzo resta senza carte, tu non perdi la partita
example_jp: >-
  [{{残|のこ}}りのゲーム{{中|ちゅう}}](grammar:grammar-nokori-no-game-chuu)、
  {{自分|じぶん}}の{{山札|やまふだ}}にカードがなくなっても、
  {{自分|じぶん}}はゲームに{{負|ま}}けない。
example_it: >-
  Per il resto della partita, anche se nel tuo mazzo non rimangono carte, tu
  non perdi la partita.
notes_it: >-
  Il blocco utile da memorizzare è la concessione intera. `カードがなくなる`
  descrive il mazzo che si esaurisce, `ても` dice `anche se`, e
  `{{負|ま}}けない` cancella l'esito normale. In questa carta il giapponese non
  dice `peschi in sicurezza` in astratto: dice con precisione che il deck-out
  non ti fa perdere.
tags: [live-duel, grammar, concession, deck-out]
:::
