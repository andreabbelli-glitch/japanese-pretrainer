---
id: lesson-duel-masters-dm25-live-duel-encounters-bandasuperu-zogujigusu
media_id: media-duel-masters-dm25
slug: live-duel-encounters-bandasuperu-zogujigusu
title: "ゾグジグス: contare un Element e ripetere quel numero"
order: 110
segment_ref: live-duel-encounters
difficulty: n4
status: active
tags: [live-duel, card, water, spell, madougu, sympathy, count, hand-lock]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-maou-de-szark,
    lesson-duel-masters-dm25-live-duel-encounters-seigi-no-kirameki-ooriria
  ]
summary: >-
  Leggere come ゾグジグス conta le carte incluse in un Element e applica gli
  effetti in proporzione a quel numero.
---

# 【デ・スザーク】卍【／デ・スザーク】堕呪 ゾグジグス: contare un Element e ripetere quel numero

ゾグジグス trasforma un Element in un numero. Prima scegli un tuo エレメント,
poi la frase stringe il campo alle carte che vi sono incluse:
[そのエレメントに{{含|ふく}}まれるカード](term:term-fukumareru). Da quel gruppo
nasce il conteggio con [{{数|かぞ}}える](term:term-kazoeru), e il testo usa
[その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake) due volte per distribuire
gli effetti successivi.

La seconda metà della carta cambia piano: il numero non viene più dal board,
ma dalla tua mano. `{{自分|じぶん}}の{{手札|てふだ}}の{{枚数|まいすう}}`
diventa il limite dei costi, e [Xを{{持|も}}つY](grammar:grammar-x-wo-motsu-y)
attacca quel limite al nome finale [呪文](term:term-spell): gli spell che
possiedono quella proprietà vengono bloccati per l'avversario fino al tuo
prossimo turno.

## Termini chiave

- [{{含|ふく}}まれる](term:term-fukumareru) — essere incluso o contenuto dentro un gruppo
- [{{数|かぞ}}える](term:term-kazoeru) — contare gli elementi di un gruppo
- [{{数|かず}}](term:term-kazu) — numero o conteggio già ottenuto
- [{{持|も}}つ](term:term-motsu) — avere o possedere una proprietà
- [{{唱|とな}}える](term:term-tonaeru) — lanciare una spell

## Espressioni ricorrenti

- [そのエレメントに{{含|ふく}}まれるカード](term:term-fukumareru) — le carte incluse in quell'Element
- [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake) — in quantità pari a quel numero
- [Xを{{持|も}}つY](grammar:grammar-x-wo-motsu-y) — Y che possiede la caratteristica X

## Pattern grammaticali chiave

- [～てもよい](grammar:grammar-temoyoi) — permesso opzionale: puoi applicare l'azione
- [{{枚数|まいすう}}{{以下|いか}}](grammar:grammar-ika-ijou) — limite numerico pari o inferiore al conteggio
- [Xを{{持|も}}つY](grammar:grammar-x-wo-motsu-y) — relativa attributiva: la proprietà precede il nome che la possiede

## Etichette da riconoscere

- シンパシー：ドルスザク — keyword di costo; il gruppo dopo `：` è la categoria che alimenta la riduzione
- [魔導具](term:term-madougu) — race della carta
- [呪文](term:term-spell) — tipo della carta e anche categoria bloccata nell'ultima riga

---

:::image
src: assets/cards/live-duel/bandasuperu-zogujigusu.png
alt: >-
  Carta Duel Masters Play's Zogujigusu, spell acqua Magic Tool con Sympathy:
  Dolszak, conteggio delle carte incluse in un Element e blocco sugli spell
  dell'avversario.
caption: >-
  ゾグジグス usa [{{含|ふく}}まれる](term:term-fukumareru) e
  [{{数|かぞ}}える](term:term-kazoeru) per trasformare un Element in un numero,
  poi ripete [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake) per applicare
  gli effetti in proporzione.
:::

## 1. シンパシー：ドルスザク: la label prepara il costo

La prima riga è compatta:

:::example_sentence
jp: >-
  シンパシー：ドルスザク
translation_it: >-
  Sympathy: Dolszak.
reveal_mode: sentence
:::

`シンパシー` è la keyword, `：` apre la specificazione, e `ドルスザク` è il gruppo
che la keyword guarda. In una carta come questa, la label vive prima del rules
text lungo: ti dice come il costo può cambiare, mentre le righe successive
spiegano cosa succede quando la spell viene davvero lanciata.

