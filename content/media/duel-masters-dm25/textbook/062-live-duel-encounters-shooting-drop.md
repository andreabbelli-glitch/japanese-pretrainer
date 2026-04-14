---
id: lesson-duel-masters-dm25-live-duel-encounters-shooting-drop
media_id: media-duel-masters-dm25
slug: live-duel-encounters-shooting-drop
title: Carte incontrate - 「流星の雫」 / Shooting Drop
order: 90
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [live-duel, card-encounter, galaxyshield, treated-as, summon, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Shooting Drop: Galaxyshield, rientro dallo scudo e focus su monotoshite per
  leggere come se il costo fosse già stato pagato.
---

# 「流星の雫」

:::image
src: assets/cards/live-duel/shooting-drop.jpg
alt: "Shooting Drop card."
caption: >-
  「{{流星|りゅうせい}}の{{雫|しずく}}」。 Creature Water con ギャラクシールド. Il
  punto davvero utile qui è
  `コストを{{支払|しはら}}ったものとして`: il testo non dice solo `{{召喚|しょうかん}}する`,
  ma ti chiede di leggere quella summon come se il pagamento fosse già stato
  effettuato.
:::

## Keyword presenti sulla carta

- ギャラクシールド

La keyword è già coperta nel media. Qui il valore didattico nuovo non è la
meccanica di scudo in sé, ma la formula `ものとして` applicata al pagamento del
cost.

## Effetti da leggere

:::example_sentence
jp: >-
  ギャラクシールド
  {{水|みず}}{{1|いち}}（このカードを{{使|つか}}う
  [{{コスト|こすと}}](term:term-cost)の[かわりに](grammar:grammar-kawarini)、
  {{水|みず}}{{1|いち}}を[{{支払|しはら}}って](term:term-harau)もよい。
  [そうしたら](grammar:grammar-soushitara)、このカードを
  [{{表向|おもてむ}}き](term:term-face-up)にし、
  {{新|あたら}}しいシールドとして[{{自分|じぶん}}](term:term-self)の
  [シールドゾーン](term:term-shield-zone)に[{{置|お}}く](term:term-oku)）
translation_it: >-
  Galaxyshield Water 1: invece di pagare il costo per usare questa carta, puoi
  pagare Water 1. Se lo fai, metti questa carta a faccia in su nel tuo shield
  zone come nuovo scudo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{自分|じぶん}}](term:term-self)のターンのはじめに、この
  [クリーチャー](term:term-creature)が
  [{{表向|おもてむ}}き](term:term-face-up)で[{{自分|じぶん}}](term:term-self)の
  [シールドゾーン](term:term-shield-zone)にあれば、
  [{{コスト|こすと}}](term:term-cost)を[{{支払|しはら}}った](term:term-harau)
  [ものとして](grammar:grammar-monotoshite)
  [{{召喚|しょうかん}}](term:term-summon)する。
translation_it: >-
  All'inizio del tuo turno, se questa creatura è a faccia in su nel tuo shield
  zone, la evochi come se il costo fosse stato pagato.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーが表向きで自分のシールドゾーンにあれば

- `{{表向|おもてむ}}きで` descrive lo stato richiesto della carta nello scudo:
  non basta che sia lì, deve anche essere face-up.
- `{{自分|じぶん}}のシールドゾーンにあれば` usa `あれば` come controllo di
  condizione: prima verifichi posizione e stato, poi leggi il risultato.
- Quindi la summon non parte automaticamente da qualsiasi scudo, ma solo da
  questo caso preciso.

### 2. コストを支払ったものとして

- Qui il verbo base è [{{支払|しはら}}う](term:term-harau): `pagare`.
- `{{支払|しはら}}った` lo mette al passato compiuto, quindi `avendolo pagato /
  avendo pagato`.
- [ものとして](grammar:grammar-monotoshite) aggiunge il senso `trattando come
  se fosse così`.
- Il blocco intero significa quindi `trattandola come una summon il cui costo è
  stato pagato`, non `paghi adesso il costo` né `ignori semplicemente il costo
  senza traccia grammaticale`.

### 3. Come leggere ものとして qui

- `もの` qui non vuol dire `oggetto` in senso concreto. Funziona come supporto
  nominale per uno stato o un fatto assunto come valido.
- `として` aggiunge l'idea di trattamento o cornice: `in qualità di / come`.
- Insieme, `～ものとして` diventa `considerando che...`, `trattando come se...`.
- In Duel Masters questo è utile perché il testo non dice che il costo sparisce
  dal mondo: dice che la summon va risolta nel quadro in cui quel pagamento
  conta già come avvenuto.

### 4. コストを支払ったものとして召喚する

- Il verbo finale [{{召喚|しょうかん}}](term:term-summon)する resta il cuore
  dell'azione.
- Tutto il blocco prima di `{{召喚|しょうかん}}する` ne definisce il modo:
  `come summon trattata come già pagata`.
- Questo è il motivo per cui vale la pena memorizzare il chunk intero
  `コストを{{支払|しはら}}ったものとして`, non solo `ものとして` isolato.

## Lessico utile in questa carta

- [ものとして](grammar:grammar-monotoshite) è il pattern trasferibile: lo puoi
  riusare ogni volta che il testo ti chiede di assumere una condizione come già
  valida.
- `コストを{{支払|しはら}}ったものとして` è invece il chunk tecnico specifico di
  questa carta: la summon viene letta nel quadro di un costo già considerato
  pagato.
- La differenza utile è questa: `ものとして` ti insegna la grammatica generale,
  mentre `コストを{{支払|しはら}}ったものとして` ti insegna come quella grammatica
  si specializza nel rules text di Duel Masters.
