---
id: lesson-duel-masters-dm25-live-duel-encounters-star-pippi
media_id: media-duel-masters-dm25
slug: live-duel-encounters-star-pippi
title: Carte incontrate - スター・ピッピー / Star Pippi
order: 89
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [
    live-duel,
    card-encounter,
    cost-reduction,
    multicolor,
    coordination,
    duel-masters
  ]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Star Pippi: la virgola dopo il primo 1 separa due riduzioni di costo
  parallele, una per Light e una per Fire, con limite finale che non fa
  scendere il costo a 0 o meno.
---

# スター・ピッピー

:::image
src: assets/cards/live-duel/star-pippi.jpg
alt: "Star Pippi card."
caption: >-
  スター・ピッピー。 Multicolor Light/Fire che riduce i costi di evocazione.
  La riga importante non è solo `{{少|すく}}なくしてもよい`, ma soprattutto la
  virgola dopo il primo `{{1|いち}}`: lì il testo separa due riduzioni
  parallele, non un'unica riduzione condivisa.
:::

## Effetti da leggere

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{光|ひかり}}](term:term-light)の[クリーチャー](term:term-creature)の
  [{{召喚|しょうかん}}](term:term-summon)コストを{{1|いち}}、
  {{火|ひ}}の[クリーチャー](term:term-creature)の
  [{{召喚|しょうかん}}](term:term-summon)コストを{{1|いち}}
  [{{少|すく}}なくしてもよい](grammar:grammar-star-pippi-double-cost-reduction)。
translation_it: >-
  Puoi ridurre di 1 il costo di evocazione delle tue creature Light e di 1 il
  costo di evocazione delle tue creature Fire.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [ただし](grammar:grammar-tadashi)、コストは{{0以下|ぜろいか}}にならない。
translation_it: >-
  Tuttavia, il costo non scende a 0 o meno.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 自分の光のクリーチャーの召喚コストを1、

- Qui la frase apre già un blocco completo di bersaglio: `{{自分|じぶん}}の`
  restringe alle tue creature, `{{光|ひかり}}のクリーチャー` fissa la civiltà,
  `{{召喚|しょうかん}}コスト` specifica quale valore viene toccato.
- Il `{{1|いち}}` non chiude ancora l'effetto. La virgola dopo il numero
  sospende il primo ramo e prepara il secondo.
- Quindi questa metà va letta come `quanto alle tue creature Light, il costo di
  evocazione di 1...`, aspettando il verbo finale che arriverà dopo.

### 2. 火のクリーチャーの召喚コストを1少なくしてもよい

- La seconda metà ripete la stessa struttura con una civiltà diversa:
  `{{火|ひ}}のクリーチャー` al posto di `{{光|ひかり}}のクリーチャー`.
- Il verbo finale `{{少|すく}}なくしてもよい` vale per entrambe le metà, non
  solo per la seconda. È una coordinazione con ellissi: il primo ramo lascia
  sottinteso proprio lo stesso finale.
- Per questo la virgola dopo il primo `{{1|いち}}` è decisiva: separa due
  riduzioni parallele, non una pausa interna dentro un unico oggetto.

### 3. Cosa cambia nella lettura pratica della virgola

- Se leggi male la virgola, rischi di capire `Light o Fire: riduci di 1 in
  totale`.
- Il giapponese della carta dice invece `riduci di 1 le Light, riduci di 1 le
  Fire`.
- Per questo una creatura multicolore Light/Fire riceve entrambe le riduzioni:
  la prima metà la prende come creatura Light, la seconda come creatura Fire.
- Il punto utile da memorizzare è proprio la forma intera con la virgola, non
  il solo verbo finale.

### 4. ただし、コストは0以下にならない

- [ただし](grammar:grammar-tadashi) corregge subito una lettura troppo ampia
  della riduzione.
- `{{0以下|ぜろいか}}` vuol dire `0 o meno`, quindi la carta introduce un pavimento:
  il costo può scendere, ma non può oltrepassare quel limite.
- Questo secondo periodo non annulla le due riduzioni precedenti. Ne limita
  solo il risultato finale.

## Lessico utile in questa carta

- Il vero chunk da fissare è l'intera frase
  `{{自分|じぶん}}の{{光|ひかり}}のクリーチャーの{{召喚|しょうかん}}コストを{{1|いち}}、{{火|ひ}}のクリーチャーの{{召喚|しょうかん}}コストを{{1|いち}}{{少|すく}}なくしてもよい`.
- La virgola dopo il primo `{{1|いち}}` non è una pausa stilistica: separa due
  rami coordinati che condividono lo stesso verbo finale.
- `ただし、コストは{{0以下|ぜろいか}}にならない` è il caveat che chiude la
  frase e impedisce di trasformare le riduzioni in un azzeramento completo del
  costo.
