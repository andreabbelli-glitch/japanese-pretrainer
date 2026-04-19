---
id: lesson-duel-masters-dm25-duel-plays-app-exchange-decks-and-setup
media_id: media-duel-masters-dm25
slug: duel-plays-app-exchange-decks-and-setup
title: デュエプレ App 6 - Exchange, deck list e setup prima del match
order: 20
segment_ref: duel-plays-app
difficulty: n4
status: active
tags: [app, ui, exchange, decks, setup, duel-plays]
prerequisites: [lesson-duel-masters-dm25-duel-plays-app-shop-packs-and-results]
summary: >-
  Approfondimento sulle schermate di scambio e preparazione: periodo attivo,
  risorsa mancante, acquisto di deck prebuilt e lettura della deck list prima di
  iniziare davvero una partita.
---

# Obiettivo

L'obiettivo delle schermate in questo argomento è un flusso operativo unico:
controllare exchange, risorse e deck prima del match.

Al termine controlli che puoi:

- leggere bene una schermata exchange senza confondere prezzo, finestra attiva e
  numero di scambi residui;
- capire che cosa ti sta bloccando quando una risorsa non basta;
- leggere una deck list come schermata di scelta e verifica, non come poster.

## Contesto

Qui devi controllare se sono soddisfatti questi punti operativi:

- puoi ancora scambiare questa carta o il periodo è finito?
- ti manca la risorsa o stai solo guardando il menu sbagliato?
- il deck che stai per usare è prebuilt, rental o già selezionato?

Leggere correttamente label e indicatori evita:

- entrare in un flusso giusto con la risorsa sbagliata;
- arrivare troppo tardi al bottone [{{対戦開始|たい.せん.かい.し}}](term:term-start-match)
  senza aver letto davvero il contesto.

## Termini chiave

