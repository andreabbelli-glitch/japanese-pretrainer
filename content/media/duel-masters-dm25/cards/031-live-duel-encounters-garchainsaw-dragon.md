---
id: cards-duel-masters-dm25-live-duel-encounters-garchainsaw-dragon
media_id: media-duel-masters-dm25
slug: live-duel-encounters-garchainsaw-dragon
title: Carte incontrate in partita 11 - Garchainsaw Dragon e i limiti per turno
order: 60
segment_ref: live-duel-encounters
---

:::grammar
id: grammar-aite-hitori-nitsuki
pattern: 相手1人につき
title: Per ogni avversario
reading: あいてひとりにつき
meaning_it: per ogni avversario
aliases: [相手1人につき]
notes_it: >-
  `1人につき` distribuisce la stessa procedura su ogni avversario presente.
  In una partita a due giocatori il chunk si legge come `per l'avversario`,
  ma la formulazione resta valida anche in contesti con più avversari.
level_hint: custom
:::

:::grammar
id: grammar-kaku-turn-ni-ichido
pattern: 各ターンに一度
title: Una volta per turno
reading: かくたーんにいちど
meaning_it: una volta per turno
aliases: [各ターンに一度]
notes_it: >-
  `各` distribuisce il limite su ogni turno, mentre `一度` chiude il conteggio.
  Il risultato è un vincolo operativo che non permette di ripetere l'effetto
  più volte nello stesso turno.
level_hint: custom
:::

:::grammar
id: grammar-hajimete-shita-toki
pattern: はじめて～した時
title: Solo la prima volta che succede
reading: はじめて～したとき
meaning_it: quando succede per la prima volta
aliases: [はじめて～した時, はじめて～したとき]
notes_it: >-
  Il chunk non dice semplicemente `quando`: dice `quando accade per la prima
  volta`. Su questa carta il limite si applica alla prima rottura degli scudi
  nel turno, non a tutte le rotture successive.
level_hint: custom
:::

:::card
id: card-garchainsaw-per-opponent-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-garchainsaw-dragon
entry_type: grammar
entry_id: grammar-aite-hitori-nitsuki
card_type: concept
front: '[{{相手|あいて}}](term:term-opponent){{1人|ひとり}}につき'
back: per ogni avversario
example_jp: >-
  [{{相手|あいて}}](term:term-opponent){{1人|ひとり}}につき、
  [{{自分|じぶん}}](term:term-self)の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{1枚目|いちまいめ}}をタップして[マナゾーン](term:term-mana-zone)に{{置|お}}く。
example_it: >-
  Per ogni avversario, metti tappata nella mana zone la prima carta del tuo
  mazzo.
notes_it: >-
  In italiano suona naturale come `per ogni avversario`, ma il giapponese usa
  `1人につき` per legare la stessa procedura a ciascun avversario. È un chunk
  utile da riconoscere anche fuori da questa carta.
tags: [live-duel, grammar, quantifier]
:::

:::card
id: card-garchainsaw-once-per-turn-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-garchainsaw-dragon
entry_type: grammar
entry_id: grammar-kaku-turn-ni-ichido
card_type: concept
front: '{{各|かく}}ターンに{{一度|いちど}}'
back: una volta per turno
example_jp: >-
  {{各|かく}}ターンに{{一度|いちど}}、
  [{{自分|じぶん}}](term:term-self)のドラゴン・クリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}、
  [{{相手|あいて}}](term:term-opponent)のクリーチャーを{{1体|いったい}}{{選|えら}}んでもよい。
example_it: >-
  Una volta per turno, quando entra una tua creatura Dragon, puoi scegliere una
  creatura avversaria.
notes_it: >-
  `各` cambia il raggio del limite: non è `una volta` in astratto, ma
  `una volta per ogni turno`. Qui il chunk governa il blocco che porta alla
  scelta della creatura avversaria e al successivo battle.
tags: [live-duel, grammar, limit]
:::

:::card
id: card-garchainsaw-first-break-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-garchainsaw-dragon
entry_type: grammar
entry_id: grammar-hajimete-shita-toki
card_type: concept
front: 'はじめて～した{{時|とき}}'
back: quando succede per la prima volta
example_jp: >-
  {{各|かく}}ターン、
  はじめて[{{相手|あいて}}](term:term-opponent)のシールドをブレイクした
  {{時|とき}}、
  {{他|ほか}}の{{各|かく}}[{{相手|あいて}}](term:term-opponent)のシールドも
  {{1|ひと}}つずつブレイクする。
example_it: >-
  Ogni turno, quando questa creatura rompe per la prima volta gli scudi di un
  avversario, rompe anche gli altri scudi di ogni altro avversario uno a uno.
notes_it: >-
  Il punto non è il semplice `quando`, ma il fatto che l'effetto scatta solo
  alla prima occorrenza del turno. Questa è una forma molto utile da
  riconoscere quando un testo vuole limitare un trigger alla prima volta.
tags: [live-duel, grammar, trigger]
:::