`【デ・スザーク】卍【／デ・スザーク】堕呪` è il nome ufficiale mostrato dal database di
Play's, con `堕呪` e [魔導具](term:term-madougu) che collocano subito la carta
nella famiglia Dolszak. Per la lettura dell'effetto, però, il punto operativo
arriva dopo: un tuo Element diventa un contenitore da contare.

## 2. 含まれるカードを数える: il board diventa un conteggio

La riga centrale costruisce prima il gruppo e solo dopo lo usa. `{{自分|じぶん}}の
エレメントを{{1|ひと}}つ{{選|えら}}び` seleziona un singolo Element sul tuo lato.
Subito dopo, `そのエレメント` riprende proprio quell'Element; la forma
[{{含|ふく}}まれる](term:term-fukumareru) descrive le carte contenute al suo
interno, e [{{数|かぞ}}える](term:term-kazoeru) trasforma quel gruppo in un
numero leggibile dal resto della frase.

:::example_sentence
jp: >-
  {{自分|じぶん}}のエレメントを{{1|ひと}}つ[{{選|えら}}び](term:term-erabu)、
  そのエレメントに[{{含|ふく}}まれる](term:term-fukumareru)カードを
  [{{数|かぞ}}える](term:term-kazoeru)。
translation_it: >-
  Scegli un tuo Element e conta le carte incluse in quell'Element.
reveal_mode: sentence
:::

#### 🗺️ Anatomia del conteggio

*   {{自分|じぶん}}のエレメントを{{1|ひと}}つ[{{選|えら}}び](term:term-erabu) ➔
    **Scelta del contenitore**: il testo non conta ancora; identifica quale
    Element userai come riferimento.
*   そのエレメントに ➔ **Ripresa del referente**: `その` punta all'Element appena
    scelto, e `に` lo marca come spazio in cui qualcosa è incluso.
*   [{{含|ふく}}まれる](term:term-fukumareru)カード ➔ **Gruppo contenuto**: il nome
    finale è カード; il verbo attributivo dice che quelle carte appartengono
    all'Element scelto.
*   カードを[{{数|かぞ}}える](term:term-kazoeru) ➔ **Conversione in numero**: `を`
    marca ciò che viene contato, e il risultato diventerà `その{{数|かず}}`.

#### 🧠 Gancio cognitivo

Come aiuto mnemonico, pensa a `そのエレメントに{{含|ふく}}まれるカード` come a un
contenitore: prima guardi dentro l'Element, poi conti le carte che contiene.
Il giapponese chiude il gruppo con カード prima di passare al verbo
[{{数|かぞ}}える](term:term-kazoeru).

## 3. その数だけ: ripetere l'effetto nella stessa quantità

Dopo il conteggio, la carta usa [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake)
come ponte. `その{{数|かず}}` riprende il totale appena ottenuto; `だけ` limita
l'azione alla misura esatta di quel totale. La prima applicazione è opzionale
perché termina in [～てもよい](grammar:grammar-temoyoi), la seconda applicazione
risolve il rimbalzo casuale delle creature avversarie.

:::example_sentence
jp: >-
  [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake)、カードを
  [{{引|ひ}}いてもよい](grammar:grammar-temoyoi)。その{{後|あと}}、
  [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake)、
  [{{相手|あいて}}](term:term-opponent)のランダムな
  [クリーチャー](term:term-creature){{1体|いったい}}を
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}す](term:term-modosu)。
translation_it: >-
  Puoi pescare carte in quantità pari a quel numero. Poi, per quel numero di
  volte, rimandi in mano 1 creatura casuale dell'avversario.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della proporzione

*   [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake) ➔ **Proporzione diretta**:
    l'effetto si applica nella misura esatta del conteggio precedente.
*   カードを[{{引|ひ}}いてもよい](grammar:grammar-temoyoi) ➔ **Payoff opzionale**:
    `てもよい` dà il permesso di pescare fino a quel numero.
*   その{{後|あと}} ➔ **Passo successivo**: la frase passa dal pescare al
    rimbalzare creature.
*   ランダムな[クリーチャー](term:term-creature){{1体|いったい}}を
    [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}す](term:term-modosu) ➔
    **Payoff ripetuto**: ogni applicazione prende una creatura casuale e la
    manda in mano.

#### ⚖️ Conteggio condiviso, azioni diverse

Il valore di [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake) resta lo stesso
per entrambe le frasi: deriva dalle carte incluse nell'Element scelto. Cambia
il verbo finale. Nel primo caso `{{引|ひ}}いてもよい` rende la pesca facoltativa;
nel secondo caso [{{戻|もど}}す](term:term-modosu) risolve il rimbalzo dopo
`その{{後|あと}}`.

