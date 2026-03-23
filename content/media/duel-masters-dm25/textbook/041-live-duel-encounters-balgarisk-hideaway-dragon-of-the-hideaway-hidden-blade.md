---
id: lesson-duel-masters-dm25-live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
media_id: media-duel-masters-dm25
slug: live-duel-encounters-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade
title: Carte incontrate - Balgarisk, Hideaway Dragon of the Hideaway Hidden Blade
order: 69
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, shinobi, ninja-strike, dragon-element, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-dm25-sd2-overview
  ]
summary: >-
  Balgarisk: Ninja Strike 8 con condizioni in serie, controllo del costo in
  base al mana e ramo finale tra mettere in campo o mettere in mana tapped.
---

# [{{裏斬隠裏蒼頭|うらぎりがくれうらそうとう}}バルガリスク](term:term-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade)

:::image
src: assets/cards/live-duel/balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade.jpg
alt: "Balgarisk, Hideaway Dragon of the Hideaway Hidden Blade card."
caption: >-
  [{{裏斬隠裏蒼頭|うらぎりがくれうらそうとう}}バルガリスク](term:term-balgarisk-hideaway-dragon-of-the-hideaway-hidden-blade)。
  Razze: アーマード・ドラゴン / シノビ. Riga centrale:
  [ニンジャ・ストライク](term:term-ninja-strike) {{8|はち}} con doppia
  condizione in serie e topdeck che controlla se il costo della carta rivelata
  rientra nel totale del mana.
:::

## Keyword presenti sulla carta

- [ニンジャ・ストライク](term:term-ninja-strike)
- [W・ブレイカー](term:term-w-breaker)

`W・ブレイカー` è già nella keyword bank. Qui conviene dividere la carta in due
blocchi: prima la finestra di [ニンジャ・ストライク](term:term-ninja-strike),
che accumula soglia di mana e controllo
[{{使|つか}}っていなければ](grammar:grammar-te-inakereba); poi l'effetto di
entrata, che filtra un Dragon Element con costo
[{{枚数|まいすう}}{{以下|いか}}](grammar:grammar-ika-ijou) tramite
[{{持|も}}つ](term:term-motsu) e, se il test fallisce, apre
[そうでなければ](grammar:grammar-soudenakereba).

## Effetti da leggere

:::example_sentence
jp: >-
  [ニンジャ・ストライク](term:term-ninja-strike) {{8|はち}}（
  [{{相手|あいて}}](term:term-opponent)の[クリーチャー](term:term-creature)が
  [{{攻撃|こうげき}}](term:term-attack)またはブロックした
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [マナゾーン](term:term-mana-zone)にカードが{{8枚以上|はちまいいじょう}}あり、
  その{{攻撃中|こうげきちゅう}}に「[ニンジャ・ストライク](term:term-ninja-strike)」
  [{{能力|のうりょく}}](term:term-ability)を{{使|つか}}っていなければ、このシノビを
  コストを[{{支払|しはら}}わずに](term:term-harau)
  [{{召喚|しょうかん}}](term:term-summon)してもよい。そのターンの
  {{終|お}}わりに、このシノビを[{{山札|やまふだ}}](term:term-deck)の{{下|した}}に
  [{{置|お}}く](term:term-oku)）
