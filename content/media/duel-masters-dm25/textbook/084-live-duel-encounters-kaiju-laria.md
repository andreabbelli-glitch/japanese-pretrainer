---
id: "lesson-duel-masters-dm25-live-duel-encounters-kaiju-laria"
media_id: "media-duel-masters-dm25"
slug: "live-duel-encounters-kaiju-laria"
title: "貝獣 ラリア: G・ゼロ e condizione già soddisfatta"
order: 113
segment_ref: "live-duel-encounters"
difficulty: n4
status: active
tags: [live-duel, card, water, mutopia, gravity-zero, condition, spells, blocker]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-overview,
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-shadan-q
  ]
summary: >-
  Leggere G Zero quando il turno ha già due spell lanciate: la condizione è
  soddisfatta e il costo non viene pagato.
---

# {{貝獣|かいじゅう}} ラリア: G・ゼロ e condizione già soddisfatta

{{貝獣|かいじゅう}} ラリア mette tutta la sua difficoltà in una riga breve:
prima controlla che cosa è già successo in questo turno, poi permette una
[{{召喚|しょうかん}}](term:term-summon) senza pagare. Il testo ufficiale usa
[G・ゼロ](term:term-g-zero) per condensare questo controllo; la schermata di
partita lo rende ancora più esplicito con
[{{条件|じょうけん}}](term:term-jouken) e
[{{満|み}}たす](term:term-mitasu).

La lettura utile è lo stato precedente all'azione. `このターン` limita il
controllo al turno in corso, `{{2枚以上|にまいいじょう}}` stabilisce la soglia
minima, e [{{支払|しはら}}わずに](grammar:grammar-zuni) spiega come avviene la
summon quando quella soglia è già vera.

## Termini chiave

- [G・ゼロ](term:term-g-zero) — keyword che apre una summon gratuita se il requisito scritto è vero
- [{{条件|じょうけん}}](term:term-jouken) — condizione, requisito da controllare
- [{{満|み}}たす](term:term-mitasu) — soddisfare un requisito o riempire una misura richiesta
- [{{呪文|じゅもん}}](term:term-spell) — spell, il tipo di carta contato dalla condizione
- [{{唱|とな}}える](term:term-tonaeru) — lanciare o recitare uno spell
- [コスト](term:term-cost) — costo della carta o valore da pagare
- [{{召喚|しょうかん}}](term:term-summon) — summon di una creatura

## Espressioni ricorrenti

- `このターン` — in questo turno, cioè entro la finestra temporale corrente
- [{{呪文|じゅもん}}](term:term-spell)を{{2枚以上|にまいいじょう}}[{{唱|とな}}えて](term:term-tonaeru)いれば — se hai già lanciato due o più spell
- [コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni) — senza pagare il costo

## Pattern grammaticali chiave

- [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) — soglie inclusive: al massimo / almeno
- [～ずに](grammar:grammar-zuni) — senza fare l'azione precedente
- [～てもよい](grammar:grammar-temoyoi) — permesso opzionale: puoi fare l'azione

## Etichette da riconoscere

- [ブロッカー](term:term-blocker) — keyword difensiva separata dalla riga di G・ゼロ

---

:::image
src: assets/cards/live-duel/kaiju-laria.jpg
alt: >-
  Carta Duel Masters Laria, creatura Water Mutopia con G-Zero e Blocker.
caption: >-
  La prima riga controlla se in `このターン` hai già
  [{{呪文|じゅもん}}](term:term-spell)を{{2枚以上|にまいいじょう}}
  [{{唱|とな}}えて](term:term-tonaeru)いる. Se la
  [{{条件|じょうけん}}](term:term-jouken) è
  [{{満|み}}たされて](term:term-mitasu)いる, ラリア può essere
  [{{召喚|しょうかん}}](term:term-summon) senza pagare il
  [コスト](term:term-cost).
:::

## 1. G・ゼロ: il turno diventa una condizione

[G・ゼロ](term:term-g-zero) apre una riga condizionale. Dopo i due punti, il
testo costruisce il requisito da sinistra a destra: `このターン` imposta la
finestra, [{{自分|じぶん}}](term:term-self)が nomina il giocatore, e
[{{呪文|じゅもん}}](term:term-spell)を{{2枚以上|にまいいじょう}}
[{{唱|とな}}えて](term:term-tonaeru)いれば dice che il conteggio delle spell deve
essere già arrivato almeno a due.

