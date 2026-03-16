---
id: lesson-duel-masters-dm25-live-duel-encounters-crash-haou
media_id: media-duel-masters-dm25
slug: live-duel-encounters-crash-haou
title: Carte incontrate in partita 1 - Crash "Haou" e il trigger del turno extra
order: 50
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, extra-turn, beat-jockey, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Prima lesson della nuova sezione "carte incontrate in partita": partiamo da
  `{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}`, verifichiamo il
  nome su fonte ufficiale DMPS e isoliamo il lessico e il parsing davvero nuovi
  che servono per leggere il trigger del turno extra.
---

# Obiettivo

Questa lesson inaugura una nuova sottosezione del textbook: carte che incontri
mentre giochi, riconosciute dallo screenshot e poi ripulite in chiave studio.

Qui il punto non e "tradurre tutto da zero", ma separare:

- cio che il media ti ha gia insegnato;
- cio che questa carta aggiunge davvero come nome, razze, keyword e parsing.

Alla fine dovresti riconoscere subito:

- il nome [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-haou);
- il blocco tecnico `タップ{{状態|じょうたい}}で{{破壊|はかい}}された{{時|とき}}`;
- la finestra `このターンの{{後|あと}}に`, cioe il punto in cui si inserisce il
  turno extra.

## Contesto

Dallo screenshot la carta identificata e
[{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-haou),
creatura di [ドラゴンギルド](term:term-dragonguild) /
[ビートジョッキー](term:term-beat-jockey), fuoco, costo 10, potere `9000+`.

Per questo primo test la verifica ufficiale e stata fatta sul card list di
`DUEL MASTERS PLAY'S` e sulla FAQ ufficiale che usa proprio il caso del turno
extra di `クラッシュ“覇道”`. Per le keyword di gioco, in piu, conviene usare
anche i tooltip ufficiali del card list DMPS.

## Termini chiave

- [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-haou)
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

### 2. Keyword ufficiali da recuperare

Per keyword di gioco come `B・A・D 2`, non basta leggere il nome sulla carta:
va recuperata anche la spiegazione ufficiale del database.

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

Qui la fonte ufficiale DMPS definisce `B・A・D` in forma generale; su
`[B・A・D 2](term:term-b-a-d-two)` il `2` specifica il numero della riduzione.
Questa ultima parte e quindi un'inferenza diretta dalla keyword numerata sulla
carta.

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

### 3. Dove sta davvero la novita

Qui molte parole-base le hai gia:
[{{破壊|はかい}}](term:term-destroy),
[タップ](term:term-tap),
[W・ブレイカー](term:term-w-breaker),
[パワー](term:term-power).

La novita vera e il blocco completo:

- `タップ{{状態|じょうたい}}` aggiunge l'idea di stato, non solo l'azione di
  tap;
- `～された{{時|とき}}` sposta il trigger in passivo: non "quando distruggi",
  ma "quando viene distrutta";
- `このターンの{{後|あと}}に` non vuol dire genericamente "piu tardi": inserisce
  un turno extra subito dopo quello corrente.

Per questo motivo, qui la flashcard su [B・A・D 2](term:term-b-a-d-two) resta
utile: la keyword non e solo da riconoscere, ma da associare subito al suo
testo ufficiale abbreviato.

### 4. Parsing del trigger principale

Leggilo in tre pezzi fissi:

1. `このクリーチャーが{{破壊|はかい}}された{{時|とき}}`
   `= quando questa creatura viene distrutta`.
2. `タップ{{状態|じょうたい}}でいたら`
   `= solo se, in quel momento, era tappata`.
3. `このターンの{{後|あと}}に{{自分|じぶん}}のターンを{{追加|ついか}}する`
   `= dopo il turno attuale ne ottieni subito un altro`.

Questo e il vero blocco da rendere automatico, perche la FAQ ufficiale DMPS
usa proprio questo trigger come caso regolistico reale.

### 5. Come leggere l'ultima riga

`[バトル](term:term-battle)[{{中|ちゅう}}](grammar:grammar-ui-chuu)` va letto come
finestra di combattimento, non come semplice "mentre attacca". La riga quindi
non parla di ingresso o di fine turno: ti dice che nello scontro questa
creatura sale a `+5000`.

### 6. Cosa mandare in review

Per questa carta conviene mettere in review:

- il nome completo, cosi lo riconosci subito in partita;
- le due razze nuove, [ドラゴンギルド](term:term-dragonguild) e
  [ビートジョッキー](term:term-beat-jockey);
- le keyword [B・A・D 2](term:term-b-a-d-two) e
  [スピードアタッカー](term:term-speed-attacker);
- i due blocchi di parsing che qui fanno davvero la differenza:
  [～された{{時|とき}}](grammar:grammar-sareta-toki) e
  [～の{{後|あと}}に](grammar:grammar-no-ato-ni).
