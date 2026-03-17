---
id: lesson-duel-masters-dm25-live-duel-encounters-dama-vaishingu
media_id: media-duel-masters-dm25
slug: live-duel-encounters-dama-vaishingu
title: Carte incontrate - Dama Vaishingu
order: 52
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, graveyard, magic-tool, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-maou-de-szark
  ]
summary: >-
  Dama Vaishingu: recupero dal cimitero, filtro sui Magic Tool di costo 4 o
  meno e bivio finale verso campo o mano.
---

# [{{堕魔|だーま}}](term:term-dama) ヴァイシング

:::image
src: assets/cards/live-duel/dama-vaishingu.jpg
alt: "Dama Vaishingu card."
caption: >-
  [{{堕魔|だーま}}](term:term-dama) ヴァイシング。 Razze:
  [マフィ・ギャング](term:term-mafi-gang) /
  [{{魔導具|まどうぐ}}](term:term-madougu)。 Riga centrale: scegli una creatura nel tuo
  cimitero e decidi se torna sul campo o in mano in base al filtro costo `4`
  sui Magic Tool.
:::

## Effetto da leggere

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [{{墓地|ぼち}}](term:term-graveyard)からクリーチャー{{1枚|いちまい}}を
  [{{選|えら}}ぶ](term:term-erabu)。それが[コスト](term:term-cost)
  {{4以下|よんいか}}の[{{魔導具|まどうぐ}}](term:term-madougu)なら
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}し](term:term-dasu)、
  [それ{{以外|いがい}}なら](grammar:grammar-soreigai-nara)
  [{{手札|てふだ}}](term:term-hand)に[{{加|くわ}}える](term:term-add)。
translation_it: >-
  Quando entra nel battle zone, scegli una creatura dal tuo cimitero. Se quella
  carta è un Magic Tool di costo 4 o meno, la metti nel battle zone;
  altrimenti la aggiungi alla mano.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 自分の墓地からクリーチャー{{1枚|いちまい}}を選ぶ

- Il primo verbo importante è [{{選|えら}}ぶ](term:term-erabu): qui la carta
  non recupera a caso, ma ti fa scegliere in modo mirato.
- Il bersaglio iniziale è largo: `クリーチャー{{1枚|いちまい}}`, non ancora
  `{{魔導具|まどうぐ}}{{1枚|いちまい}}`.
- Quindi la restrizione vera arriva solo nella frase successiva.

### 2. それがコスト{{4以下|よんいか}}の魔導具なら

- [それが～なら](grammar:grammar-sorega-nara) riprende proprio la carta appena
  scelta dal cimitero e la mette subito sotto verifica.
- `コスト{{4以下|よんいか}}` riusa il filtro numerico già noto: conta il costo
  stampato della carta scelta.
- `魔導具なら` aggiunge il secondo controllo: per tornare direttamente sul campo,
  la carta deve essere sia Magic Tool sia di costo `4` o meno.

### 3. バトルゾーンに出し、それ以外なら手札に加える

- [{{出|だ}}す](term:term-dasu) è il verbo transitivo: l'effetto fa entrare la
  carta nel battle zone.
- [それ{{以外|いがい}}なら](grammar:grammar-soreigai-nara) apre il ramo alternativo: se la
  carta scelta non passa il filtro precedente, non la perdi e non la lasci nel
  cimitero, ma la mandi in mano.
- [{{手札|てふだ}}](term:term-hand)に[{{加|くわ}}える](term:term-add) è quindi il
  piano di ripiego, non un secondo premio separato.
- Le due metà della frase vanno lette come un bivio chiuso sullo stesso
  bersaglio: `それが ... なら` manda sul campo, `それ{{以外|いがい}}なら` manda in mano.

### 4. Perché questa frase vale la pena di essere letta bene

- La carta non dice `魔導具を選ぶ`, quindi puoi scegliere anche una creatura che
  non rientra nel filtro stretto.
- Il giapponese ti fa prima scegliere e solo dopo controlla il bivio.
- Se leggi bene `それが ... なら / それ以外なら`, capisci subito che la frase ha
  due uscite diverse ma parte da un solo bersaglio.

## Lessico utile in questa carta

- [{{堕魔|だーま}}](term:term-dama) compare in molti nomi del pacchetto
  `{{魔導具|まどうぐ}}`: è un prefisso d'archetipo, non un kanji ornamentale.
- [{{魔導具|まどうぐ}}](term:term-madougu) qui decide il risultato pratico dell'effetto:
  campo se il filtro passa, mano se non passa.
- [マフィ・ギャング](term:term-mafi-gang) resta nella riga `{{種族|しゅぞく}}` come seconda
  etichetta tribale della carta.
