---
id: cards-duel-masters-dm25-live-duel-encounters-felix-misery
media_id: media-duel-masters-dm25
slug: live-duel-encounters-felix-misery
title: Carte incontrate in partita 19 - Felix Misery, 場合 e でない
order: 68
segment_ref: live-duel-encounters
---

:::term
id: term-felix-misery
lemma: フェリックス・ミザリィ
reading: ふぇりっくす みざりぃ
romaji: ferikkusu mizarii
meaning_it: Felix Misery / NEO creature Darkness che si evoca dal cimitero e rianima su attacco
pos: proper-noun
aliases: [フェリックス・ミザリィ, Felix Misery, ferikkusu mizarii]
notes_it: >-
  È il nome proprio della carta. La lettura utile da fissare insieme a questo
  nome non è solo il corpo da `{{6000|ろくせん}}`, ma soprattutto il blocco
  `{{2体以上|にたいいじょう}}あれば{{墓地|ぼち}}から{{召喚|しょうかん}}してもよい`
  e il filtro `コスト{{6以下|ろくいか}}の、{{進化|しんか}}でない{{闇|やみ}}の
  クリーチャー{{1枚|いちまい}}`.
level_hint: custom
:::

:::grammar
id: grammar-de-nai
pattern: ～でない
title: Non essere X / non di quel tipo
reading: でない
meaning_it: non essere / che non è / non di quel tipo
aliases: [でない]
notes_it: >-
  In giapponese generale `でない` è la forma negativa collegata ai nomi e alle
  categorie: `non è X`, `non di tipo X`. Nel rules text di Duel Masters è molto
  utile perché funziona spesso come filtro tecnico. In
  `{{進化|しんか}}でない{{闇|やみ}}のクリーチャー`, la carta non sta descrivendo
  un'atmosfera o una mancanza vaga: sta escludendo con precisione le evolution
  creature dal gruppo dei bersagli validi.
level_hint: n4
:::

:::card
id: card-felix-misery-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-felix-misery
entry_type: term
entry_id: term-felix-misery
card_type: recognition
front: フェリックス・ミザリィ
back: Felix Misery / NEO creature Darkness che si evoca dal cimitero e rianima
example_jp: >-
  フェリックス・ミザリィは、{{自分|じぶん}}の{{闇|やみ}}のクリーチャーが
  {{2体以上|にたいいじょう}}あれば{{墓地|ぼち}}から{{召喚|しょうかん}}できる。
example_it: >-
  Se hai due o più creature Darkness, puoi evocare Felix Misery dal cimitero.
notes_it: >-
  Il nome va fissato come blocco unico. In questa lezione richiama subito una
  carta oscura che entra facilmente dal cimitero e poi converte l'attacco in
  self mill più rianimazione.
tags: [live-duel, proper-name, darkness, graveyard]
:::

:::card
id: card-felix-neo-evolution-baai-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-felix-misery
entry_type: term
entry_id: term-baai
card_type: concept
front: >-
  NEO{{進化|しんか}}クリーチャーとして{{召喚|しょうかん}}する{{場合|ばあい}}
back: nel caso in cui la evochi come creatura NEO evolution
example_jp: >-
  `{{場合|ばあい}}`だから、どんな{{召喚|しょうかん}}でもよいのではなく、
  NEO{{進化|しんか}}として{{出|だ}}す{{時|とき}}だけを{{指|さ}}している。
example_it: >-
  Siccome c'è `baai`, non vale per ogni evocazione: indica solo il caso in cui
  la metti come NEO evolution.
notes_it: >-
  Il punto da allenare è proprio la cornice. `{{場合|ばあい}}` fissa lo
  scenario, `として` dice `in quel ruolo`, e solo dentro quella finestra si
  accende lo sconto di costo.
tags: [live-duel, concept, condition, neo-evolution]
:::

:::card
id: card-felix-two-darkness-creatures-areba-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-felix-misery
entry_type: grammar
entry_id: grammar-areba
card_type: concept
front: >-
  {{自分|じぶん}}の{{闇|やみ}}のクリーチャーが{{2体以上|にたいいじょう}}あれば
back: se hai due o più creature Darkness
example_jp: >-
  `あれば`だから、まず{{場|ば}}の{{数|かず}}を{{見|み}}て、
  {{条件|じょうけん}}を{{満|み}}たした{{後|あと}}で{{続|つづ}}きを{{読|よ}}む。
example_it: >-
  Siccome c'è `areba`, prima controlli il numero sul campo e solo dopo leggi la
  conseguenza.
notes_it: >-
  Questo chunk vale la pena di essere memorizzato intero: gruppo filtrato
  `{{闇|やみ}}のクリーチャー`, soglia `{{2体以上|にたいいじょう}}` e
  condizionale `あれば`. È una struttura molto riusabile nei testi che aprono
  un effetto solo se il board soddisfa una certa quantità minima.
tags: [live-duel, grammar, threshold, darkness]
:::

:::card
id: card-felix-non-evolution-darkness-cost-six-or-less-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-felix-misery
entry_type: grammar
entry_id: grammar-de-nai
card_type: concept
front: >-
  コスト{{6以下|ろくいか}}の、{{進化|しんか}}でない{{闇|やみ}}のクリーチャー{{1枚|いちまい}}
back: una creatura Darkness non evolution di costo 6 o meno
example_jp: >-
  `{{進化|しんか}}でない`があるので、{{闇|やみ}}なら{{何|なん}}でもよいのではなく、
  {{進化|しんか}}クリーチャーは{{除外|じょがい}}される。
example_it: >-
  Siccome c'è `shinka de nai`, non basta che sia Darkness: le evolution
  creature vengono escluse.
notes_it: >-
  Qui `でない` è il filtro decisivo. La carta accumula più restrizioni sullo
  stesso bersaglio, ma il pezzo davvero facile da perdere è proprio
  `{{進化|しんか}}でない`: se lo salti, leggi un insieme di bersagli troppo largo.
tags: [live-duel, grammar, filter, targeting]
:::
