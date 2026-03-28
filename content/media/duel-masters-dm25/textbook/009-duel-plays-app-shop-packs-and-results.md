---
id: lesson-duel-masters-dm25-duel-plays-app-shop-packs-and-results
media_id: media-duel-masters-dm25
slug: duel-plays-app-shop-packs-and-results
title: デュエプレ App 5 - Shop, pack opening e verifica del risultato
order: 19
segment_ref: duel-plays-app
difficulty: n4
status: active
tags: [app, ui, shop, packs, results, duel-plays]
prerequisites: [lesson-duel-masters-dm25-duel-plays-app-rewards-and-claim-flow]
summary: >-
  Approfondimento sulle schermate shop e pack opening: scelta del flusso giusto,
  consumo di ticket, popup di conferma e differenza tra reveal spettacolare e
  lista finale delle carte ottenute.
---

# Obiettivo

Questo contenuto descrive il flusso che va dall'ingresso nello shop
fino al risultato finale dell'apertura pack.

Alla fine dovresti riuscire a:

- capire quale tipo di acquisizione stai aprendo nello shop;
- leggere bene risorse, quantità e conferma prima di consumare ticket;
- distinguere schermata "spettacolo" e schermata "inventario".

## Contesto

Lo shop di `デュエプレ` è pieno di schermate con grafica forte, ma la lettura
utile è quasi sempre più semplice:

- che cosa stai comprando;
- con quale risorsa;
- quante unità stai consumando;
- dove controlli il risultato in modo leggibile.

Per questo le schermate shop sono perfette per allenare il giapponese UI:
molti label sembrano decorativi, ma in realtà sono istruzioni molto precise.

## Termini chiave