- [カード{{交換|こうかん}}](term:term-card-exchange)
- [{{交換|こうかん}}](term:term-exchange)
- [{{交換期間|こう.かん.き.かん}}](term:term-exchange-period)
- [{{販売期間|はん.ばい.き.かん}}](term:term-sale-period)
- [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
- [{{不足|ふそく}}](term:term-shortage)
- [デッキ{{一覧|いちらん}}](term:term-deck-list)
- [{{概要|がいよう}}](term:term-overview)
- [レンタルデッキ](term:term-rental-deck)
- [キーカード](term:term-key-card)
- [レジェンドスキル](term:term-legend-skill)
- [{{確認|かくにん}}](term:term-confirm)
- [{{分解|ぶんかい}}](term:term-disenchant)
- [DMポイント](term:term-dm-points)
- [{{対戦開始|たい.せん.かい.し}}](term:term-start-match)

## Pattern grammaticali chiave

- [～{{可能|かのう}}](grammar:grammar-kanou)
- [～{{一覧|いちらん}}](grammar:grammar-ichiran)
- [～{{済|ず}}み](grammar:grammar-zumi)

## Spiegazione

### 1. La schermata exchange ruota attorno a finestra temporale e tentativi residui

:::image
src: assets/ui/card-exchange-main.png
alt: >-
  Schermata card exchange con tab prize card exchange e arc card exchange,
  categorie a sinistra e ribbon periodo scambio sulle carte.
caption: >-
  In [カード{{交換|こうかん}}](term:term-card-exchange) prima leggi tab, filtri
  e valuta; poi la singola riga carta con
  [{{交換期間|こう.かん.き.かん}}](term:term-exchange-period),
  [{{所持|しょじ}}](term:term-owned) e `あと{{4回交換可能|よん.かい.こう.かん.か.のう}}！`.
:::

In [カード{{交換|こうかん}}](term:term-card-exchange) la carta in evidenza non è
mai l'unica cosa da leggere. Prima della riga della carta leggi la struttura
della schermata:

- i tab superiori, come `プライズカード交換` e `アークカード交換`, che ti dicono
  quale famiglia di risorse o oggetti stai usando;
- la colonna sinistra di categorie, che restringe il campo;
- solo dopo la riga della carta che ti interessa.

I label decisivi sono intorno:

- [{{交換期間|こう.かん.き.かん}}](term:term-exchange-period) = fino a quando questa
  finestra di scambio resta valida;
- `{{所持|しょじ}}: 0` = quante copie o risorse rilevanti possiedi;
- `あと4回{{交換可能|こう.かん.か.のう}}!` = quante volte puoi ancora completare
  l'operazione.

La schermata comunica insieme *tempo*, *stock* e *possibilità residua*. Se ne
leggi solo uno, perdi il senso operativo dell'interfaccia.

### 2. I popup di risorsa insufficiente spiegano anche la via di recupero

:::image
src: assets/ui/card-exchange-dm-points-shortage.png
alt: >-
  Popup che avvisa della mancanza di DMポイント e propone il flusso di
  dismantle carte come azione successiva.
caption: >-
  Il popup identifica il blocco reale (`DMポイントが[{{不足|ふそく}}](term:term-shortage)しています`)
  e propone subito il flusso di recupero (`カード{{分解|ぶんかい}}しますか？`).
:::

Questo popup non si limita a segnalare
[{{不足|ふそく}}](term:term-shortage) "manca".
Ti dice anche quale passaggio successivo è sensato.

La logica è:

- [DMポイント](term:term-dm-points) non bastano;
- l'operazione scelta non può chiudersi ora;
- puoi passare a [{{分解|ぶんかい}}](term:term-disenchant) per recuperare la
  risorsa necessaria.

Il messaggio indica un blocco operativo: non hai abbastanza
[DMポイント](term:term-dm-points) per completare
l'azione.

### 3. I deck prebuilt si leggono tra periodo di vendita e bonus inclusi

:::image
src: assets/ui/constructed-deck-purchase.png
alt: >-
  Schermata acquisto deck prebuilt con più deck in vendita, ribbon periodo
  vendita e bonus playmat/protector.
caption: >-
  [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
  mostra deck-prodotto, [{{販売期間|はん.ばい.き.かん}}](term:term-sale-period),
  prezzo e bonus `{{特典|とくてん}}プレイマット/プロテクト`: qui non stai
  ancora editando una lista.
:::

[{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
è composto da:

- [{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt) = deck già preparato /
  prebuilt;
- `デッキ` = il prodotto principale;
- `{{購入|こうにゅう}}` = il flusso di acquisto.

La schermata aggiunge due elementi molto tipici della UI shop:

- [{{販売期間|はん.ばい.き.かん}}](term:term-sale-period) = finestra di vendita;
- `{{特典|とくてん}}プレイマット/プロテクト` = bonus inclusi.

La lettura include anche *fino a quando* il prodotto è disponibile e *quali extra*
accompagnano l'acquisto.

### 4. La deck list collega scelta, preview e avvio della partita

:::image
src: assets/ui/deck-list-rental.png
alt: >-
  Schermata lista deck nella sezione レンタルデッキ con preview del mazzo,
  pannello キーカード e pulsanti overview deck, verifica legend skill e avvio
  sfida.
caption: >-
  [デッキ{{一覧|いちらん}}](term:term-deck-list) è un hub di preparazione:
  scegli il mazzo, controlli preview e pulsanti diversi per capire, modificare
  o avviare la partita.
:::

In [デッキ{{一覧|いちらん}}](term:term-deck-list) la UI ti mette davanti quattro
livelli di lettura:

- lista dei mazzi disponibili;
- focus sul deck selezionato;
- pannello [キーカード](term:term-key-card) per capire l'identità del mazzo;
- pulsanti finali come `デッキ[{{概要|がいよう}}](term:term-overview)`,
  `レジェンドスキル{{確認|かくにん}}`
  e [{{対戦開始|たい.せん.かい.し}}](term:term-start-match).

Qui [レンタルデッキ](term:term-rental-deck) cambia il senso pratico della
schermata: non stai solo editando una lista tua, stai scegliendo un mazzo già
fornito dal gioco.

[レジェンドスキル](term:term-legend-skill) e [キーカード](term:term-key-card)
sono label operative: mostrano rispettivamente controllo avanzato del mazzo e
identità rapida del deck.

Classifica i pulsanti per funzione:

- `デッキ[{{概要|がいよう}}](term:term-overview)` e
  `デッキ{{確認|かくにん}}` = ispezioni;
- `デッキ{{編成|へんせい}}` = modifichi;
- [{{対戦開始|たい.せん.かい.し}}](term:term-start-match) = parti davvero.

Così eviti di trattare pulsanti diversi come varianti dello stesso flusso.

## Esempi guidati

**Esempio 1**

:::example_sentence
jp: >-
  {{限定|げんてい}}カードの{{交換期間|こう.かん.き.かん}}は{{3月26日|さんがつにじゅうろくにち}}までなので、{{急|いそ}}いでDMポイントをあつめる。
translation_it: >-
  La finestra di scambio delle carte evento dura fino al 26 Marzo, per cui mi sbrigo a raccogliere i punti.
:::

- [{{交換期間|こう.かん.き.かん}}](term:term-exchange-period) non è il prezzo, ma la
  finestra temporale dell'operazione.
- Se lo leggi male, rischi di pensare che il contenuto sia ancora attivo quando
  non lo è più.

**Esempio 2**

:::example_sentence
jp: >-
  DMポイントが{{不足|ふそく}}しているのでカードを{{分解|ぶんかい}}する。
translation_it: >-
  I DM Points non bastano, quindi smonta una carta.
:::

- Il messaggio individua il blocco reale: la risorsa.
- [{{分解|ぶんかい}}](term:term-disenchant) appare come soluzione operativa, non
  come menu scollegato.

**Esempio 3**

:::example_sentence
jp: >-
  {{販売期間|はん.ばい.き.かん}}を{{見|み}}てから{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}を{{決|き}}める。
translation_it: >-
  Controlla il periodo di vendita prima di decidere se comprare il deck
  prebuilt.
:::

- [{{販売期間|はん.ばい.き.かん}}](term:term-sale-period) ti orienta sul tempo.
- [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
  ti dice il tipo di prodotto che stai guardando.

**Esempio 4**

:::example_sentence
jp: >-
  デッキ{{一覧|いちらん}}でキーカードを{{確認|かくにん}}してから{{対戦開始|たい.せん.かい.し}}を{{押|お}}す。
translation_it: >-
  Controlla la key card nella deck list prima di premere Avvia partita.
:::

- [デッキ{{一覧|いちらん}}](term:term-deck-list) è una schermata di scelta.
- [キーカード](term:term-key-card) ti aiuta a capire velocemente il mazzo che
  stai per usare.

## Nota finale

Queste schermate insegnano una regola molto utile: prima di partire, leggi
sempre *finestra attiva*, *risorsa disponibile* e *contesto del deck*. È lì che
la UI di `デュエプレ` ti dice se l'azione è davvero pronta oppure no.
