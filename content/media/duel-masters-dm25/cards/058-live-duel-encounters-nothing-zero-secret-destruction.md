---
id: cards-duel-masters-dm25-live-duel-encounters-nothing-zero-secret-destruction
media_id: media-duel-masters-dm25
slug: live-duel-encounters-nothing-zero-secret-destruction
title: Carte incontrate in partita 37 - 破界秘伝ナッシング・ゼロ e こうして / どちらか
order: 86
segment_ref: live-duel-encounters
---

:::term
id: term-sarani
lemma: さらに
reading: さらに
romaji: sarani
meaning_it: inoltre / in più / ulteriormente
pos: adverb
aliases: [さらに, sarani]
notes_it: >-
  In giapponese generale `さらに` aggiunge qualcosa a ciò che è già stato
  stabilito. Nel rules text di Duel Masters spesso non introduce un effetto
  separato, ma aumenta un risultato già in corso. In
  `シールドをさらに{{1枚|いちまい}}ブレイクする` il break extra si somma al
  break normale della creatura.
level_hint: n3
:::

:::grammar
id: grammar-koushite-misetamushoku-card-1-nitsuki
pattern: こうして見せた無色カード1枚につき
title: Per ogni carta incolore mostrata in questo modo
reading: こうしてみせたむしょくかーどいちまいにつき
meaning_it: per ogni carta incolore mostrata in questo modo
aliases: [こうして見せた無色カード1枚につき, こうして見せたカード1枚につき]
notes_it: >-
  `こうして` rimanda alla procedura appena descritta e significa `in questo
  modo`. `{{1枚|いちまい}}につき` distribuisce l'effetto una carta alla volta,
  quindi non stai sommando tutte le carte mostrate in un unico blocco.
level_hint: n3
:::

:::grammar
id: grammar-misetakado-wa-subete
pattern: 見せたカードはすべて
title: Tutte le carte mostrate
reading: みせたかーどはすべて
meaning_it: tutte le carte mostrate / l'intero gruppo mostrato
aliases: [見せたカードはすべて, 見せたカード]
notes_it: >-
  `見せた` è una relativa verbale: modifica `カード` e significa `le carte che hai
  mostrato`. `はすべて` chiude l'intero gruppo senza lasciare eccezioni. È utile
  quando il testo prima crea un insieme e poi ti dice di trattarlo nel suo
  complesso.
level_hint: n3
:::

:::grammar
id: grammar-yamafuda-no-ue-ka-shita-no-dochiraka-ni-modosu
pattern: 山札の上か下のどちらかに戻す
title: Rimetti in cima o in fondo, ma solo uno dei due
reading: やまふだのうえかしたのどちらかにもどす
meaning_it: rimettere in cima o in fondo al mazzo, scegliendo una sola delle due posizioni
aliases: [山札の上か下のどちらかに戻す, 上か下のどちらかに戻す]
notes_it: >-
  Il primo `か` oppone `上` e `下`. Il secondo `か` dentro `どちらか` stringe la
  scelta a una delle due sole opzioni. `好きな順序で` dice soltanto in quale
  ordine risolvi le carte mostrate; non cambia la scelta tra cima e fondo.
level_hint: n3
:::

:::card
id: card-sarani-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-nothing-zero-secret-destruction
entry_type: term
entry_id: term-sarani
card_type: recognition
front: さらに
back: inoltre / in più / ulteriormente
example_jp: >-
  このターン、[バトルゾーン](term:term-battle-zone)にある
  [{{自分|じぶん}}](term:term-self)の[クリーチャー](term:term-creature){{1体|いったい}}は
  シールドをさらに{{1枚|いちまい}}ブレイクする。
example_it: >-
  In questo turno una tua creatura nel battle zone rompe uno scudo in più.
notes_it: >-
  `さらに` non sostituisce il break normale: lo aumenta. In questa spell il
  punto utile è proprio il valore additivo, cioè `uno scudo in più` rispetto al
  numero già previsto.
tags: [live-duel, term, addition, break]
:::

:::card
id: card-koushite-misetamushoku-card-1-nitsuki-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-nothing-zero-secret-destruction
entry_type: grammar
entry_id: grammar-koushite-misetamushoku-card-1-nitsuki
card_type: concept
front: 'こうして{{見|み}}せた{{無色|むしょく}}カード{{1枚|いちまい}}につき'
back: per ogni carta incolore mostrata in questo modo
example_jp: >-
  こうして{{見|み}}せた{{無色|むしょく}}カード{{1枚|いちまい}}につき、
  このターン、[バトルゾーン](term:term-battle-zone)にある
  [{{自分|じぶん}}](term:term-self)の[クリーチャー](term:term-creature){{1体|いったい}}は
  シールドをさらに{{1枚|いちまい}}ブレイクする。
example_it: >-
  Per ogni carta incolore mostrata in questo modo, in questo turno una tua
  creatura nel battle zone rompe uno scudo in più.
notes_it: >-
  `こうして` riprende la procedura appena descritta: non introduce un evento
  nuovo, rimanda al reveal già fatto. `{{1枚|いちまい}}につき` distribuisce il
  payoff carta per carta, e [さらに](term:term-sarani) aggiunge uno scudo oltre
  al break base.
tags: [live-duel, grammar, reveal, distribution]
:::

:::card
id: card-misetakado-wa-subete-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-nothing-zero-secret-destruction
entry_type: grammar
entry_id: grammar-misetakado-wa-subete
card_type: concept
front: '{{見|み}}せたカードはすべて'
back: tutte le carte mostrate
example_jp: >-
  {{見|み}}せたカードはすべて、{{好|す}}きな{{順序|じゅんじょ}}で{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}か
  {{下|した}}のどちらかに{{戻|もど}}す。
example_it: >-
  Tutte le carte mostrate tornano, nell'ordine che preferisci, in cima o in
  fondo al tuo mazzo.
notes_it: >-
  `見せた` è una relativa verbale: modifica `カード` e forma `le carte che hai
  mostrato`. `はすべて` esaurisce il gruppo senza eccezioni.
tags: [live-duel, grammar, scope, reveal]
:::

:::card
id: card-yamafuda-no-ue-ka-shita-no-dochiraka-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-nothing-zero-secret-destruction
entry_type: grammar
entry_id: grammar-yamafuda-no-ue-ka-shita-no-dochiraka-ni-modosu
card_type: concept
front: '{{山札|やまふだ}}の{{上|うえ}}か{{下|した}}のどちらかに{{戻|もど}}す'
back: rimetti in cima o in fondo al mazzo, ma solo uno dei due
example_jp: >-
  {{見|み}}せたカードはすべて、{{好|す}}きな{{順序|じゅんじょ}}で{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}か
  {{下|した}}のどちらかに{{戻|もど}}す。
example_it: >-
  Tutte le carte mostrate tornano, nell'ordine che preferisci, in cima o in
  fondo al tuo mazzo.
notes_it: >-
  Il primo `か` oppone `上` e `下`. Il secondo `か` dentro `どちらか` chiude la
  scelta a una sola delle due posizioni. `好きな順序で` regola soltanto
  l'ordine di risoluzione, non il lato di destinazione.
tags: [live-duel, grammar, choice, deck-order]
:::
