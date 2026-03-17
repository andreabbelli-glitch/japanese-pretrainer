---
id: cards-duel-masters-dm25-dm25-sd1-core
media_id: media-duel-masters-dm25
slug: dm25-sd1-core
title: DM25-SD1 - Nomi e lessico dell'asse Abyss
order: 30
segment_ref: mazzo-abyss
---

:::term
id: term-abyss-royal
lemma: アビスロイヤル
reading: あびすろいやる
romaji: abisuroiyaru
meaning_it: tribu Abyss Royal
pos: noun
aliases: [アビスロイヤル, abyss royal]
notes_it: >-
  È una linea di [{{種族|しゅぞく}}](term:term-race) decisiva per leggere bene `DM25-SD1`.
  Quando compare, non aggiunge solo "lore" al nome della carta: restringe in
  modo concreto quali carte il mazzo può recuperare, mettere in campo o
  premiare.
level_hint: custom
:::

:::term
id: term-abyssbell-jashintei
lemma: アビスベル=ジャシン帝
reading: あびすべるじゃしんてい
romaji: abisuberu jashintei
meaning_it: Abyssbell Jashin Emperor / finisher dell'asse Abyss
pos: proper-noun
aliases: [アビスベル=ジャシン帝, ジャシン帝, abisuberu jashintei]
notes_it: >-
  `ジャシン` marca il sottoblocco lessicale dell'asse Abyss e `帝` segnala un
  pezzo di vertice. Quando la stringa compare in riferimenti o regole di carta,
  identifica un payoff ad alta pressione che trasforma vantaggio di board in
  chiusura della partita.
level_hint: custom
:::

:::term
id: term-jashinnyuu
lemma: 邪侵入
reading: じゃしんにゅう
romaji: jashinnyuu
meaning_it: Jashinnyuu / magia chiave dell'asse Abyss
pos: proper-noun
aliases: [邪侵入, じゃしんにゅう, jashinnyuu]
notes_it: >-
  Il nome mette insieme `邪`, che richiama l'asse oscuro del mazzo, e
  `侵入`, cioè "irruzione / ingresso forzato". Sul piano operativo segnala una
  linea che porta un Abyss in campo senza passare da un normale sviluppo dalla
  mano, aumentando la pressione immediata.
level_hint: custom
:::

:::term
id: term-jablood
lemma: ジャブラッド
reading: じゃぶらっど
romaji: jaburaddo
meaning_it: Jablood / creatura simbolo del deck
pos: proper-noun
aliases: [ジャブラッド, jaburaddo]
notes_it: >-
  In `DM25-SD1` ricorre tra i pezzi che tengono insieme il piano Abyss. Nel
  parsing va trattato come nome-proprio di ruolo: non descrive un effetto con
  lessico trasparente, ma indica un nodo funzionale ricorrente del deck.
level_hint: custom
:::

:::card
id: card-abyss-royal-recognition
entry_type: term
entry_id: term-abyss-royal
card_type: recognition
front: アビスロイヤル
back: tribu Abyss Royal
example_jp: >-
  コスト{{4以下|よんいか}}のアビスロイヤルを{{1体|いったい}} {{出|だ}}してもよい。
example_it: >-
  Puoi mettere in gioco 1 Abyss Royal di costo 4 o inferiore.
notes_it: >-
  Se lo vedi in una frase, trattalo come filtro operativo di
  [{{種族|しゅぞく}}](term:term-race). In `DM25-SD1` non basta leggere "Abyss": spesso la
  carta vuole proprio la sottofamiglia corretta.
tags: [dm25-sd1, abyss, tribe]
:::

:::card
id: card-abyssbell-jashintei-recognition
entry_type: term
entry_id: term-abyssbell-jashintei
card_type: recognition
front: 'アビスベル=ジャシン{{帝|てい}}'
back: Abyssbell Jashin Emperor
example_jp: >-
  {{アビスベル=ジャシン帝|あびすべるじゃしんてい}}で{{攻撃|こうげき}}して{{勝負|しょうぶ}}を{{決|き}}める。
example_it: >-
  Attacca con Abyssbell Jashin Emperor per chiudere la partita.
notes_it: >-
  La stringa completa identifica un riferimento di carta specifico, non una
  categoria generica. Nel flusso di gioco segnala il payoff principale del
  blocco Abyss e quindi un asse di chiusura della partita.
