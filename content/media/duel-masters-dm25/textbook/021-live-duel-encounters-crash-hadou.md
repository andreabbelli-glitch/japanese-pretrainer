---
id: lesson-duel-masters-dm25-live-duel-encounters-crash-hadou
media_id: media-duel-masters-dm25
slug: live-duel-encounters-crash-hadou
title: Carte incontrate in partita 1 - Crash "Hadou" e il trigger del turno extra
order: 50
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, extra-turn, beat-jockey, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Leggiamo `勝利龍装 クラッシュ“覇道”` pezzo per pezzo: nome, razze, keyword e
  trigger che aggiunge un turno extra se la creatura viene distrutta da
  tappata.
---

# Obiettivo

Qui impari a leggere
[{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou)
senza ritradurre ogni riga da zero.

In questa carta il lessico gia noto, come
[{{破壊|はかい}}](term:term-destroy), [タップ](term:term-tap) e
[W・ブレイカー](term:term-w-breaker), si combina con tre punti che cambiano
davvero la lettura:

- il composto [タップ{{状態|じょうたい}}](term:term-tap-state);
- il trigger passivo [～された{{時|とき}}](grammar:grammar-sareta-toki);
- la finestra [～の{{後|あと}}に](grammar:grammar-no-ato-ni), che qui produce un
  turno extra.

Alla fine saprai:

- riconoscere il nome
  [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou);
- leggere il blocco `タップ{{状態|じょうたい}}で{{破壊|はかい}}された{{時|とき}}`;
- capire perche `このターンの{{後|あと}}に` inserisce subito un tuo turno extra.

## Contesto

Dallo screenshot la carta identificata e
[{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou),
creatura di [ドラゴンギルド](term:term-dragonguild) /
[ビートジョッキー](term:term-beat-jockey), fuoco, costo 10, potere `9000+`.

La carta concentra tre livelli diversi:

- un nome proprio molto carico, che va riconosciuto come etichetta unica;
- una riga di razze che colloca la carta dentro famiglie precise;
- un trigger che parla di distruzione, stato tapped e ordine dei turni.

## Termini chiave

- [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou)
- [B・A・D 2](term:term-b-a-d-two)
- [スピードアタッカー](term:term-speed-attacker)
- [ドラゴンギルド](term:term-dragonguild)
- [ビートジョッキー](term:term-beat-jockey)
- [タップ{{状態|じょうたい}}](term:term-tap-state)
- [バトル](term:term-battle)
- [ターンを{{追加|ついか}}する](term:term-add-turn)

## Pattern grammaticali chiave

- [～された{{時|とき}}](grammar:grammar-sareta-toki)
- [～の{{後|あと}}に](grammar:grammar-no-ato-ni)
- [～{{中|ちゅう}}](grammar:grammar-ui-chuu)

## Spiegazione

### 1. Effetto completo

- [B・A・D 2](term:term-b-a-d-two)
- [スピードアタッカー](term:term-speed-attacker)
- [W・ブレイカー](term:term-w-breaker)

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
:::

:::example_sentence
jp: >-
  [バトル](term:term-battle)[{{中|ちゅう}}](grammar:grammar-ui-chuu)、この
  クリーチャーの[パワー](term:term-power)を+5000する。
translation_it: >-
  Durante il battle, questa creatura prende +5000 potere.
:::

### 2. Nome e razze

Nel nome
[{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou)
la parte meccanicamente importante e riconoscere l'etichetta completa; pero il
giapponese del nome dice comunque qualcosa.

- `{{勝利|しょうり}}` vuol dire "vittoria".
- `{{龍装|りゅうそう}}` contiene `{{龍|りゅう}}`, "drago", e `{{装|そう}}`,
  "equipaggiare / armare": in un nome proprio suona come un titolo enfatico
  legato ai draghi, non come una keyword di rules text.
- `クラッシュ` e katakana inglese: "crash", quindi impatto distruttivo.
- `{{覇道|はどう}}` vuol dire letteralmente "via del dominio / dell'egemonia",
  con tono da finisher o boss card.

Questo ti aiuta a separare subito due piani:

- il nome della carta, che va letto come nome proprio;
- la riga `種族`, dove
  [ドラゴンギルド](term:term-dragonguild) e
  [ビートジョッキー](term:term-beat-jockey) sono invece categorie di gioco che
  possono contare per sinergie e riferimenti di razza.

### 3. Come leggere le keyword

:::example_sentence
jp: >-
  [B・A・D](term:term-b-a-d-two)：
  このクリーチャーの{{召喚|しょうかん}}コストを{{指定|してい}}された{{数|かず}}
  {{少|すく}}なくしてもよい。そうした{{場合|ばあい}}、このターン
  {{終了時|しゅうりょうじ}}にこのクリーチャーを[{{破壊|はかい}}](term:term-destroy)する。
translation_it: >-
  B.A.D: puoi ridurre il costo di evocazione di questa creatura del numero
  indicato. Se lo fai, alla fine di questo turno distruggi questa creatura.
:::

La prima riga della carta e un blocco di keyword aggressive:

- [B・A・D 2](term:term-b-a-d-two) ti dice che puoi farla scendere con costo
  ridotto di `2`, ma poi la carta si autodistrugge a fine turno se hai usato
  quella riduzione.
- [スピードアタッカー](term:term-speed-attacker) vuol dire che puo attaccare
  subito nel turno in cui entra.
- [W・ブレイカー](term:term-w-breaker) vuol dire che quando rompe gli scudi ne
  rompe `2`.

:::example_sentence
jp: >-
  [スピードアタッカー](term:term-speed-attacker)：
  {{召喚酔|しょうかんよ}}いしない。
translation_it: >-
  Speed Attacker: non soffre di "summoning sickness".
:::

:::example_sentence
jp: >-
  [W・ブレイカー](term:term-w-breaker)：
  シールドを{{2|ふた}}つブレイクする。
translation_it: >-
  W-Breaker: rompe 2 scudi.
:::

Su una carta cosi queste keyword spiegano il piano di gioco: entra in fretta,
puo attaccare subito, rompe due scudi e, se muore tappata, lascia dietro di se
un altro turno.

### 4. Dove cambia davvero la lettura

Molte parole-base qui sono gia note:
[{{破壊|はかい}}](term:term-destroy),
[タップ](term:term-tap),
[W・ブレイカー](term:term-w-breaker),
[パワー](term:term-power).

La parte nuova sta nel blocco completo:

- `タップ{{状態|じょうたい}}` aggiunge l'idea di stato, non solo l'azione di
  tap: la carta deve essere gia tappata quando il gioco controlla la condizione;
- `～された{{時|とき}}` sposta il trigger in passivo: non "quando distruggi",
  ma "quando viene distrutta";
- `このターンの{{後|あと}}に` non vuol dire genericamente "piu tardi": inserisce
  un turno extra subito dopo quello corrente.

### 5. Parsing del trigger principale

Leggilo in tre pezzi fissi:

1. `このクリーチャーが{{破壊|はかい}}された{{時|とき}}`
   `= quando questa creatura viene distrutta`.
2. `タップ{{状態|じょうたい}}でいたら`
   `= solo se, in quel momento, era tappata`.
3. `このターンの{{後|あと}}に{{自分|じぶん}}のターンを{{追加|ついか}}する`
   `= dopo il turno attuale ne ottieni subito un altro`.

Il punto importante di gioco e la seconda riga: se la creatura viene distrutta
ma non era tappata, il turno extra non parte. Il trigger non chiede soltanto
"muore?"; chiede "muore mentre si trova gia in stato tapped?".

### 6. Come leggere l'ultima riga

`[バトル](term:term-battle)[{{中|ちゅう}}](grammar:grammar-ui-chuu)` va letto come
finestra di combattimento, non come semplice "mentre attacca". La riga quindi
non parla di ingresso o di fine turno: ti dice che nello scontro questa
creatura sale a `+5000`.

### 7. Riepilogo operativo

Su questa carta vale la pena tenere insieme quattro cose:

- il nome completo
  [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou),
  che funziona come etichetta unica della carta;
- le due razze
  [ドラゴンギルド](term:term-dragonguild) e
  [ビートジョッキー](term:term-beat-jockey);
- il pacchetto aggressivo di keyword:
  [B・A・D 2](term:term-b-a-d-two),
  [スピードアタッカー](term:term-speed-attacker) e
  [W・ブレイカー](term:term-w-breaker);
- i due blocchi di parsing che decidono l'effetto:
  [～された{{時|とき}}](grammar:grammar-sareta-toki) e
  [～の{{後|あと}}に](grammar:grammar-no-ato-ni).

Se questi quattro pezzi sono chiari, il testo della carta smette di sembrare un
insieme di keyword sparse e diventa una sequenza molto netta: entra in fretta,
attacca subito, spinge sugli scudi e, se viene abbattuta da tappata, ti lascia
un turno extra.
