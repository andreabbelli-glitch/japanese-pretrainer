---
id: cards-duel-masters-dm25-live-duel-encounters-tamatango-panzer
media_id: media-duel-masters-dm25
slug: live-duel-encounters-tamatango-panzer
title: Carte incontrate in partita 7 - Tamatango Panzer e il bersaglio forzato
order: 56
segment_ref: live-duel-encounters
---

:::term
id: term-tamatango-panzer
lemma: タマタンゴ・パンツァー
reading: たまたんご ぱんつぁー
romaji: tamatango pantsaa
meaning_it: Tamatango Panzer / Gransect enorme che entra tapped e protegge gli scudi
pos: proper-noun
aliases: [タマタンゴ・パンツァー, Tamatango Panzer]
notes_it: >-
  E il nome proprio di un grosso [グランセクト](term:term-gransect) naturale.
  In Duel Masters PLAY'S lo riconosci per tre cose lette insieme: entra gia
  tappato, forza gli attacchi avversari su di se se possibile e puo ottenere
  `S・トリガー` quando esce dagli scudi.
level_hint: custom
:::

:::term
id: term-gransect
lemma: グランセクト
reading: ぐらんせくと
romaji: guransekuto
meaning_it: Gransect / razza naturale di creature grandi e pesanti
pos: noun
aliases: [グランセクト, Gransect, guransekuto]
notes_it: >-
  Compare sulla riga `{{種族|しゅぞく}}` come etichetta tribale. Quando leggi
  `グランセクト`, non stai leggendo un soprannome del personaggio ma una famiglia
  di carte che puo essere chiamata da filtri e sinergie di razza.
level_hint: custom
:::

:::term
id: term-enter-battle-zone-tapped
lemma: タップしてバトルゾーンに出る
reading: たっぷしてばとるぞーんにでる
romaji: tappu shite batoruzoon ni deru
meaning_it: entra nel battle zone tapped
pos: verb-phrase
aliases: [タップしてバトルゾーンに出る]
notes_it: >-
  E una formula utile da riconoscere in blocco. Non descrive due azioni
  separate, prima entrare e poi tappare: dice che la carta entra gia nel
  battle zone in stato tapped.
level_hint: custom
:::

:::grammar
id: grammar-kanou-nara
pattern: 可能なら
title: Se puo farlo, deve seguire quel vincolo
reading: かのうなら
meaning_it: se possibile / se puo farlo
aliases: [可能なら]
notes_it: >-
  Nel rules text restringe un obbligo ai casi in cui il gioco rende davvero
  legale quella scelta. In `{{可能|かのう}}ならこのクリーチャーを{{攻撃|こうげき}}する`,
  l'attaccante non sceglie liberamente un altro bersaglio: se puo colpire
  questa creatura, deve farlo.
level_hint: n3
:::

:::card
id: card-tamatango-panzer-recognition
entry_type: term
entry_id: term-tamatango-panzer
card_type: recognition
front: タマタンゴ・パンツァー
back: Tamatango Panzer / Gransect che forza gli attacchi su di se
example_jp: >-
  タマタンゴ・パンツァーがいれば、{{相手|あいて}}は{{可能|かのう}}ならそれを
  {{攻撃|こうげき}}する。
example_it: >-
  Se c'e Tamatango Panzer, l'avversario deve attaccarlo se puo farlo.
notes_it: >-
  Il nome va fissato come nome proprio completo. In questa carta quel nome
  coincide con una lettura molto riconoscibile: ingresso tapped, attacco
  reindirizzato e minaccia di `S・トリガー` dagli scudi.
tags: [live-duel, proper-name, shield-trigger]
:::

:::card
id: card-gransect-recognition
entry_type: term
entry_id: term-gransect
card_type: recognition
front: グランセクト
back: Gransect / razza naturale della carta
example_jp: >-
  グランセクトは{{自然|しぜん}}の{{大型|おおがた}}クリーチャーに{{多|おお}}い。
example_it: >-
  Gransect compare spesso sulle grandi creature della civilta naturale.
notes_it: >-
  Questa parola e utile per leggere subito la riga `{{種族|しゅぞく}}`. Quando
  compare, pensa a una categoria di razza che puo contare per filtri, supporti
  o sinergie.
tags: [live-duel, race, tribe]
:::

:::card
id: card-enter-battle-zone-tapped-recognition
entry_type: term
entry_id: term-enter-battle-zone-tapped
card_type: recognition
front: >-
  タップしてバトルゾーンに{{出|で}}る
back: entra nel battle zone tapped
example_jp: >-
  タップしてバトルゾーンに{{出|で}}るなら、{{場|ば}}に{{出|で}}た
  {{瞬間|しゅんかん}}からもう{{横向|よこむ}}きだ。
example_it: >-
  Se entra nel battle zone tapped, e gia orizzontale dal momento in cui arriva.
notes_it: >-
  Il valore utile sta nel blocco intero: il testo non aggiunge un tap dopo
  l'ingresso, ma descrive un ingresso che avviene gia in quello stato.
tags: [live-duel, entry, tap, chunk]
:::

:::card
id: card-kanou-nara-concept
entry_type: grammar
entry_id: grammar-kanou-nara
card_type: concept
front: '{{可能|かのう}}なら、このクリーチャーを{{攻撃|こうげき}}する'
back: se puo farlo, deve attaccare questa creatura
example_jp: >-
  {{相手|あいて}}のクリーチャーが{{攻撃|こうげき}}する{{場合|ばあい}}、
  {{可能|かのう}}ならこのクリーチャーを{{攻撃|こうげき}}する。
example_it: >-
  Quando una creatura avversaria attacca, se puo farlo deve attaccare questa
  creatura.
notes_it: >-
  `{{可能|かのう}}なら` non vuol dire "forse". Vuol dire che l'obbligo vale ogni
  volta che il gioco rende davvero disponibile quel bersaglio.
tags: [live-duel, grammar, attack, restriction]
:::
