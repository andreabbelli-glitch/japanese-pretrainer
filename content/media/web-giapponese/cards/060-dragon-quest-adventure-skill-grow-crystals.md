---
id: cards-web-giapponese-dragon-quest-adventure-skill-grow-crystals
media_id: media-web-giapponese
slug: 060-dragon-quest-adventure-skill-grow-crystals
title: Dragon Quest app - 冒険スキルを手に入れよう
order: 60
segment_ref: dragon-quest-app
---

:::term
id: term-te-ni-ireru
cross_media_group: term-shared-te-ni-ireru
lemma: 手に入れる
reading: てにいれる
romaji: te ni ireru
meaning_it: ottenere; mettere le mani su
pos: verb
aliases: [手に入れよう, 手に入れると]
notes_it: >-
  [{{手|て}}に{{入|い}}れる](term:term-te-ni-ireru) significa ottenere qualcosa
  e portarlo nella propria disponibilità. Nel banner i cristalli non vengono
  solo “presi”: accumularli serve a sbloccare una skill.
level_hint: n4
:::

:::term
id: term-tojiru
cross_media_group: term-shared-tojiru
lemma: とじる
reading: とじる
romaji: tojiru
meaning_it: chiudere
pos: verb
aliases: [閉じる]
notes_it: >-
  `とじる` è il comando per chiudere una finestra, un menu o un popup. Può
  essere scritto anche `{{閉|と}}じる`, ma in questa schermata appare in
  hiragana come label UI semplice.
level_hint: n5
:::

:::term
id: term-teki
cross_media_group: term-shared-teki
lemma: 敵
reading: てき
romaji: teki
meaning_it: nemico
pos: noun
aliases: []
notes_it: >-
  [{{敵|てき}}](term:term-teki) indica il nemico come bersaglio o avversario.
  In `{{敵|てき}}を{{倒|たお}}すと`, è ciò che viene sconfitto per far partire
  il drop.
level_hint: n4
:::

:::term
id: term-otosu
cross_media_group: term-shared-otosu
lemma: 落とす
reading: おとす
romaji: otosu
meaning_it: far cadere; lasciare cadere
pos: verb
aliases: [落とすぞ]
notes_it: >-
  [{{落|お}}とす](term:term-otosu) è transitivo: qualcuno o qualcosa fa cadere
  l'oggetto. In una schermata di gioco descrive spesso il drop lasciato dal
  nemico dopo una sconfitta.
level_hint: n4
:::

:::grammar
id: grammar-plain-to-consequence
cross_media_group: grammar-shared-plain-to-consequence
pattern: 〜すると
title: Condizione automatica con と
reading: すると
meaning_it: se/quando succede A, allora B segue naturalmente
aliases: [動詞普通形 + と, Vると, verbo piano + と]
notes_it: >-
  `と` dopo un verbo in forma piana collega un'azione alla sua conseguenza
  naturale, regolare o automatica. Nei tutorial di gioco è molto comune perché
  spiega cosa succede quando il giocatore compie una certa azione.
level_hint: n4
:::

:::card
id: card-web-giapponese-te-ni-ireru-recognition
lesson_id: lesson-web-giapponese-dragon-quest-adventure-skill-grow-crystals
entry_type: term
entry_id: term-te-ni-ireru
card_type: recognition
front: '{{手|て}}に{{入|い}}れる'
back: 'ottenere; mettere le mani su'
example_jp: >-
  アイテムを{{手|て}}に{{入|い}}れる。
example_it: >-
  Ottieni un item.
notes_it: >-
  [{{手|て}}に{{入|い}}れる](term:term-te-ni-ireru) è più idiomatico di una
  traduzione parola per parola: l'immagine è “far entrare nelle mani”, ma il
  valore naturale è ottenere qualcosa.
tags: [videogame, tutorial, reward]
:::

:::card
id: card-web-giapponese-tojiru-recognition
lesson_id: lesson-web-giapponese-dragon-quest-adventure-skill-grow-crystals
entry_type: term
entry_id: term-tojiru
card_type: recognition
front: 'とじる'
back: 'chiudere'
example_jp: >-
  このメニューをとじる。
example_it: >-
  Chiudo questo menu.
notes_it: >-
  `とじる` è una label UI diretta: chiude il popup o il menu attuale. La forma
  in hiragana rende il pulsante più immediato di `{{閉|と}}じる`.
tags: [ui, button, verb]
:::

:::card
id: card-web-giapponese-teki-recognition
lesson_id: lesson-web-giapponese-dragon-quest-adventure-skill-grow-crystals
entry_type: term
entry_id: term-teki
card_type: recognition
front: '{{敵|てき}}'
back: 'nemico'
example_jp: >-
  {{敵|てき}}をたおす。
example_it: >-
  Sconfiggo un nemico.
notes_it: >-
  [{{敵|てき}}](term:term-teki) è il bersaglio dell'azione. Nel banner è
  marcato da `を`, quindi è ciò che viene sconfitto.
tags: [videogame, battle, noun]
:::

:::card
id: card-web-giapponese-otosu-recognition
lesson_id: lesson-web-giapponese-dragon-quest-adventure-skill-grow-crystals
entry_type: term
entry_id: term-otosu
card_type: recognition
front: '{{落|お}}とす'
back: 'far cadere; lasciare cadere'
example_jp: >-
  {{敵|てき}}がアイテムを{{落|お}}とす。
example_it: >-
  Il nemico lascia cadere un item.
notes_it: >-
  [{{落|お}}とす](term:term-otosu) indica che qualcosa viene fatto cadere. In
  un gioco può corrispondere al drop: dopo la sconfitta, un nemico rilascia un
  oggetto.
tags: [videogame, reward, verb]
:::

:::card
id: card-web-giapponese-plain-to-consequence-concept
lesson_id: lesson-web-giapponese-dragon-quest-adventure-skill-grow-crystals
entry_type: grammar
entry_id: grammar-plain-to-consequence
card_type: concept
front: '〜すると'
back: >-
  verbo in forma piana + と: se/quando succede A, B segue come conseguenza
  naturale o automatica
example_jp: >-
  アイテムを{{手|て}}に{{入|い}}れると、スキルがふえる。
example_it: >-
  Quando ottieni un item, le skill aumentano.
notes_it: >-
  In `{{敵|てき}}をたおすと、アイテムを{{落|お}}とす`, `と` non significa “e”:
  introduce la condizione che fa scattare la conseguenza. È lo stesso schema di
  `グロウ{{結晶|けっしょう}}をたくさん{{手|て}}に{{入|い}}れると...`.
tags: [grammar, condition, videogame]
:::
