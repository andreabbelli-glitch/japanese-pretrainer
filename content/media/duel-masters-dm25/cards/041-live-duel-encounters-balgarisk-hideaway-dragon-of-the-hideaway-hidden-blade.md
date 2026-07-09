---
id: cards-duel-masters-dm25-live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
media_id: media-duel-masters-dm25
slug: live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
title: Carte incontrate in partita 20 - Ninja Strike, 持つ e そうでなければ
order: 69
segment_ref: live-duel-encounters
---

:::term
id: term-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
lemma: 裏斬隠裏蒼頭バルガリスク
reading: うらぎりがくれうらそうとう ばるがりすく
romaji: uragirigakure urasoutou barugarisuku
meaning_it: Balgarisk, Hideaway Dragon of the Hideaway Hidden Blade
pos: proper-noun
aliases:
  [
    裏斬隠裏蒼頭バルガリスク,
    バルガリスク,
    Balgarisk,
    Balgarisk, Hideaway Dragon of the Hideaway Hidden Blade
  ]
notes_it: >-
  È il nome proprio della carta. La lettura lo collega subito a tre punti di
  lingua: la catena condizionale di `ニンジャ・ストライク {{8|はち}}`, il filtro
  con `コストを{{持|も}}つ` e il ramo alternativo `そうでなければ`.
level_hint: custom
:::

:::term
id: term-ninja-strike
lemma: ニンジャ・ストライク
reading: にんじゃすとらいく
romaji: ninja sutoraiku
meaning_it: Ninja Strike / keyword che permette di evocare la carta durante un attacco se la condizione indicata è soddisfatta
pos: keyword
aliases: [ニンジャ・ストライク, Ninja Strike, ninja strike]
notes_it: >-
  È una keyword di risposta durante un attacco o un blocco. Il nucleo da ricordare e' la catena successiva all'ingresso gratuito.
level_hint: custom
:::

:::term
id: term-motsu
lemma: 持つ
reading: もつ
romaji: motsu
meaning_it: avere / possedere
pos: godan-verb
aliases: [持つ, もつ, motsu]
notes_it: >-
  In giapponese generale `持つ` vuol dire `avere`, `possedere`, `portare con
  sé`. Nel rules text di Duel Masters appare spesso come verbo che modifica un
  nome: `〜を{{持|も}}つX` = `X che ha 〜`. `コストを持つ` significa possedere un valore di costo stampato o rilevante.
level_hint: n4
:::

:::grammar
id: grammar-te-inakereba
pattern: ～ていなければ
title: Se non è ancora in quello stato
reading: ていなければ
meaning_it: se non ha ancora / se non è ancora
aliases: [～ていなければ, 使っていなければ]
notes_it: >-
  Unisce `～ている` e `～なければ`. Nel rules text non descrive un'azione in
  corso, ma controlla se uno stato non si è ancora verificato dentro la
  finestra appena nominata. In `{{使|つか}}っていなければ` il senso non è `non
  usarlo adesso`, ma `se non l'hai già usato prima in questa stessa finestra`.
level_hint: custom
:::

:::grammar
id: grammar-soudenakereba
pattern: そうでなければ
title: Se non è così / altrimenti
reading: そうでなければ
meaning_it: altrimenti / se non è così
aliases: [そうでなければ]
notes_it: >-
  `そう` riprende la situazione appena descritta; `でなければ` aggiunge `se non
  è così`. Nel rules text è un marcatore molto utile perché apre il ramo
  alternativo quando la verifica appena fatta non passa.
level_hint: n4
:::

:::card
id: card-ninja-strike-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
entry_type: term
entry_id: term-ninja-strike
card_type: recognition
front: ニンジャ・ストライク
back: keyword che ti permette di evocare la carta durante un attacco se passi la condizione scritta
example_jp: >-
  ニンジャ・ストライク{{8|はち}}だから、{{相手|あいて}}の{{攻撃|こうげき}}に
  {{割|わ}}り{{込|こ}}むようにこのシノビを{{出|だ}}せる。
example_it: >-
  Siccome ha Ninja Strike 8, puoi mettere in campo questo Shinobi durante l'attacco
  dell'avversario.
notes_it: >-
  Non fermarti alla traduzione rapida `entra gratis`. Questa keyword va letta
  insieme alla condizione che la segue: il giapponese ti dice esattamente
  quando puoi intervenire e quando invece il ramo non si apre.
