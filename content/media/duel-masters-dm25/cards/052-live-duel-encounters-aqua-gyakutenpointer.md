---
id: cards-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
media_id: media-duel-masters-dm25
slug: live-duel-encounters-aqua-gyakutenpointer
title: Carte incontrate in partita 31 - Aqua Gyakutenpointer, 最大 e このようにして
order: 80
segment_ref: live-duel-encounters
---

:::term
id: term-saidai
lemma: 最大
reading: さいだい
romaji: saidai
meaning_it: massimo / al massimo / fino a quel limite
pos: noun
aliases: [最大, さいだい, saidai]
notes_it: >-
  In giapponese generale `{{最大|さいだい}}` può essere sia `il massimo` come
  sostantivo sia `massimo` come estremo superiore. Nel rules text di Duel
  Masters, davanti a un numero, va quasi sempre letto come `al massimo`. In
  `{{最大|さいだい}}{{1体|いったい}}ずつ{{選|えら}}び`, il testo non impone di
  scegliere una creatura per forza: ti concede di arrivare fino a una per ogni
  giocatore.
level_hint: n3
:::

:::grammar
id: grammar-konoyounishite
pattern: このようにして
title: In questo modo / tramite questa procedura
reading: このようにして
meaning_it: così / in questo modo / tramite quanto appena fatto
aliases: [このようにして]
notes_it: >-
  In giapponese generale `このようにして` riprende un procedimento o uno stato
  appena descritto e costruisce il passo che ne deriva. Nel rules text è molto
  utile perché evita di riscrivere tutta la procedura precedente. Qui rimanda
  alla scelta delle creature e al loro ritorno in fondo al mazzo; la frase
  successiva vale solo per i giocatori coinvolti proprio in quel modo.
level_hint: n3
:::

:::grammar
id: grammar-erabareta-player
pattern: 自身のクリーチャーが選ばれたプレイヤーは
title: Il giocatore di cui è stata scelta una propria creatura
reading: じしんのクリーチャーがえらばれたプレイヤーは
meaning_it: quanto al giocatore di cui è stata scelta una propria creatura
aliases: [選ばれたプレイヤー, 自身のクリーチャーが選ばれたプレイヤーは]
notes_it: >-
  Il blocco decisivo è `{{選|えら}}ばれた`, passivo di
  [{{選|えら}}ぶ](term:term-erabu). Qui non stai leggendo `il giocatore scelto`
  o `il giocatore che ha scelto`, ma una relativa più lunga: `il giocatore di
  cui è stata scelta una propria creatura`. `{{自身|じしん}}` resta ancorato a
  quel giocatore e ti impedisce di scivolare su un referente esterno.
level_hint: n3
:::

:::grammar
id: grammar-deru-made-omotemuki-ni-shi
pattern: クリーチャーが出るまで表向きにし
title: Girare carte a faccia in su finché non esce una creatura
reading: くりーちゃーがでるまでおもてむきにし
meaning_it: gira carte a faccia in su finché non compare una creatura
aliases: [クリーチャーが出るまで表向きにし, 表向きにし]
notes_it: >-
  Questo chunk unisce due cose. `まで` fissa il punto di arresto: continui
  fino all'apparizione di una creatura. `{{表向|おもてむ}}きにし` viene invece da
  `{{表向|おもてむ}}きにする` e qui usa la forma connettiva in `し` per passare
  direttamente al passo successivo `そのクリーチャーを{{出|だ}}す`. Non è uno
  `shi` vago o sospeso: è una giunzione operativa della procedura.
level_hint: n3
:::

:::card
id: card-saidai-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
entry_type: term
entry_id: term-saidai
card_type: recognition
front: '{{最大|さいだい}}'
back: massimo / al massimo / fino a quel limite
example_jp: >-
  この{{効果|こうか}}で{{最大|さいだい}}{{2体|にたい}}の
  クリーチャーを{{選|えら}}ぶ。
