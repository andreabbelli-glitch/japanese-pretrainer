---
id: cards-duel-masters-dm25-duel-plays-app-ui-deep-dive
media_id: media-duel-masters-dm25
slug: duel-plays-app-ui-deep-dive
title: デュエプレ - Reward, shop e schermate di setup
order: 19
segment_ref: duel-plays-app
---

:::term
id: term-present-box
lemma: プレゼントボックス
reading: ぷれぜんとぼっくす
romaji: purezento bokkusu
meaning_it: casella premi / present box
pos: screen-label
aliases: [プレゼントボックス, present box]
notes_it: >-
  È la schermata in cui si accumulano reward e oggetti già inviati al tuo
  account ma non ancora necessariamente incassati. Va distinta da
  [プレゼント](term:term-present), che è la parola-base "regalo": il composto con
  `ボックス` ti segnala una inbox concreta, non un premio generico.
level_hint: custom
:::

:::term
id: term-unclaimed
lemma: 未受け取り
reading: みうけとり
romaji: miuketori
meaning_it: non ancora riscosso / unclaimed
pos: status-label
aliases: [未受け取り, unclaimed]
notes_it: >-
  Combina [{{未|み}}～](grammar:grammar-mi-prefix) e
  [{{受け取る|うけとる}}](term:term-receive). Il senso pratico è molto preciso:
  la reward esiste già nella box, ma il claim non è ancora stato completato.
level_hint: n4
:::

:::term
id: term-claim-history
lemma: 受け取り履歴
reading: うけとりりれき
romaji: uketori rireki
meaning_it: storico delle riscossioni / claim history
pos: screen-label
aliases: [受け取り履歴, claim history]
notes_it: >-
  `{{履歴|りれき}}` indica che non stai guardando reward ancora aperte, ma lo
  storico delle operazioni già elaborate. È una schermata di controllo, non una
  coda da svuotare.
level_hint: custom
:::

:::term
id: term-bulk-claim
lemma: 一括受け取り
reading: いっかつうけとり
romaji: ikkatsu uketori
meaning_it: riscuoti tutto insieme / bulk claim
pos: ui-action
aliases: [一括受け取り, bulk claim]
notes_it: >-
  Il composto unisce `{{一括|いっかつ}}` "in blocco / in un colpo solo" e
  [{{受け取る|うけとる}}](term:term-receive). In pratica ti dice che l'app può
  elaborare più reward pendenti nello stesso gesto.
level_hint: custom
:::

:::term
id: term-claim-deadline
lemma: 受け取り期限
reading: うけとりきげん
romaji: uketori kigen
meaning_it: scadenza per il claim / claim deadline
pos: status-label
aliases: [受け取り期限, claim deadline]
notes_it: >-
  Non descrive quando hai ottenuto la reward, ma fino a quando puoi ancora
  incassarla. In UI questo label conta perché ti dice se la reward è solo
  presente o ancora riscattabile.
level_hint: custom
:::

:::term
id: term-deadline
lemma: 期限
reading: きげん
romaji: kigen
meaning_it: scadenza / termine valido
pos: noun
aliases: [期限, きげん, kigen]
notes_it: >-
  Nelle schermate reward e shop indica il limite temporale entro cui un'azione
  o un prodotto restano validi. Compare dentro composti come
  [{{受け取り期限|うけとりきげん}}](term:term-claim-deadline), ma funziona anche da
  solo: quando compare, il blocco UI sta imponendo un limite temporale.
level_hint: n4
:::

:::term
id: term-kakutoku
lemma: 獲得
reading: かくとく
romaji: kakutoku
meaning_it: ottenere / acquisire / guadagnare
pos: verbal-noun
aliases: [獲得, kakutoku]
notes_it: >-
  Nell'app compare in stringhe come `{{獲得|かくとく}}{{日時|にちじ}}` e
  `{{獲得|かくとく}}カード{{一覧|いちらん}}`. Non vuol dire soltanto "ricevere"
  in astratto: segnala che qualcosa entra nel tuo stock o nel tuo
  risultato.
level_hint: custom
:::