translation_it: >-
  Ninja Strike 8: quando una creatura avversaria attacca o blocca, se hai 8 o
  più carte nel mana e durante quell'attacco non hai ancora usato una abilità
  Ninja Strike, puoi evocare questo Shinobi senza pagarne il costo. Alla fine
  di quel turno, metti questo Shinobi in fondo al mazzo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  このクリーチャーが[{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を
  [{{表向|おもてむ}}き](term:term-face-up)にしてもよい。それが、
  {{自分|じぶん}}の[マナゾーン](term:term-mana-zone)にあるカードの
  {{枚数|まいすう}}{{以下|いか}}の[コスト](term:term-cost)を
  [{{持|も}}つ](term:term-motsu)ドラゴン・エレメントなら、
  [{{出|だ}}す](term:term-dasu)。
  [そうでなければ](grammar:grammar-soudenakereba)、
  [タップ](term:term-tap)して[マナゾーン](term:term-mana-zone)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando questa creatura entra, puoi rivelare la prima carta del tuo mazzo. Se
  quella carta è un Dragon Element che ha un costo pari o inferiore al numero
  di carte nel tuo mana, la metti in gioco. Altrimenti, la metti tappata nel
  mana zone.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 8枚以上あり

- `あり` qui è la forma di collegamento di `ある`, non un nuovo effetto.
- In pratica la carta non dice `ci sono 8 carte. Fine.`: dice `con 8 o più
  carte nel mana, e inoltre...`.
- Per questo `8枚以上あり、その攻撃中に...` va letto come una condizione ancora
  aperta. Il testo sta ancora accumulando requisiti prima di arrivare al
  `召喚してもよい`.

### 2. その攻撃中に「ニンジャ・ストライク」能力を使っていなければ

- Il pezzo decisivo qui è
  [{{使|つか}}っていなければ](grammar:grammar-te-inakereba). Non descrive
  un'azione in corso, ma controlla uno stato già/non ancora realizzato.
- `その攻撃中に` chiude lo scope dentro quello stesso attacco. La carta non sta
  parlando del turno in generale, ma di quella singola finestra appena aperta.
- `～ている` legge la situazione come `essere già nel caso in cui l'hai usata`;
  `～なければ` la ribalta in negativo. Il risultato è: `se non sei già nel caso
  in cui l'hai usata`.
- Quindi la lettura naturale è: in questo attacco hai ancora disponibile la
  tua finestra di Ninja Strike solo se non l'hai già consumata prima.

### 3. 枚数以下のコストを持つドラゴン・エレメントなら

- [{{枚数|まいすう}}{{以下|いか}}](grammar:grammar-ika-ijou) fissa prima il
  tetto massimo: il costo della carta rivelata deve stare dentro il numero di
  carte nel tuo mana.
- Poi [{{持|も}}つ](term:term-motsu) si attacca al nome finale. In
  `コストを{{持|も}}つドラゴン・エレメント`, il giapponese va letto da destra:
  `un Dragon Element che ha quel costo`.
- Non c'è alcuna idea di `tenere in mano` il costo. `持つ` qui serve solo a
  trasformare il filtro numerico in una proprietà del nome che segue.
- Una volta passato quel filtro, `なら` apre il ramo positivo: la carta
  rivelata [{{出|だ}}す](term:term-dasu) invece di andare nel mana.

### 4. そうでなければ

- [そうでなければ](grammar:grammar-soudenakereba) non apre un tema nuovo:
  riassume in blocco la verifica appena fatta e ne prende il ramo negativo.
- Qui `そう` = `che la carta rivelata sia un Dragon Element con costo
  abbastanza basso`.
- Se quella proposizione non è vera, il testo entra nel fallback:
  [タップ](term:term-tap)して[マナゾーン](term:term-mana-zone)に
  [{{置|お}}く](term:term-oku)。
- Quindi `そうでなければ` si può tradurre con `altrimenti`, ma il punto utile è
  capire a quale controllo precedente si aggancia.

### 5. そのターンの終わりに、このシノビを山札の下に置く

- Dopo l'evocazione gratuita la carta aggiunge una pulizia differita:
  [そのターンの{{終|お}}わりに](grammar:grammar-turn-timing) chiude la finestra
  non subito, ma alla fine di quel turno.
- Questo pezzo appartiene ancora alla clausola di Ninja Strike: non descrive
  l'effetto di entrata, ma ti dice che la presenza di questo Shinobi è
  temporanea.
- `このシノビを[{{山札|やまふだ}}](term:term-deck)の{{下|した}}に
  [{{置|お}}く](term:term-oku)` specifica la destinazione finale con precisione:
  non mano, non cimitero, ma fondo del mazzo.

## Lessico utile in questa carta

- [ニンジャ・ストライク](term:term-ninja-strike) qui non è solo il nome della
  keyword: è anche il posto in cui vedi molto bene una catena di condizioni in
  serie.
- [{{使|つか}}っていなければ](grammar:grammar-te-inakereba) è un chunk utile da
  riconoscere in blocco: controlla se uno stato non si è ancora verificato
  dentro la finestra appena nominata.
- [{{持|も}}つ](term:term-motsu) è giapponese molto generale e molto riusabile.
  Vale la pena fissarlo bene perché nei rules text compare spesso come verbo
  che modifica un nome.
- [そうでなければ](grammar:grammar-soudenakereba) è un ottimo chunk da
  riconoscere in blocco: quando appare, sai già che stai entrando nel ramo
  alternativo della frase.
- [そのターンの{{終|お}}わりに](grammar:grammar-turn-timing) è un marcatore di
  timing molto pulito: ti dice subito che il testo sta fissando un effetto
  differito.
