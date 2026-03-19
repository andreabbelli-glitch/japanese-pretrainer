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
  condizione sul mana che le conferisce S-Trigger mentre si trova negli scudi.
---

# [タマタンゴ・パンツァー](term:term-tamatango-panzer)

:::image
src: assets/cards/live-duel/tamatango-panzer.webp
alt: "Tamatango Panzer card."
caption: >-
  [タマタンゴ・パンツァー](term:term-tamatango-panzer)。 Razza:
  [グランセクト](term:term-gransect)。 Riga centrale: entra tapped, costringe
  gli attaccanti avversari a colpirlo se possono e ottiene
  [S・トリガー](term:term-s-trigger) mentre si trova nello shield zone se il mana
  supera la soglia.
:::

## Keyword presenti sulla carta

- [T（トリプル）・ブレイカー](term:term-t-breaker)
- [S・トリガー](term:term-s-trigger)

Le keyword sono gia coperte nella keyword bank. Qui conviene concentrarsi sul
modo in cui il testo costruisce l'ingresso tapped, il vincolo `se possibile` e
la condizione lunga che conferisce `S・トリガー` alla carta negli scudi.

## Effetti da leggere

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)に{{置|お}}く
  [{{時|とき}}](grammar:grammar-toki)、このカードは
  [タップして{{置|お}}く](term:term-enter-battle-zone-tapped)。
translation_it: >-
  Quando viene messa nel battle zone, questa carta viene messa tapped.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の
  [クリーチャー](term:term-creature)が
  [{{攻撃|こうげき}}](term:term-attack)する
  [{{場合|ばあい}}](term:term-baai)、
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
  [クリーチャー](term:term-creature)が{{5体以上|ごたいいじょう}}あれば、
  [シールドゾーン](term:term-shield-zone)にあるこの
  [クリーチャー](term:term-creature)に
  「[S・トリガー](term:term-s-trigger)」を[{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Se nel tuo mana zone ci sono almeno cinque creature con potere 12000 o piu,
  questa creatura nello shield zone ottiene S-Trigger.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. バトルゾーンに置く時、このカードはタップして置く

- `バトルゾーンに{{置|お}}く[{{時|とき}}](grammar:grammar-toki)` apre il timing:
  il testo fissa il momento in cui la carta viene collocata nel battle zone.
- Il verbo chiave qui non e `{{出|で}}る`, ma `{{置|お}}く`, ripetuto due volte.
  La prima occorrenza definisce `quando`, la seconda definisce `come`: la carta
  viene messa sul campo gia in stato tapped.
- [タップして{{置|お}}く](term:term-enter-battle-zone-tapped) va quindi letto
  come blocco operativo unico, non come ingresso normale seguito da un tap
  separato.

### 2. 相手のクリーチャーが攻撃する[場合](term:term-baai)、可能なら

- `{{攻撃|こうげき}}する[{{場合|ばあい}}](term:term-baai)` costruisce il caso
  preciso in cui controllare l'obbligo: prima delimita la situazione
  rilevante, poi dice cosa deve succedere dentro quella situazione.
- In giapponese generale `{{場合|ばあい}}` vuol dire `caso`, `situazione`,
  `scenario di riferimento`. Qui la carta lo usa in modo tecnico: appena si
  presenta il caso di un attacco avversario, il gioco controlla subito il
  bersaglio legale.
- [{{可能|かのう}}なら](grammar:grammar-kanou-nara) non rende l'effetto
  facoltativo. Vuol dire invece `se il gioco lo permette davvero`: se
  quell'attaccante puo scegliere questa creatura, deve farlo.
- Il pezzo finale `このクリーチャーを{{攻撃|こうげき}}する` chiude il
  reindirizzamento: non cambia il fatto che ci sia un attacco, cambia quale
  bersaglio quell'attacco deve prendere.

### 3. 自分のマナゾーンにパワー12000以上のクリーチャーが5体以上あれば

- Qui [あれば](grammar:grammar-areba) controlla una soglia precisa prima di
  concedere il payoff successivo.
- Il gruppo contato non e `qualsiasi carta nel mana`: sono solo le carte che
  soddisfano insieme due filtri, cioe `クリーチャー` e
  `パワー{{12000以上|いちまんにせんいじょう}}`.
- La stampa usa proprio `{{5体以上|ごたいいじょう}}`, non `5枚以上`: il testo
  continua a contare `クリーチャー` come categoria di carta rilevante, anche se
  in quel momento si trovano nella mana zone.

### 4. シールドゾーンにあるこのクリーチャーに「S・トリガー」を[与える](term:term-ataeru)

- `シールドゾーンにあるこのクリーチャー` restringe con precisione il bersaglio:
  non parla del momento in cui la carta esce dagli scudi, ma della carta mentre
  si trova ancora nello shield zone.
- In giapponese generale [{{与|あた}}える](term:term-ataeru) vuol dire `dare`,
  `conferire`, `attribuire`. Qui il verbo conserva quell'idea di base, ma la
  applica a una keyword di gioco: il testo sta dicendo che `S・トリガー` viene
  assegnato a questa carta in questo stato.
- `「S・トリガー」を[{{与|あた}}える](term:term-ataeru)` significa quindi che la
  keyword viene concessa da questa condizione; non e una keyword sempre attiva
  stampata in modo indipendente.
- La lettura completa quindi e: `se la soglia nel mana c'e, allora questa carta
  ha S-Trigger mentre si trova nei tuoi scudi, e quindi potra usarlo quando
  verra rivelata da li`.

## Lessico utile in questa carta

- [グランセクト](term:term-gransect) e la razza della carta: quando la rileggi
  sulla riga `{{種族|しゅぞく}}`, sai che stai guardando un filtro tribale, non un
  nome decorativo.
- [タップして{{置|お}}く](term:term-enter-battle-zone-tapped) e un chunk utile
  per tutte le carte che vengono messe sul campo gia tappate.
- [{{場合|ばあい}}](term:term-baai) e una parola piccola ma molto ricorrente:
  ti segnala il `caso` o la `situazione` in cui il gioco deve controllare una
  regola, un vincolo o una conseguenza.
- [{{与|あた}}える](term:term-ataeru) e un verbo utile da fissare bene: nei testi
  di carta compare spesso quando un effetto concede a una carta una keyword,
  un'abilita o un'altra proprieta.
- [{{可能|かのう}}なら](grammar:grammar-kanou-nara) e piccolo ma decisivo: nei
  testi di carta segnala spesso un obbligo che vale solo se la giocata resta
  legalmente possibile.