:::term
id: term-datetime
lemma: 日時
reading: にちじ
romaji: nichiji
meaning_it: data e ora / date-time
pos: noun
aliases: [日時, にちじ, nichiji]
notes_it: >-
  Nella UI è il dato temporale registrato in modo puntuale. In stringhe come
  `{{獲得|かくとく}}{{日時|にちじ}}`, non ti parla della scadenza ma del momento
  in cui qualcosa è stato ottenuto o registrato.
level_hint: n4
:::

:::term
id: term-stage-select
lemma: ステージ選択
reading: すてーじせんたく
romaji: suteeji sentaku
meaning_it: selezione stage / stage select
pos: screen-label
aliases: [ステージ選択, stage select]
notes_it: >-
  È la schermata in cui scegli il livello o lo stage da affrontare. Il composto
  va letto come blocco operativo: non è una descrizione narrativa, ma il punto
  in cui si definiscono costo, difficoltà e reward preview.
level_hint: custom
:::

:::term
id: term-card-pack-purchase
lemma: カードパック購入
reading: かーどぱっくこうにゅう
romaji: kaado pakku kounyuu
meaning_it: acquisto pack / card pack purchase
pos: screen-label
aliases: [カードパック購入, card pack purchase]
notes_it: >-
  Qui l'oggetto non è una carta singola ma un pack. Il label intero ti porta nel
  flusso di acquisto delle buste, con relative valute, ticket, `カード一覧` e
  [{{提供割合|ていきょうわりあい}}](term:term-offer-rate).
level_hint: custom
:::

:::term
id: term-offer-rate
lemma: 提供割合
reading: ていきょうわりあい
romaji: teikyou wariai
meaning_it: percentuali di apparizione / rates
pos: screen-label
aliases: [提供割合, ていきょうわりあい, teikyou wariai]
notes_it: >-
  È il pannello che ti fa leggere le percentuali di disponibilità delle carte in
  un pack. Va distinto da `カード{{一覧|いちらん}}`: uno ti mostra che cosa può
  uscire, l'altro con quale frequenza relativa.
level_hint: custom
:::

:::term
id: term-use
lemma: 使用
reading: しよう
romaji: shiyou
meaning_it: usare / impiegare
pos: verbal-noun
aliases: [使用, shiyou]
notes_it: >-
  Nelle schermate di conferma indica la risorsa che stai consumando per
  compiere un acquisto o un'altra operazione. Qui non vuol dire solo "usare" in
  astratto: vuol dire spendere ticket, punti o altre unità disponibili.
level_hint: n4
:::

:::term
id: term-owned-ticket
lemma: 所持チケット
reading: しょじちけっと
romaji: shoji chiketto
meaning_it: ticket posseduti / tickets currently owned
pos: resource-name
aliases: [所持チケット, owned tickets]
notes_it: >-
  Combina [{{所持|しょじ}}](term:term-owned) e
  [チケット](term:term-ticket). Non indica un tipo di ticket astratto, ma lo
  stock spendibile in quel momento in quello specifico popup o menu.
level_hint: custom
:::

:::term
id: term-purchase-quantity
lemma: 購入個数
reading: こうにゅうこすう
romaji: kounyuu kosuu
meaning_it: quantità da acquistare / purchase quantity
pos: ui-field
aliases: [購入個数, purchase quantity]
notes_it: >-
  Non parla del prezzo o del prodotto, ma solo del numero di unità che stai per
  comprare. Nelle schermate pack ti evita di confondere costo totale e quantità
  selezionata.
level_hint: custom
:::

:::term
id: term-exchange-period
lemma: 交換期間
reading: こうかんきかん
romaji: koukan kikan
meaning_it: periodo di scambio / exchange period
pos: status-label
aliases: [交換期間, exchange period]
notes_it: >-
  Il composto unisce `{{交換|こうかん}}` e `{{期間|きかん}}`. In pratica ti dice
  fino a quando quella finestra di scambio è attiva, non quanto costa la carta
  né quante volte l'hai già ottenuta.
level_hint: custom
:::

:::term
id: term-sale-period
lemma: 販売期間
reading: はんばいきかん
romaji: hanbai kikan
meaning_it: periodo di vendita / sale period
pos: status-label
aliases: [販売期間, sale period]
notes_it: >-
  È il ribbon temporale dei prodotti in vendita nello shop. Va letto come
  finestra di disponibilità commerciale: il deck o il bundle esistono, ma solo
  entro quel limite temporale.
level_hint: custom
:::