tags: [dm25-sd1, abyss, proper-name]
:::

:::card
id: card-jashinnyuu-recognition
entry_type: term
entry_id: term-jashinnyuu
card_type: recognition
front: '{{邪侵入|じゃしんにゅう}}'
back: Jashinnyuu
example_jp: >-
  {{邪侵入|じゃしんにゅう}}で{{墓地|ぼち}}からアビスを{{出|だ}}す。
example_it: >-
  Usa Jashinnyuu per mettere in gioco un Abyss dal cimitero.
notes_it: >-
  Forma compatta legata a una magia che converte risorse dal
  [{{墓地|ぼち}}](term:term-graveyard) in presenza immediata sul campo. La lettura corretta
  separa subito nome della carta e risultato pratico dell'effetto.
tags: [dm25-sd1, abyss, spell-name]
:::

:::card
id: card-jablood-recognition
entry_type: term
entry_id: term-jablood
card_type: recognition
front: ジャブラッド
back: Jablood
example_jp: >-
  ジャブラッドを{{出|だ}}して{{攻撃|こうげき}}の{{準備|じゅんび}}をする。
example_it: >-
  Metti in gioco Jablood e prepara l'attacco.
notes_it: >-
  Nome proprio ricorrente dell'asse Abyss. Quando compare nel testo o nella
  lista, identifica un pezzo che partecipa al passaggio da setup a pressione di
  combattimento.
tags: [dm25-sd1, abyss, proper-name]
:::

:::term
id: term-abyss-rush
lemma: アビスラッシュ
reading: あびすらっしゅ
romaji: abisurasshu
meaning_it: Abyss Rush / keyword di permanenza e rilancio
pos: keyword
aliases: [アビスラッシュ, abisurasshu, abyss rush]
notes_it: >-
  È una keyword dell'asse Abyss che comprime una regola di sostituzione:
  quando la creatura sta per [{{離|はな}}れる](term:term-hanareru), puoi tenere il corpo
  in gioco pagando un costo alternativo, spesso scartando carte. In partita
  cambia l'esito di una rimozione: la perdita di board viene convertita in
  consumo di mano.
level_hint: custom
:::

:::term
id: term-civil-count
lemma: シビルカウント
reading: しびるかうんと
romaji: shibiru kaunto
meaning_it: Civil Count / soglia basata su un totale di costi
pos: keyword
aliases: [シビルカウント, shibiru kaunto, civil count]
notes_it: >-
  Introduce un conteggio-soglia: dopo il numero devi cercare quale totale il
  testo sta sommando davvero. In `DM25-SD1` non conta quante carte hai, ma il
  costo totale delle carte di una certa civiltà. È quindi una keyword che va
  letta insieme a [{{合計|ごうけい}}](term:term-goukei) e a un filtro come `{{3以上|さんいじょう}}`.
level_hint: custom
:::

:::term
id: term-attack-target
lemma: 攻撃先
reading: こうげきさき
romaji: kougekisaki
meaning_it: bersaglio dell'attacco
pos: noun
aliases: [攻撃先, こうげきさき, kougekisaki]
notes_it: >-
  È la destinazione concreta di un attacco. Compare in frasi come
  `{{攻撃先|こうげきさき}}を{{変更|へんこう}}する`, dove il testo non sta
  aggiungendo un effetto vago: sta davvero riassegnando dove va l'attacco.
level_hint: custom
:::

:::term
id: term-tobasu
lemma: とばす
reading: とばす
romaji: tobasu
meaning_it: saltare / far passare / skip
pos: godan-verb
aliases: [とばす, 飛ばす, tobasu]
notes_it: >-
  In Duel Masters compare spesso in formule brevi ma molto forti come
  `そのターンの{{残|のこ}}りをとばす`. Qui non parla di movimento fisico: vuol
  dire far saltare una porzione del turno o della sequenza. Sul piano del
  gameplay cancella le azioni residue disponibili in quel turno.
level_hint: custom
:::

