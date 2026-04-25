---
id: cards-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
media_id: media-duel-masters-dm25
slug: live-duel-encounters-aoki-danchou-dogiragon-buster
title: Carte incontrate in partita 45 - Dogiragon Buster, 革命チェンジ e ファイナル革命
order: 94
segment_ref: live-duel-encounters
---

:::term
id: term-danchou
lemma: 団長
reading: だんちょう
romaji: danchou
meaning_it: capo di un gruppo / leader di una compagnia, brigata o squadra
pos: noun
aliases: [団長, だんちょう, danchou]
notes_it: >-
  `{{団|だん}}` indica un gruppo organizzato, una compagnia o una squadra;
  `{{長|ちょう}}` indica il capo. Insieme `{{団長|だんちょう}}` significa leader
  del gruppo. Nel nome `{{蒼|あお}}き{{団長|だんちょう}}` non è un titolo
  puramente ornamentale: presenta Dogiragon Buster come capo della fazione.
level_hint: n3
:::

:::term
id: term-kakumei-change
lemma: 革命チェンジ
reading: かくめいチェンジ
romaji: kakumei chenji
meaning_it: Revolution Change / keyword che scambia una creatura attaccante specificata con questa carta dalla mano
pos: keyword
aliases: [革命チェンジ, かくめいチェンジ, kakumei change, Revolution Change]
notes_it: >-
  È una keyword di cambio. La definizione operativa è:
  `{{自分|じぶん}}の{{指定|してい}}されたクリーチャーが
  {{攻撃|こうげき}}する{{時|とき}}、そのクリーチャーと
  [{{手札|てふだ}}](term:term-hand)にあるこのクリーチャーを
  {{入|い}}れ{{替|か}}えてもよい`. Il punto da fissare è
  `{{入|い}}れ{{替|か}}える`: non stai solo mettendo una creatura in campo, stai
  scambiando il posto fra l'attaccante valido e la carta in mano.
level_hint: custom
:::

:::term
id: term-final-revolution
lemma: ファイナル革命
reading: ファイナルかくめい
romaji: fainaru kakumei
meaning_it: Final Revolution / keyword che si usa una sola volta per turno dopo Revolution Change
pos: keyword
aliases: [ファイナル革命, ファイナルかくめい, Final Revolution]
notes_it: >-
  È una keyword legata a [{{革命|かくめい}}チェンジ](term:term-kakumei-change).
  La carta controlla se è entrata nel modo giusto e poi chiede se, in quel
  turno, hai già usato un'altra `ファイナル{{革命|かくめい}}`. Il payoff cambia da
  carta a carta; il blocco ricorrente da leggere è il cancello
  `そのターン{{中|ちゅう}}に{{他|ほか}}の「ファイナル{{革命|かくめい}}」をまだ
  {{使|つか}}っていなければ`.
level_hint: custom
:::

:::term
id: term-shitei
lemma: 指定
reading: してい
romaji: shitei
meaning_it: designazione / specificazione; ciò che il testo indica come valido
pos: verbal-noun
aliases: [指定, してい, shitei, 指定された]
notes_it: >-
  In giapponese generale `{{指定|してい}}` vuol dire indicare o designare in
  modo preciso. Nel rules text restringe il gruppo valido: in
  `{{指定|してい}}されたクリーチャー`, non basta una creatura qualunque, ma serve una
  creatura che corrisponda alla condizione scritta dalla carta.
level_hint: n3
:::

:::term
id: term-kakumei
lemma: 革命
reading: かくめい
romaji: kakumei
meaning_it: rivoluzione / revolution; kanji comune nelle keyword Revolution
pos: noun
aliases: [革命, かくめい, kakumei, revolution]
notes_it: >-
  In giapponese generale `{{革命|かくめい}}` significa rivoluzione. In Duel
  Masters resta un sostantivo riconoscibile dentro nomi di famiglia come
  `{{革命|かくめい}}チェンジ` e `ファイナル{{革命|かくめい}}`: il valore pratico cambia
  con la keyword, ma la lettura del kanji resta stabile.
level_hint: n3
:::

