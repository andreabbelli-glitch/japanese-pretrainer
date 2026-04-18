---
id: cards-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
media_id: media-web-giapponese
slug: 030-dmps-takaratomy-deckbuilder-create-or-code-input
title: デッキ編成
order: 30
segment_ref: dmps-takaratomy-deckbuilder
---

:::grammar
id: grammar-state-de
pattern: 新規で〜する
title: 状態・条件の で
reading: しんきで〜する
meaning_it: fare qualcosa in quello stato o con quell'impostazione
notes_it: >-
  In [{{新規|しんき}}](term:term-shinki)でデッキを
  [{{作成|さくせい}}する](term:term-sakusei-suru), `で` non indica il luogo.
  Marca il frame operativo: creare il deck come nuova lista, cioè da zero e non
  a partire da un codice o da una lista già pronta.
level_hint: n4
:::

:::term
id: term-shinki
lemma: 新規
reading: しんき
romaji: shinki
meaning_it: nuovo; da zero; come nuova creazione
notes_it: >-
  In una UI [{{新規|しんき}}](term:term-shinki) segnala l'avvio di qualcosa di
  nuovo. Qui, dentro [{{新規|しんき}}](term:term-shinki)でデッキを
  [{{作成|さくせい}}する](term:term-sakusei-suru), vuol dire che parti da una
  lista nuova e non da un codice già pronto.
level_hint: n4
:::

:::card
id: card-web-giapponese-shinki-recognition
lesson_id: lesson-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
entry_type: term
entry_id: term-shinki
card_type: recognition
front: '{{新規|しんき}}'
back: 'nuovo; da zero'
example_jp: >-
  {{新規|しんき}}でデッキを{{作成|さくせい}}する。
example_it: >-
  Creo un deck nuovo da zero.
notes_it: >-
  In questo contesto [{{新規|しんき}}](term:term-shinki) non è “ultimo” o
  “appena arrivato”: indica il fatto che la lista nasce nuova.
tags: [web, ui, create]
:::

:::term
id: term-sakusei-suru
lemma: 作成する
reading: さくせいする
romaji: sakusei suru
meaning_it: creare; generare
notes_it: >-
  È un verbo operativo molto comune nelle interfacce. Qui indica la creazione
  concreta di un nuovo deck, non la sua selezione o il suo
  caricamento da un codice.
level_hint: n4
:::

:::card
id: card-web-giapponese-sakusei-suru-recognition
lesson_id: lesson-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
entry_type: term
entry_id: term-sakusei-suru
card_type: recognition
front: '{{作成|さくせい}}する'
back: 'creare; generare'
example_jp: >-
  デッキを{{作成|さくせい}}する。
example_it: >-
  Creo il deck.
notes_it: >-
  [{{作成|さくせい}}する](term:term-sakusei-suru) è il verbo della creazione
  da zero. In questa schermata si oppone bene al flusso di
  [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) un codice già esistente.
tags: [web, ui, create]
:::

:::term
id: term-deck-code
lemma: デッキコード
reading: でっきこーど
romaji: dekki koodo
meaning_it: codice del deck; deck code
notes_it: >-
  È il codice testuale che rappresenta una lista già costruita. In questa
  pagina serve per richiamare o condividere un deck senza ricrearlo carta per
  carta.
level_hint: custom
:::

:::card
id: card-web-giapponese-deck-code-recognition
lesson_id: lesson-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
entry_type: term
entry_id: term-deck-code
card_type: recognition
front: 'デッキコード'
back: 'codice del deck; deck code'
example_jp: >-
  デッキコードを{{入力|にゅうりょく}}する。
example_it: >-
  Inserisco il deck code.
notes_it: >-
  [デッキコード](term:term-deck-code) non è il nome libero del mazzo: è una
  stringa tecnica che richiama una lista precisa.
tags: [web, ui, import]
:::

:::term
id: term-nyuryoku-suru
lemma: 入力する
reading: にゅうりょくする
romaji: nyuuryoku suru
meaning_it: inserire; digitare; immettere
notes_it: >-
  In una UI [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) vuol dire
  mettere un valore dentro un campo. Qui l'oggetto è
  [デッキコード](term:term-deck-code), quindi il gesto concreto è digitare o
  incollare il codice del deck.
level_hint: n4
:::

:::card
id: card-web-giapponese-nyuryoku-suru-recognition
lesson_id: lesson-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
entry_type: term
entry_id: term-nyuryoku-suru
card_type: recognition
front: '{{入力|にゅうりょく}}する'
back: 'inserire; digitare'
example_jp: >-
  コードを{{入力|にゅうりょく}}する。
example_it: >-
  Inserisco il codice.
notes_it: >-
  [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) qui è il verbo del
  campo di testo: prima immetti il valore, poi confermi con `{{決定|けってい}}`.
tags: [web, ui, input]
:::