:::term
id: term-prebuilt
lemma: 構築済み
reading: こうちくずみ
romaji: kouchikuzumi
meaning_it: gia costruito / prebuilt
pos: status-label
aliases: [構築済み, こうちくずみ, kouchikuzumi]
notes_it: >-
  Ti dice che il deck o il prodotto sono già preparati e non richiedono deck
  building da zero. Per questo, dentro
  [{{構築済みデッキ購入|こうちくずみでっきこうにゅう}}](term:term-constructed-deck-purchase),
  il valore operativo è che stai guardando un prodotto pronto.
level_hint: custom
:::

:::term
id: term-constructed-deck-purchase
lemma: 構築済みデッキ購入
reading: こうちくずみでっきこうにゅう
romaji: kouchikuzumi dekki kounyuu
meaning_it: acquisto deck prebuilt / constructed deck purchase
pos: screen-label
aliases: [構築済みデッキ購入, constructed deck purchase]
notes_it: >-
  [{{構築済み|こうちくずみ}}](term:term-prebuilt) segnala che il deck è già
  preparato. Il label intero va quindi letto come acquisto di un prodotto
  prebuilt, non come schermata di editing del tuo mazzo personale.
level_hint: custom
:::

:::term
id: term-deck-list
lemma: デッキ一覧
reading: でっきいちらん
romaji: dekki ichiran
meaning_it: lista dei deck / deck list
pos: screen-label
aliases: [デッキ一覧, deck list]
notes_it: >-
  Qui [デッキ](term:term-constructed-deck) è l'oggetto e
  [～{{一覧|いちらん}}](grammar:grammar-ichiran) il formato schermata. Quindi il
  label non indica un deck singolo, ma la vista da cui li confronti e li scegli.
level_hint: custom
:::

:::term
id: term-overview
lemma: 概要
reading: がいよう
romaji: gaiyou
meaning_it: panoramica / overview
pos: screen-label
aliases: [概要, がいよう, gaiyou]
notes_it: >-
  In UI indica una schermata riassuntiva che ti fa ispezionare un contenuto in
  modo rapido. Va distinta sia da [{{確認|かくにん}}](term:term-confirm), che
  sottolinea il controllo puntuale, sia da un bottone di avvio come
  [{{対戦開始|たいせんかいし}}](term:term-start-match).
level_hint: n4
:::

:::term
id: term-key-card
lemma: キーカード
reading: きーかーど
romaji: kii kaado
meaning_it: carta chiave / key card
pos: screen-label
aliases: [キーカード, key card]
notes_it: >-
  È il pannello che mostra la carta rappresentativa del deck. Nella UI funziona
  come sintesi: il tema del mazzo è leggibile da quella carta senza aprire tutto
  l'elenco.
level_hint: custom
:::

:::term
id: term-legend-skill
lemma: レジェンドスキル
reading: れじぇんどすきる
romaji: rejendo sukiru
meaning_it: abilità leggenda / legend skill
pos: feature-label
aliases: [レジェンドスキル, legend skill]
notes_it: >-
  È un'informazione di setup nelle schermate deck o stage. Anche quando compare
  con `なし`, esplicita che in quel contesto non ci sono regole o capacità
  aggiuntive.
level_hint: custom
:::

:::term
id: term-shortage
lemma: 不足
reading: ふそく
romaji: fusoku
meaning_it: insufficienza / mancanza
pos: noun
aliases: [不足, ふそく, fusoku]
notes_it: >-
  Nei popup di shop e exchange segnala il vero blocco operativo: la risorsa non
  basta per chiudere l'azione. Ti aiuta a capire che il problema non è la carta
  o il menu, ma lo stock disponibile in quel momento.
level_hint: n4
:::

:::term
id: term-read-already
lemma: 既読
reading: きどく
romaji: kidoku
meaning_it: già letto / already read
pos: status-label
aliases: [既読, already read]
notes_it: >-
  È un label di stato che ti segnala che il contenuto testuale o narrativo è già
  stato visto. In UI questo stato spesso sblocca o giustifica
  l'opzione [スキップ](term:term-skip), soprattutto sulle scene di storia.
level_hint: custom
:::

