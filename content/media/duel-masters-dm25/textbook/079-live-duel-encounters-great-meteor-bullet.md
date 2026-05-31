---
id: lesson-duel-masters-dm25-live-duel-encounters-great-meteor-bullet
media_id: media-duel-masters-dm25
slug: live-duel-encounters-great-meteor-bullet
title: "グレート・流星弾: il costo scartato come tetto"
order: 107
segment_ref: live-duel-encounters
difficulty: n4
status: active
tags: [live-duel, card, spell, discard, total-cost, removal]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-aoki-danchou-dogiragon-buster,
    lesson-duel-masters-dm25-live-duel-encounters-infelstarge
  ]
summary: >-
  Leggere una rimozione che sceglie fino a due element rispettando il costo
  della carta scartata.
---

# グレート・{{流星弾|りゅうせいだん}}: il costo scartato come tetto

グレート・{{流星弾|りゅうせいだん}} concentra la parte più densa in una sola frase:
prima fissa un tetto di costo, poi ti dice quanti bersagli puoi scegliere e che
cosa succede a quei bersagli. La frase si appoggia al periodo subito prima,
`{{自分|じぶん}}の[{{手札|てふだ}}](term:term-hand)を{{1枚|いちまい}}
[{{捨|す}}て](term:term-suteru)`, perché `その` deve riprendere una carta
specifica: quella appena scartata dalla mano.

Il cuore della lettura è tenere insieme due limiti diversi. `コストの
[{{合計|ごうけい}}](term:term-goukei)` controlla la somma dei costi degli
element scelti; `[{{2|ふた}}つまで](grammar:grammar-made)` controlla quanti
element puoi prendere. Entrambi devono restare veri mentre risolvi
`[{{選|えら}}び](term:term-erabu)、[{{破壊|はかい}}する](term:term-destroy)`.

## Termini chiave

- [コスト](term:term-cost)の[{{合計|ごうけい}}](term:term-goukei) — totale dei costi dentro il gruppo scelto
- その[{{捨|す}}てた](term:term-suteru)[{{手札|てふだ}}](term:term-hand) — quella carta dalla mano che hai appena scartato
- [コスト](term:term-cost)[{{以下|いか}}](grammar:grammar-ika-ijou) — costo pari o inferiore al valore di riferimento
- [{{相手|あいて}}](term:term-opponent)のエレメント — element sul lato dell'avversario
- [{{破壊|はかい}}する](term:term-destroy) — distruggere come risultato finale della scelta

## Pattern grammaticali chiave

- [{{以下|いか}}になるよう](grammar:grammar-youni) — in modo da restare entro il limite indicato
- [{{2|ふた}}つまで](grammar:grammar-made) — fino a due, con due come massimo
- [{{選|えら}}び](term:term-erabu)、[{{破壊|はかい}}する](term:term-destroy) — scegli, poi applica la distruzione agli oggetti scelti

---

:::image
src: assets/cards/live-duel/great-meteor-bullet.jpg
alt: >-
  Carta Duel Masters Great Meteor Bullet, spell Fire che scarta una carta,
  pesca e distrugge fino a due element avversari entro il costo della carta
  scartata.
caption: >-
  La frase decisiva usa `その[{{捨|す}}てた](term:term-suteru)
  [{{手札|てふだ}}](term:term-hand)` come riferimento: il costo della carta
  scartata diventa il tetto per il [{{合計|ごうけい}}](term:term-goukei) dei
  bersagli.
:::

## 1. コストの合計が: il gruppo scelto viene letto come somma

`[コスト](term:term-cost)の[{{合計|ごうけい}}](term:term-goukei)が` apre la
frase mettendo in primo piano il totale. `の` collega `コスト` a `合計`: stai
leggendo la somma dei costi del gruppo scelto. Il valore di una carta singola
basta solo quando il gruppo contiene un unico element. `が` marca quel totale
come valore che deve rientrare nel controllo successivo.

Questo totale nasce dagli element che sceglierai dopo la virgola. Se scegli un
solo element, il `合計` coincide con il suo costo. Se scegli due element, i due
costi vengono sommati e la somma deve restare entro il tetto. La frase quindi
ti fa preparare il criterio prima di mostrarti il verbo `選び`.

:::example_sentence
jp: >-
  [コスト](term:term-cost)の[{{合計|ごうけい}}](term:term-goukei)がその
  [{{捨|す}}てた](term:term-suteru)[{{手札|てふだ}}](term:term-hand)の
  [コスト](term:term-cost)[{{以下|いか}}](grammar:grammar-ika-ijou)になる
  [よう](grammar:grammar-youni)、
  [{{相手|あいて}}](term:term-opponent)のエレメントを
  [{{2|ふた}}つまで](grammar:grammar-made)[{{選|えら}}び](term:term-erabu)、
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Scegli fino a due element dell'avversario in modo che il loro costo totale
  sia pari o inferiore al costo della carta scartata dalla mano, poi
  distruggili.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [コスト](term:term-cost)の[{{合計|ごうけい}}](term:term-goukei)が ➔
    **Valore controllato**: il soggetto grammaticale è la somma dei costi del
    gruppo scelto.
*   その[{{捨|す}}てた](term:term-suteru)[{{手札|てふだ}}](term:term-hand)の
    [コスト](term:term-cost) ➔ **Tetto di riferimento**: `その` punta alla carta
    appena scartata, e `のコスト` prende il suo valore numerico.
