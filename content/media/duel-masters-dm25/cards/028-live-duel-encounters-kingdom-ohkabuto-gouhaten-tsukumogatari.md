---
id: cards-duel-masters-dm25-live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari
media_id: media-duel-masters-dm25
slug: live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari
title: Carte incontrate in partita 8 - Kingdom Ohkabuto / Gouhaten Tsukumogatari e lo scope di これら
order: 57
segment_ref: live-duel-encounters
---

:::term
id: term-kingdom-ohkabuto
lemma: キングダム・オウ禍武斗
reading: きんぐだむ おうかぶと
romaji: kingudamu oukabuto
meaning_it: Kingdom Ohkabuto / lato creatura della twinpact naturale
pos: proper-noun
aliases:
  [キングダム・オウ禍武斗, キングダム・オウカブト, kingdom ohkabuto]
notes_it: >-
  È il nome proprio del lato creatura di una singola
  [ツインパクトカード](term:term-twinpact-card). Quando compare
  `キングダム・オウ{{禍武斗|かぶと}}`, il blocco utile da associare è doppio:
  restrizione sugli attaccanti sotto `{{9000|きゅうせん}}` potere e trigger di
  vittoria in battle che rompe `{{9|ここの}}つ` scudi.
level_hint: custom
:::

:::term
id: term-gouhaten-tsukumogatari
lemma: 轟破天九十九語
reading: ごうはてんつくもがたり
romaji: gouhaten tsukumogatari
meaning_it: Gouhaten Tsukumogatari / lato spell che mette in campo dalla mana zone quante creature vuoi e ignora gli effetti d'ingresso
pos: proper-noun
aliases:
  [轟破天九十九語, ごうはてんつくもがたり, gouhaten tsukumogatari]
notes_it: >-
  È il nome proprio del lato spell della stessa twinpact. Quando leggi
  `{{轟破天九十九語|ごうはてんつくもがたり}}`, la parte importante non è solo la
  messa in campo massiccia ma soprattutto lo scope finale:
  [これら](term:term-kore-ra) / [ことによって](grammar:grammar-koto-ni-yotte)
  / [{{無視|むし}}する](term:term-mushi-suru).
level_hint: custom
:::

:::term
id: term-mach-fighter
lemma: マッハファイター
reading: まっはふぁいたー
romaji: mahha faitaa
meaning_it: Mach Fighter / può attaccare creature tapped o untapped nel turno in cui entra
pos: keyword
aliases: [マッハファイター, Mach Fighter, mahha faitaa]
notes_it: >-
  È una keyword offensiva ma va letta anche come informazione di targeting.
  `マッハファイター` non dice solo `attacca subito`: specifica che nel turno
  d'ingresso la creatura può colpire creature tapped o untapped.
level_hint: custom
:::

:::term
id: term-suki-na-kazu
lemma: 好きな数
reading: すきなかず
romaji: suki na kazu
meaning_it: il numero che preferisci / quanti ne vuoi
pos: noun
aliases: [好きな数, すきなかず]
notes_it: >-
  È un chunk molto utile nei testi che ti lasciano scegliere la quantità.
  In `クリーチャーを{{好|す}}きな{{数|かず}}`, il rules text non ti sta dicendo
  solo che puoi scegliere creature: ti lascia decidere quanti pezzi spostare
  in quella risoluzione.
level_hint: n4
:::

:::term
id: term-kore-ra
lemma: これら
reading: これら
romaji: korera
meaning_it: questi / questo gruppo appena menzionato
pos: pronoun
aliases: [これら, korera]
notes_it: >-
  È un dimostrativo plurale che chiude un gruppo già nominato. Su
  `{{轟破天九十九語|ごうはてんつくもがたり}}`, `これら` raccoglie le creature
  appena messe nel [バトルゾーン](term:term-battle-zone) e definisce il perimetro
  degli effetti che verranno ignorati.
level_hint: n3
:::

:::term
id: term-mushi-suru
lemma: 無視する
reading: むしする
romaji: mushi suru
meaning_it: ignorare / non far valere
pos: verb
aliases: [無視する, むしする, ignore]
notes_it: >-
  `{{無視|むし}}する` non significa distruggere o annullare retroattivamente una
  carta. Qui segnala che un certo gruppo di effetti non viene preso in conto
  nella risoluzione corrente.
level_hint: n3
:::

:::term
id: term-jougen
lemma: 上限
reading: じょうげん
romaji: jougen
meaning_it: limite massimo / cap
pos: noun
aliases: [上限, じょうげん, jougen]
notes_it: >-
  `{{上限|じょうげん}}` indica il tetto che non si può superare. In
  `バトルゾーンの{{上限|じょうげん}}になるまで`, il testo non ti chiede di mettere
  in campo tutte le creature possibili: ti dice di continuare finché la zona
  raggiunge il numero massimo consentito.
level_hint: n3
:::