:::term
id: term-skip
lemma: スキップ
reading: すきっぷ
romaji: sukippu
meaning_it: salta / skip
pos: ui-action
aliases: [スキップ, skip]
notes_it: >-
  È il comando che ti permette di saltare una sequenza già vista o non
  necessaria. Nelle schermate evento o storia va letto come vera scelta di
  flusso, non come dettaglio cosmetico.
level_hint: custom
:::

:::term
id: term-beginner-class
lemma: 初級
reading: しょきゅう
romaji: shokyuu
meaning_it: livello base / beginner tier
pos: difficulty-label
aliases: [初級, beginner]
notes_it: >-
  Nello stage select indica il gradino di difficoltà più basso tra quelli
  mostrati. Non va letto come "classe scolastica", ma come etichetta pratica
  per costo e livello atteso della sfida.
level_hint: n4
:::

:::term
id: term-intermediate-class
lemma: 中級
reading: ちゅうきゅう
romaji: chuukyuu
meaning_it: livello intermedio / intermediate tier
pos: difficulty-label
aliases: [中級, intermediate]
notes_it: >-
  È il livello subito sopra [{{初級|しょきゅう}}](term:term-beginner-class).
  Dentro la UI indica una sfida più impegnativa e spesso un costo d'accesso
  diverso.
level_hint: n4
:::

:::term
id: term-challenge
lemma: 挑戦
reading: ちょうせん
romaji: chousen
meaning_it: tentativo / sfida / challenge
pos: ui-action
aliases: [挑戦, challenge]
notes_it: >-
  Nelle schermate stage o evento è il verbo operativo dell'ingresso nella
  sfida. Se vedi `×2で{{挑戦|ちょうせん}}`, il messaggio concreto è che servono due
  ticket o due unità della risorsa per provare quello stage.
level_hint: custom
:::

:::card
id: card-present-box-recognition
entry_type: term
entry_id: term-present-box
card_type: recognition
front: プレゼントボックス
back: casella premi / present box
example_jp: >-
  プレゼントボックスで{{報酬|ほうしゅう}}を{{受|う}}け{{取|と}}る。
example_it: >-
  Riscuoti una reward nella present box.
notes_it: >-
  È l'inbox concreta dei premi. Se la riconosci, sai subito dove controllare
  reward in attesa, storico dei claim e scadenze di riscossione.
tags: [duel-plays, app, ui, reward]
:::

:::card
id: card-unclaimed-recognition
entry_type: term
entry_id: term-unclaimed
card_type: recognition
front: 未受け取り
back: non ancora riscosso / unclaimed
example_jp: >-
  {{未受け取り|みうけとり}}の{{報酬|ほうしゅう}}が{{2件|にけん}}ある。
example_it: >-
  Ci sono 2 reward ancora da riscuotere.
notes_it: >-
  Non dice "premio nuovo" in generale: dice che il claim è ancora aperto.
tags: [duel-plays, app, ui, status]
:::

:::card
id: card-claim-history-recognition
entry_type: term
entry_id: term-claim-history
card_type: recognition
front: 受け取り履歴
back: storico delle riscossioni / claim history
example_jp: >-
  {{受け取り履歴|うけとりりれき}}で{{昨日|きのう}}の{{報酬|ほうしゅう}}を{{確認|かくにん}}する。
example_it: >-
  Controlla nello storico la reward di ieri.
notes_it: >-
  Qui `{{履歴|りれき}}` cambia totalmente il senso della schermata: non residuo
  aperto, ma cronologia di ciò che hai già riscosso.
tags: [duel-plays, app, ui, history]
:::

:::card
id: card-bulk-claim-recognition
entry_type: term
entry_id: term-bulk-claim
card_type: recognition
front: 一括受け取り
back: riscuoti tutto insieme / bulk claim
example_jp: >-
  {{一括受け取り|いっかつうけとり}}で{{全部|ぜんぶ}}{{受|う}}け{{取|と}}る。
example_it: >-
  Riscuoti tutto in una volta.
notes_it: >-
  È un comando di velocità: ti evita il claim ripetuto voce per voce.
tags: [duel-plays, app, ui, action]
:::

:::card
id: card-claim-deadline-recognition
entry_type: term
entry_id: term-claim-deadline
card_type: recognition
front: 受け取り期限
back: scadenza del claim / claim deadline
example_jp: >-
  {{受け取り期限|うけとりきげん}}までに{{報酬|ほうしゅう}}を{{受|う}}け{{取|と}}る。
