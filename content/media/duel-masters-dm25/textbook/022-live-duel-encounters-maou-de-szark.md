---
id: lesson-duel-masters-dm25-live-duel-encounters-maou-de-szark
media_id: media-duel-masters-dm25
slug: live-duel-encounters-maou-de-szark
title: Carte incontrate - Maou De Szark
order: 51
segment_ref: live-duel-encounters
difficulty: n2
status: active
tags: [live-duel, card-encounter, mugestsu-no-mon, magic-tool, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-crash-hadou
  ]
summary: >-
  Maou De Szark: Gate of Moonless Night, lettura di due per ciascun gruppo e
  del chunk che permette di evocare senza pagare il costo.
---

# [{{魔凰|まおう}} デ・スザーク](term:term-maou-de-szark)

:::image
src: assets/cards/live-duel/maou-de-szark.jpg
alt: "Maou De Szark card."
caption: >-
  [{{魔凰|まおう}} デ・スザーク](term:term-maou-de-szark)。 Razze:
  [マスター・ドルスザク](term:term-master-dolszak) /
  [マフィ・ギャング](term:term-mafi-gang)。 Riga centrale:
  [{{無月|むげつ}}の{{門|もん}}](term:term-mugestsu-no-mon) e ingresso gratis sopra quattro
  [{{魔導具|まどうぐ}}](term:term-madougu).
:::

## Keyword presenti sulla carta

- [{{無月|むげつ}}の{{門|もん}}](term:term-mugestsu-no-mon)
- [W・ブレイカー](term:term-w-breaker)

`W・ブレイカー` sta già nella keyword bank. Qui ci concentriamo sul blocco
lungo di `{{無月|むげつ}}の{{門|もん}}` e sul secondo effetto di ingresso.

## Effetti da leggere

:::example_sentence
jp: >-
  [{{無月|むげつ}}の{{門|もん}}](term:term-mugestsu-no-mon)：
  [{{自分|じぶん}}](term:term-self)の[{{魔導具|まどうぐ}}](term:term-madougu)が
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の[{{魔導具|まどうぐ}}](term:term-madougu)を
  [バトルゾーン](term:term-battle-zone)と[{{墓地|ぼち}}](term:term-graveyard)から
  {{2|ふた}}つ[ずつ](grammar:grammar-zutsu)[{{選|えら}}び](term:term-erabu)、この
  クリーチャーを{{自分|じぶん}}の[{{手札|てふだ}}](term:term-hand)または
  [{{墓地|ぼち}}](term:term-graveyard)からそれら{{4枚|よんまい}}の{{上|うえ}}に
  [コスト](term:term-cost)を[{{払|はら}}わ](term:term-harau)ずに
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  Gate of Moonless Night: quando un tuo Magic Tool entra nel battle zone,
  scegli due tuoi Magic Tool dal battle zone e due dal cimitero, poi puoi
  evocare questa creatura dalla tua mano o dal tuo cimitero sopra quelle
  quattro carte senza pagarne il costo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、そのターン、
  [{{相手|あいて}}](term:term-opponent)のクリーチャー
  [すべて](term:term-subete)の
  [パワー](term:term-power)を{{-3000|マイナスさんぜん}}する。
translation_it: >-
  Quando entra nel battle zone, per quel turno tutte le creature avversarie
  prendono -3000 potere.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 自分の魔導具がバトルゾーンに出た時

- Il soggetto del trigger non è `このクリーチャー`, ma `自分の魔導具`.
- [{{出|で}}た](term:term-deru) + [{{時|とき}}](grammar:grammar-toki) segnala
  il classico trigger di ingresso: la keyword si accende quando un tuo Magic
  Tool arriva sul campo.
- Questo conta anche se la carta che entra non è De Szark: l'effetto guarda la
  famiglia `{{魔導具|まどうぐ}}`, non il nome proprio.

### 2. バトルゾーンと墓地から{{2|ふた}}つずつ選び

- Il blocco difficile qui è [ずつ](grammar:grammar-zutsu): distribuisce la
  quantità su ciascun gruppo nominato.
- Quindi non stai scegliendo quattro carte da dove vuoi; stai scegliendo `2`
  dal battle zone e `2` dal cimitero.
- `自分の魔導具を` resta sottinteso anche dopo `墓地から`: i bersagli validi
  sono sempre i tuoi Magic Tool.

### 3. それら{{4枚|よんまい}}の上にコストを払わずに召喚してもよい

- `それら{{4枚|よんまい}}` riprende esattamente le quattro carte appena scelte.
- `それら` non aggiunge un nuovo gruppo: serve a richiudere la frase e a dire
  `quelle appena nominate`.
- Nel rules text è un ottimo campanello d'allarme: quando compare `それら`,
  fermati e recupera l'ultimo insieme esplicito costruito subito prima.
- `〜の上に` dice che De Szark entra sopra quel gruppo di carte: non è una
  semplice messa in campo separata.
- [コスト](term:term-cost)を[{{払|はら}}わ](term:term-harau)ずに +
  [{{召喚|しょうかん}}](term:term-summon)してもよい unisce due chunk già noti:
  `senza pagare il costo` e `puoi evocare`.
- Il giapponese qui mette prima la procedura e poi l'opzione finale: leggi
  tutto il blocco prima di decidere se il payoff è obbligatorio o facoltativo.

### 4. バトルゾーンに出た時、そのターン

- Il secondo effetto torna al trigger base di ingresso, ma stavolta il soggetto
  implicito è proprio questa creatura.
- `そのターン` delimita la durata del debuff: non è permanente, vale solo per
  il turno in corso.
- [すべて](term:term-subete) allarga subito lo scope all'intero gruppo appena
  nominato: qui vuol dire `tutte le creature avversarie`.
- `すべてのパワーを{{-3000|マイナスさんぜん}}する` colpisce quindi tutto il
  lato avversario insieme, non un bersaglio singolo e non solo una parte del
  gruppo.

## Lessico utile in questa carta

- [{{魔導具|まどうぐ}}](term:term-madougu) è il filtro davvero importante: se un effetto
  parla di `{{魔導具|まどうぐ}}`, De Szark e i suoi pezzi di supporto entrano nello stesso
  gruppo operativo.
- [それら](grammar:grammar-sorera) è piccolo ma utile: nei testi di carta
  riaggancia spesso un gruppo appena costruito e ti evita di perdere il
  referente nel mezzo della procedura.
- [すべて](term:term-subete) è un marcatore di scope molto frequente: quando lo
  incontri dopo un nome di gruppo, l'effetto si estende all'insieme intero.
- [マスター・ドルスザク](term:term-master-dolszak) è la razza boss della carta.
  Quando la rileggi nella riga `{{種族|しゅぞく}}`, sai che non è sapore narrativo ma un
  marcatore tribale.
- [マフィ・ギャング](term:term-mafi-gang) accompagna spesso le carte oscure più
  aggressive o sporche di vantaggio. Qui è una seconda etichetta di razza da
  riconoscere al volo.
