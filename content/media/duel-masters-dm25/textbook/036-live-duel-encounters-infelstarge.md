---
id: lesson-duel-masters-dm25-live-duel-encounters-infelstarge
media_id: media-duel-masters-dm25
slug: live-duel-encounters-infelstarge
title: Carte incontrate - Infelstarge
order: 64
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, owner, guard-strike, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
  ]
summary: >-
  Infelstarge: owner con mochinushi, limite superiore con 2-mai made e trigger
  passivo con okareta toki quando una carta passa dal battle zone al tuo mana.
---

# [インフェル{{星樹|スタージュ}}](term:term-infelstarge)

:::image
src: assets/cards/live-duel/infelstarge.jpg
alt: "Infelstarge card."
caption: >-
  [インフェル{{星樹|スタージュ}}](term:term-infelstarge)。 Razze:
  ジャイアント・ドラゴン / レクスターズ. Riga centrale:
  [G（ガード）・ストライク](term:term-g-strike), [W（ダブル）・ブレイカー](term:term-w-breaker),
  rimozione dei non-creature nel mana del [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi)
  e draw quando una carta viene messa dal battle zone nel tuo mana.
:::

## Keyword presenti sulla carta

- [G（ガード）・ストライク](term:term-g-strike)
- [W（ダブル）・ブレイカー](term:term-w-breaker)

Le keyword sono gia coperte nella keyword bank. Qui il valore didattico sta
soprattutto in tre punti: chi e il referente di
[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi), come funziona il limite di
[{{2枚|にまい}}まで](grammar:grammar-made) e che cosa implica il trigger passivo
`{{置|お}}かれた{{時|とき}}`.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが{{出|で}}た[{{時|とき}}](grammar:grammar-toki)、
  [バトルゾーン](term:term-battle-zone)にある、クリーチャーではないカードを
  [{{2枚|にまい}}まで](grammar:grammar-made)[{{選|えら}}ぶ](term:term-erabu)。
  それらを[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi)の
  [マナゾーン](term:term-mana-zone)にタップして[{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando questa creatura entra, scegli fino a 2 carte non creatura nel battle
  zone. Mettile tapped nella mana zone dei rispettivi proprietari.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)から
  [{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に
  カードが[{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki)、
  カードを{{1枚|いちまい}}[{{引|ひ}}く](term:term-hiku)。
translation_it: >-
  Quando una carta viene messa dal battle zone nella tua mana zone, pesca 1
  carta.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 持ち主

- [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi) e` un composto molto trasparente
  in giapponese generale: `chi possiede / chi tiene quella cosa`.
- Nel rules text di Duel Masters il valore si stringe: non vuol dire `chi la
  controlla adesso`, ma `il proprietario di quella carta`.
- Questo dettaglio conta perche` il testo dice `それらを{{持|も}}ち{{主|ぬし}}の
  マナゾーンに...`: ogni carta scelta torna nella mana zone del suo proprio
  owner, anche se si trova sul campo sotto un controllo diverso.
- `それら` riprende l'intero gruppo appena scelto; poi `{{持|も}}ち{{主|ぬし}}`
  risolve il destino di ciascun pezzo del gruppo uno per uno.

### 2. クリーチャーではないカードを2枚まで選ぶ

- [{{2枚|にまい}}まで](grammar:grammar-made) mette un tetto massimo, non una
  quantita obbligatoria. Il senso corretto e` `zero, uno o due`, non `scegline
  due per forza`.
- `まで` si attacca al numero e ne limita la quantita massima. Qui non sta
  dicendo `fino a dove` in senso spaziale o temporale, ma `fino a questo
  conteggio`.
- [{{選|えら}}ぶ](term:term-erabu) resta il verbo di selezione mirata. Prima il
  testo restringe il gruppo con `クリーチャーではないカード`, poi ti lascia
  scegliere dentro quel gruppo fino al limite indicato.
- Per questo `{{2枚|にまい}}まで{{選|えら}}ぶ` e` un chunk molto utile da fissare:
  la grammatica ti dice subito che esiste una scelta, ma che il numero non deve
  necessariamente saturare il massimo.

### 3. バトルゾーンから自分のマナゾーンにカードが置かれた時

- `バトルゾーンから{{自分|じぶん}}のマナゾーンに` marca il percorso completo
  della carta. Il trigger non guarda qualsiasi carta messa nel mana, ma solo
  quelle che arrivano proprio dal battle zone.
- [{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki) usa il passivo di
  [{{置|お}}く](term:term-oku): il focus non e` `chi mette` la carta, ma il fatto
  che la carta sia stata collocata li.
- In giapponese generale `{{置|お}}かれた{{時|とき}}` si capisce come `nel momento
  in cui e` stata messa`. Nel rules text questo valore diventa un trigger
  tecnico: appena la carta finisce nella tua mana zone dal battle zone, il draw
  si accende.
- Il `た` di `{{置|お}}かれた` non racconta un passato lontano; e` la forma che
  modifica [{{時|とき}}](grammar:grammar-sareta-toki) e costruisce `quando viene
  messa / quando e` stata messa`.

## Lessico utile in questa carta

- [インフェル{{星樹|スタージュ}}](term:term-infelstarge) vale come nome proprio
  unico: la parte utile da collegargli e` subito il doppio blocco
  `{{2枚|にまい}}まで{{選|えら}}ぶ` + `{{持|も}}ち{{主|ぬし}}のマナゾーンに
  {{置|お}}く`.
- [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi) e` una parola piccola ma
  importante: in tante carte distingue il proprietario dal giocatore che sta
  usando o controllando la carta in quel momento.
- [{{2枚|にまい}}まで](grammar:grammar-made) e` un pattern molto riusabile:
  segnala un limite superiore e non un conteggio obbligatorio.
- [{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki) e` il trigger passivo
  da riconoscere in blocco quando la carta reagisce a uno spostamento gia`
  avvenuto.