example_it: >-
  Riscuoti la reward entro la scadenza.
notes_it: >-
  Se lo leggi bene, capisci subito quanto è urgente l'incasso.
tags: [duel-plays, app, ui, time]
:::

:::card
id: card-deadline-recognition
entry_type: term
entry_id: term-deadline
card_type: recognition
front: 期限
back: scadenza / termine valido
example_jp: >-
  {{期限|きげん}}までに{{報酬|ほうしゅう}}を{{受|う}}け{{取|と}}る。
example_it: >-
  Riscuoti la reward entro la scadenza.
notes_it: >-
  È il nucleo lessicale che poi ritrovi dentro molti label più lunghi. Se lo
  riconosci, la UI sta parlando di tempo residuo.
tags: [duel-plays, app, ui, time, kanji]
:::

:::card
id: card-kakutoku-recognition
entry_type: term
entry_id: term-kakutoku
card_type: recognition
front: 獲得
back: ottenere / guadagnare
example_jp: >-
  このステージで{{100PT|ひゃくぴーてぃー}} {{獲得|かくとく}}できる。
example_it: >-
  In questo stage puoi ottenere 100 punti.
notes_it: >-
  È il verbo che lega reward, punti e carte ottenute a un risultato concreto.
  Collega il risultato finale e la preview di ciò che resta ottenibile.
tags: [duel-plays, app, ui, reward]
:::

:::card
id: card-datetime-recognition
entry_type: term
entry_id: term-datetime
card_type: recognition
front: 日時
back: data e ora / date-time
example_jp: >-
  {{獲得|かくとく}}{{日時|にちじ}}を{{確認|かくにん}}する。
example_it: >-
  Controlla la data e l'ora di ottenimento.
notes_it: >-
  Indica il momento registrato di un reward o di un risultato, non la sua
  scadenza.
tags: [duel-plays, app, ui, time, kanji]
:::

:::card
id: card-stage-select-recognition
entry_type: term
entry_id: term-stage-select
card_type: recognition
front: ステージ選択
back: selezione stage / stage select
example_jp: >-
  ステージ{{選択|せんたく}}で{{難易度|なんいど}}を{{選|えら}}ぶ。
example_it: >-
  Scegli la difficoltà nella schermata stage select.
notes_it: >-
  Qui confluiscono livello, costo, reward preview e pulsanti di ingresso.
tags: [duel-plays, app, ui, stage]
:::

:::card
id: card-card-pack-purchase-recognition
entry_type: term
entry_id: term-card-pack-purchase
card_type: recognition
front: カードパック購入
back: acquisto pack / card pack purchase
example_jp: >-
  カードパック{{購入|こうにゅう}}でチケットを{{使|つか}}う。
example_it: >-
  Usa un ticket nella schermata acquisto pack.
notes_it: >-
  `カードパック{{購入|こうにゅう}}` apre il flusso in cui spendi ticket o gemme
  per bustine. Va distinto da `カード{{購入|こうにゅう}}`, che nomina uno shop
  più ampio o altri tipi di acquisto.
tags: [duel-plays, app, ui, shop]
:::

:::card
id: card-offer-rate-recognition
entry_type: term
entry_id: term-offer-rate
card_type: recognition
front: 提供割合
back: percentuali di apparizione / rates
example_jp: >-
  {{提供割合|ていきょうわりあい}}で{{内容|ないよう}}を{{確認|かくにん}}する。
example_it: >-
  Controlla i rates e il contenuto.
notes_it: >-
  `{{提供割合|ていきょうわりあい}}` è la schermata dei drop rate: non ti dice
  che cosa fa il pack, ma con quale probabilità può contenere certe carte o
  rarità.
tags: [duel-plays, app, ui, shop]
:::

:::card
id: card-use-recognition
entry_type: term
entry_id: term-use
card_type: recognition
front: 使用
back: usare / impiegare
example_jp: >-
  {{4枚|よんまい}}を{{使用|しよう}}してパックを{{購入|こうにゅう}}する。
example_it: >-
  Usa 4 ticket per comprare i pack.
notes_it: >-
  Nelle conferme shop è il verbo che collega stock attuale e consumo reale della
  risorsa. Quando compare, l'app sta per spendere una risorsa reale.