tags: [live-duel, keyword, response, attack]
:::

:::card
id: card-balgarisk-eight-or-more-ari-and-no-ninja-strike-yet-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
entry_type: grammar
entry_id: grammar-te-inakereba
card_type: concept
front: >-
  {{8枚以上|はち.まい.い.じょう}}あり、その{{攻撃中|こう.げき.ちゅう}}に「ニンジャ・ストライク」
  {{能力|のうりょく}}を{{使|つか}}っていなければ
back: se hai almeno 8 carte in mana e durante quell'attacco non hai ancora usato Ninja Strike
example_jp: >-
  マナが{{8枚以上|はち.まい.い.じょう}}あり、その{{攻撃中|こう.げき.ちゅう}}に
  ニンジャ・ストライクを{{使|つか}}っていなければ、このシノビを{{召喚|しょうかん}}できる。
example_it: >-
  Se hai almeno otto carte nel mana e non hai usato Ninja Strike durante quell'attacco,
  puoi evocare questo Shinobi.
notes_it: >-
  Questo è il punto più importante della finestra di Ninja Strike. `あり` tiene
  aperta la catena delle condizioni; `{{使|つか}}っていなければ` è invece il
  vero controllo di stato. La carta non chiede `stai usando ora Ninja
  Strike?`, ma `sei già nel caso in cui l'hai usata in questo stesso attacco?`
  Se la risposta è no, il ramo resta disponibile.
tags: [live-duel, concept, condition, ninja-strike]
:::

:::card
id: card-motsu-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
entry_type: term
entry_id: term-motsu
card_type: recognition
front: '{{持|も}}つ'
back: avere / possedere
example_jp: >-
  コストを{{持|も}}つドラゴン・エレメントなら、{{出|だ}}す。
example_it: >-
  Se è un Dragon Element con un costo, lo metti in gioco.
notes_it: >-
  `{{持|も}}つ` da solo è giapponese molto generale. Il punto utile qui è come
  si comporta davanti a un nome: `〜を{{持|も}}つX` = `X che ha 〜`. Quindi il
  testo sta filtrando una proprietà, non descrivendo un'azione fisica.
tags: [live-duel, term, general-japanese, filter]
:::

:::card
id: card-cost-up-to-your-mana-motsu-dragon-element-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
entry_type: term
entry_id: term-motsu
card_type: concept
front: >-
  {{自分|じぶん}}のマナゾーンにあるカードの{{枚数|まいすう}}{{以下|いか}}のコストを
  {{持|も}}つドラゴン・エレメント
back: un Dragon Element che ha un costo pari o inferiore al numero di carte nel tuo mana
example_jp: >-
  {{自分|じぶん}}のマナの{{枚数|まいすう}}{{以下|いか}}のコストを
  {{持|も}}つドラゴン・エレメントを{{出|だ}}す。
example_it: >-
  Metti in gioco un Dragon Element con costo pari o inferiore al numero di carte nel tuo mana.
notes_it: >-
  Qui vale la pena memorizzare il chunk intero. Prima il testo fissa il limite
  `{{枚数|まいすう}}{{以下|いか}}`, poi con `{{持|も}}つ` attacca quel limite al
  nome finale `ドラゴン・エレメント`. Il risultato è: `un Dragon Element che ha
  un costo non superiore al mio mana`.
tags: [live-duel, concept, filter, mana-zone]
:::

:::card
id: card-soudenakereba-tapped-to-mana-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
entry_type: grammar
entry_id: grammar-soudenakereba
card_type: concept
front: >-
  そうでなければ、[タップ](term:term-tap)して[マナゾーン](term:term-mana-zone)に{{置|お}}く
back: altrimenti, mettila tappata nel mana zone
example_jp: >-
  ドラゴン・エレメントなら{{出|だ}}す。そうでなければ、
  タップしてマナゾーンに{{置|お}}く。
example_it: >-
  Se è un Dragon Element, mettilo in gioco; altrimenti, mettilo tappato nella mana zone.
notes_it: >-
  Questo chunk va riconosciuto in blocco. `そう` non indica una cosa nuova:
  punta al contenuto del `なら` appena prima. Se quella carta non è il Dragon
  Element giusto, il testo entra qui e la manda nel mana zone tappata.
tags: [live-duel, grammar, branch, fallback]
:::
