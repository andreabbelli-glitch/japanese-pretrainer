---
id: cards-duel-masters-dm25-live-duel-encounters-kenzan-no-sabaki
media_id: media-duel-masters-dm25
slug: live-duel-encounters-kenzan-no-sabaki
title: Carte incontrate in partita 5 - Kenzan no Sabaki, Metallica e scudo face-up
order: 54
segment_ref: live-duel-encounters
---

:::term
id: term-kenzan-no-sabaki
lemma: 剣参ノ裁キ
reading: けんざんのさばき
romaji: kenzan no sabaki
meaning_it: Kenzan no Sabaki / spell che cerca uno spell o un Metallica e poi resta sopra uno scudo
pos: proper-noun
aliases:
  [剣参ノ裁キ, 剣参の裁き, kenzan no sabaki, Three Sword's Judgment]
notes_it: >-
  È il nome proprio di uno spell di supporto della linea Sabaki. Quando leggi
  `{{剣参|けんざん}}ノ{{裁|さば}}キ`, il blocco importante è doppio: prima filtra
  le prime tre carte del mazzo cercando uno
  [{{呪文|じゅもん}}](term:term-spell) o un [メタリカ](term:term-metallica), poi
  invece di finire nel [{{墓地|ぼち}}](term:term-graveyard) resta sopra uno
  scudo [{{表|おもて}}{{向|む}}き](term:term-face-up).
level_hint: custom
:::

:::term
id: term-metallica
lemma: メタリカ
reading: めたりか
romaji: metarika
meaning_it: Metallica / famiglia di creature luce metalliche
pos: noun
aliases: [メタリカ, metarika, Metallica]
notes_it: >-
  Non è un katakana ornamentale: è il nome di una famiglia di creature luce
  usata come filtro operativo. In
  `{{呪文|じゅもん}}を{{1枚|いちまい}}またはメタリカを{{1体|いったい}}`,
  `メタリカ` decide una delle due categorie valide che puoi prendere dal gruppo
  appena rivelato.
level_hint: custom
:::

:::term
id: term-judgment-emblem
lemma: 裁きの紋章
reading: さばきのもんしょう
romaji: sabaki no monshou
meaning_it: Judgment Emblem / razza dei Sabaki spell e delle carte collegate
pos: noun
aliases: [裁きの紋章, さばきのもんしょう, sabaki no monshou, Judgment Emblem]
notes_it: >-
  Compare nella riga `{{種族|しゅぞく}}` di molte carte Sabaki. Anche se qui la
  carta è uno spell, `{{裁|さば}}きの{{紋章|もんしょう}}` resta una vera etichetta
  tribale e ti segnala che stai entrando nell'ecosistema luce legato a
  [{{剣参|けんざん}}ノ{{裁|さば}}キ](term:term-kenzan-no-sabaki) e ai Savark.
level_hint: custom
:::

:::card
id: card-kenzan-no-sabaki-recognition
entry_type: term
entry_id: term-kenzan-no-sabaki
card_type: recognition
front: '{{剣参|けんざん}}ノ{{裁|さば}}キ'
back: Kenzan no Sabaki / spell che filtra il top 3 e poi resta sopra uno scudo
example_jp: >-
  {{剣参|けんざん}}ノ{{裁|さば}}キで{{山札|やまふだ}}の{{上|うえ}}から
  {{3枚|さんまい}}{{見|み}}て、{{呪文|じゅもん}}かメタリカを
  {{探|さが}}す。
example_it: >-
  Con Kenzan no Sabaki guardi le prime tre carte del mazzo e cerchi uno spell
  oppure un Metallica.
notes_it: >-
  Il nome va fissato come nome proprio completo. Qui quel nome corrisponde a
  una procedura molto leggibile: top 3, filtro doppio, poi permanenza sopra lo
  scudo invece del cimitero.
tags: [live-duel, proper-name, spell, filter]
:::

:::card
id: card-metallica-recognition
entry_type: term
entry_id: term-metallica
card_type: recognition
front: メタリカ
back: Metallica / famiglia di creature luce metalliche
example_jp: >-
  メタリカなら、{{相手|あいて}}に{{見|み}}せてから
  {{手札|てふだ}}に{{加|くわ}}えてもよい。
example_it: >-
  Se è un Metallica, puoi mostrarlo all'avversario e poi aggiungerlo alla mano.
notes_it: >-
  Qui `メタリカ` non è un nome da memorizzare isolato: è una categoria che il
  testo usa davvero come filtro di scelta.
tags: [live-duel, tribe, filter]
:::

:::card
id: card-judgment-emblem-recognition
entry_type: term
entry_id: term-judgment-emblem
card_type: recognition
front: '{{裁|さば}}きの{{紋章|もんしょう}}'
back: Judgment Emblem / razza dei Sabaki spell
example_jp: >-
  {{裁|さば}}きの{{紋章|もんしょう}}と{{書|か}}いてあれば、
  サバキ{{系統|けいとう}}のカードだと{{気|き}}づきやすい。
example_it: >-
  Se leggi `Judgment Emblem`, è più facile accorgerti che la carta appartiene
  alla linea Sabaki.
notes_it: >-
  Vale la pena fissarlo perché compare nella riga di razza di molte carte
  collegate. Riconoscerlo al volo riduce il carico quando rileggi spell e
  supporti luce dello stesso ecosistema.
tags: [live-duel, race, sabaki]
:::

:::card
id: card-show-then-add-spell-or-metallica-concept
entry_type: grammar
entry_id: grammar-te-kara
card_type: concept
front: >-
  その{{中|なか}}から、{{呪文|じゅもん}}を{{1枚|いちまい}}またはメタリカを
  {{1体|いったい}}{{相手|あいて}}に{{見|み}}せてから
  {{手札|てふだ}}に{{加|くわ}}えてもよい
back: >-
  Tra quelle carte, puoi mostrare all'avversario 1 spell oppure 1 Metallica e
  poi aggiungerla alla mano.
example_jp: >-
  `{{見|み}}せてから`だから、{{先|さき}}に{{手札|てふだ}}へ{{入|い}}れる
  のではなく、まず{{公開|こうかい}}する。
example_it: >-
  Siccome c'è `{{見|み}}せてから`, non la metti prima in mano: la devi mostrare
  per prima.
notes_it: >-
  Questa frase vale la pena di essere fissata come chunk unico: `または`
  unisce due categorie valide, ma è `{{見|み}}せてから` che impone la sequenza
  corretta della procedura.
tags: [live-duel, grammar, sequence, filter]
:::

:::card
id: card-face-up-on-shield-concept
entry_type: term
entry_id: term-face-up
card_type: concept
front: >-
  {{表|おもて}}{{向|む}}きのまま{{自分|じぶん}}のシールド{{1|ひと}}つの
  {{上|うえ}}に{{置|お}}く
back: mettila sopra uno dei tuoi scudi lasciandola a faccia in su
example_jp: >-
  {{墓地|ぼち}}に{{置|お}}くかわりに、
  {{表|おもて}}{{向|む}}きのままシールドの{{上|うえ}}に{{置|お}}く。
example_it: >-
  Invece di metterla nel cimitero, la metti sopra uno scudo lasciandola a
  faccia in su.
notes_it: >-
  Qui `{{表|おもて}}{{向|む}}き` non descrive una semplice rivelazione
  momentanea. La frase completa ti dice che la carta mantiene quello stato
  mentre cambia zona e si appoggia sopra uno scudo preciso.
tags: [live-duel, state, shield, chunk]
:::