:::grammar
id: grammar-nikai-okonau
pattern: ～を{{2回|にかい}}{{行|おこな}}う
title: Ripetere due volte lo stesso effetto
reading: にかいおこなう
meaning_it: esegui questo due volte
aliases: [2回行う, これを2回行う]
notes_it: >-
  È una formula compatta del rules text: invece di riscrivere l'effetto una
  seconda volta, la carta ti dice di eseguire di nuovo il blocco appena letto.
  Quando compare, la risoluzione avviene due volte in sequenza e l'impatto sul
  board viene raddoppiato secondo lo stesso testo.
level_hint: custom
:::

:::card
id: card-abyss-rush-recognition
entry_type: term
entry_id: term-abyss-rush
card_type: recognition
front: アビスラッシュ
back: Abyss Rush
example_jp: >-
  アビスラッシュ：このクリーチャーが{{離|はな}}れる{{時|とき}}、かわりに
  {{自分|じぶん}}の{{手札|てふだ}}を{{2枚|にまい}}{{捨|す}}ててもよい。
example_it: >-
  Abyss Rush: quando questa creatura sta per lasciare il campo, puoi invece
  scartare 2 carte dalla tua mano.
notes_it: >-
  Questa keyword applica una sostituzione con [{{離|はな}}れる](term:term-hanareru) +
  [かわりに](grammar:grammar-kawarini): invece di uscire dal campo, la creatura
  resta in gioco pagando il costo richiesto.
tags: [dm25-sd1, abyss, keyword]
:::

:::card
id: card-civil-count-recognition
entry_type: term
entry_id: term-civil-count
card_type: recognition
front: シビルカウント
back: Civil Count
example_jp: >-
  シビルカウント{{3|さん}}：{{自分|じぶん}}の{{闇|やみ}}のカードのコストの
  {{合計|ごうけい}}が{{3以上|さんいじょう}}であれば、このクリーチャーの
  「S・トリガー」を{{使|つか}}ってもよい。
example_it: >-
  Civil Count 3: se la somma dei costi delle tue carte oscurità è 3 o più, puoi
  usare l'S-Trigger di questa creatura.
notes_it: >-
  Il numero non basta: la soglia controlla un totale di costi specifico. Se il
  totale richiesto è raggiunto, l'abilita si attiva; se non è raggiunto,
  l'effetto resta bloccato.
tags: [dm25-sd1, keyword, threshold]
:::

:::card
id: card-attack-target-recognition
entry_type: term
entry_id: term-attack-target
card_type: recognition
front: '{{攻撃先|こうげきさき}}'
back: bersaglio dell'attacco
example_jp: >-
  そのクリーチャーに{{攻撃先|こうげきさき}}を{{変更|へんこう}}する。
example_it: >-
  Cambia il bersaglio dell'attacco a quella creatura.
notes_it: >-
  `{{攻撃先|こうげきさき}}を{{変更|へんこう}}する` riassegna un attacco già
  dichiarato a un nuovo bersaglio. In combattimento cambia direttamente quale
  lato subisce l'esito dell'attacco.
tags: [dm25-sd1, combat, target]
:::

:::card
id: card-tobasu-recognition
entry_type: term
entry_id: term-tobasu
card_type: recognition
front: とばす
back: saltare / skip
example_jp: >-
  {{相手|あいて}}は、そのターンの{{残|のこ}}りをとばす。
example_it: >-
  L'avversario salta il resto di quel turno.
notes_it: >-
  In questa frase `とばす` tronca il turno avversario: dopo la risoluzione, il
  resto delle azioni di quel turno non viene più eseguito.
tags: [dm25-sd1, timing, control]
:::

:::card
id: card-nikai-okonau-recognition
entry_type: grammar
entry_id: grammar-nikai-okonau
card_type: recognition
front: '～を{{2回|にかい}}{{行|おこな}}う'
back: esegui questo due volte
example_jp: >-
  {{相手|あいて}}のクリーチャー{{1体|いったい}}のパワーを
  `{{-4000|マイナスよんせん}}`する。これを
  {{2回|にかい}}{{行|おこな}}う。
example_it: >-
  Dai `-4000` a 1 creatura dell'avversario. Esegui questo due volte.
notes_it: >-
  Non ripete il testo da capo: fa rieseguire lo stesso blocco subito dopo la
  prima risoluzione. In partita significa applicare due volte lo stesso effetto
  sul board.
tags: [dm25-sd1, grammar, repetition]
:::