- [カード{{購入|こうにゅう}}](term:term-card-purchase)
- [{{購入|こうにゅう}}](term:term-purchase)
- [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase)
- [カード{{交換|こうかん}}](term:term-card-exchange)
- [{{交換|こうかん}}](term:term-exchange)
- [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
- [{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt)
- [{{所持|しょじ}}チケット](term:term-owned-ticket)
- [{{購入個数|こう.にゅう.こ.すう}}](term:term-purchase-quantity)
- [{{使用|しよう}}](term:term-use)
- [{{獲得|かくとく}}](term:term-kakutoku)
- [{{提供割合|てい.きょう.わり.あい}}](term:term-offer-rate)
- [{{確認|かくにん}}](term:term-confirm)
- [チケット](term:term-ticket)
- [{{所持|しょじ}}](term:term-owned)

## Pattern grammaticali chiave

- [～{{一覧|いちらん}}](grammar:grammar-ichiran)
- [～{{可能|かのう}}](grammar:grammar-kanou)

## Spiegazione

### 1. La schermata shop classifica subito il tipo di acquisizione

:::image
src: assets/ui/shop-menu-panels.png
alt: >-
  Home shop con quattro grandi pannelli per acquisto carte, acquisto pack,
  acquisto deck costruiti e card exchange.
caption: >-
  `ショップ` separa già a colpo d'occhio acquisto carte, pack, deck prebuilt e
  exchange: capire il pannello giusto evita di entrare nel flusso sbagliato.
:::

In questa schermata lo shop separa i tipi di acquisizione: non si tratta di un
unico verbo "ottenere", ma di flussi diversi.

I quattro pannelli principali ti portano verso flussi diversi:

- [カード{{購入|こうにゅう}}](term:term-card-purchase) = entri nel lato acquisto
  generale;
- [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase) = entri
  direttamente nella schermata dei pack;
- [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
  = stai guardando deck prebuilt venduti come prodotto;
- [カード{{交換|こうかん}}](term:term-card-exchange) = apri lo scambio con
  risorse dedicate.

La classificazione iniziale indica subito quale percorso prendere. Se capisci il
nome del pannello, capisci anche quale tipo di decisione ti aspetta.

I due ingressi principali nello shop sono:

- [カード{{購入|こうにゅう}}](term:term-card-purchase) = percorso acquisto generale;
- [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase) = percorso
  specifico per l'apertura pack.

### 2. La schermata principale dei pack va letta come un menu di risorse

:::image
src: assets/ui/card-pack-purchase-main.png
alt: >-
  Schermata acquisto pack con banner del pack, costi in gemme e oro, righe
  ticket e pulsanti lista carte e percentuali.
caption: >-
  [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase) va letto come
  menu di risorse e controlli: bottoni di acquisto, stock ticket,
  `カード{{一覧|いちらん}}` e
  [{{提供割合|てい.きょう.わり.あい}}](term:term-offer-rate).
:::

Quando entri in [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase),
non devi lasciarti trascinare solo dal banner del set. La schermata va letta
come tabella di accesso:

- quali valute esistono;
- quale pacchetto o bundle è in evidenza;
- quanti [{{所持|しょじ}}チケット](term:term-owned-ticket) hai;
- dove puoi aprire `カード{{一覧|いちらん}}` o `{{提供割合|てい.きょう.わり.あい}}`.

In altre parole, il layout ti dice se stai usando gemme, oro o ticket e ti evita
errori di acquisto.

Qui è utile separare anche i bottoni per funzione:

- `ジェムで{{購入|こうにゅう}}`, `ゴールドで{{購入|こうにゅう}}`,
  `チケットで{{購入|こうにゅう}}` consumano una risorsa;
- `カード{{一覧|いちらん}}` e
  [{{提供割合|てい.きょう.わり.あい}}](term:term-offer-rate) ti fanno
  controllare contenuto e rates prima di spendere.

### 3. Il popup quantità mette al centro stock e numero di pack

:::image
src: assets/ui/card-pack-purchase-count.png
alt: >-
  Popup acquisto pack con contatore della quantità, indicazione ticket
  posseduti e pulsanti meno, più e MAX.
caption: >-
  Nel popup quantità il punto non è il banner del pack, ma il rapporto tra
  [{{所持|しょじ}}チケット](term:term-owned-ticket), contatore e `MAX`.
:::

Nel popup quantità, il testo davvero utile non è il logo del pack. È questo:

- [{{所持|しょじ}}チケット](term:term-owned-ticket) = quanti ingressi
  spendibili hai davvero in quel momento;
- [{{購入個数|こう.にゅう.こ.すう}}](term:term-purchase-quantity) = quante unità
  stai per comprare;
- `MAX` = scorciatoia che porta il numero al limite consentito dalla risorsa
  attuale.

Qui la UI non ti chiede un'opinione sul pack. Ti chiede di impostare con
precisione una quantità.

La frase in alto ti aiuta a non perdere il focus: stai usando ticket per
comprare pack, non solo guardando un logo o un'illustrazione.

### 4. Il popup conferma imposta quantità, risorsa e acquisto in una riga

:::image
src: assets/ui/card-pack-purchase-confirm.png
alt: >-
  Popup di conferma pack che chiede se usare 4 ticket per comprare quattro
  pack PLAY'S CHRONICLE PACK II.
caption: >-
  Il popup di conferma esplicita quantità e prodotto nella frase centrale,
  mentre la riga in basso ti fa controllare la risorsa consumata.
:::

Il popup di conferma riassume i dati chiave dell'operazione in una riga:

- quante unità stai spendendo;
- quale risorsa stai usando;
- che cosa stai per comprare.

Qui [{{使用|しよう}}](term:term-use) è il verbo decisivo. Non stai più solo
guardando uno stock: stai per consumarlo.

Quando leggi `{{4枚|よんまい}}を{{使用|しよう}}して...{{購入|こうにゅう}}しますか`,
la schermata ti sta chiedendo un consenso operativo completo, non una semplice
conferma generica.

`{{使用|しよう}}` descrive la risorsa che si consuma,
[{{購入|こうにゅう}}](term:term-purchase) descrive il risultato atteso.
Insieme indicano cosa esce dallo stock e cosa entra nel risultato.

### 5. I risultati alternano reveal spettacolare e lista leggibile

:::image
src: assets/ui/card-pack-card-reveal.png
alt: >-
  Schermata di reveal spettacolare della carta ディアス Z durante l'apertura
  pack.
caption: >-
  Il reveal enfatizza il colpo di scena visivo, ma il lettore deve comunque
  saper recuperare nome carta e risultato reale.
:::

:::image
src: assets/ui/card-pack-obtained-list.png
alt: >-
  Schermata lista carte ottenute con filtri per civiltà o categoria e griglia
  delle carte.
caption: >-
  `{{獲得|かくとく}}カード{{一覧|いちらん}}` è la schermata utile per
  verificare davvero il risultato dell'apertura, con filtri e griglia delle
  carte.
:::

Queste due schermate fanno due lavori diversi:

- il reveal serve a rendere memorabile il momento dell'apertura;
- `{{獲得|かくとく}}`カード{{一覧|いちらん}} serve a verificare davvero che cosa
  hai ottenuto.

La riga `{{獲得|かくとく}}カード{{一覧|いちらん}}` è quella da usare per
verificare l'esito reale con filtri e confronto diretto.
Il reveal serve a mostrare l'apertura, mentre la lista finale conferma in modo
contabile il contenuto ricevuto.

## Esempi guidati

**Esempio 1**

:::example_sentence
jp: >-
  カードパック{{購入|こうにゅう}}でチケットを{{使|つか}}う。
translation_it: >-
  Usa un ticket nella schermata acquisto pack.
:::

- [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase) ti dice dove
  sei.
- Il passo successivo è leggere quale risorsa verrà consumata.

**Esempio 2**

:::example_sentence
jp: >-
  {{所持|しょじ}}チケットは{{4枚|よんまい}}ある。
translation_it: >-
  Hai 4 ticket disponibili.
:::

- [{{所持|しょじ}}チケット](term:term-owned-ticket) non parla di ciò
  che esiste nel gioco, ma dello stock attuale del tuo account.
- È una lettura molto più pratica di una semplice voce di inventario.

**Esempio 3**

:::example_sentence
jp: >-
  {{4枚|よんまい}}を{{使用|しよう}}してパックを{{購入|こうにゅう}}しますか。
translation_it: >-
  Vuoi usare 4 ticket per comprare i pack?
:::

- [{{使用|しよう}}](term:term-use) e `{{購入|こうにゅう}}` vanno letti insieme:
  stai consumando una risorsa per ottenere un prodotto.
- Questo è il momento in cui la UI ti chiede davvero di impegnarti.

**Esempio 4**

:::example_sentence
jp: >-
  {{獲得|かくとく}}カード{{一覧|いちらん}}で{{結果|けっか}}を{{確認|かくにん}}する。
translation_it: >-
  Controlla il risultato nella lista delle carte ottenute.
:::

- [{{獲得|かくとく}}](term:term-kakutoku) spiega che quelle carte sono già state
  ottenute.
- [～{{一覧|いちらん}}](grammar:grammar-ichiran) ti dice che la schermata è
  una lista consultabile, non un singolo popup.

## Nota finale

Quando apri un pack, segui sempre lo stesso controllo: entrata nello shop, risorsa
consumata, conferma esplicita e verifica finale del risultato nella lista
`{{獲得|かくとく}}カード{{一覧|いちらん}}`.
