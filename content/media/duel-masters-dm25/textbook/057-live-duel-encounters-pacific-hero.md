---
id: lesson-duel-masters-dm25-live-duel-encounters-pacific-hero
media_id: media-duel-masters-dm25
slug: live-duel-encounters-pacific-hero
title: Carte incontrate - パシフィック・ヒーロー / Pacific Hero
order: 85
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, justdiver, varavariety, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Pacific Hero: focus su justdiver, sulla forma passiva negativa erabarezu e
  sulla protezione che dura fino all'inizio del turno successivo.
---

# パシフィック・ヒーロー

:::image
src: assets/cards/live-duel/pacific-hero.jpg
alt: "Pacific Hero card."
caption: >-
  パシフィック・ヒーロー。 Carta Water/Merfolk con ジャストダイバー e
  バラバラエティ{{3|さん}}. La riga davvero utile da leggere bene è la
  coppia `{{相手|あいて}}に{{選|えら}}ばれず、{{攻撃|こうげき}}されない`: qui la protezione non è un blocco
  unico, ma due negazioni coordinate.
:::

## Keyword presenti sulla carta

- ジャストダイバー
- バラバラエティ{{3|さん}}

`ジャストダイバー` è la keyword che porta la protezione iniziale;
`バラバラエティ{{3|さん}}` è la variante che concede lo stesso tipo di protezione
a un'altra creatura quando la condizione sugli elementi è soddisfatta.

## Effetti da leggere

:::example_sentence
jp: >-
  ジャストダイバー（このクリーチャーが{{出|で}}た{{時|とき}}、{{次|つぎ}}の{{自分|じぶん}}の
  ターンのはじめまで、このクリーチャーは{{相手|あいて}}に{{選|えら}}ばれず、
  {{攻撃|こうげき}}されない）
translation_it: >-
  Justdiver: quando questa creatura entra, fino all'inizio del tuo prossimo
  turno non può essere scelta dall'avversario né attaccata.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  バラバラエティ{{3|さん}}：{{自分|じぶん}}の{{他|ほか}}のクリーチャーが
  {{出|で}}た{{時|とき}}、{{次|つぎ}}の{{自分|じぶん}}のターンのはじめまで、
  そのクリーチャーは{{相手|あいて}}に{{選|えら}}ばれず、
  {{攻撃|こうげき}}されない。（{{コスト|こすと}}が{{異|こと}}なる{{自分|じぶん}}の
  エレメントが{{3|みっ}}つ{{以上|いじょう}}あれば、このクリーチャーにこの{{能力|のうりょく}}を
  {{与|あた}}える）
translation_it: >-
  Varavariety 3: quando entra un'altra tua creatura, fino all'inizio del tuo
  prossimo turno quella creatura non può essere scelta dall'avversario né
  attaccata. Se hai 3 o più dei tuoi elementi con costo diverso, questa
  creatura ottiene questa abilità.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. ジャストダイバーと 出た時

- `ジャストダイバー` è il nome fisso della keyword. In giapponese generale
  non è una parola da scomporre liberamente: qui funziona come etichetta del
  pacchetto di protezione che segue.
- [{{出|で}}た{{時|とき}}](grammar:grammar-toki) è il trigger che accende il
  testo. Non dice semplicemente `dopo l'ingresso`, ma il momento esatto in cui
  la creatura è appena entrata.
- `次の{{自分|じぶん}}のターンのはじめまで` fissa la durata: la protezione
  resta attiva fino all'inizio del tuo prossimo turno, non oltre.

### 2. 相手に選ばれず、攻撃されない

- [{{選|えら}}ばれず](grammar:grammar-zu) è la forma negativa in `～ず` del
  passivo di [{{選|えら}}ぶ](term:term-erabu). Qui vuol dire `senza essere
  scelto`.
- [{{攻撃|こうげき}}されない](term:term-attack) è la negativa passiva normale:
  `non può essere attaccato`.
- La virgola non introduce una seconda condizione. Tiene insieme due
  conseguenze parallele della stessa finestra temporale.

### 3. バラバラエティ{{3|さん}}

- `{{自分|じぶん}}の{{他|ほか}}のクリーチャー` esclude la creatura che possiede
  l'abilità: `他の` vuol dire proprio `un'altra`.
- `そのクリーチャー` rimanda alla creatura appena entrata, non a `questa`
  carta.
- `{{コスト|こすと}}が{{異|こと}}なる...が{{3|みっ}}つ{{以上|いじょう}}あれば` usa
  `あれば` come controllo di soglia: se la condizione è vera, allora questa
  creatura ottiene l'abilità.

## Lessico utile in questa carta

- `相手に{{選|えら}}ばれず` è il punto da non leggere come un blocco unico: la
  negazione classica `～ず` si appoggia a `選ばれる`, mentre
  `{{攻撃|こうげき}}されない` è la negazione passiva normale.
- `バラバラエティ{{3|さん}}` è utile da riconoscere come nome di abilità
  legato alla condizione sui costi, non come semplice etichetta decorativa.