:::term
id: term-okoru
lemma: 起こる
reading: おこる
romaji: okoru
meaning_it: verificarsi / accadere / attivarsi
pos: verb
aliases: [起こる, おこる, okoru]
notes_it: >-
  Nel rules text `{{起|お}}こる` segnala che qualcosa si verifica davvero come
  conseguenza di un evento. In
  `{{出|で}}ることによって{{起|お}}こる[{{効果|こうか}}](term:term-effect)`, il
  focus non è su qualsiasi effetto scritto sulla carta, ma sugli effetti che si
  attivano proprio perché quelle creature sono entrate nel battle zone.
level_hint: n4
:::

:::grammar
id: grammar-demo-demo-nai
pattern: ～でも～でもない
title: Doppia esclusione "né A né B"
reading: でも でも ない
meaning_it: né A né B / non essere né l'uno né l'altro
aliases: [～でも～でもない]
notes_it: >-
  Qui `でも` non significa `anche`, ma viene ripetuto per escludere due
  categorie nello stesso filtro. In `{{進化|しんか}}でもNEOでもない`, la creatura
  valida deve passare entrambe le esclusioni: non essere un'evoluzione e non
  essere nemmeno NEO.
level_hint: n3
:::

:::grammar
id: grammar-koto-ni-yotte
pattern: ～ことによって
title: Effetto causato proprio da quell'evento
reading: ことによって
meaning_it: per il fatto che / a causa di / in conseguenza di
aliases: [ことによって]
notes_it: >-
  Questo pattern trasforma un evento nella causa di ciò che segue. In
  `バトルゾーンに{{出|で}}ることによって{{起|お}}こる{{効果|こうか}}`, il testo
  non parla di effetti qualsiasi: parla proprio degli effetti che nascono
  perché quelle creature sono entrate nel battle zone.
level_hint: n3
:::

:::card
id: card-kingdom-ohkabuto-recognition
entry_type: term
entry_id: term-kingdom-ohkabuto
card_type: recognition
front: 'キングダム・オウ{{禍武斗|かぶと}}'
back: Kingdom Ohkabuto / lato creatura della twinpact
example_jp: >-
  キングダム・オウ{{禍武斗|かぶと}}がいれば、パワーが{{9000|きゅうせん}}より
  {{小|ちい}}さいクリーチャーは{{自分|じぶん}}を{{攻撃|こうげき}}できない。
example_it: >-
  Se hai Kingdom Ohkabuto, le creature con potere sotto 9000 non possono
  attaccarti.
notes_it: >-
  Qui il nome va fissato come nome proprio del lato creatura, non come carta
  separata dalla twinpact. Quando lo rileggi, pensa subito alla riga difensiva
  e al trigger di vittoria in battle.
tags: [live-duel, proper-name, twinpact, creature]
:::

:::card
id: card-gouhaten-tsukumogatari-recognition
entry_type: term
entry_id: term-gouhaten-tsukumogatari
card_type: recognition
front: '{{轟破天九十九語|ごうはてんつくもがたり}}'
back: Gouhaten Tsukumogatari / lato spell della twinpact
example_jp: >-
  {{轟破天九十九語|ごうはてんつくもがたり}}は、
  [マナゾーン](term:term-mana-zone)からクリーチャーをたくさん
  [バトルゾーン](term:term-battle-zone)に{{出|だ}}す。
example_it: >-
  Gouhaten Tsukumogatari mette molte creature nel battle zone dalla mana zone.
notes_it: >-
  Il nome vale la pena di essere fissato perché introduce subito una frase lunga
  e densa di scope. Quando compare questo titolo, preparati a leggere
  quantità, gruppo referenziale e `{{無視|むし}}する`.
tags: [live-duel, proper-name, twinpact, spell]
:::

:::card
id: card-mach-fighter-recognition
entry_type: term
entry_id: term-mach-fighter
card_type: recognition
front: マッハファイター
back: può attaccare creature tapped o untapped nel turno in cui entra
example_jp: >-
  マッハファイターだから、{{出|で}}たターンにタップしていない
  クリーチャーにも{{攻撃|こうげき}}できる。
example_it: >-
  Siccome ha Mach Fighter, nel turno in cui entra può attaccare anche creature
  non tapped.
notes_it: >-
  Qui la keyword va letta come licenza di targeting più che come pura velocità:
  allarga i bersagli validi nel turno d'ingresso.
tags: [live-duel, keyword, attack, targeting]
:::

:::card
id: card-suki-na-kazu-recognition
entry_type: term
entry_id: term-suki-na-kazu
card_type: recognition
front: '{{好|す}}きな{{数|かず}}'
back: il numero che preferisci / quanti ne vuoi
example_jp: >-
  クリーチャーを{{好|す}}きな{{数|かず}}{{出|だ}}せるなら、
  {{必要|ひつよう}}な{{分|ぶん}}だけ{{選|えら}}べばいい。
example_it: >-
  Se puoi mettere in campo il numero che vuoi di creature, scegli solo quante
  te ne servono.
notes_it: >-
  Questo chunk cambia la quantità, non l'identità del gruppo. Quando lo vedi,
  chiediti subito `quanti?`, non soltanto `quali?`.
tags: [live-duel, quantity, chunk]
:::

