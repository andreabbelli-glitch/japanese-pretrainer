---
id: lesson-duel-masters-dm25-live-duel-encounters-shouri-no-apache-urara
media_id: media-duel-masters-dm25
slug: live-duel-encounters-shouri-no-apache-urara
title: Carte incontrate - 勝利のアパッチ・ウララー
order: 96
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [
    live-duel,
    card-encounter,
    superdimension-zone,
    psychic-creature,
    civilization-check,
    duel-masters
  ]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-card-types,
    lesson-duel-masters-dm25-live-duel-encounters-jenny-jane,
    lesson-duel-masters-dm25-live-duel-encounters-ryusei-the-earth
  ]
summary: >-
  Apache Urara: reveal casuale dalla mano avversaria, controllo su almeno una
  civiltà condivisa e uscita di una Psychic Creature dalla zona
  superdimensionale.
---

# {{勝利|しょう.り}}のアパッチ・ウララー

:::image
src: assets/cards/live-duel/shouri-no-apache-urara.png
alt: "Shouri no Apache Urara card."
caption: >-
  {{勝利|しょう.り}}のアパッチ・ウララー. Razze: メルト・ウォリアー /
  ダークロード / ハンター. La carta fa rivelare una carta casuale dalla
  [{{手札|てふだ}}](term:term-hand) avversaria, poi cerca una
  [サイキック・クリーチャー](term:term-psychic-creature) di costo
  {{8以下|はちいか}} nella [{{超次元|ちょう.じ.げん}}ゾーン](term:term-superdimension-zone)
  se quella creatura condivide almeno una [{{文明|ぶんめい}}](term:term-civilization)
  con la carta rivelata.
:::

## Keyword presenti sulla carta

Questa carta non ha keyword stampate nella riga centrale. Il peso di lettura è
tutto nell'effetto: prima `{{公開|こうかい}}させる`, poi il filtro
`そのカードと{{同|おな}}じ{{文明|ぶんめい}}を{{1|ひと}}つでも{{持|も}}つ`,
infine la provenienza dalla
[{{超次元|ちょう.じ.げん}}ゾーン](term:term-superdimension-zone).

## Effetto da leggere

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、
  [{{相手|あいて}}](term:term-opponent)のランダムな
  [{{手札|てふだ}}](term:term-hand){{1枚|いちまい}}を
  [{{公開|こうかい}}させる](term:term-koukai)。そのカードと
  [{{同|おな}}じ{{文明|ぶんめい}}を{{1|ひと}}つでも{{持|も}}つ](grammar:grammar-sono-card-to-onaji-bunmei-hitotsu-demo-motsu)、
  [コスト](term:term-cost){{8以下|はちいか}}のハンター・
  [サイキック・クリーチャー](term:term-psychic-creature){{1枚|いちまい}}を
  {{自分|じぶん}}の[{{超次元|ちょう.じ.げん}}ゾーン](term:term-superdimension-zone)から
  [{{出|だ}}す](term:term-dasu)。
translation_it: >-
  Quando entra nel battle zone, fai rivelare 1 carta casuale dalla mano
  dell'avversario. Poi metti dalla tua zona superdimensionale 1 Hunter Psychic
  Creature di costo 8 o meno che abbia almeno una civiltà uguale a quella carta.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. バトルゾーンに出た時

- `[バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)` è il trigger d'ingresso. La carta non
  controlla un attacco o una distruzione: l'effetto parte appena la creatura
  entra nel battle zone.
- `{{時|とき}}` chiude la finestra temporale e prepara la sequenza successiva.
  Dopo la virgola arrivano due frasi operative: reveal, poi messa in campo.

### 2. 相手のランダムな手札1枚を公開させる

- `[{{相手|あいて}}](term:term-opponent)の` restringe la zona alla mano
  dell'avversario.
- `ランダムな[{{手札|てふだ}}](term:term-hand){{1枚|いちまい}}` indica una carta
  scelta casualmente. Non scegli il bersaglio dopo aver visto la mano.
- `[{{公開|こうかい}}させる](term:term-koukai)` è causativo: fai rivelare la
  carta. Il testo non dice che l'avversario sceglie liberamente di mostrarla,
  ma che l'effetto lo costringe a renderla visibile.

### 3. そのカードと同じ文明を1つでも持つ

- `そのカード` riprende la carta appena rivelata. Non guarda una carta qualsiasi
  della mano: il riferimento resta fissato al risultato del reveal.
- `[{{同|おな}}じ{{文明|ぶんめい}}を{{1|ひと}}つでも{{持|も}}つ](grammar:grammar-sono-card-to-onaji-bunmei-hitotsu-demo-motsu)`
  costruisce il filtro: la creatura da scegliere deve avere almeno una
  [{{文明|ぶんめい}}](term:term-civilization) in comune con quella carta.
- `[{{1|ひと}}つでも](grammar:grammar-hitotsu-demo)` abbassa la soglia:
  basta una civiltà condivisa. Se la carta rivelata è multicolore, non serve
  coincidere con tutte le sue civiltà.

### 4. コスト8以下のハンター・サイキック・クリーチャー1枚

- `[コスト](term:term-cost){{8以下|はちいか}}` è il limite massimo: costo 8 va
  bene, costo 9 no.
- `ハンター・[サイキック・クリーチャー](term:term-psychic-creature)` accumula due
  requisiti sul tipo/razza. La creatura deve essere sia Hunter sia Psychic
  Creature.
- `{{1枚|いちまい}}` fissa la quantità scelta. Anche se più creature rispettano
  costo e civiltà, l'effetto ne mette in campo una sola.

### 5. 自分の超次元ゾーンから出す

- `{{自分|じぶん}}の` sposta la ricerca nel tuo lato: non si prende una carta
  dalla zona avversaria.
- `[{{超次元|ちょう.じ.げん}}ゾーン](term:term-superdimension-zone)` è una zona
  separata dalla mano e dal mazzo. Il kanji
  [{{超|ちょう}}](term:term-chou) aggiunge l'idea di "oltre/super", mentre
  [{{次元|じ.げん}}](term:term-jigen) dà la base "dimensione".
- `[{{出|だ}}す](term:term-dasu)` qui è transitivo: l'effetto mette la creatura
  nel battle zone. Non è una normale evocazione dalla mano.

## Lessico e chunk utili in questa carta

- [{{超次元|ちょう.じ.げん}}ゾーン](term:term-superdimension-zone) va letto come una
  zona dedicata, non come una variante poetica di `バトルゾーン`.
- [{{超|ちょう}}](term:term-chou) e [{{次元|じ.げん}}](term:term-jigen) aiutano a
  scomporre il composto `{{超次元|ちょう.じ.げん}}`.
- [{{1|ひと}}つでも](grammar:grammar-hitotsu-demo) è il pezzo che rende
  sufficiente una sola corrispondenza.
- [そのカードと{{同|おな}}じ{{文明|ぶんめい}}を{{1|ひと}}つでも{{持|も}}つ](grammar:grammar-sono-card-to-onaji-bunmei-hitotsu-demo-motsu)
  collega riferimento, somiglianza e soglia minima: `quella carta` -> `stessa
  civiltà` -> `almeno una`.
