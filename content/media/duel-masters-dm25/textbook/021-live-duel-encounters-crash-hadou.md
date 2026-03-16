---
id: lesson-duel-masters-dm25-live-duel-encounters-crash-hadou
media_id: media-duel-masters-dm25
slug: live-duel-encounters-crash-hadou
title: Carte incontrate - Crash Hadou
order: 50
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, extra-turn, beat-jockey, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Carta encounter dedicata a Crash Hadou: foto della carta, righe effetto
  davvero da leggere, spiegazione grammaticale concreta dei pattern nuovi e
  flashcard utile per il chunk del turno extra.
---

# [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou)

:::image
src: assets/cards/crash-hadou.png
alt: "Crash Hadou card."
caption: >-
  [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou)。
  Razze: [ドラゴンギルド](term:term-dragonguild) /
  [ビートジョッキー](term:term-beat-jockey)。 Riga centrale: turno extra se
  viene distrutta da tappata.
:::

## Keyword presenti sulla carta

- [B・A・D 2](term:term-b-a-d-two)
- [スピードアタッカー](term:term-speed-attacker)
- [W・ブレイカー](term:term-w-breaker)

Le keyword stanno nella keyword bank. Qui sotto restano solo le righe che
richiedono parsing della frase.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが[{{破壊|はかい}}](term:term-destroy)された
  [{{時|とき}}](grammar:grammar-sareta-toki)、
  [タップ{{状態|じょうたい}}](term:term-tap-state)でいたら、このターンの
  [{{後|あと}}](grammar:grammar-no-ato-ni)に
  [{{自分|じぶん}}](term:term-self)の
  [ターンを{{追加|ついか}}する](term:term-add-turn)。
translation_it: >-
  Quando questa creatura viene distrutta, se era in stato tapped, aggiungi un
  tuo turno dopo questo turno.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [バトル](term:term-battle)[{{中|ちゅう}}](grammar:grammar-ui-chuu)、この
  クリーチャーの[パワー](term:term-power)を+5000する。
translation_it: >-
  Durante il battle, questa creatura prende +5000 potere.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーが破壊された時

- `このクリーチャーが` marca il soggetto dell'intera condizione: e questa
  creatura quella che subisce l'evento.
- [{{破壊|はかい}}](term:term-destroy) + [～された{{時|とき}}](grammar:grammar-sareta-toki)
  crea un trigger passivo: `quando viene distrutta`.
- Il `た` in `された` non e passato narrativo; e la forma che modifica
  [{{時|とき}}](grammar:grammar-sareta-toki), cioe `nel momento in cui e stata
  distrutta / quando viene distrutta`.

### 2. タップ状態でいたら

- [タップ{{状態|じょうたい}}](term:term-tap-state) e un nome: `stato tapped`.
- `でいる` qui non vuol dire "stare facendo", ma "essere in quello stato".
- [～たら](grammar:grammar-tara) aggiunge la condizione: `se era in stato tapped`.
- Quindi il senso completo e: il turno extra parte solo se, nel momento della
  distruzione, la creatura si trovava gia tappata.

### 3. このターンの後に自分のターンを追加する

- [～の{{後|あと}}に](grammar:grammar-no-ato-ni) significa `dopo X`.
- `このターンの後に` fissa il punto esatto: subito dopo il turno attuale.
- [{{自分|じぶん}}](term:term-self)のターン chiarisce che il turno aggiunto e il
  tuo, non un turno generico.
- [ターンを{{追加|ついか}}する](term:term-add-turn) e il chunk lessicale da
  fissare come `aggiungere un turno`.

### 4. バトル中

- [バトル](term:term-battle) + [{{中|ちゅう}}](grammar:grammar-ui-chuu) =
  `durante il battle`.
- Non vuol dire genericamente `quando attacca`: delimita proprio la finestra
  dello scontro.

## Lessico utile in questa carta

- [ドラゴンギルド](term:term-dragonguild) e
  [ビートジョッキー](term:term-beat-jockey) sono le due razze della carta.
- Se incontri effetti che cercano una di queste razze, questa carta puo essere
  un bersaglio valido.

## Flashcard utile

- `タップ状態で破壊された時、このターンの後に自分のターンを追加する`
  e la flashcard nuova che vale la pena tenere: il chunk unisce passivo, stato
  e timing nello stesso blocco.