tags: [duel-plays, app, ui, action]
:::

:::card
id: card-owned-ticket-recognition
entry_type: term
entry_id: term-owned-ticket
card_type: recognition
front: 所持チケット
back: ticket posseduti / owned tickets
example_jp: >-
  {{所持チケット|しょじちけっと}}は{{4枚|よんまい}}ある。
example_it: >-
  Hai 4 ticket disponibili.
notes_it: >-
  È lo stock immediato che il popup userà per decidere fino a dove puoi arrivare.
  Non è il nome della valuta in astratto, ma il numero spendibile adesso.
tags: [duel-plays, app, ui, resource]
:::

:::card
id: card-purchase-quantity-recognition
entry_type: term
entry_id: term-purchase-quantity
card_type: recognition
front: 購入個数
back: quantità da acquistare / purchase quantity
example_jp: >-
  {{購入個数|こうにゅうこすう}}を{{4個|よんこ}}にする。
example_it: >-
  Imposta la quantità da acquistare su 4.
notes_it: >-
  Non è il costo: è il numero di unità che stai per comprare.
tags: [duel-plays, app, ui, shop]
:::

:::card
id: card-exchange-period-recognition
entry_type: term
entry_id: term-exchange-period
card_type: recognition
front: 交換期間
back: periodo di scambio / exchange period
example_jp: >-
  {{交換期間|こうかんきかん}}は{{3月26日|さんがつにじゅうろくにち}}までだ。
example_it: >-
  Il periodo di scambio dura fino al 26 marzo.
notes_it: >-
  È il label che ti dice se quello scambio è ancora nel suo intervallo valido.
tags: [duel-plays, app, ui, time]
:::

:::card
id: card-sale-period-recognition
entry_type: term
entry_id: term-sale-period
card_type: recognition
front: 販売期間
back: periodo di vendita / sale period
example_jp: >-
  {{販売期間|はんばいきかん}}を{{見|み}}てからデッキを{{買|か}}う。
example_it: >-
  Controlla il periodo di vendita prima di comprare il deck.
notes_it: >-
  Ti dice fino a quando il prodotto resta in vendita nello shop.
tags: [duel-plays, app, ui, time]
:::

:::card
id: card-prebuilt-recognition
entry_type: term
entry_id: term-prebuilt
card_type: recognition
front: 構築済み
back: gia costruito / prebuilt
example_jp: >-
  {{構築済み|こうちくずみ}}デッキを{{買|か}}う。
example_it: >-
  Compra un deck già costruito.
notes_it: >-
  Letto da solo, chiarisce subito i label composti che lo contengono:
  l'oggetto è già pronto e non richiede deck building.
tags: [duel-plays, app, ui, deck, kanji]
:::

:::card
id: card-constructed-deck-purchase-recognition
entry_type: term
entry_id: term-constructed-deck-purchase
card_type: recognition
front: 構築済みデッキ購入
back: acquisto deck prebuilt / constructed deck purchase
example_jp: >-
  {{構築済みデッキ購入|こうちくずみでっきこうにゅう}}でコラボデッキを{{買|か}}う。
example_it: >-
  Compra un deck collaborazione nella schermata deck prebuilt.
notes_it: >-
  `{{構築済み|こうちくずみ}}` indica che il mazzo è già pronto, non da
  costruire pezzo per pezzo. Questa schermata va letta come prodotto shop, non
  come deck edit.
tags: [duel-plays, app, ui, deck]
:::

:::card
id: card-overview-recognition
entry_type: term
entry_id: term-overview
card_type: recognition
front: 概要
back: panoramica / overview
example_jp: >-
  デッキ{{概要|がいよう}}でキーカードを{{確認|かくにん}}する。
example_it: >-
  Controlla la key card nella panoramica del deck.
notes_it: >-
  Distingue i bottoni di ispezione da quelli che modificano o avviano
  un'azione.
tags: [duel-plays, app, ui, deck, kanji]
:::

:::card
id: card-deck-list-recognition
entry_type: term
entry_id: term-deck-list
card_type: recognition
front: デッキ一覧
back: lista dei deck / deck list
example_jp: >-
  デッキ{{一覧|いちらん}}からレンタルデッキを{{選|えら}}ぶ。
example_it: >-
  Scegli un rental deck dalla deck list.
