---
id: lesson-duel-masters-dm25-live-duel-encounters-duck-ahicchi
media_id: media-duel-masters-dm25
slug: live-duel-encounters-duck-ahicchi
title: "Duck Ahicchi: costi diversi e attacco bloccato"
order: 77
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, fire-bird, attack-restriction, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke,
    lesson-duel-masters-dm25-live-duel-encounters-bauwauja-abyssal-three-roar
  ]
summary: >-
  Leggere Duck Ahicchi come controllo di costi diversi: costruire il gruppo,
  contare la soglia e capire quando l'attacco resta bloccato.
---

# Duck Ahicchi: costi diversi e attacco bloccato

ダック・アヒッチ ha un effetto molto compatto: non sceglie bersagli, non sposta carte e non apre una finestra di timing. Prima controlla il tuo campo, poi decide se questa creatura può attaccare. Tutto dipende da una piccola catena nominale, `コストが{{異|こと}}なる{{自分|じぶん}}のエレメント`, che costruisce il gruppo da contare.

Il giapponese procede in tre mosse: [コスト](term:term-cost) indica il valore da confrontare, [{{異|こと}}なる](term:term-kotonaru) dice che quei valori non coincidono, e [～なければ ... ない](grammar:grammar-nakereba) trasforma la soglia mancata in un divieto. Se leggi solo {{3|みっ}}つ{{以上|いじょう}}, perdi il punto: non servono tre elementi qualunque, servono almeno tre elementi validi dopo il filtro dei costi diversi.


## Termini chiave

- [コスト](term:term-cost) — costo come valore numerico da confrontare
- [{{異|こと}}なる](term:term-kotonaru) — essere diverso / non coincidere
- [{{自分|じぶん}}](term:term-self) — il tuo lato della partita, visto dal testo della carta
- [{{攻撃|こうげき}}](term:term-attack) — attacco, qui azione negata dalla restrizione

## Espressioni ricorrenti

- [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru)[{{自分|じぶん}}](term:term-self)のエレメント — tuoi element con costi diversi
- {{3|みっ}}つ{{以上|いじょう}}なければ — se non ce ne sono almeno tre
- このクリーチャーは[{{攻撃|こうげき}}](term:term-attack)できない — questa creatura non può attaccare

## Pattern grammaticali chiave

- [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) — limite numerico incluso; {{3|みっ}}つ{{以上|いじょう}} passa già con tre
- [～なければ ... ない](grammar:grammar-nakereba) — se il requisito non è soddisfatto, il risultato viene negato

## Etichette da riconoscere

- ダック・アヒッチ — la creatura che riceve il divieto d'attacco se il controllo fallisce
- ファイアー・バード — razza stampata sulla carta; qui non cambia il requisito grammaticale della riga effetto
- エレメント — categoria ampia del board che viene filtrata dai costi diversi

---

:::image
src: assets/cards/live-duel/duck-ahicchi.jpg
alt: "Duck Ahicchi card."
caption: >-
  ダック・アヒッチ。 Razza: ファイアー・バード. La riga centrale mette in sequenza
  [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru)
  [{{自分|じぶん}}](term:term-self)のエレメント, la soglia
  {{3|みっ}}つ{{以上|いじょう}} e il divieto
  このクリーチャーは[{{攻撃|こうげき}}](term:term-attack)できない.
:::

## 1. Il filtro nominale: costi che non coincidono

La prima metà della riga non parla ancora dell'attacco. Costruisce il gruppo da controllare: elementi tuoi, ma soltanto quando i loro costi non coincidono. Il nome finale è `エレメント`; tutto ciò che lo precede restringe quali element entrano davvero nel conteggio.

- [コスト](term:term-cost)が `コストが` vive dentro la clausola che modifica `エレメント`.
- [{{異|こと}}なる](term:term-kotonaru) non equivale a "strano", "particolare" o "speciale". In questa riga è un verbo di confronto: due o più valori vengono messi uno accanto all'altro e non risultano uguali.
- [{{自分|じぶん}}](term:term-self)の restringe il gruppo al tuo lato della partita. Non sta parlando dell'identità psicologica della creatura; nel rules text di Duel Masters è il possessivo tecnico che seleziona carte, zone o oggetti controllati da te.

:::example_sentence
jp: >-
  [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru)
  [{{自分|じぶん}}](term:term-self)のエレメント
translation_it: >-
  Tuoi element con costi diversi.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [コスト](term:term-cost)が — **soggetto interno del confronto**: が marca il valore che deve risultare diverso, non il soggetto del divieto finale.
*   [{{異|こと}}なる](term:term-kotonaru) — **verbo attributivo**: resta prima del nome e lo filtra, come "che hanno costi diversi".
*   [{{自分|じぶん}}](term:term-self)のエレメント — **nome finale posseduto**: il gruppo contato è formato dai tuoi element, non da quelli dell'avversario.

#### ⚖️ Contrasto operativo: `{{異|こと}}なる` non è `{{大|おお}}きい`

