---
id: cards-duel-masters-dm25-live-duel-encounters-crash-hadou
media_id: media-duel-masters-dm25
slug: live-duel-encounters-crash-hadou
title: Carte incontrate in partita 1 - Crash "Hadou" e trigger del turno extra
order: 50
segment_ref: live-duel-encounters
---

:::term
id: term-crash-hadou
lemma: 勝利龍装 クラッシュ“覇道”
reading: しょうりりゅうそう くらっしゅはどう
romaji: shouri ryuusou kurasshu hadou
meaning_it: Crash Hadou / finisher che puo dare un turno extra
pos: proper-noun
aliases:
  [勝利龍装 クラッシュ“覇道”, 勝利龍装 クラッシュ覇道, クラッシュ覇道, crash hadou]
notes_it: >-
  E il nome proprio di un finisher aggressivo. Quando compare
  `クラッシュ“覇道”`, stai guardando una carta Beat Jockey che puo trasformare
  una distruzione subita da tappata in un turno extra.
level_hint: custom
:::

:::term
id: term-b-a-d-two
lemma: B・A・D 2
reading: びーえーでぃーつー
romaji: bii ei dii tsuu
meaning_it: keyword che fa scendere la creatura con costo ridotto di 2
pos: keyword
aliases: [B・A・D 2, BAD 2, bii ei dii tsuu]
notes_it: >-
  `B・A・D` abbrevia una riduzione del costo di evocazione seguita da
  auto-distruzione a fine turno. In `B・A・D 2` il numero dice di quanto il
  costo puo scendere, quindi la keyword comunica insieme velocita di ingresso e
  limite temporale della carta.
level_hint: custom
:::

:::term
id: term-speed-attacker
lemma: スピードアタッカー
reading: すぴーどあたっかー
romaji: supiido atakkaa
meaning_it: puo attaccare subito nel turno in cui entra
pos: keyword
aliases: [スピードアタッカー, speed attacker, supiido atakkaa]
notes_it: >-
  Il testo tecnico `{{召喚酔|しょうかんよ}}いしない` dice che la creatura puo
  attaccare nello stesso turno in cui entra. Su una carta aggressiva questo
  trasforma subito il corpo in pressione.
level_hint: custom
:::

:::term
id: term-dragonguild
lemma: ドラゴンギルド
reading: どらごんぎるど
romaji: doragon girudo
meaning_it: Dragon Guild / razza-famiglia di carte
pos: noun
aliases: [ドラゴンギルド, doragon girudo, Dragon Guild]
notes_it: >-
  Compare nella riga `種族`, quindi indica una razza e non un titolo narrativo.
  In partita questo decide i bersagli validi: se un effetto cerca una carta
  `ドラゴンギルド`, questa carta puo essere scelta.
level_hint: custom
:::

:::term
id: term-beat-jockey
lemma: ビートジョッキー
reading: びーとじょっきー
romaji: biito jokkii
meaning_it: Beat Jockey / razza aggressiva di fuoco
pos: noun
aliases: [ビートジョッキー, biito jokkii, Beat Jockey]
notes_it: >-
  E una razza aggressiva legata al fuoco. Su questa carta si accompagna bene a
  riduzione di costo e attacco immediato; quando un effetto richiede
  `ビートジョッキー`, questa carta soddisfa il filtro di razza.
level_hint: custom
:::

:::term
id: term-tap-state
lemma: タップ状態
reading: たっぷじょうたい
romaji: tappu joutai
meaning_it: stato tapped / in stato di tap
pos: noun
aliases: [タップ状態, tappu joutai]
notes_it: >-
  `状態` trasforma [タップ](term:term-tap) da azione a condizione della carta.
  Nel trigger di Crash Hadou conta proprio questo stato gia presente al momento
  della distruzione.
level_hint: custom
:::

:::term
id: term-battle
lemma: バトル
reading: ばとる
romaji: batoru
meaning_it: battle / scontro diretto
pos: noun
aliases: [バトル, batoru]
notes_it: >-
  Nel rules text non va confuso con l'attacco in generale. In frasi come
  `バトル中`, delimita la finestra dello scontro, cioe il momento in cui i
  valori di forza contano davvero nel combattimento.
level_hint: custom
:::