example_it: >-
  Con questo effetto scegli al massimo due creature.
notes_it: >-
  In questa carta il valore utile è pratico: `{{最大|さいだい}}` non ordina di
  riempire il numero che segue, ma apre un tetto massimo.
tags: [live-duel, term, quantity, limit]
:::

:::card
id: card-saidai-ittai-zutsu-erabi-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
entry_type: term
entry_id: term-saidai
card_type: concept
front: '{{最大|さいだい}}{{1体|いったい}}ずつ{{選|えら}}び'
back: scegli al massimo una creatura per ciascun giocatore
example_jp: >-
  [{{各|かく}}](term:term-kaku)プレイヤーの[クリーチャー](term:term-creature)を
  {{最大|さいだい}}{{1体|いったい}}ずつ{{選|えら}}ぶ。
example_it: >-
  Scegli al massimo una creatura per ciascun giocatore.
notes_it: >-
  Qui `最大` lavora insieme alla quantita' indicata e fissa un tetto. Il numero viene distribuito separatamente su
  ogni giocatore e resta facoltativo entro quel limite.
tags: [live-duel, concept, quantity, distribution]
:::

:::card
id: card-konoyounishite-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
entry_type: grammar
entry_id: grammar-konoyounishite
card_type: concept
front: このようにして
back: in questo modo / tramite questa procedura
example_jp: >-
  {{各|かく}}プレイヤーがクリーチャーを{{1体|いったい}}ずつ{{選|えら}}ぶ。
  このようにして{{選|えら}}ばれたクリーチャーを{{山札|やまふだ}}に{{戻|もど}}す。
example_it: >-
  Ogni giocatore sceglie una creatura; rimetti nel mazzo le creature scelte in questo modo.
notes_it: >-
  In Aqua Gyakutenpointer questo chunk evita una ripetizione lunga: il testo
  dice `in questo modo` e restringe la seconda metà dell'effetto solo ai
  giocatori toccati dalla scelta precedente.
tags: [live-duel, grammar, procedure, reference]
:::

:::card
id: card-erabareta-player-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
entry_type: grammar
entry_id: grammar-erabareta-player
card_type: concept
front: '{{自身|じしん}}のクリーチャーが{{選|えら}}ばれたプレイヤーは'
back: quanto al giocatore di cui è stata scelta una propria creatura
example_jp: >-
  {{自身|じしん}}の[クリーチャー](term:term-creature)が{{選|えら}}ばれたプレイヤーは、
  カードを{{1枚|いちまい}}{{引|ひ}}く。
example_it: >-
  Il giocatore di cui è stata scelta una creatura pesca una carta.
notes_it: >-
  Questo è il chunk giusto da fissare se `選ばれた` ti confonde. La forma
  passiva serve da etichetta relativa e costruisce `il giocatore per cui è
  stata scelta una propria creatura`, non `chi ha fatto la scelta`.
tags: [live-duel, grammar, passive, relative-clause]
:::

:::card
id: card-deru-made-omotemuki-ni-shi-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
entry_type: grammar
entry_id: grammar-deru-made-omotemuki-ni-shi
card_type: concept
front: 'クリーチャーが{{出|で}}るまで{{表向|おもてむ}}きにし'
back: gira carte a faccia in su finché non compare una creatura
example_jp: >-
  {{山札|やまふだ}}の{{上|うえ}}から、クリーチャーが{{出|で}}るまで
  カードを{{表向|おもてむ}}きにし、そのクリーチャーを{{出|だ}}す。
example_it: >-
  Gira carte dalla cima del mazzo finché non compare una creatura, poi mettila in gioco.
notes_it: >-
  Questo è il chunk da memorizzare intero. `まで` fissa il punto in cui fermarsi
  e `し` tiene aperta la procedura fino all'uscita della creatura rivelata.
tags: [live-duel, grammar, procedure, reveal]
:::