La parte `{{唱|とな}}えていれば` lavora come condizione di stato: il testo guarda
il risultato accumulato nel turno. Quando quel risultato è vero, la frase può
passare a ラリア stessa, marcata da `このクリーチャーを`.

:::example_sentence
jp: >-
  [G・ゼロ](term:term-g-zero)：このターン、
  [{{自分|じぶん}}](term:term-self)が
  [{{呪文|じゅもん}}](term:term-spell)を{{2枚以上|にまいいじょう}}
  [{{唱|とな}}えて](term:term-tonaeru)いれば、このクリーチャーを
  [コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni)
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  G-Zero: se in questo turno hai lanciato due o più spell, puoi evocare questa
  creatura senza pagarne il costo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della riga di G・ゼロ

*   [G・ゼロ](term:term-g-zero) ➔ **Keyword di ingresso**: la riga dopo i due
    punti spiega quando la summon gratuita è disponibile.
*   `このターン` ➔ **Finestra temporale**: il controllo riguarda il turno in
    corso.
*   [{{自分|じぶん}}](term:term-self)が ➔ **Soggetto**: sei tu, non
    l'avversario, ad aver lanciato le spell.
*   [{{呪文|じゅもん}}](term:term-spell)を{{2枚以上|にまいいじょう}} ➔ **Oggetto e
    soglia**: due spell è il minimo valido; anche tre o più passano.
*   [{{唱|とな}}えて](term:term-tonaeru)いれば ➔ **Condizione verificata**: la
    frase controlla che il lancio sia già avvenuto nel turno.
*   [コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni) ➔
    **Modo della summon**: il pagamento del costo viene saltato.
*   [{{召喚|しょうかん}}](term:term-summon)してもよい ➔ **Permesso**: puoi evocare
    ラリア; la decisione resta del giocatore.

#### ⚖️ Stato del turno e pagamento della carta

`このターン` e [{{呪文|じゅもん}}](term:term-spell)を
{{2枚以上|にまいいじょう}}[{{唱|とな}}えて](term:term-tonaeru)いれば descrivono il
requisito già presente nel turno. [コスト](term:term-cost)を
[{{支払|しはら}}わずに](grammar:grammar-zuni) descrive invece il modo in cui
entra ラリア. I due blocchi restano collegati con funzioni diverse: prima
controlli lo stato, poi applichi la summon gratuita.

## 2. 条件を満たす: il tooltip rende visibile il controllo

Nel riquadro di aiuto della partita, la stessa idea viene riassunta con
{{次|つぎ}}の[{{条件|じょうけん}}](term:term-jouken)を
[{{満|み}}たして](term:term-mitasu)いれば. Qui
[{{条件|じょうけん}}](term:term-jouken) è il requisito da controllare, mentre
[{{満|み}}たす](term:term-mitasu) dice che quel requisito è stato riempito,
raggiunto, soddisfatto.

Il valore di [{{満|み}}たす](term:term-mitasu) è molto concreto: la condizione
ha una misura, e quella misura viene completata. Sulla carta, la misura è
[{{呪文|じゅもん}}](term:term-spell)を{{2枚以上|にまいいじょう}}. Appena il turno
contiene almeno due spell lanciate da te, la
[{{条件|じょうけん}}](term:term-jouken) è
[{{満|み}}たされて](term:term-mitasu)いる e la riga di
[G・ゼロ](term:term-g-zero) può essere letta fino alla summon.

:::example_sentence
jp: >-
  {{次|つぎ}}の[{{条件|じょうけん}}](term:term-jouken)を
  [{{満|み}}たして](term:term-mitasu)いれば、このカードは
  [コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni)
  {{実行|じっこう}}する。
translation_it: >-
  Se soddisfi la condizione seguente, questa carta viene eseguita senza pagare
  il costo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia del tooltip

*   {{次|つぎ}}の[{{条件|じょうけん}}](term:term-jouken)を ➔ **Requisito
    puntato**: la UI prepara una condizione precisa per il blocco seguente.
*   [{{満|み}}たして](term:term-mitasu)いれば ➔ **Stato condizionale**: se quel
    requisito è già soddisfatto.
*   このカードは ➔ **Soggetto operativo**: la carta spiegata dal tooltip.
*   [コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni) ➔
    **Costo saltato**: l'esecuzione avviene senza pagamento.
*   {{実行|じっこう}}する ➔ **Azione della UI**: il gioco presenta l'attivazione
    o esecuzione della carta.