:::term
id: term-add-turn
lemma: ターンを追加する
reading: たーんをついかする
romaji: taan o tsuika suru
meaning_it: aggiungere un turno / ottenere un turno extra
pos: verb
aliases: [ターンを追加する, 追加する, taan o tsuika suru]
notes_it: >-
  Qui `追加する` si applica a `ターン` e produce davvero un turno extra. La frase
  intera descrive un cambiamento nell'ordine dei turni, non un'aggiunta
  generica.
level_hint: custom
:::

:::grammar
id: grammar-sareta-toki
pattern: ～された時
title: Trigger passivo su cio che subisce la carta
reading: されたとき
meaning_it: quando viene X / quando subisce X
aliases: [された時]
notes_it: >-
  Nel rules text questa forma passiva sposta il focus sull'evento subito dalla
  carta. In `破壊された時`, il punto non e chi distrugge, ma il fatto che questa
  creatura venga distrutta e che da li parta il trigger.
level_hint: custom
:::

:::grammar
id: grammar-no-ato-ni
pattern: ～の後に
title: Subito dopo questo punto
reading: のあとに
meaning_it: dopo / subito dopo
aliases: [の後に]
notes_it: >-
  In carte come `このターンの後に`, non descrive un futuro vago: inserisce un
  evento preciso subito dopo la finestra appena nominata. Qui serve a capire
  esattamente quando entra il turno extra.
level_hint: n4
:::

