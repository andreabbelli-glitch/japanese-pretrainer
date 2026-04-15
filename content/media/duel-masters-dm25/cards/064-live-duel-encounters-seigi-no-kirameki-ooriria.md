---
id: cards-duel-masters-dm25-live-duel-encounters-seigi-no-kirameki-ooriria
media_id: media-duel-masters-dm25
slug: live-duel-encounters-seigi-no-kirameki-ooriria
title: Carte incontrate in partita 43 - Orlilia, ラビリンス e confronto degli scudi
order: 92
segment_ref: live-duel-encounters
---

:::term
id: term-labyrinth
lemma: ラビリンス
reading: らびりんす
romaji: rabirinsu
meaning_it: Labyrinth / keyword che si accende se hai più scudi dell'avversario
pos: keyword
aliases: [ラビリンス, rabirinsu, Labyrinth]
notes_it: >-
  Come parola richiama il `labirinto`, presa dal lessico inglese e riscritta
  in katakana. In Duel Masters però `ラビリンス` non è un nome ornamentale:
  è una keyword che annuncia subito un controllo di soglia tra il tuo numero di
  scudi e quello dell'avversario. Quando la vedi, sai che la riga sotto non si
  attiva sempre, ma solo se quel vantaggio di scudi esiste davvero.
level_hint: custom
:::

:::term
id: term-kazu
lemma: 数
reading: かず
romaji: kazu
meaning_it: numero / quantità / conteggio
pos: noun
aliases: [数, かず, kazu]
notes_it: >-
  In giapponese generale `{{数|かず}}` è il numero o la quantità di qualcosa.
  Nel rules text di Duel Masters compare spesso dopo una zona o un gruppo già
  nominato e lo trasforma nel conteggio che verrà confrontato, limitato o usato
  come soglia. In `シールドの{{数|かず}}`, il punto non è quali scudi hai, ma
  quanti scudi risultano presenti in quel momento.
level_hint: n4
:::

:::grammar
id: grammar-seigi-no-shield-count-yori-ookereba
pattern: 自分のシールドの数が相手より多ければ
title: Se i tuoi scudi sono più di quelli dell'avversario
reading: じぶんのしーるどのかずがあいてよりおおければ
meaning_it: se il numero dei tuoi scudi è maggiore di quello dell'avversario
aliases: [自分のシールドの数が相手より多ければ]
notes_it: >-
  In giapponese generale `AがBより{{多|おお}}ければ` costruisce un confronto:
  `se A è più di B`. Nel rules text di Duel Masters questa struttura diventa
  una soglia relativa. Qui `{{自分|じぶん}}のシールドの{{数|かず}}` è il tuo
  conteggio, e `{{相手|あいて}}より` usa il comparativo standard `rispetto a`.
  La piccola particolarità è che il testo taglia via il secondo
  `シールドの{{数|かず}}`: la forma piena sarebbe
  `{{相手|あいて}}のシールドの{{数|かず}}より`. È quindi un'ellissi normale da
  rules text compatto, non un uso anomalo di `より`. Il possibile effetto di
  `ribaltamento` nasce solo perché per un lettore italiano `{{相手|あいて}}より`
  spicca molto presto nella frase; ma `より` marca soltanto il termine di
  paragone, non il protagonista dell'aggettivo. Il protagonista è il soggetto
  con `が`, cioè `{{自分|じぶん}}のシールドの{{数|かず}}`. `{{多|おお}}ければ`
  chiede quindi che il tuo conteggio superi davvero quel benchmark. Non basta
  avere `molti` scudi in astratto: devi averne più dell'altro giocatore.
level_hint: n3
:::

:::card
id: card-labyrinth-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-seigi-no-kirameki-ooriria
entry_type: term
entry_id: term-labyrinth
card_type: recognition
front: ラビリンス
back: Labyrinth / keyword che si attiva solo se hai più scudi dell'avversario
example_jp: >-
  ラビリンスなら、{{自分|じぶん}}のシールドの{{数|かず}}が
  {{相手|あいて}}より{{多|おお}}い{{時|とき}}だけ、
  {{追加|ついか}}の{{効果|こうか}}が{{働|はたら}}く。
example_it: >-
  Se c'è Labyrinth, l'effetto aggiuntivo funziona solo quando hai più scudi
  dell'avversario.
notes_it: >-
  Vale la pena fissarla perché nel corpus Metallica non è una scritta
  decorativa. Come parola resta riconoscibile anche fuori dal gioco, ma nel
  rules text diventa il segnale operativo che ti ordina di confrontare i due
  conteggi di scudi prima di leggere il resto.
tags: [live-duel, keyword, shield-threshold, metallica]
:::

:::card
id: card-kazu-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-seigi-no-kirameki-ooriria
entry_type: term
entry_id: term-kazu
card_type: recognition
front: '{{数|かず}}'
back: numero / quantità / conteggio
example_jp: >-
  シールドの{{数|かず}}を{{見|み}}る{{時|とき}}は、
  {{何枚|なんまい}}あるかを{{数|かぞ}}えてから
  {{条件|じょうけん}}を{{確|たし}}かめる。
example_it: >-
  Quando il testo ti fa guardare il numero degli scudi, prima conti quante
  carte ci sono e poi controlli la condizione.
notes_it: >-
  In generale `{{数|かず}}` è il numero di qualcosa. Nel rules text torna utile
  perché chiude un gruppo appena nominato e lo trasforma nel dato che il gioco
  confronterà davvero, come in `シールドの{{数|かず}}`.
tags: [live-duel, term, counting, threshold]
:::

:::card
id: card-shield-count-yori-ookereba-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-seigi-no-kirameki-ooriria
entry_type: grammar
entry_id: grammar-seigi-no-shield-count-yori-ookereba
card_type: concept
front: >-
  {{自分|じぶん}}のシールドの{{数|かず}}が{{相手|あいて}}より{{多|おお}}ければ
back: se il numero dei tuoi scudi è maggiore di quello dell'avversario
example_jp: >-
  `より`が{{比較|ひかく}}の{{基準|きじゅん}}で、
  `{{多|おお}}ければ`がその{{数|かず}}を{{上回|うわまわ}}るかどうかを
  {{見|み}}ている。
example_it: >-
  `Yori` fissa il benchmark del confronto, e `ookereba` controlla se il tuo
  conteggio lo supera davvero.
notes_it: >-
  Questa è la lettura da fissare per intero. Il punto non è il solo
  `あれば`: qui la carta non controlla una soglia assoluta, ma un confronto
  relativo. `{{相手|あいて}}より` mette l'avversario come termine di paragone e
  `{{多|おお}}ければ` richiede un vantaggio reale di scudi, non una semplice
  parità.
tags: [live-duel, grammar, comparison, shield-threshold]
:::