notes_it: >-
  È la schermata da cui confronti mazzi e passi alla preview dettagliata. La UI
  ordina le azioni in sequenza: scelta, ispezione, poi avvio della partita.
tags: [duel-plays, app, ui, deck]
:::

:::card
id: card-shortage-recognition
entry_type: term
entry_id: term-shortage
card_type: recognition
front: 不足
back: insufficienza / mancanza
example_jp: >-
  DMポイントが{{不足|ふそく}}している。
example_it: >-
  I DM Points non sono sufficienti.
notes_it: >-
  Nei popup di blocco segnala che il problema è la risorsa disponibile.
tags: [duel-plays, app, ui, status, kanji]
:::

:::card
id: card-key-card-recognition
entry_type: term
entry_id: term-key-card
card_type: recognition
front: キーカード
back: carta chiave / key card
example_jp: >-
  キーカードを{{見|み}}てデッキの{{特徴|とくちょう}}を{{知|し}}る。
example_it: >-
  Guarda la key card per capire il carattere del deck.
notes_it: >-
  È un pannello di sintesi visiva: mostra il tema del mazzo prima di aprire
  dettagli e lista completa.
tags: [duel-plays, app, ui, deck]
:::

:::card
id: card-legend-skill-recognition
entry_type: term
entry_id: term-legend-skill
card_type: recognition
front: レジェンドスキル
back: abilità leggenda / legend skill
example_jp: >-
  レジェンドスキルがあるかを{{確認|かくにん}}する。
example_it: >-
  Controlla se c'è una legend skill.
notes_it: >-
  Anche quando vale `なし`, resta un'informazione di setup da leggere: ti dice
  esplicitamente che non ci sono regole o bonus aggiuntivi da considerare.
tags: [duel-plays, app, ui, setup]
:::

:::card
id: card-read-already-recognition
entry_type: term
entry_id: term-read-already
card_type: recognition
front: 既読
back: già letto / already read
example_jp: >-
  {{既読|きどく}}ストーリーはスキップできる。
example_it: >-
  Una scena di storia già letta può essere saltata.
notes_it: >-
  È un label di stato che giustifica un'azione successiva nella UI.
tags: [duel-plays, app, ui, status]
:::

:::card
id: card-skip-recognition
entry_type: term
entry_id: term-skip
card_type: recognition
front: スキップ
back: salta / skip
example_jp: >-
  {{既読|きどく}}のストーリーをスキップする。
example_it: >-
  Salta una scena di storia già letta.
notes_it: >-
  Va letto come comando di flusso, non come semplice decorazione del menu.
tags: [duel-plays, app, ui, action]
:::

:::card
id: card-beginner-class-recognition
entry_type: term
entry_id: term-beginner-class
card_type: recognition
front: 初級
back: livello base / beginner tier
example_jp: >-
  {{初級|しょきゅう}}をクリアしてから{{中級|ちゅうきゅう}}へ{{進|すす}}む。
example_it: >-
  Completa il livello base prima di passare a quello intermedio.
notes_it: >-
  È una difficoltà, non un'etichetta scolastica astratta.
tags: [duel-plays, app, ui, stage]
:::

:::card
id: card-intermediate-class-recognition
entry_type: term
entry_id: term-intermediate-class
card_type: recognition
front: 中級
back: livello intermedio / intermediate tier
example_jp: >-
  {{中級|ちゅうきゅう}}はチケット{{2枚|にまい}}で{{挑戦|ちょうせん}}する。
example_it: >-
  Il livello intermedio richiede 2 ticket per tentare la sfida.
notes_it: >-
  Ti prepara a un costo e a un impegno maggiori rispetto a `{{初級|しょきゅう}}`.
tags: [duel-plays, app, ui, stage]
:::

:::card
id: card-challenge-recognition
entry_type: term
entry_id: term-challenge
card_type: recognition
front: 挑戦
back: tentativo / sfida / challenge
example_jp: >-
  このステージに{{2回|にかい}}{{挑戦|ちょうせん}}する。
example_it: >-
  Tenta questo stage due volte.
notes_it: >-
  È il verbo dell'ingresso vero nella sfida, spesso collegato a un consumo di
  ticket o di altra risorsa.
tags: [duel-plays, app, ui, stage]
:::