## 4. 枚数以下のコストを持つ呪文: la mano diventa un limite

L'ultima riga usa un secondo conteggio, questa volta legato alla tua mano.
`{{自分|じぶん}}の{{手札|てふだ}}の{{枚数|まいすう}}` misura quante carte hai in
mano; [{{枚数|まいすう}}{{以下|いか}}](grammar:grammar-ika-ijou) trasforma quel
numero in un tetto massimo; [Xを{{持|も}}つY](grammar:grammar-x-wo-motsu-y)
fa arrivare il nome finale [呪文](term:term-spell) solo dopo la proprietà:
spell che hanno un costo pari o inferiore a quel conteggio.

:::example_sentence
jp: >-
  {{次|つぎ}}の{{自分|じぶん}}のターン{{開始|かいし}}{{時|じ}}まで、
  {{自分|じぶん}}の[{{手札|てふだ}}](term:term-hand)の
  {{枚数|まいすう}}{{以下|いか}}の[コスト](term:term-cost)を
  [{{持|も}}つ](term:term-motsu)[{{呪文|じゅもん}}](term:term-spell)を、
  [{{相手|あいて}}](term:term-opponent)は
  [{{唱|とな}}えられない](term:term-tonaeru)。
translation_it: >-
  Fino all'inizio del tuo prossimo turno, l'avversario non può lanciare spell
  che hanno un costo pari o inferiore al numero di carte nella tua mano.
reveal_mode: sentence
:::

#### 🗺️ Anatomia del blocco di costo

*   {{次|つぎ}}の{{自分|じぶん}}のターン{{開始|かいし}}{{時|じ}}まで ➔ **Durata**:
    l'effetto resta valido fino all'inizio del tuo prossimo turno.
*   {{自分|じぶん}}の[{{手札|てふだ}}](term:term-hand)の{{枚数|まいすう}} ➔
    **Fonte del numero**: il conteggio viene dalla tua mano, non dal board.
*   {{枚数|まいすう}}{{以下|いか}}の[コスト](term:term-cost)を ➔ **Limite
    nominale**: il costo filtrato deve stare entro quel numero.
*   [{{持|も}}つ](term:term-motsu)[呪文](term:term-spell) ➔ **Proprietà più nome**:
    `{{持|も}}つ` aggancia la proprietà al nome finale [呪文](term:term-spell).
*   [{{相手|あいて}}](term:term-opponent)は[{{唱|とな}}えられない](term:term-tonaeru)
    ➔ **Soggetto bloccato**: l'avversario è il soggetto della negazione
    potenziale, quindi è lui a perdere la possibilità di lanciare quelle spell.

#### ⚖️ Il nome finale arriva dopo la proprietà

In [Xを{{持|も}}つY](grammar:grammar-x-wo-motsu-y), la parte prima di
[{{持|も}}つ](term:term-motsu) prepara la caratteristica, e Y è il nome che la
possiede. Qui `{{自分|じぶん}}の{{手札|てふだ}}の{{枚数|まいすう}}{{以下|いか}}の
[コスト](term:term-cost)を{{持|も}}つ` descrive quali spell rientrano nel blocco;
solo quando arrivi a [呪文](term:term-spell) sai quale categoria viene davvero
limitata.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  そのエレメントに[{{含|ふく}}まれる](term:term-fukumareru)カードを
  [{{数|かぞ}}える](term:term-kazoeru)。
translation_it: >-
  Conta le carte incluse in quell'Element.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake)、カードを
  [{{引|ひ}}いてもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Puoi pescare carte in quantità pari a quel numero.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [コスト](term:term-cost)を[{{持|も}}つ](term:term-motsu)[{{呪文|じゅもん}}](term:term-spell)
translation_it: >-
  Spell che hanno un costo.
reveal_mode: sentence
:::

## Nota finale

ゾグジグス alterna due modi di trasformare un gruppo in regola. Prima scegli
un Element, guardi le carte che vi sono [{{含|ふく}}まれる](term:term-fukumareru)
e le [{{数|かぞ}}える](term:term-kazoeru); poi
[その{{数|かず}}だけ](grammar:grammar-sono-kazu-dake) ripete gli effetti in
proporzione. Alla fine `{{手札|てふだ}}の{{枚数|まいすう}}{{以下|いか}}の
[コスト](term:term-cost)を[{{持|も}}つ](term:term-motsu)[呪文](term:term-spell)`
usa lo stesso istinto di lettura: trova il numero, aggancialo al nome finale,
poi leggi chi può o non può agire.