:::card
id: card-jougen-recognition
entry_type: term
entry_id: term-jougen
card_type: recognition
front: '{{上限|じょうげん}}'
back: limite massimo / cap
example_jp: >-
  バトルゾーンの{{上限|じょうげん}}になれば、もうそれ{{以上|いじょう}}は
  クリーチャーを{{出|だ}}せない。
example_it: >-
  Se il battle zone raggiunge il suo limite massimo, non puoi più metterci
  altre creature.
notes_it: >-
  Quando vedi `{{上限|じょうげん}}`, la domanda giusta non è `quante ne voglio?`
  ma `qual è il cap che non posso superare?`.
tags: [live-duel, quantity, limit]
:::

:::card
id: card-okoru-recognition
entry_type: term
entry_id: term-okoru
card_type: recognition
front: '{{起|お}}こる'
back: verificarsi / accadere / attivarsi
example_jp: >-
  {{出|で}}たことによって{{起|お}}こる[{{効果|こうか}}](term:term-effect)なら、
  {{登場|とうじょう}}そのものが{{原因|げんいん}}になっている。
example_it: >-
  Se è un effetto che si verifica per l'ingresso, l'ingresso stesso ne è la causa.
notes_it: >-
  Nel rules text `{{起|お}}こる` vale spesso come `scattare / verificarsi` più
  che come semplice `succedere`. Qui restringe il focus agli effetti davvero
  causati dall'ingresso nel battle zone.
tags: [live-duel, verb, trigger, cause]
:::

:::card
id: card-demo-demo-nai-concept
entry_type: grammar
entry_id: grammar-demo-demo-nai
card_type: concept
front: '{{進化|しんか}}でもNEOでもない'
back: non è né un'evoluzione né un NEO
example_jp: >-
  `{{進化|しんか}}でもNEOでもない`なら、{{2|ふた}}つの{{種類|しゅるい}}の
  どちらにも{{入|はい}}らないクリーチャーだけが{{残|のこ}}る。
example_it: >-
  Se è "né evoluzione né NEO", restano solo creature che non rientrano in
  nessuna delle due categorie.
notes_it: >-
  Il punto utile non è `でも` come `anche`, ma il suo uso ripetuto in serie
  negativa: `AでもBでもない` costruisce un doppio filtro esclusivo.
tags: [live-duel, grammar, filter, exclusion]
:::

:::card
id: card-korera-recognition
entry_type: term
entry_id: term-kore-ra
card_type: recognition
front: これら
back: questi / il gruppo appena menzionato
example_jp: >-
  これらと{{書|か}}いてあれば、すぐ{{前|まえ}}に{{出|で}}てきた
  カードたちをまとめて{{指|さ}}している。
example_it: >-
  Quando leggi `これら`, sta indicando insieme le carte nominate subito prima.
notes_it: >-
  È piccolo ma decisivo: nei testi di effetto serve a chiudere lo scope su un
  gruppo preciso senza riscriverlo da capo.
tags: [live-duel, reference, scope]
:::

:::card
id: card-koto-ni-yotte-trigger-concept
entry_type: grammar
entry_id: grammar-koto-ni-yotte
card_type: concept
front: '{{出|で}}ることによって{{起|お}}こる{{効果|こうか}}'
back: effetti che si verificano proprio perché qualcosa entra in gioco
example_jp: >-
  {{出|で}}ることによって{{起|お}}こる{{効果|こうか}}なら、
  {{登場|とうじょう}}そのものが{{原因|げんいん}}になっている。
example_it: >-
  Se si tratta di effetti che si verificano per l'ingresso, l'ingresso stesso è
  la causa che li accende.
notes_it: >-
  `ことによって` lega evento e conseguenza. Qui non devi pensare a `effetti
  della carta` in generale, ma al sottoinsieme di effetti causati da
  quell'ingresso nel battle zone.
tags: [live-duel, grammar, cause, scope]
:::

:::card
id: card-ignore-enter-effects-concept
entry_type: term
entry_id: term-mushi-suru
card_type: concept
front: >-
  これらが[バトルゾーン](term:term-battle-zone)に{{出|で}}ることによって
  {{起|お}}こる{{効果|こうか}}はすべて{{無視|むし}}する
back: ignora tutti gli effetti che si verificano per il loro ingresso nel battle zone
example_jp: >-
  {{登場|とうじょう}}で{{始|はじ}}まる{{効果|こうか}}だけを
  {{無視|むし}}するので、その{{後|あと}}に{{別|べつ}}の{{条件|じょうけん}}で
  {{働|はたら}}く{{能力|のうりょく}}まではまとめて{{消|け}}さない。
example_it: >-
  Ignora solo gli effetti che partono dall'ingresso; non cancella in blocco
  ogni altra abilità che potrà funzionare più tardi con condizioni diverse.
notes_it: >-
  Il cuore del chunk è l'incastro fra referente e causa: `これら` dice chi,
  `{{出|で}}ることによって` dice perché, `{{無視|むし}}する` dice cosa non viene
  fatto valere.
tags: [live-duel, effect, scope, chunk]
:::