:::term
id: term-irekaeru
lemma: 入れ替える
reading: いれかえる
romaji: irekaeru
meaning_it: scambiare / sostituire mettendo una cosa al posto dell'altra
pos: verb
aliases: [入れ替える, 入れ替えて, いれかえる, irekaeru]
notes_it: >-
  `{{入|い}}れる` porta l'idea di mettere dentro, `{{替|か}}える` quella di
  cambiare o sostituire. Insieme formano `{{入|い}}れ{{替|か}}える`: scambiare due
  elementi di posto. In [{{革命|かくめい}}チェンジ](term:term-kakumei-change), il
  verbo spiega perché l'attaccante torna indietro mentre questa carta entra dal
  [{{手札|てふだ}}](term:term-hand).
level_hint: n3
:::

:::grammar
id: grammar-sonoturnchuu-hoka-final-kakumei-mada-tsukatte-inakereba
pattern: そのターン中に他の「ファイナル革命」をまだ使っていなければ
title: Se in quel turno non hai ancora usato un'altra Final Revolution
reading: そのターンちゅうにほかのファイナルかくめいをまだつかっていなければ
meaning_it: se durante quel turno non hai ancora usato un'altra Final Revolution
aliases:
  [
    そのターン中に他の「ファイナル革命」をまだ使っていなければ,
    そのターン中に他のファイナル革命をまだ使っていなければ
  ]
notes_it: >-
  `そのターン{{中|ちゅう}}に` fissa lo scope temporale nello stesso turno.
  `{{他|ほか}}の` esclude questa istanza e guarda le altre Final Revolution.
  `まだ{{使|つか}}っていなければ` è il controllo negativo: se fino a quel momento non
  l'hai ancora usata, l'effetto può procedere.
level_hint: custom
:::

:::card
id: card-danchou-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: term
entry_id: term-danchou
card_type: recognition
front: '{{団長|だんちょう}}'
back: capo di un gruppo / leader di una compagnia o squadra
example_jp: >-
  {{蒼|あお}}き{{団長|だんちょう}}は、{{革命軍|かくめいぐん}}を
  {{率|ひき}}いるドラゴンだ。
example_it: >-
  Il leader azzurro è il Drago che guida la Revolutionary Army.
notes_it: >-
  Il composto è trasparente ma utile: `{{団|だん}}` è il gruppo organizzato,
  `{{長|ちょう}}` è il capo. Qui aiuta a leggere il titolo della carta senza
  dover memorizzare l'intero nome proprio.
tags: [live-duel, term, kanji, title]
:::

:::card
id: card-kakumei-change-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: term
entry_id: term-kakumei-change
card_type: recognition
front: '{{革命|かくめい}}チェンジ'
back: Revolution Change / scambio fra una creatura attaccante specificata e questa carta dalla mano
example_jp: >-
  {{火|ひ}}または{{自然|しぜん}}のコスト{{5以上|ごいじょう}}のドラゴンが
  {{攻撃|こうげき}}する{{時|とき}}、{{革命|かくめい}}チェンジを{{使|つか}}える。
example_it: >-
  Quando un Drago di fuoco o natura di costo 5 o superiore attacca, puoi usare
  Revolution Change.
notes_it: >-
  La definizione da ricordare è lo scambio:
  `{{指定|してい}}されたクリーチャー` attacca, poi quella creatura e questa carta in
  [{{手札|てふだ}}](term:term-hand) vengono
  `{{入|い}}れ{{替|か}}え`-te.
tags: [live-duel, keyword, revolution-change, attack-window]
:::

:::card
id: card-final-revolution-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: term
entry_id: term-final-revolution
card_type: recognition
front: 'ファイナル{{革命|かくめい}}'
back: Final Revolution / effetto speciale usabile solo se non ne hai già usato un altro in quel turno
example_jp: >-
  そのターン{{中|ちゅう}}に{{他|ほか}}のファイナル{{革命|かくめい}}をまだ
  {{使|つか}}っていなければ、ファイナル{{革命|かくめい}}が{{使|つか}}える。
example_it: >-
  Se in quel turno non hai ancora usato un'altra Final Revolution, puoi usare
  Final Revolution.
notes_it: >-
  Non memorizzarla come semplice nome di potere: il blocco utile è il limite
  per turno espresso da `そのターン{{中|ちゅう}}に{{他|ほか}}の...まだ
  {{使|つか}}っていなければ`.
tags: [live-duel, keyword, final-revolution, turn-limit]
:::

