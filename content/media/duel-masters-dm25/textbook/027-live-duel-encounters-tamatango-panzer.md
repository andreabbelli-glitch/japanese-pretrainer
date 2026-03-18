---
id: lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
media_id: media-duel-masters-dm25
slug: live-duel-encounters-tamatango-panzer
title: Carte incontrate - Tamatango Panzer
order: 56
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, gransect, shield-trigger, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
  ]
summary: >-
  Tamatango Panzer: ingresso tapped, attacchi reindirizzati se possibile e
  condizione sul mana che trasforma la carta in S-Trigger dallo scudo.
---

# [タマタンゴ・パンツァー](term:term-tamatango-panzer)

:::image
src: assets/cards/live-duel/tamatango-panzer.webp
alt: "Tamatango Panzer card."
caption: >-
  [タマタンゴ・パンツァー](term:term-tamatango-panzer)。 Razza:
  [グランセクト](term:term-gransect)。 Riga centrale: entra tapped, costringe
  gli attaccanti avversari a colpirlo se possono e diventa
  [S・トリガー](term:term-s-trigger) dallo scudo se il mana supera la soglia.
:::

## Keyword presenti sulla carta

- [T・ブレイカー](term:term-t-breaker)
- [S・トリガー](term:term-s-trigger)

Le keyword sono gia coperte nella keyword bank. Qui conviene concentrarsi sul
modo in cui il testo costruisce l'ingresso tapped, il vincolo `se possibile` e
la condizione lunga che accende `S・トリガー`.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーは、
  [タップしてバトルゾーンに{{出|で}}る](term:term-enter-battle-zone-tapped)。
translation_it: Questa creatura entra nel battle zone tapped.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の
  [クリーチャー](term:term-creature)が
  [{{攻撃|こうげき}}](term:term-attack)する
  {{場合|ばあい}}、
  [{{可能|かのう}}なら](grammar:grammar-kanou-nara)この
  [クリーチャー](term:term-creature)を
  [{{攻撃|こうげき}}](term:term-attack)する。
translation_it: >-
  Quando una creatura avversaria attacca, se puo farlo deve attaccare questa
  creatura.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{自分|じぶん}}](term:term-self)の
  [マナゾーン](term:term-mana-zone)に
  [パワー](term:term-power){{12000以上|いちまんにせんいじょう}}の
  [クリーチャー](term:term-creature)が{{5枚以上|ごまいいじょう}}あれば、
  [{{自分|じぶん}}](term:term-self)の
  [シールドゾーン](term:term-shield-zone)から
  [{{手札|てふだ}}](term:term-hand)に
  [{{加|くわ}}える](term:term-add)このカードに
  「[S・トリガー](term:term-s-trigger)」を{{与|あた}}える。
translation_it: >-
  Se hai cinque o piu creature con potere 12000 o piu nel mana, questa carta
  ottiene S-Trigger quando la aggiungi alla mano dai tuoi scudi.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーは、タップしてバトルゾーンに出る

- [タップしてバトルゾーンに{{出|で}}る](term:term-enter-battle-zone-tapped) va letto
  come un blocco unico: la carta non entra e poi viene tappata, ma arriva gia
  sul campo in quello stato.
- Il soggetto resta `このクリーチャーは`, quindi il testo non parla di una
  creatura qualsiasi che metti tu: parla proprio di questa carta e del suo modo
  di ingresso.
- In pratica il giapponese comprime stato e movimento nella stessa frase:
  `come entra` e `in che stato entra` vengono letti insieme.

### 2. 相手のクリーチャーが攻撃する場合、可能なら

- `{{攻撃|こうげき}}する{{場合|ばあい}}` costruisce la situazione in cui controllare
  l'obbligo: ogni volta che una creatura avversaria prova ad attaccare, il
  testo verifica subito il bersaglio legale.
- [{{可能|かのう}}なら](grammar:grammar-kanou-nara) non rende l'effetto
  facoltativo. Vuol dire invece `se il gioco lo permette davvero`: se
  quell'attaccante puo scegliere questa creatura, deve farlo.
- Il pezzo finale `このクリーチャーを{{攻撃|こうげき}}する` chiude il
  reindirizzamento: non cambia il fatto che ci sia un attacco, cambia quale
  bersaglio quell'attacco deve prendere.

### 3. 自分のマナゾーンにパワー12000以上のクリーチャーが5枚以上あれば

- Qui [あれば](grammar:grammar-areba) controlla una soglia precisa prima di
  concedere il payoff successivo.
- Il gruppo contato non e `qualsiasi carta nel mana`: sono solo le carte che
  soddisfano insieme due filtri, cioe `クリーチャー` e
  `パワー{{12000以上|いちまんにせんいじょう}}`.
- `{{5枚以上|ごまいいじょう}}` vale la pena di notarlo bene: nel mana stai
  contando carte presenti in quella zona, non creature in battle zone.

### 4. シールドゾーンから手札に加えるこのカードに「S・トリガー」を与える

- `シールドゾーンから{{手札|てふだ}}に{{加|くわ}}えるこのカード` restringe con
  precisione quando l'effetto si applica: non `sempre questa carta`, ma questa
  carta proprio nel passaggio da scudo a mano.
- `「S・トリガー」を与える` significa che la keyword viene concessa da questa
  condizione; non e una keyword sempre attiva stampata in modo indipendente.
- La lettura completa quindi e: `se la soglia nel mana c'e, allora questa carta
  si comporta come uno S-Trigger quando esce dagli scudi`.

## Lessico utile in questa carta

- [グランセクト](term:term-gransect) e la razza della carta: quando la rileggi
  sulla riga `{{種族|しゅぞく}}`, sai che stai guardando un filtro tribale, non un
  nome decorativo.
- [タップしてバトルゾーンに{{出|で}}る](term:term-enter-battle-zone-tapped) e un
  chunk molto utile da fissare per tutte le creature che entrano gia tappate.
- [{{可能|かのう}}なら](grammar:grammar-kanou-nara) e piccolo ma decisivo: nei
  testi di carta segnala spesso un obbligo che vale solo se la giocata resta
  legalmente possibile.