Quando una carta confronta una soglia alta o bassa, spesso usa forme come コストが{{大|おお}}きい o コスト{{5以上|ごいじょう}}. Qui invece [{{異|こと}}なる](term:term-kotonaru) non chiede costi più alti: chiede costi non uguali fra loro. Due element di costo 2 non aggiungono due valori diversi; restano dentro la stessa colonna di costo.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, immagina [{{異|こと}}なる](term:term-kotonaru) come un separatore di colonne: costo 1, costo 2, costo 3. La carta non sta pesando quanto è grande ogni colonna, sta controllando se hai abbastanza colonne distinte.

## 2. La soglia: da gruppo filtrato a requisito minimo

Dopo aver costruito il gruppo, la frase passa al conteggio. {{3|みっ}}つ{{以上|いじょう}} non significa "più di tre": [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) include il numero nominato, quindi tre elementi validi bastano già. La negazione arriva subito dopo, con なければ, e cambia il tono: non stai leggendo un bonus quando arrivi a tre, ma una restrizione se non ci arrivi.

:::example_sentence
jp: >-
  [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru)
  [{{自分|じぶん}}](term:term-self)のエレメントが
  {{3|みっ}}つ{{以上|いじょう}}なければ、このクリーチャーは
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Se non hai almeno 3 tuoi element con costi diversi, questa creatura non può
  attaccare.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru) — **filtro di qualità**: i costi devono non coincidere; la frase non conta ancora.
*   [{{自分|じぶん}}](term:term-self)のエレメントが — **soggetto contato**: が dopo エレメント porta il gruppo filtrato dentro il controllo di esistenza.
*   `{{3|みっ}}つ{{以上|いじょう}}なければ` — **soglia negativa**: se il gruppo non arriva almeno a tre, la condizione fallisce.
*   このクリーチャーは[{{攻撃|こうげき}}](term:term-attack)できない — **risultato negato**: il topic è questa creatura, e l'azione bloccata è soltanto attaccare.

#### ⚖️ Contrasto operativo: tre element non basta se i costi si ripetono

La lettura rapida "ho tre element, quindi posso attaccare" è troppo larga. Il filtro [{{異|こと}}なる](term:term-kotonaru) viene prima della soglia: tre element con costi 2, 2 e 4 non mostrano tre costi diversi. Per soddisfare la frase, devi poter riconoscere almeno tre element validi che rappresentano tre costi distinti.

## 3. Il divieto finale: `なければ` chiude l'attacco, non il board

La parte finale usa [～なければ ... ない](grammar:grammar-nakereba), una forma molto leggibile nei rules text perché mette requisito e conseguenza nella stessa frase. Il requisito è "avere almeno tre element con costi diversi"; la conseguenza, se il requisito manca, è このクリーチャーは{{攻撃|こうげき}}できない.

### A. `なければ`: il requisito non c'è

La condizione richiede uno stato visibile sul campo: costi abbastanza vari tra i tuoi element.

### B. `できない`: l'azione impossibile

[{{攻撃|こうげき}}](term:term-attack)できない non distrugge Duck Ahicchi, non lo tappa e non gli toglie il tipo creatura. Dice solo che non può essere dichiarato come attaccante mentre la condizione resta falsa. Il topic このクリーチャーは tiene il divieto su questa creatura: non sta bloccando automaticamente tutti i tuoi altri attacchi.

:::example_sentence
jp: >-
  このクリーチャーは[{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Questa creatura non può attaccare.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーは` — **topic locale**: il divieto riguarda Duck Ahicchi, cioè la creatura indicata da "questa".
*   [{{攻撃|こうげき}}](term:term-attack)できない — **potenziale negato**: できない chiude la possibilità di compiere l'azione, non descrive una rimozione dal campo.

#### ⚖️ Contrasto operativo: requisito del campo, non costo di attacco

La carta non ti chiede di pagare tre costi e non consuma gli element che soddisfano la soglia. Il testo guarda una condizione statica del board: se il gruppo esiste, Duck Ahicchi può attaccare; se non esiste, la frase negativa resta attiva.

## Esempi guidati di riepilogo

Le stesse parti diventano più facili da leggere quando le ricombini separando filtro, soglia e divieto:

:::example_sentence
jp: >-
  [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru)
  [{{自分|じぶん}}](term:term-self)のエレメントが
  {{3|みっ}}つ{{以上|いじょう}}ある。
translation_it: >-
  Hai almeno 3 tuoi element con costi diversi.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru)エレメントが
  {{2|ふた}}つしかない。
translation_it: >-
  Ci sono solo 2 element con costi diversi.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{3|みっ}}つ{{以上|いじょう}}なければ、このクリーチャーは
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Se non ce ne sono almeno 3, questa creatura non può attaccare.
reveal_mode: sentence
:::

---

## Nota finale

ダック・アヒッチ si legge bene quando non salti direttamente al できない. Prima il testo costruisce il gruppo con [コスト](term:term-cost)が[{{異|こと}}なる](term:term-kotonaru), poi lo conta con {{3|みっ}}つ{{以上|いじょう}}, e solo alla fine applica [～なければ ... ない](grammar:grammar-nakereba). Se quel gruppo di costi diversi esiste, l'attacco è aperto; se non esiste, il divieto resta su questa creatura.
