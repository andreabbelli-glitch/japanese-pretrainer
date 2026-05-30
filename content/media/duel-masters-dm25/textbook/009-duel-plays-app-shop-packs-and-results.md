---
id: lesson-duel-masters-dm25-duel-plays-app-shop-packs-and-results
media_id: media-duel-masters-dm25
slug: duel-plays-app-shop-packs-and-results
title: "Shop e pack opening: risorse, conferme e risultati"
order: 19
segment_ref: duel-plays-app
difficulty: n4
status: active
tags: [app, ui, shop, packs, results, duel-plays]
prerequisites: [lesson-duel-masters-dm25-duel-plays-app-rewards-and-claim-flow]
summary: >-
  Lo shop di デュエプレ si legge come un flusso: tipo di acquisto, risorsa,
  quantità, conferma del consumo e lista finale delle carte ottenute.
---

# Shop e pack opening: risorse, conferme e risultati

Nello shop di `デュエプレ` il banner del pack attira l'occhio, ma le decisioni
vere stanno nelle label più piccole: quale flusso stai aprendo, quale risorsa
verrà consumata, quante unità hai selezionato e dove controlli il risultato
dopo il reveal.

Il giapponese della UI separa bene questi passaggi. [{{購入|こうにゅう}}](term:term-purchase)
nomina l'acquisto, [{{使用|しよう}}](term:term-use) segnala la risorsa che
esce dallo stock, [{{確認|かくにん}}](term:term-confirm) blocca il momento di
controllo e [{{獲得|かくとく}}](term:term-kakutoku) descrive ciò che è già
entrato nel tuo account.

## Termini chiave

- [カード{{購入|こうにゅう}}](term:term-card-purchase) — ingresso generale
  all'acquisto carte.
- [{{購入|こうにゅう}}](term:term-purchase) — acquistare; nella UI è il verbo
  che chiude la spesa.
- [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase) — acquisto dei
  pack, quindi flusso specifico per le buste.
- [カード{{交換|こうかん}}](term:term-card-exchange) — scambio carte con una
  risorsa dedicata, non acquisto diretto.
- [{{交換|こうかん}}](term:term-exchange) — scambiare; cambia la logica rispetto
  a comprare.
- [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase) —
  acquisto di un deck già costruito.