:::card
id: card-shitei-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: term
entry_id: term-shitei
card_type: recognition
front: '{{指定|してい}}'
back: designazione / specificazione; ciò che viene indicato come valido
example_jp: >-
  {{指定|してい}}されたドラゴンが{{攻撃|こうげき}}する{{時|とき}}、
  {{革命|かくめい}}チェンジを{{使|つか}}える。
example_it: >-
  Quando il Drago specificato attacca, puoi usare Revolution Change.
notes_it: >-
  In generale significa indicare in modo preciso. Nel rules text ti dice che il
  gruppo valido non è libero: devi controllare la condizione scritta dalla
  carta.
tags: [live-duel, term, filter, rules-text]
:::

:::card
id: card-kakumei-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: term
entry_id: term-kakumei
card_type: recognition
front: '{{革命|かくめい}}'
back: rivoluzione / revolution
example_jp: >-
  ファイナル{{革命|かくめい}}は、そのターン{{中|ちゅう}}に{{1回|いっかい}}だけ
  {{使|つか}}える。
example_it: >-
  Final Revolution può essere usata solo una volta in quel turno.
notes_it: >-
  Il kanji resta lo stesso dentro keyword diverse. Qui non devi solo leggere
  `revolution`, ma riconoscere la famiglia lessicale che collega
  `{{革命|かくめい}}チェンジ` e `ファイナル{{革命|かくめい}}`.
tags: [live-duel, kanji, keyword-family]
:::

:::card
id: card-irekaete-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: term
entry_id: term-irekaeru
card_type: recognition
front: '{{入|い}}れ{{替|か}}えて'
back: scambiando / mettendo una cosa al posto dell'altra
example_jp: >-
  {{攻撃|こうげき}}するクリーチャーと
  [{{手札|てふだ}}](term:term-hand)のドラゴンを{{入|い}}れ{{替|か}}えてもよい。
example_it: >-
  Puoi scambiare la creatura che attacca con il Drago nella mano.
notes_it: >-
  È il verbo che rende concreta [{{革命|かくめい}}チェンジ](term:term-kakumei-change):
  non è solo `出す`, ma uno scambio di posizione fra due carte.
tags: [live-duel, verb, revolution-change, movement]
:::

:::card
id: card-sonoturnchuu-hoka-final-kakumei-mada-tsukatte-inakereba
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: grammar
entry_id: grammar-sonoturnchuu-hoka-final-kakumei-mada-tsukatte-inakereba
card_type: concept
front: 'そのターン{{中|ちゅう}}に{{他|ほか}}の「ファイナル{{革命|かくめい}}」をまだ{{使|つか}}っていなければ'
back: se in quel turno non hai ancora usato un'altra Final Revolution
example_jp: >-
  そのターン{{中|ちゅう}}に{{他|ほか}}の「ファイナル{{革命|かくめい}}」をまだ
  {{使|つか}}っていなければ、{{手札|てふだ}}からクリーチャーを{{出|だ}}せる。
example_it: >-
  Se in quel turno non hai ancora usato un'altra Final Revolution, puoi mettere
  una creatura dalla mano.
notes_it: >-
  La struttura ha tre pezzi: `そのターン{{中|ちゅう}}に` delimita il turno,
  `{{他|ほか}}の` controlla le altre Final Revolution, e
  `まだ{{使|つか}}っていなければ` dice che fino a quel momento non deve essere già
  successo.
tags: [live-duel, grammar, final-revolution, turn-limit]
:::

:::card
id: card-rokuika-ni-naru-youni-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster
entry_type: grammar
entry_id: grammar-youni
card_type: concept
front: '{{6以下|ろくいか}}になるよう'
back: in modo che diventi 6 o meno / resti entro 6
example_jp: >-
  コストの{{合計|ごうけい}}が{{6以下|ろくいか}}になるよう、
  {{進化|しんか}}でない{{多色|たしょく}}クリーチャーを
  {{好|す}}きな{{数|かず}}{{出|だ}}す。
example_it: >-
  Metti in campo quante creature multicolori non evoluzione vuoi, in modo che
  il costo totale sia 6 o meno.
notes_it: >-
  Qui [ように](grammar:grammar-youni) non indica desiderio: impone il criterio
  con cui costruisci il gruppo. `{{好|す}}きな{{数|かず}}` resta limitato dal
  tetto `{{6以下|ろくいか}}`.
tags: [live-duel, grammar, quantity, total-cost]
:::