#### 🧠 Gancio cognitivo

Come aiuto mnemonico, leggi [{{満|み}}たす](term:term-mitasu) come una barra che
si riempie: finché la barra della [{{条件|じょうけん}}](term:term-jouken) non
arriva a `{{2枚以上|にまいいじょう}}`, [G・ゼロ](term:term-g-zero) resta chiuso.
Quando la barra è piena, il costo può essere saltato.

## 3. 支払わずに召喚してもよい: il costo sparisce, la scelta resta

La seconda metà del rules text contiene due decisioni di lettura separate.
[コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni) dice il
modo della summon: il pagamento non viene eseguito. Subito dopo,
[{{召喚|しょうかん}}](term:term-summon)してもよい dice che l'azione è permessa,
quindi resta una scelta del giocatore.

Questo ordine è importante perché [～ずに](grammar:grammar-zuni) si attacca al
verbo che viene saltato, {{支払|しはら}}う, mentre
[～てもよい](grammar:grammar-temoyoi) si attacca alla summon. La frase apre una
finestra in cui puoi evocare ラリア senza pagare il costo.

:::example_sentence
jp: >-
  このクリーチャーを[コスト](term:term-cost)を
  [{{支払|しはら}}わずに](grammar:grammar-zuni)
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  Puoi evocare questa creatura senza pagarne il costo.
reveal_mode: sentence
:::

#### ⚖️ Costo saltato e permesso opzionale

[{{支払|しはら}}わずに](grammar:grammar-zuni) controlla il pagamento; `してもよい`
controlla il permesso. Se la
[{{条件|じょうけん}}](term:term-jouken) è
[{{満|み}}たされて](term:term-mitasu)いる, il testo ti lascia scegliere la summon.
La gratuità riguarda il costo, mentre l'opzionalità riguarda l'azione di
[{{召喚|しょうかん}}](term:term-summon).

## 4. ブロッカー: una keyword separata dalla condizione

La seconda riga stampata è [ブロッカー](term:term-blocker). Qui il testo assegna
una keyword difensiva alla creatura, separata dalla
[{{条件|じょうけん}}](term:term-jouken) di [G・ゼロ](term:term-g-zero). La parentesi
ufficiale chiarisce il gesto: questa creatura può essere tappata per cambiare
la destinazione dell'attacco di una creatura avversaria.

:::example_sentence
jp: >-
  [ブロッカー](term:term-blocker)（このクリーチャーをタップして、
  [{{相手|あいて}}](term:term-opponent)クリーチャーの
  {{攻撃先|こうげきさき}}をこのクリーチャーに{{変更|へんこう}}してもよい）
translation_it: >-
  Blocker: puoi tappare questa creatura e cambiare verso questa creatura la
  destinazione dell'attacco di una creatura avversaria.
reveal_mode: sentence
:::

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  このターン、
  [{{自分|じぶん}}](term:term-self)が
  [{{呪文|じゅもん}}](term:term-spell)を{{2枚以上|にまいいじょう}}
  [{{唱|とな}}えて](term:term-tonaeru)いれば、ラリアの
  [G・ゼロ](term:term-g-zero)を{{使|つか}}える。
translation_it: >-
  Se in questo turno hai lanciato due o più spell, puoi usare G-Zero di Laria.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{条件|じょうけん}}](term:term-jouken)を
  [{{満|み}}たす](term:term-mitasu)と、[コスト](term:term-cost)を
  [{{支払|しはら}}わずに](grammar:grammar-zuni)
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  Quando soddisfi la condizione, puoi evocarla senza pagare il costo.
reveal_mode: sentence
:::

## Nota finale

{{貝獣|かいじゅう}} ラリア si legge bene quando separi tre livelli. Il primo è il
controllo del turno: [{{呪文|じゅもん}}](term:term-spell)を
{{2枚以上|にまいいじょう}}[{{唱|とな}}えて](term:term-tonaeru)いれば. Il secondo è la
formula della UI: [{{条件|じょうけん}}](term:term-jouken)を
[{{満|み}}たす](term:term-mitasu). Il terzo è il risultato operativo:
[コスト](term:term-cost)を[{{支払|しはら}}わずに](grammar:grammar-zuni)
[{{召喚|しょうかん}}](term:term-summon)してもよい. [ブロッカー](term:term-blocker)
resta una keyword separata: aiuta in difesa e lascia invariata la condizione di
[G・ゼロ](term:term-g-zero).