- [{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt) — già assemblato / già
  costruito.
- [{{所持|しょじ}}チケット](term:term-owned-ticket) — ticket posseduti al
  momento.
- [{{購入|こうにゅう}}{{個数|こすう}}](term:term-purchase-quantity) — quantità
  selezionata per l'acquisto.
- [{{使用|しよう}}](term:term-use) — usare / consumare una risorsa.
- [{{獲得|かくとく}}](term:term-kakutoku) — ottenere come risultato già
  acquisito.
- [{{提供|ていきょう}}{{割合|わりあい}}](term:term-offer-rate) — percentuali di
  offerta / drop rate.
- [{{確認|かくにん}}](term:term-confirm) — verifica o conferma prima di
  procedere.
- [チケット](term:term-ticket) — ticket come risorsa spendibile.
- [{{所持|しょじ}}](term:term-owned) — possesso attuale, ciò che hai davvero
  in stock.

## Espressioni ricorrenti

- ジェムで[{{購入|こうにゅう}}](term:term-purchase) — comprare usando gemme;
  `で` marca il mezzo di pagamento.
- ゴールドで[{{購入|こうにゅう}}](term:term-purchase) — comprare usando oro.
- [チケット](term:term-ticket)で[{{購入|こうにゅう}}](term:term-purchase) —
  comprare consumando ticket.
- [{{獲得|かくとく}}](term:term-kakutoku)カード{{一覧|いちらん}} — lista delle
  carte ottenute dopo l'apertura.

## Pattern grammaticali chiave

- [～{{一覧|いちらん}}](grammar:grammar-ichiran) — il nome prima di
  `{{一覧|いちらん}}` diventa una lista consultabile.
- [～{{可能|かのう}}](grammar:grammar-kanou) — azione disponibile o possibile
  nelle condizioni attuali.

## Etichette da riconoscere

- `ショップ` — hub dello shop.
- `MAX` — scorciatoia che porta la quantità al limite consentito dallo stock.
- ジェム, ゴールド, [チケット](term:term-ticket) — risorse alternative per
  lo stesso tipo di acquisto.
- `PLAY'S CHRONICLE PACK II` — nome del prodotto pack mostrato nel popup.

---

## 1. Dai pannelli dello shop al tipo di acquisizione

:::image
src: assets/ui/shop-menu-panels.png
alt: >-
  Home shop con quattro grandi pannelli per acquisto carte, acquisto pack,
  acquisto deck costruiti e card exchange.
caption: >-
  `ショップ` separa già a colpo d'occhio acquisto carte, pack, deck prebuilt e
  exchange: capire il pannello giusto evita di entrare nel flusso sbagliato.
:::

La prima schermata non usa un solo verbo generico per "ottenere carte". Divide
lo shop in percorsi, e il nome del pannello ti dice quale tipo di scelta arriva
dopo.

*   [カード{{購入|こうにゅう}}](term:term-card-purchase) mette prima カード e
    poi [{{購入|こうにゅう}}](term:term-purchase): stai entrando nel lato
    acquisto carte in senso largo. Non sai ancora se spenderai gemme, oro o
    ticket; sai però che la logica sarà quella di comprare, non di scambiare.
*   [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase) restringe
    subito l'oggetto a `カードパック`. La UI non sta parlando della collezione
    intera, ma del flusso di apertura delle buste: banner del pack, risorse,
    quantità e conferma.
*   [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
    è più lungo perché contiene lo stato del prodotto. [{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt)
    significa "già costruito": `済み` segnala una costruzione già completata
    prima della vendita del deck.
*   [カード{{交換|こうかん}}](term:term-card-exchange) cambia verbo e quindi
    cambia logica. [{{交換|こうかん}}](term:term-exchange) non è "comprare a
    prezzo diverso"; è ottenere una carta dando in cambio una risorsa prevista
    da quel menu.

:::example_sentence
jp: >-
  ショップでカードパック{{購入|こうにゅう}}を{{選|えら}}ぶ。
translation_it: >-
  Nello shop scelgo l'acquisto dei pack.
:::

#### 🗺️ Anatomia della frase

*   `ショップで` ➔ **Luogo operativo**: `で` indica dove avviene la scelta.
*   `カードパック{{購入|こうにゅう}}を` ➔ **Oggetto selezionato**: il blocco intero
    è ciò che scegli, non una singola carta.
*   `{{選|えら}}ぶ` ➔ **Azione di scelta**: la UI aspetta che tu entri in un
    percorso preciso.

#### ⚖️ Contrasto operativo: `{{購入|こうにゅう}}` non è `{{交換|こうかん}}`

[{{購入|こうにゅう}}](term:term-purchase) porta verso una spesa; [{{交換|こうかん}}](term:term-exchange)
porta verso una conversione. In italiano possono sembrare entrambi "prendere
carte", ma in giapponese il verbo ti dice già quale tipo di risorsa verrà
coinvolta.

---

## 2. La schermata pack è una tabella di risorse

:::image
src: assets/ui/card-pack-purchase-main.png
alt: >-
  Schermata acquisto pack con banner del pack, costi in gemme e oro, righe
  ticket e pulsanti lista carte e percentuali.
caption: >-
  [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase) va letto come
  menu di risorse e controlli: bottoni di acquisto, stock ticket,
  `カード{{一覧|いちらん}}` e
  [{{提供|ていきょう}}{{割合|わりあい}}](term:term-offer-rate).
:::

Dentro [カードパック{{購入|こうにゅう}}](term:term-card-pack-purchase), il banner
del set dice che cosa è in vendita; le label operative dicono come stai per
agire. La particella `で` è il pezzo piccolo che regge tutta la frase: in
`ジェムで{{購入|こうにゅう}}`, `ゴールドで{{購入|こうにゅう}}` e
`チケットで{{購入|こうにゅう}}`, marca la risorsa usata per completare
l'acquisto.

*   `ジェムで` e `ゴールドで` preparano una spesa diretta con valuta. Il verbo
    resta [{{購入|こうにゅう}}](term:term-purchase), quindi il punto non è
    "aprire un pack" in astratto, ma comprare usando quella risorsa.
*   [チケット](term:term-ticket)で[{{購入|こうにゅう}}](term:term-purchase) usa
    la stessa grammatica, ma il mezzo non è una valuta generica: è uno stock di
    ticket già posseduti.
*   [カード{{一覧|いちらん}}](grammar:grammar-ichiran) non consuma nulla.
    [～{{一覧|いちらん}}](grammar:grammar-ichiran) trasforma カード in una vista
    elenco, quindi ti porta a controllare quali carte appartengono al pack.
*   [{{提供|ていきょう}}{{割合|わりあい}}](term:term-offer-rate) apre il dato
    delle percentuali. `{{提供|ていきょう}}` è ciò che viene offerto dal pack,
    `{{割合|わりあい}}` è il rapporto: insieme ti dicono la distribuzione prima
    della spesa, non il risultato che otterrai.

:::example_sentence
jp: >-
  パックを{{購入|こうにゅう}}する{{前|まえ}}に、カード{{一覧|いちらん}}と
  {{提供|ていきょう}}{{割合|わりあい}}を{{確認|かくにん}}する。
translation_it: >-
  Prima di comprare un pack, controllo la lista carte e le percentuali di
  offerta.
:::

#### 🗺️ Anatomia della frase

*   `パックを{{購入|こうにゅう}}する{{前|まえ}}に` ➔ **Prima dell'azione**:
    `{{前|まえ}}に` colloca il controllo prima della spesa.
*   `カード{{一覧|いちらん}}と{{提供|ていきょう}}{{割合|わりあい}}を` ➔ **Due oggetti
    da controllare**: lista contenuti e percentuali non sono la stessa
    schermata.
*   `{{確認|かくにん}}する` ➔ **Verifica attiva**: non stai confermando un
    acquisto, stai controllando informazioni prima di procedere.

#### ⚖️ Contrasto operativo: lista carte vs percentuali

カード{{一覧|いちらん}} ti dice che cosa può comparire nel pack; [{{提供|ていきょう}}{{割合|わりあい}}](term:term-offer-rate)
ti dice con quale distribuzione. La prima schermata risponde a "quali carte?",
la seconda a "con che probabilità?".

#### 🧠 Gancio cognitivo

Per [{{提供|ていきょう}}{{割合|わりあい}}](term:term-offer-rate), pensa a
"offerta + rapporto": il pack mette un insieme di carte a disposizione, ma la
UI ti sta mostrando il rapporto tra le rarità, non una promessa sul singolo
pack che aprirai.

---

## 3. Quantità e stock: il popup conta prima di spendere

:::image
src: assets/ui/card-pack-purchase-count.png
alt: >-
  Popup acquisto pack con contatore della quantità, indicazione ticket
  posseduti e pulsanti meno, più e MAX.
:::

Nel popup quantita', guarda il rapporto tra banner, pack e numero selezionato.

riconoscere `チケット`: devi leggere se la UI parla di ticket posseduti,
quantità selezionata o scorciatoia di massimo consumo.

*   [{{所持|しょじ}}チケット](term:term-owned-ticket) combina
    [{{所持|しょじ}}](term:term-owned) e [チケット](term:term-ticket). Il risultato si riferisce ai ticket posseduti dal tuo account.
*   [{{購入|こうにゅう}}{{個数|こすう}}](term:term-purchase-quantity) è la
    quantità dell'acquisto. `{{個数|こすう}}` conta unità; attaccato a
    [{{購入|こうにゅう}}](term:term-purchase), ti dice quante unità stai per
    comprare, non quante carte usciranno dal pack.
*   `MAX` non è una rarità e non è una garanzia di risultato. È un comando UI:
    porta il contatore al massimo consentito dalla risorsa disponibile.
*   [～{{可能|かのう}}](grammar:grammar-kanou), quando compare in messaggi di
    disponibilità, funziona con la stessa logica: non promette un risultato
    migliore, dice solo che l'azione è eseguibile nelle condizioni attuali.

:::example_sentence
jp: >-
  {{所持|しょじ}}チケットを{{確認|かくにん}}して、
  {{購入|こうにゅう}}{{個数|こすう}}を{{4|よん}}にする。
translation_it: >-
  Controllo i ticket posseduti e imposto la quantità di acquisto a 4.
:::

Il popup quantità sposta l'attenzione dal prodotto allo stock. Qui non basta

#### 🗺️ Anatomia della frase

    stai verificando.
*   `{{確認|かくにん}}して` ➔ **Azione preparatoria**: la forma in `-te`
    collega il controllo al passo successivo.
*   `{{購入|こうにゅう}}{{個数|こすう}}を{{4|よん}}にする` ➔ **Impostazione di
    quantità**: `にする` trasforma il valore del contatore in `4`.

#### ⚖️ Contrasto operativo: `{{所持|しょじ}}` vs `{{使用|しよう}}`

[{{所持|しょじ}}](term:term-owned) fotografa ciò che hai; [{{使用|しよう}}](term:term-use)
descrive ciò che consumi. Nel popup quantità sei ancora nel controllo dello
stock, mentre nel popup successivo la UI ti chiede se vuoi davvero usarlo.

---

## 4. La conferma lega risorsa consumata e acquisto

:::image
src: assets/ui/card-pack-purchase-confirm.png
alt: >-
  Popup di conferma pack che chiede se usare 4 ticket per comprare quattro
  pack PLAY'S CHRONICLE PACK II.
caption: >-
  Il popup di conferma esplicita quantità e prodotto nella frase centrale,
  mentre la riga in basso ti fa controllare la risorsa consumata.
:::

*   `{{所持|しょじ}}チケットを` ➔ **Stock controllato**: `を` marca il dato che

di acquisto. Questo è il punto in cui [{{確認|かくにん}}](term:term-confirm)
diventa una decisione pratica: prima eri nel menu, ora stai autorizzando il
consumo.

:::example_sentence
jp: >-
  {{4枚|よんまい}}を{{使用|しよう}}してパックを{{購入|こうにゅう}}しますか。
translation_it: >-
  Vuoi usare 4 ticket per comprare i pack?
:::

Il popup di conferma mette nella stessa frase il numero, la risorsa e il verbo

#### 🗺️ Anatomia della frase

    risorsa contata dal popup, non una previsione sulle carte che usciranno.
*   {{使用|しよう}}して ➔ **Mezzo consumato**: [{{使用|しよう}}](term:term-use)
    dice che quella quantità verrà spesa.
*   `パックを{{購入|こうにゅう}}しますか` ➔ **Domanda di acquisto**: `しますか`
    trasforma l'azione in richiesta di consenso.

#### ⚖️ Contrasto operativo: confermare non significa avere già ottenuto

[{{確認|かくにん}}](term:term-confirm) controlla e chiede consenso;
[{{使用|しよう}}](term:term-use) consuma la risorsa; [{{購入|こうにゅう}}](term:term-purchase)
esegue l'acquisto. Il risultato non è ancora [{{獲得|かくとく}}](term:term-kakutoku):
quella parola diventa centrale solo dopo l'apertura.

---

## 5. Reveal e lista finale non fanno lo stesso lavoro

:::image
src: assets/ui/card-pack-card-reveal.png
alt: >-
  Schermata di reveal spettacolare della carta ディアス Z durante l'apertura
  pack.
caption: >-
  Il reveal enfatizza il colpo di scena visivo, ma il lettore deve comunque
  saper recuperare nome carta e risultato reale.
:::

*   `{{4枚|よんまい}}を` ➔ **Quantità marcata come oggetto**: il referente è la

:::image
src: assets/ui/card-pack-obtained-list.png
alt: >-
  Schermata lista carte ottenute con filtri per civiltà o categoria e griglia
  delle carte.
caption: >-
  `{{獲得|かくとく}}カード{{一覧|いちらん}}` mostra il risultato dell'apertura con
  filtri e griglia delle carte ottenute.
:::

L'apertura del pack alterna spettacolo e verifica. Il reveal mette in primo
piano la carta appena comparsa; la lista finale organizza il risultato in modo
leggibile.

*   [{{獲得|かくとく}}](term:term-kakutoku) indica un'acquisizione già
    avvenuta. Non è il verbo del pagamento: descrive ciò che è entrato nel tuo
    account dopo l'apertura.
*   カード{{一覧|いちらん}} usa [～{{一覧|いちらん}}](grammar:grammar-ichiran) per
    trasformare le carte ottenute in una vista consultabile. Questa schermata serve a controllare nomi, quantita' e rarita'.
*   I filtri per civiltà o categoria hanno senso proprio perché la lista è il
    luogo della verifica. Nel reveal leggi il colpo singolo; in
    `{{獲得|かくとく}}カード{{一覧|いちらん}}` leggi il risultato completo.

:::example_sentence
jp: >-
  パックを{{引|ひ}}いた{{後|あと}}、{{獲得|かくとく}}カード{{一覧|いちらん}}で
  {{結果|けっか}}を{{確認|かくにん}}する。
translation_it: >-
  Dopo aver aperto il pack, controllo il risultato nella lista delle carte
  ottenute.
:::

#### 🗺️ Anatomia della frase

*   `パックを{{引|ひ}}いた{{後|あと}}` ➔ **Sequenza temporale**: prima avviene
    l'apertura, poi il controllo.
*   `{{獲得|かくとく}}カード{{一覧|いちらん}}で` ➔ **Luogo funzionale**: `で` marca
    la schermata in cui avviene la verifica.
Dopo l'acquisto, l'azione centrale diventa leggere cosa hai ottenuto.

#### 🧠 Gancio cognitivo

Per `{{獲得|かくとく}}カード{{一覧|いちらん}}`, tieni insieme i tre pezzi:
`{{獲得|かくとく}}` dice "ottenute", `カード` dice l'oggetto, `{{一覧|いちらん}}`
dice il formato lista. Se manca uno di questi pezzi, stai probabilmente
guardando un'altra schermata.

---

## Esempi guidati di riepilogo

Le stesse forme diventano più solide quando ricostruisci l'intero flusso dello
shop: ingresso, controllo, quantità, conferma e verifica finale.

:::example_sentence
jp: >-
  ショップでカードパック{{購入|こうにゅう}}を{{開|ひら}}いて、
  チケットで{{購入|こうにゅう}}する。
translation_it: >-
  Apro l'acquisto dei pack nello shop e compro usando ticket.
:::

:::example_sentence
jp: >-
  {{購入|こうにゅう}}する{{前|まえ}}に、カード{{一覧|いちらん}}と
  {{提供|ていきょう}}{{割合|わりあい}}を{{確認|かくにん}}する。
translation_it: >-
  Prima di comprare, controllo la lista carte e le percentuali di offerta.
:::

:::example_sentence
jp: >-
  {{所持|しょじ}}チケットが{{4枚|よんまい}}あるので、
  {{購入|こうにゅう}}{{個数|こすう}}を{{4|よん}}にする。
translation_it: >-
  Poiché ho 4 ticket, imposto la quantità di acquisto a 4.
:::

:::example_sentence
jp: >-
  {{4枚|よんまい}}を{{使用|しよう}}してパックを{{購入|こうにゅう}}しますか。
translation_it: >-
  Vuoi usare 4 ticket per comprare i pack?
:::

:::example_sentence
jp: >-
  パックを{{引|ひ}}いた{{後|あと}}、{{獲得|かくとく}}カード{{一覧|いちらん}}で
  カードを{{確認|かくにん}}する。
translation_it: >-
  Dopo aver aperto il pack, controllo le carte nella lista delle carte
  ottenute.
:::

---

## Nota finale

Il pack opening diventa leggibile quando segui i verbi nell'ordine giusto:
[{{購入|こうにゅう}}](term:term-purchase) apre la spesa,
[{{所持|しょじ}}](term:term-owned) mostra lo stock,
[{{使用|しよう}}](term:term-use) consuma la risorsa e
[{{獲得|かくとく}}](term:term-kakutoku) porta alla lista finale. Il reveal è la
parte spettacolare; `{{獲得|かくとく}}カード{{一覧|いちらん}}` è la schermata che ti
permette di leggere davvero il risultato.
