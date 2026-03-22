---
id: cards-duel-masters-dm25-live-duel-encounters-infelstarge
media_id: media-duel-masters-dm25
slug: live-duel-encounters-infelstarge
title: Carte incontrate in partita 15 - Infelstarge, 持ち主 e 2枚まで
order: 64
segment_ref: live-duel-encounters
---

:::term
id: term-infelstarge
lemma: インフェル星樹
reading: いんふぇるすたーじゅ
romaji: inferu sutaaju
meaning_it: Infelstarge / drago naturale che rimette nel mana i non-creature e pesca se il mana si alimenta dal battle zone
pos: proper-noun
aliases: [インフェル星樹, インフェル 星樹, インフェルスタージュ, Infelstarge]
notes_it: >-
  E` il nome proprio della carta. La lettura utile da associare subito a questo
  nome non e` solo il corpo Nature da `{{6000|ろくせん}}`, ma soprattutto la
  sequenza `クリーチャーではないカードを{{2枚|にまい}}まで{{選|えら}}ぶ` +
  `{{持|も}}ち{{主|ぬし}}のマナゾーンにタップして{{置|お}}く` +
  `{{置|お}}かれた{{時|とき}}` per il draw successivo.
level_hint: custom
:::

:::term
id: term-mochinushi
lemma: 持ち主
reading: もちぬし
romaji: mochinushi
meaning_it: proprietario / owner della carta
pos: noun
aliases: [持ち主, もちぬし, mochinushi, owner]
notes_it: >-
  In giapponese generale `{{持|も}}ち{{主|ぬし}}` e` `chi possiede quella cosa`,
  `chi ne e` il titolare`. Nel rules text di Duel Masters questa idea resta
  uguale ma diventa molto precisa: non indica il controller momentaneo della
  carta, ma il suo proprietario. In frasi come
  `それらを{{持|も}}ち{{主|ぬし}}のマナゾーンにタップして{{置|お}}く`, ogni carta
  scelta va quindi nella mana zone del suo owner, non necessariamente di chi la
  aveva sul battle zone in quel momento.
level_hint: n3
:::

:::grammar
id: grammar-made
pattern: ～まで
title: Limite massimo / fino a N
reading: まで
meaning_it: fino a / al massimo / entro quel limite
aliases: [まで]
notes_it: >-
  In giapponese generale `まで` copre idee come `fino a`, `entro`, `fin dove`.
  Nel rules text di Duel Masters, quando segue un numero, diventa soprattutto
  un limite superiore. In `{{2枚|にまい}}まで{{選|えら}}ぶ` non dice che devi
  scegliere due carte: dice che puoi sceglierne al massimo due. Il punto
  importante e` che il massimo non e` obbligatorio; il testo consente anche una
  scelta piu piccola se la situazione o la convenienza lo richiedono.
level_hint: n4
:::

:::card
id: card-infelstarge-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-infelstarge
entry_type: term
entry_id: term-infelstarge
card_type: recognition
front: 'インフェル{{星樹|スタージュ}}'
back: Infelstarge / drago naturale che sposta non-creature nel mana e pesca
example_jp: >-
  インフェル{{星樹|スタージュ}}が{{出|で}}た{{時|とき}}、
  クリーチャーではないカードを{{2枚|にまい}}まで{{選|えら}}ぶ。
example_it: >-
  Quando entra Infelstarge, scegli fino a 2 carte non creatura.
notes_it: >-
  Il nome va fissato come blocco unico. In questa lezione il valore didattico
  del nome e` il collegamento immediato con `{{持|も}}ち{{主|ぬし}}`,
  `{{2枚|にまい}}まで` e `{{置|お}}かれた{{時|とき}}`.
tags: [live-duel, proper-name, nature]
:::

:::card
id: card-mochinushi-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-infelstarge
entry_type: term
entry_id: term-mochinushi
card_type: recognition
front: '{{持|も}}ち{{主|ぬし}}'
back: proprietario / owner della carta
example_jp: >-
  それらを{{持|も}}ち{{主|ぬし}}のマナゾーンにタップして{{置|お}}く。
example_it: >-
  Metti quelle carte tappate nella mana zone dei rispettivi proprietari.
notes_it: >-
  Qui `{{持|も}}ち{{主|ぬし}}` non e` `chi la controlla adesso`, ma `chi possiede
  quella carta`. E` proprio questo che rende la rimozione di Infelstarge una
  restituzione nel mana dell'owner.
tags: [live-duel, term, ownership, rules]
:::

:::card
id: card-ni-mai-made-erabu-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-infelstarge
entry_type: grammar
entry_id: grammar-made
card_type: concept
front: >-
  クリーチャーではないカードを{{2枚|にまい}}まで{{選|えら}}ぶ
back: scegli fino a 2 carte non creatura
example_jp: >-
  `{{2枚|にまい}}まで`だから、{{0枚|ぜろまい}}でも{{1枚|いちまい}}でも
  {{2枚|にまい}}でもよい。
example_it: >-
  Siccome c'e` `fino a 2`, puoi sceglierne 0, 1 oppure 2.
notes_it: >-
  Il punto da fissare non e` il verbo `{{選|えら}}ぶ`, che esiste gia`, ma il
  modo in cui `まで` trasforma il numero in un tetto massimo. La carta non ti
  impone di riempire il massimo: ti lascia salire fino a quel limite.
tags: [live-duel, grammar, quantity, selection]
:::

:::card
id: card-mochinushi-mana-zone-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-infelstarge
entry_type: term
entry_id: term-mochinushi
card_type: concept
front: >-
  それらを{{持|も}}ち{{主|ぬし}}のマナゾーンにタップして{{置|お}}く
back: metti quelle carte tappate nella mana zone dei rispettivi proprietari
example_jp: >-
  `{{持|も}}ち{{主|ぬし}}のマナゾーン`だから、{{相手|あいて}}のカードなら
  {{相手|あいて}}のマナに{{戻|もど}}る。
example_it: >-
  Siccome c'e` `mana zone del proprietario`, se la carta e` avversaria torna
  nel mana dell'avversario.
notes_it: >-
  Questo chunk unisce due cose utili: il referente di `それら` e il valore
  preciso di `{{持|も}}ち{{主|ぬし}}`. La frase non parla di un mana generico:
  per ogni carta selezionata il testo risolve quale giocatore ne sia l'owner e
  la manda li.
tags: [live-duel, concept, ownership, destination]
:::

:::card
id: card-okareta-toki-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-infelstarge
entry_type: grammar
entry_id: grammar-sareta-toki
card_type: concept
front: 'カードが{{置|お}}かれた{{時|とき}}'
back: quando una carta viene messa / quando una carta e` stata messa
example_jp: >-
  バトルゾーンから{{自分|じぶん}}のマナゾーンにカードが{{置|お}}かれた
  {{時|とき}}、カードを{{1枚|いちまい}}{{引|ひ}}く。
example_it: >-
  Quando una carta viene messa dal battle zone nella tua mana zone, pesca 1
  carta.
notes_it: >-
  Qui il focus utile e` il passivo: la carta non dice `{{置|お}}く{{時|とき}}`,
  cioe` `quando la metti`, ma `{{置|お}}かれた{{時|とき}}`, `quando viene messa`.
  Il trigger si accende sull'evento gia` compiuto, senza dare importanza a chi
  abbia eseguito lo spostamento.
tags: [live-duel, grammar, passive, trigger]
:::
