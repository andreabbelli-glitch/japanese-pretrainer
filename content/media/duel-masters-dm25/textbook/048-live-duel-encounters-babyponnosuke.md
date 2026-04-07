---
id: lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke
media_id: media-duel-masters-dm25
slug: live-duel-encounters-babyponnosuke
title: Carte incontrate - Babyponnosuke
order: 76
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, jokers, replacement, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-sofa-softysonia,
    lesson-duel-masters-dm25-live-duel-encounters-jenny-jane
  ]
summary: >-
  Babyponnosuke: yori fissa la soglia, ōkii indica un costo più alto del
  benchmark e deru toki marca la finestra in cui l'ingresso viene sostituito.
---

# [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke)

:::image
src: assets/cards/live-duel/babyponnosuke.jpg
alt: "Babyponnosuke card."
caption: >-
  [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke)。 Razza:
  ジョーカーズ. Riga centrale: una sostituzione che controlla se, durante il
  turno avversario, entra una creatura con costo più alto del numero di carte
  nel mana avversario; se hai abbastanza Joker, quella creatura non resta in
  campo e anche Babyponnosuke finisce sotto il mazzo.
:::

## Effetti da leggere

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}}に、
  [{{相手|あいて}}](term:term-opponent)の[マナゾーン](term:term-mana-zone)にあるカードの
  {{枚数|まいすう}}
  [より](grammar:grammar-yori)[コスト](term:term-cost)が
  [{{大|おお}}きい](term:term-ookii)[{{相手|あいて}}](term:term-opponent)の
  [クリーチャー](term:term-creature)が
  [{{出|で}}る](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  [バトルゾーン](term:term-battle-zone)または[マナゾーン](term:term-mana-zone)に
  {{自分|じぶん}}のジョーカーズが[{{合計|ごうけい}}](term:term-goukei)
  {{3枚以上|さん.まい.い.じょう}}あれば、{{相手|あいて}}は
  [かわりに](grammar:grammar-kawarini)そのクリーチャーを
  [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に[{{置|お}}き](term:term-oku)、
  その{{後|あと}}、このクリーチャーを[{{山札|やまふだ}}](term:term-deck)の
  {{下|した}}に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Durante il turno avversario, quando sta per entrare una creatura avversaria
  con costo maggiore del numero di carte nel mana dell'avversario, se tra
  battle zone e mana zone hai in totale almeno 3 Joker, l'avversario mette
  invece quella creatura in fondo al mazzo e poi mette in fondo al mazzo anche
  questa creatura.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 相手のマナゾーンにあるカードの枚数より

- Il blocco lungo prima di `より` è tutto il benchmark del confronto:
  `相手のマナゾーンにあるカードの枚数`.
- `相手の` specifica il possessore, `マナゾーンにあるカード` restringe il
  gruppo contato e `枚数` trasforma quel gruppo in un numero.
- [より](grammar:grammar-yori) non significa `da` o `a partire da`: qui marca
  il valore di riferimento rispetto al quale verrà confrontato il costo.

### 2. コストが大きい

- Qui il pezzo decisivo è [{{大|おお}}きい](term:term-ookii). In giapponese
  generale vuol dire `grande`, ma con `コスト` non parla della taglia fisica
  della creatura.
- `コストが大きい` significa `avere un costo numericamente più alto`.
- Messo insieme a `より`, il senso completo non è `una creatura grossa`, ma
  `una creatura il cui costo supera quel benchmark`.
- La direzione del confronto è importante: `Xよりコストが大きい` = il costo è
  sopra `X`; non `entro X`, non `uguale a X`.

### 3. 相手のクリーチャーが出る時

- [{{出|で}}る](term:term-deru) è il verbo intransitivo di ingresso, quindi la
  frase guarda il momento in cui la creatura entra o sta entrando.
- [{{時|とき}}](grammar:grammar-toki) apre la finestra temporale. Qui non stai
  leggendo un effetto `dopo che è già rimasta sul campo`, ma la finestra di
  ingresso a cui si aggancerà la sostituzione.
- Anche `相手のターン中に` va tenuto dentro la stessa lettura: la carta non
  protegge sempre, ma solo nelle entrate che avvengono durante il turno
  avversario.

### 4. かわりにそのクリーチャーを山札の下に置き、その後、このクリーチャーを山札の下に置く

- [かわりに](grammar:grammar-kawarini) segnala una sostituzione vera: invece
  di lasciare entrare normalmente quella creatura, la mandi sotto il mazzo.
- `そのクリーチャー` punta alla creatura appena identificata dalla soglia
  `より ... 大きい`.
- `その後` aggiunge un secondo passaggio nello stesso pacchetto: dopo aver
  sistemato la creatura avversaria, anche Babyponnosuke va sotto il mazzo.
- Questo spiega perché `出る時` è importante: la carta interviene proprio sulla
  procedura di ingresso, non su una creatura già stabilizzata sul battle zone.

## Lessico utile in questa carta

- [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke) va collegata subito a un
  pattern molto leggibile: benchmark con
  [より](grammar:grammar-yori), superamento della soglia con
  [{{大|おお}}きい](term:term-ookii), finestra di ingresso con
  [{{出|で}}る](term:term-deru)[{{時|とき}}](grammar:grammar-toki).
- [より](grammar:grammar-yori) qui non è un confronto astratto: fissa il
  numero oltre cui il costo diventa proibito.
- [{{大|おお}}きい](term:term-ookii) in un rules text di costo vale `più alto`,
  non `più grande` in senso fisico.
- [かわりに](grammar:grammar-kawarini) conferma che l'effetto rimpiazza
  l'ingresso normale con una destinazione diversa.
