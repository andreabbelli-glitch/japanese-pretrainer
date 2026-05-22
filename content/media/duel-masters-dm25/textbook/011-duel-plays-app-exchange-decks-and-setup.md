---
id: lesson-duel-masters-dm25-duel-plays-app-exchange-decks-and-setup
media_id: media-duel-masters-dm25
slug: duel-plays-app-exchange-decks-and-setup
title: Exchange, risorse e deck list prima del match
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

# Exchange, risorse e deck list prima del match

In *Duel Masters Plays*, la partita non comincia quando compare la prima creatura:
comincia già nelle schermate che ti fanno controllare scambi, risorse, deck
prebuilt e mazzi disponibili. La UI usa composti compatti come
[{{交換期間|こうかんきかん}}](term:term-exchange-period),
[{{不足|ふそく}}](term:term-shortage) e
[デッキ{{一覧|いちらん}}](term:term-deck-list) per dirti se puoi ancora agire,
che cosa ti manca e quale deck stai per portare al match.

Questi label non sono decorazione intorno ai pulsanti. Leggendoli insieme
capisci se una carta è ancora scambiabile, se il blocco nasce dai
[DMポイント](term:term-dm-points), se un prodotto è un
[{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
o se il bottone
[{{対戦開始|たいせんかいし}}](term:term-start-match) sta davvero chiudendo la
preparazione.

## Termini chiave

- [カード{{交換|こうかん}}](term:term-card-exchange) — area in cui scambi carte o
  risorse, non shop generico
- [{{交換|こうかん}}](term:term-exchange) — scambio / conversione tramite una
  risorsa o finestra dedicata
- [{{交換期間|こうかんきかん}}](term:term-exchange-period) — finestra temporale dello
  scambio
- [{{販売期間|はんばいきかん}}](term:term-sale-period) — finestra temporale di
  vendita
- [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
  — acquisto di deck già costruito
- [{{不足|ふそく}}](term:term-shortage) — mancanza / insufficienza della risorsa
- [{{所持|しょじ}}](term:term-owned) — quantità già posseduta, utile per capire
  se un'azione è disponibile
- [{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt) — già costruito / già pronto,
  non da assemblare manualmente
- [デッキ{{一覧|いちらん}}](term:term-deck-list) — vista elenco dei deck
- [{{概要|がいよう}}](term:term-overview) — panoramica rapida del deck o del
  contenuto
- [{{確認|かくにん}}](term:term-confirm) — controllo puntuale / verifica
- [{{分解|ぶんかい}}](term:term-disenchant) — smontare una carta per convertirla
  in risorsa
- [DMポイント](term:term-dm-points) — risorsa spendibile nelle schermate carte e
  shop
- [{{対戦開始|たいせんかいし}}](term:term-start-match) — avvio effettivo del match

## Espressioni ricorrenti

- `あと{{4回|よんかい}}{{交換|こうかん}}{{可能|かのう}}！` — puoi ancora scambiare
  quattro volte
- `DMポイントが{{不足|ふそく}}しています` — i DM Points non bastano
- `カード{{分解|ぶんかい}}しますか？` — vuoi passare allo smontaggio carte?
- `デッキ{{概要|がいよう}}` / `デッキ{{確認|かくにん}}` — apri una vista di controllo,
  non inizi la partita

## Pattern grammaticali chiave

- [～{{可能|かのう}}](grammar:grammar-kanou) — possibilità operativa: l'azione è
  disponibile
- [～{{一覧|いちらん}}](grammar:grammar-ichiran) — vista elenco: molti elementi in
  una sola schermata
- [～{{済|ず}}み](grammar:grammar-zumi) — stato già completato o già preparato

## Etichette da riconoscere

- [レンタルデッキ](term:term-rental-deck) — deck fornito dal gioco
- [キーカード](term:term-key-card) — carta rappresentativa del deck
- [レジェンドスキル](term:term-legend-skill) — informazione di setup o abilità
  speciale del contesto

---

## 1. Exchange: periodo, stock e possibilità residua

:::image
src: assets/ui/card-exchange-main.png
alt: >-
  Schermata card exchange con tab prize card exchange e arc card exchange,
  categorie a sinistra e ribbon periodo scambio sulle carte.
caption: >-
  In [カード{{交換|こうかん}}](term:term-card-exchange) la riga della carta va
  letta insieme a tab, filtri, valuta,
  [{{交換期間|こうかんきかん}}](term:term-exchange-period),
  [{{所持|しょじ}}](term:term-owned) e あと{{4回|よんかい}}{{交換|こうかん}}{{可能|かのう}}！.
:::

La schermata [カード{{交換|こうかん}}](term:term-card-exchange) mette la carta al
centro, ma il giapponese decisivo sta nei label che la circondano. `カード` è
l'oggetto, [{{交換|こうかん}}](term:term-exchange) è l'operazione: non stai
comprando direttamente una carta come nello shop, stai entrando in una finestra
di scambio con regole e risorse proprie.

- I tab superiori, come `プライズカード交換` e `アークカード交換`, restringono la
  famiglia di oggetti o risorse. Prima ancora di leggere il prezzo, il composto
  con [{{交換|こうかん}}](term:term-exchange) ti dice che la logica della schermata
  è conversione / scambio.
- [{{交換期間|こうかんきかん}}](term:term-exchange-period) unisce
  [{{交換|こうかん}}](term:term-exchange) e {{期間|きかん}}: il punto non è
  "quanto costa", ma "fino a quando questa finestra resta aperta". È una label
  temporale, quindi va letta insieme alle date.
- [{{所持|しょじ}}](term:term-owned) trasforma un numero in stock reale: 0 non
  vuol dire che la carta non esiste nel gioco, ma che tu non la possiedi in
  quel momento.
- `あと{{4回|よんかい}}{{交換|こうかん}}{{可能|かのう}}！` aggiunge il conteggio
  residuo. [～{{可能|かのう}}](grammar:grammar-kanou) dice che l'azione è ancora
  disponibile; `あと{{4回|よんかい}}` precisa quante volte resta disponibile.

:::example_sentence
jp: >-
  あと{{4回|よんかい}}{{交換|こうかん}}{{可能|かのう}}！
translation_it: >-
  Puoi ancora effettuare lo scambio quattro volte!
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `あと{{4回|よんかい}}` ➔ **Conteggio residuo**: `あと` guarda a ciò che
    rimane, mentre `{{4回|よんかい}}` conta il numero di operazioni possibili.
*   `{{交換|こうかん}}` ➔ **Azione controllata dalla UI**: il conteggio non parla
    di copie possedute, ma di quante volte puoi completare lo scambio.
*   [{{可能|かのう}}](grammar:grammar-kanou) ➔ **Disponibilità operativa**:
    l'azione è permessa dalla schermata in questo momento.

#### ⚖️ Contrasto operativo: periodo, stock e possibilità

*   [{{交換期間|こうかんきかん}}](term:term-exchange-period) risponde a "fino a
    quando?".
*   [{{所持|しょじ}}](term:term-owned) risponde a "quante copie o risorse ho
    già?".
*   `あと{{4回|よんかい}}{{交換|こうかん}}{{可能|かのう}}！` risponde a "quante
    operazioni posso ancora fare?".

Se confondi questi tre livelli, la schermata sembra ripetere lo stesso dato.
In realtà separa tempo, possesso e limite residuo.

#### 🧠 Gancio cognitivo

`{{期間|きかん}}` è il "contenitore temporale" dell'azione: quando lo vedi in
[{{交換期間|こうかんきかん}}](term:term-exchange-period) o
[{{販売期間|はんばいきかん}}](term:term-sale-period), cerca subito una data o una
scadenza, non un prezzo.

## 2. Il popup di 不足: il blocco è la risorsa, non il menu

:::image
src: assets/ui/card-exchange-dm-points-shortage.png
alt: >-
  Popup che avvisa della mancanza di DMポイント e propone il flusso di
  dismantle carte come azione successiva.
caption: >-
  Il popup identifica il blocco reale (`DMポイントが{{不足|ふそく}}しています`) e
  propone subito il recupero tramite `カード{{分解|ぶんかい}}しますか？`.
:::

Quando il popup dice `DMポイントが{{不足|ふそく}}しています`, non sta
rimandando a una spiegazione generica. Il soggetto marcato da `が` è
[DMポイント](term:term-dm-points), e
[{{不足|ふそく}}](term:term-shortage) descrive il suo stato: la risorsa non
raggiunge la quantità richiesta per chiudere l'azione.

La seconda frase, `カード{{分解|ぶんかい}}しますか？`, propone una via di recupero.
[{{分解|ぶんかい}}](term:term-disenchant) non è un menu scollegato: nel lessico
dell'app è l'azione che smonta carte per ottenere risorse. Il popup lega quindi
diagnosi e prossimo passo: mancano DM Points, quindi puoi passare allo
smontaggio.

:::example_sentence
jp: >-
  DMポイントが{{不足|ふそく}}しています。カード{{分解|ぶんかい}}しますか？
translation_it: >-
  I DM Points non sono sufficienti. Vuoi smontare carte?
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `DMポイントが` ➔ **Risorsa soggetto**: `が` mette a fuoco ciò che non basta,
    non la carta che volevi ottenere.
*   [{{不足|ふそく}}](term:term-shortage)しています ➔ **Stato in corso**:
    la forma con `しています` presenta la carenza come condizione attuale della
    risorsa.
*   `カード{{分解|ぶんかい}}しますか？` ➔ **Proposta di azione**:
    [{{分解|ぶんかい}}](term:term-disenchant) diventa il possibile passaggio
    successivo, formulato come domanda.

#### ⚖️ Contrasto operativo: mancanza e possesso non sono la stessa lettura

*   [{{所持|しょじ}}](term:term-owned): 0 ti dice che non possiedi qualcosa o
    che lo stock mostrato è zero.
*   [{{不足|ふそく}}](term:term-shortage) ti dice che una quantità necessaria non
    è sufficiente rispetto a un costo o requisito.

Un numero basso in [{{所持|しょじ}}](term:term-owned) può essere solo un dato di
inventario. [{{不足|ふそく}}](term:term-shortage), invece, compare quando hai già
tentato o selezionato un'azione e il sistema ti sta spiegando perché non può
andare a buon fine.

#### 🧠 Gancio cognitivo

In [{{不足|ふそく}}](term:term-shortage), {{不|ふ}} nega e {{足|そく}} porta
l'idea di bastare. Come gancio di memoria, leggilo come "non abbastanza": è
esattamente la domanda che il popup sta risolvendo.

## 3. Deck prebuilt: 済み, periodo di vendita e bonus inclusi

:::image
src: assets/ui/constructed-deck-purchase.png
alt: >-
  Schermata acquisto deck prebuilt con più deck in vendita, ribbon periodo
  vendita e bonus playmat/protector.
caption: >-
  [{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase)
  mostra un prodotto già pronto: deck, [{{販売期間|はんばいきかん}}](term:term-sale-period),
  prezzo e `{{特典|とくてん}}プレイマット/プロテクト`.
:::

Nel label
[{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}](term:term-constructed-deck-purchase),
la parte che cambia la lettura è [～{{済|ず}}み](grammar:grammar-zumi).
`{{構築|こうちく}}` da solo richiama la costruzione del deck;
[{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt) aggiunge che quella costruzione
è già completata. Per questo il deck non è un progetto da montare da zero, ma
un prodotto già pronto.

- `デッキ` resta il termine di gioco per il mazzo.
- `{{購入|こうにゅう}}` apre il flusso di acquisto.
- [{{販売期間|はんばいきかん}}](term:term-sale-period) sposta l'attenzione sulla
  disponibilità commerciale: il prodotto esiste solo entro quella finestra.
- `{{特典|とくてん}}プレイマット/プロテクト` segnala bonus inclusi. `{{特典|とくてん}}`
  non è il deck principale, ma ciò che viene aggiunto come extra.

:::example_sentence
jp: >-
  {{販売期間|はんばいきかん}}を{{見|み}}てから{{構築|こうちく}}{{済|ず}}みデッキ{{購入|こうにゅう}}を{{決|き}}める。
translation_it: >-
  Guardo il periodo di vendita e poi decido se comprare il deck prebuilt.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{販売期間|はんばいきかん}}](term:term-sale-period)を{{見|み}}てから ➔
    **Controllo prima della scelta**: `てから` mette la verifica della finestra
    di vendita prima della decisione.
*   [{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt)デッキ ➔ **Deck già
    preparato**: [～{{済|ず}}み](grammar:grammar-zumi) chiude l'azione di
    costruzione come già fatta.
*   `{{購入|こうにゅう}}を{{決|き}}める` ➔ **Decisione d'acquisto**: il verbo
    `{{決|き}}める` riguarda se entrare nel flusso di acquisto, non se editare
    il mazzo.

#### ⚖️ Contrasto operativo: exchange period e sale period

*   [{{交換期間|こうかんきかん}}](term:term-exchange-period) appartiene allo
    scambio: controlla la finestra in cui puoi convertire risorse o ottenere
    una carta tramite exchange.
*   [{{販売期間|はんばいきかん}}](term:term-sale-period) appartiene alla vendita:
    controlla la finestra in cui un prodotto dello shop resta acquistabile.

Il kanji `{{期間|きかん}}` è lo stesso, ma il nome prima di `{{期間|きかん}}`
cambia la scena: [{{交換|こうかん}}](term:term-exchange) porta al flusso exchange,
`{{販売|はんばい}}` porta allo shop.

#### ⚖️ Contrasto operativo: 構築済み e deck edit

[{{構築|こうちく}}{{済|ず}}み](term:term-prebuilt) guarda a un deck già
preparato. `デッキ{{編成|へんせい}}`, invece, guarda alla composizione o modifica
del deck. Se vedi `{{済|ず}}み`, la UI sta vendendo o mostrando un prodotto già
costruito; se vedi `{{編成|へんせい}}`, ti sta portando dentro la modifica.

## 4. Deck list: ispezionare, verificare e solo alla fine iniziare

:::image
src: assets/ui/deck-list-rental.png
alt: >-
  Schermata lista deck nella sezione レンタルデッキ con preview del mazzo,
  pannello キーカード e pulsanti overview deck, verifica legend skill e avvio
  sfida.
caption: >-
  [デッキ{{一覧|いちらん}}](term:term-deck-list) è l'hub di preparazione: scegli
  un [レンタルデッキ](term:term-rental-deck), controlli
  [キーカード](term:term-key-card), [レジェンドスキル](term:term-legend-skill) e solo
  dopo arrivi a [{{対戦開始|たいせんかいし}}](term:term-start-match).
:::

[デッキ{{一覧|いちらん}}](term:term-deck-list) non nomina un mazzo singolo.
[～{{一覧|いちらん}}](grammar:grammar-ichiran) trasforma デッキ in una vista
elenco: il punto è confrontare opzioni, selezionare un deck e controllare che il
setup sia quello giusto.

Dentro questa schermata, i label separano tre funzioni:

- [レンタルデッキ](term:term-rental-deck) ti dice che il mazzo è fornito dal
  gioco. Non stai necessariamente guardando una lista costruita da te.
- [キーカード](term:term-key-card) comprime l'identità del mazzo in una carta
  rappresentativa: ti aiuta a leggere il piano del deck senza aprire tutta la
  lista.
- [レジェンドスキル](term:term-legend-skill) è un controllo di setup. Anche
  quando la schermata dice `なし`, il label ti segnala che quel contesto può
  avere regole o capacità aggiuntive.

I pulsanti finali vanno letti per verbo, non per posizione sullo schermo.
[デッキ{{概要|がいよう}}](term:term-overview) apre una panoramica;
`レジェンドスキル{{確認|かくにん}}` verifica un dettaglio;
[{{対戦開始|たいせんかいし}}](term:term-start-match) passa invece dalla
preparazione alla partita vera.

:::example_sentence
jp: >-
  デッキ{{一覧|いちらん}}でキーカードを{{確認|かくにん}}してから{{対戦開始|たいせんかいし}}を{{押|お}}す。
translation_it: >-
  Nella deck list controllo la key card e poi premo Avvia partita.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [デッキ{{一覧|いちらん}}](term:term-deck-list)で ➔ **Luogo operativo**:
    `で` marca la schermata in cui avviene il controllo.
*   [キーカード](term:term-key-card)を{{確認|かくにん}}してから ➔ **Verifica prima
    dell'avvio**: [{{確認|かくにん}}](term:term-confirm) è controllo puntuale,
    mentre `てから` lo mette prima dell'azione successiva.
*   [{{対戦開始|たいせんかいし}}](term:term-start-match)を{{押|お}}す ➔
    **Comando finale**: il bottone non apre una panoramica; avvia il match.

#### ⚖️ Contrasto operativo: 概要, 確認, 開始

*   [{{概要|がいよう}}](term:term-overview) significa panoramica: apre una vista
    riassuntiva.
*   [{{確認|かくにん}}](term:term-confirm) significa controllo: verifica un
    dettaglio o conferma uno stato.
*   `{{開始|かいし}}`, dentro
    [{{対戦開始|たいせんかいし}}](term:term-start-match), significa avvio: dopo quel
    pulsante non sei più nella sola preparazione.

#### 🧠 Gancio cognitivo

[～{{一覧|いちらん}}](grammar:grammar-ichiran) è il label da cercare quando la UI
ti fa scegliere fra molti elementi. Come trucco di memoria, pensa a "vedere in
un colpo solo": non è il contenuto scelto, è la schermata che li mette tutti
davanti a te.

## Esempi guidati di riepilogo

Le stesse forme si ricombinano quando passi dalla schermata exchange allo shop
e poi alla scelta del deck:

:::example_sentence
jp: >-
  {{限定|げんてい}}カードの{{交換期間|こうかんきかん}}は{{3月26日|さんがつにじゅうろくにち}}までなので、{{急|いそ}}いでDMポイントをあつめる。
translation_it: >-
  Il periodo di scambio della carta limitata dura fino al 26 marzo, quindi mi sbrigo a raccogliere DM Points.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  DMポイントが{{不足|ふそく}}しているので、カードを{{分解|ぶんかい}}する。
translation_it: >-
  Siccome i DM Points non bastano, smonto una carta.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{販売期間|はんばいきかん}}を{{確認|かくにん}}してから、{{構築|こうちく}}{{済|ず}}みデッキを{{購入|こうにゅう}}する。
translation_it: >-
  Controllo il periodo di vendita e poi compro il deck prebuilt.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  レンタルデッキのキーカードを{{見|み}}て、{{対戦開始|たいせんかいし}}を{{押|お}}す。
translation_it: >-
  Guardo la key card del rental deck e premo Avvia partita.
reveal_mode: sentence
:::

## Nota finale

Prima del match, la UI ti chiede di distinguere tre tipi di informazione:
[{{交換期間|こうかんきかん}}](term:term-exchange-period) e
[{{販売期間|はんばいきかん}}](term:term-sale-period) parlano di tempo,
[{{所持|しょじ}}](term:term-owned) e [{{不足|ふそく}}](term:term-shortage)
parlano di risorse, mentre
[デッキ{{一覧|いちらん}}](term:term-deck-list),
[{{概要|がいよう}}](term:term-overview),
[{{確認|かくにん}}](term:term-confirm) e
[{{対戦開始|たいせんかいし}}](term:term-start-match) ordinano le azioni sul deck:
prima guardi, poi verifichi, solo alla fine inizi la partita.