:::card
id: card-crash-hadou-recognition
entry_type: term
entry_id: term-crash-hadou
card_type: recognition
front: '{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}'
back: Crash Hadou / finisher con turno extra
example_jp: >-
  {{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}が
  タップ{{状態|じょうたい}}で{{破壊|はかい}}されると、
  {{追加|ついか}}ターンが{{入|はい}}る。
example_it: >-
  Se Crash Hadou viene distrutto da tappato, entra un turno extra.
notes_it: >-
  `クラッシュ“覇道”` va riconosciuto come nome proprio; su questa carta quel nome
  coincide con un finisher che puo convertire una distruzione da tappato in
  turno extra.
tags: [live-duel, proper-name, extra-turn]
:::

:::card
id: card-b-a-d-two-recognition
entry_type: term
entry_id: term-b-a-d-two
card_type: recognition
front: B・A・D 2
back: keyword con riduzione di costo di 2
example_jp: >-
  B・A・D 2だから、このカードは{{想像|そうぞう}}より{{早|はや}}く{{出|で}}てくる。
example_it: >-
  Con B.A.D 2 questa carta puo scendere prima di quanto sembri.
notes_it: >-
  `B・A・D 2` non e una sigla decorativa: riassume una riduzione di costo di `2`
  e il fatto che la creatura verra distrutta a fine turno se hai usato quella
  riduzione.
tags: [live-duel, keyword, cost]
:::

:::card
id: card-speed-attacker-recognition
entry_type: term
entry_id: term-speed-attacker
card_type: recognition
front: スピードアタッカー
back: puo attaccare subito
example_jp: >-
  スピードアタッカーなので、{{出|で}}たターンにすぐ
  {{攻撃|こうげき}}できる。
example_it: >-
  Siccome ha Speed Attacker, puo attaccare subito nel turno in cui entra.
notes_it: >-
  Questa keyword dice che la creatura puo passare subito all'attacco invece di
  aspettare il turno successivo.
tags: [live-duel, keyword, attack]
:::

:::card
id: card-dragonguild-recognition
entry_type: term
entry_id: term-dragonguild
card_type: recognition
front: ドラゴンギルド
back: Dragon Guild / razza della carta
example_jp: >-
  このカードの{{種族|しゅぞく}}にはドラゴンギルドが{{入|はい}}っている。
example_it: >-
  Tra le razze di questa carta c'e Dragon Guild.
notes_it: >-
  `ドラゴンギルド` e la razza letta nella riga `種族`; percio puo comparire in
  sinergie, filtri o riferimenti tribali.
tags: [live-duel, race, tribe]
:::

:::card
id: card-beat-jockey-recognition
entry_type: term
entry_id: term-beat-jockey
card_type: recognition
front: ビートジョッキー
back: Beat Jockey / razza aggressiva di fuoco
example_jp: >-
  ビートジョッキーらしく、{{速|はや}}い{{展開|てんかい}}を{{支|ささ}}える。
example_it: >-
  Da buon Beat Jockey, sostiene un piano di gioco veloce.
notes_it: >-
  `ビートジョッキー` segnala una razza aggressiva. Qui si combina con
  riduzione di costo e attacco immediato; inoltre rende la carta bersaglio
  valido quando il testo richiede `ビートジョッキー`.
tags: [live-duel, race, aggression]
:::

:::card
id: card-tap-state-recognition
entry_type: term
entry_id: term-tap-state
card_type: recognition
front: 'タップ{{状態|じょうたい}}'
back: stato tapped
example_jp: >-
  タップ{{状態|じょうたい}}でいたら、その{{条件|じょうけん}}を{{満|み}}たす。
example_it: >-
  Se era in stato tapped, soddisfa quella condizione.
notes_it: >-
  Qui conta il composto completo: non l'azione di tap in astratto, ma lo stato
  in cui la carta si trova quando il gioco controlla il trigger.
tags: [live-duel, state, trigger]
:::

:::card
id: card-battle-recognition
entry_type: term
entry_id: term-battle
card_type: recognition
front: バトル
back: battle / scontro diretto
example_jp: >-
  バトル{{中|ちゅう}}は、このクリーチャーのパワーが{{上|あ}}がる。
example_it: >-
  Durante il battle, il potere di questa creatura sale.
notes_it: >-
  In `バトル中` bonus e modifiche valgono solo nella finestra dello scontro.
  Fuori da quel momento, lo stesso testo non cambia il combattimento.
tags: [live-duel, combat, timing]
:::

:::card
id: card-add-turn-recognition
entry_type: term
entry_id: term-add-turn
card_type: recognition
front: 'ターンを{{追加|ついか}}する'
back: aggiungere un turno / ottenere un turno extra
example_jp: >-
  このターンの{{後|あと}}に{{自分|じぶん}}のターンを{{追加|ついか}}する。
example_it: >-
  Dopo questo turno, aggiungi un tuo turno.
notes_it: >-
  La frase intera dice che ottieni un turno extra subito dopo quello attuale.
  `追加する` da solo non basta a esprimere questa idea.
tags: [live-duel, turn-order, payoff]
:::

:::card
id: card-sareta-toki-concept
entry_type: grammar
entry_id: grammar-sareta-toki
card_type: concept
front: '～された{{時|とき}}'
back: quando viene X / quando subisce X
example_jp: >-
  このクリーチャーが{{破壊|はかい}}された{{時|とき}}、
  {{追加|ついか}}ターンが{{発生|はっせい}}する。
example_it: >-
  Quando questa creatura viene distrutta, si genera il turno extra.
notes_it: >-
  Il passivo indica l'evento subito dalla carta. In `破壊された時` il trigger
  parte dal fatto che la creatura viene distrutta, non da chi la distrugge.
tags: [live-duel, grammar, passive]
:::

:::card
id: card-no-ato-ni-concept
entry_type: grammar
entry_id: grammar-no-ato-ni
card_type: concept
front: '～の{{後|あと}}に'
back: dopo / subito dopo
example_jp: >-
  このターンの{{後|あと}}に{{自分|じぶん}}のターンを{{追加|ついか}}する。
example_it: >-
  Dopo questo turno, aggiungi un tuo turno.
notes_it: >-
  Qui delimita il punto esatto in cui il nuovo turno entra nella sequenza. Non
  e un "poi" generico, ma un aggancio molto preciso nell'ordine del turno.
tags: [live-duel, grammar, timing]
:::

:::card
id: card-crash-hadou-extra-turn-trigger-concept
entry_type: grammar
entry_id: grammar-sareta-toki
card_type: concept
front: >-
  タップ{{状態|じょうたい}}で{{破壊|はかい}}された{{時|とき}}、このターンの{{後|あと}}に
  {{自分|じぶん}}のターンを{{追加|ついか}}する
back: >-
  Se viene distrutta da tappata, dopo questo turno ne aggiungi uno tuo.
example_jp: >-
  タップ{{状態|じょうたい}}で{{破壊|はかい}}された{{時|とき}}だけ、
  {{追加|ついか}}ターンが{{発生|はっせい}}する。
example_it: >-
  Il turno extra parte solo quando la creatura viene distrutta mentre e tappata.
notes_it: >-
  Questa card unisce nello stesso chunk tre cose che vale la pena leggere in
  un colpo solo: stato gia presente, trigger passivo e inserimento del nuovo
  turno subito dopo quello corrente.
tags: [live-duel, chunk, extra-turn, grammar]
:::