*   [{{以下|いか}}](grammar:grammar-ika-ijou)になる
    [よう](grammar:grammar-youni) ➔ **Criterio di scelta**: il totale deve
    finire nello stato "pari o sotto quel costo".
*   [{{相手|あいて}}](term:term-opponent)のエレメントを ➔ **Gruppo bersaglio**:
    gli oggetti validi stanno sul lato dell'avversario.
*   [{{2|ふた}}つまで](grammar:grammar-made)[{{選|えら}}び](term:term-erabu)、
    [{{破壊|はかい}}する](term:term-destroy) ➔ **Azione risolta**: scegli al
    massimo due element e distruggi quelli scelti.

## 2. その捨てた手札: その porta indietro alla carta scartata

`その[{{捨|す}}てた](term:term-suteru)[{{手札|てふだ}}](term:term-hand)` è il
pezzo che rende la frase ancorata al passaggio precedente. `その` segnala "quel
preciso elemento già introdotto"; `[{{捨|す}}てた](term:term-suteru)` è una
relativa al passato che modifica `手札`; `手札` qui indica la carta che era
nella tua mano prima di essere scartata.

La carta fisicamente è già andata via dalla mano, ma il testo continua a
chiamarla `手札` perché la identifica dalla sua zona di partenza. Il valore che
serve adesso è `[コスト](term:term-cost)`: se la carta scartata costava 6, il
totale degli element scelti deve stare a 6 o meno; se costava 3, il tetto
diventa 3.

#### 🧠 Gancio cognitivo

Come trucco di riconoscimento, tratta `その` come un dito puntato sullo scarto
appena fatto. Prima la carta lascia la mano; subito dopo `その捨てた手札のコスト`
riapre proprio quella carta e ne legge il numero di costo.

## 3. 以下になるよう: il criterio prima della scelta

`[{{以下|いか}}](grammar:grammar-ika-ijou)` crea un limite superiore: il valore
può essere uguale al costo della carta scartata oppure più basso. `になる`
descrive il risultato del calcolo: il `合計` deve arrivare a quello stato di
"entro il limite". `[よう](grammar:grammar-youni)` trasforma tutto il blocco in
un criterio operativo per la scelta che segue.

Qui `よう` appare senza `に` prima della virgola, una forma compatta molto
naturale nel rules text scritto. Il valore resta quello di
[～ように](grammar:grammar-youni): costruisci la scelta in modo che il risultato
rispetti la condizione.

#### ⚖️ Due limiti nello stesso effetto

Il limite di costo e il limite di quantità lavorano insieme. `[{{2|ふた}}つまで](grammar:grammar-made)`
ti dà il massimo di oggetti: uno o due element, secondo la situazione. `コスト
[{{以下|いか}}](grammar:grammar-ika-ijou)` controlla invece il totale numerico:
due element piccoli possono passare insieme, mentre un solo element troppo
costoso resta fuori dal criterio.

## 4. 相手のエレメントを{{2|ふた}}つまで選び、破壊する: bersaglio e payoff

`[{{相手|あいて}}](term:term-opponent)のエレメントを` mette `を` sul gruppo che
riceve l'azione: sono gli element dell'avversario. Subito prima del verbo,
`[{{2|ふた}}つまで](grammar:grammar-made)` fissa il massimo. `まで` dopo un numero
funziona come tetto: puoi fermarti sotto il massimo quando il campo o il limite
di costo lo richiedono.

`[{{選|えら}}び](term:term-erabu)、[{{破壊|はかい}}する](term:term-destroy)` usa la
forma continuativa di `選ぶ`. Prima selezioni gli element validi; poi
`破壊する` applica il risultato agli stessi oggetti. La virgola tiene insieme i
due passaggi come una sola risoluzione: scelta controllata dal costo, quindi
distruzione.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  [{{捨|す}}てた](term:term-suteru)[{{手札|てふだ}}](term:term-hand)の
  [コスト](term:term-cost)が{{6|ろく}}なら、[コスト](term:term-cost)の
  [{{合計|ごうけい}}](term:term-goukei)が{{6以下|ろくいか}}になる
  [よう](grammar:grammar-youni)に[{{選|えら}}ぶ](term:term-erabu)。
translation_it: >-
  Se il costo della carta scartata dalla mano è 6, scegli in modo che il costo
  totale sia 6 o meno.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{2|ふた}}つまで](grammar:grammar-made)なので、[コスト](term:term-cost){{3|さん}}の
  エレメントを{{2|ふた}}つ[{{選|えら}}ぶ](term:term-erabu)と、
  [{{合計|ごうけい}}](term:term-goukei)は{{6|ろく}}になる。
translation_it: >-
  Poiché il limite è fino a due, se scegli due element di costo 3 il totale
  diventa 6.
reveal_mode: sentence
:::

## Nota finale

La frase diventa leggibile quando separi budget, quantità e azione. `その
[{{捨|す}}てた](term:term-suteru)[{{手札|てふだ}}](term:term-hand)の
[コスト](term:term-cost)` dà il budget; `[{{合計|ごうけい}}](term:term-goukei)` lo
applica al gruppo scelto; `[{{2|ふた}}つまで](grammar:grammar-made)` limita il
numero di element; `[{{破壊|はかい}}する](term:term-destroy)` chiude la sequenza
sugli oggetti che hanno superato entrambi i controlli.
