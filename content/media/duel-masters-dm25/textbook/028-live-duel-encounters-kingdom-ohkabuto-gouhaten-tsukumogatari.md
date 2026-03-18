---
id: lesson-duel-masters-dm25-live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari
media_id: media-duel-masters-dm25
slug: live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari
title: Carte incontrate - Kingdom Ohkabuto / Gouhaten Tsukumogatari
order: 57
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, twinpact, mana-zone, gransect, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-card-types,
    lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
  ]
summary: >-
  Kingdom Ohkabuto / Gouhaten Tsukumogatari: twinpact con lato creatura che
  blocca gli attaccanti piccoli dal colpire te e lato spell che mette in campo
  dalla tua mana zone quante creature vuoi, riempie anche il campo avversario e
  ignora gli effetti d'ingresso.
---

# [キングダム・オウ{{禍武斗|かぶと}}](term:term-kingdom-ohkabuto) / [{{轟破天九十九語|ごうはてんつくもがたり}}](term:term-gouhaten-tsukumogatari)

:::image
src: assets/cards/live-duel/kingdom-ohkabuto-gouhaten-tsukumogatari.png
alt: "Kingdom Ohkabuto / Gouhaten Tsukumogatari twinpact card."
caption: >-
  [キングダム・オウ{{禍武斗|かぶと}}](term:term-kingdom-ohkabuto) /
  [{{轟破天九十九語|ごうはてんつくもがたり}}](term:term-gouhaten-tsukumogatari)。
  Una sola [ツインパクトカード](term:term-twinpact-card): lato creatura
  naturale, razza グランセクト, con linea difensiva sui piccoli attaccanti;
  lato spell che mette in campo creature dalla mana zone e poi ignora gli
  effetti che nascono da quell'ingresso.
:::

## Etichette da riconoscere

- [ツインパクトカード](term:term-twinpact-card)
- [マッハファイター](term:term-mach-fighter)
- [T・ブレイカー](term:term-t-breaker)

Qui la parte davvero utile da leggere non è la keyword da sola, ma il cambio di
grammatica fra i due lati: la creatura impone una restrizione con soggetto
invertito, mentre lo spell costruisce scope, ordine di risoluzione e gruppo
referenziale con `これら`.

## Effetti da leggere

:::example_sentence
jp: >-
  {{相手|あいて}}の、パワーが{{9000|きゅうせん}}より{{小|ちい}}さいクリーチャーは、
  {{自分|じぶん}}を[{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Le creature dell'avversario con potere minore di 9000 non possono attaccare
  te.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{破天九語|はてんきゅうご}}：このクリーチャーが[バトル](term:term-battle)に{{勝|か}}った
  [{{時|とき}}](grammar:grammar-toki)、{{相手|あいて}}のシールドを
  {{9|ここの}}つブレイクする。
translation_it: >-
  Hatenkyuugo: quando questa creatura vince un battle, rompe 9 scudi
  dell'avversario.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{自分|じぶん}}の[マナゾーン](term:term-mana-zone)からクリーチャーを
  [{{好|す}}きな{{数|かず}}](term:term-suki-na-kazu)、
  [バトルゾーン](term:term-battle-zone)に{{出|だ}}す。
translation_it: >-
  Metti nel battle zone dalla tua mana zone il numero di creature che preferisci.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  その{{後|あと}}、{{相手|あいて}}の[マナゾーン](term:term-mana-zone)から
  [{{進化|しんか}}でもNEOでもない](grammar:grammar-demo-demo-nai)クリーチャーを、
  [バトルゾーン](term:term-battle-zone)の[{{上限|じょうげん}}](term:term-jougen)になるまで
  ランダムに[バトルゾーン](term:term-battle-zone)に{{出|だ}}す。
  [これら](term:term-kore-ra)が[バトルゾーン](term:term-battle-zone)に
  {{出|で}}る[ことによって](grammar:grammar-koto-ni-yotte)
  [{{起|お}}こる](term:term-okoru)[{{効果|こうか}}](term:term-effect)はすべて
  [{{無視|むし}}する](term:term-mushi-suru)。
translation_it: >-
  Dopo di ciò, dalla mana zone dell'avversario metti nel battle zone, a caso,
  creature che non siano né evoluzione né NEO fino a riempire il limite del
  battle zone. Ignori tutti gli effetti che si verificano per il loro ingresso
  nel battle zone.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 相手の、パワーが9000より小さいクリーチャーは、自分を攻撃できない

- `パワーが{{9000|きゅうせん}}より{{小|ちい}}さい` è una relativa che
  restringe quali creature dell'avversario entrano davvero nel divieto.
- `{{自分|じぶん}}を{{攻撃|こうげき}}できない` usa `自分` nel senso del giocatore
  che controlla la carta, non della creatura stessa.
- Il giapponese quindi va letto come `le creature avversarie sotto la soglia di
  potere non possono attaccare te`, non come un divieto di colpire questa
  creatura.

### 2. 破天九語：このクリーチャーがバトルに勝った時

- `破天九語` è un'etichetta di effetto legata a questo lato creatura, non il
  nome completo del lato spell.
- [バトル](term:term-battle)に{{勝|か}}った
  [{{時|とき}}](grammar:grammar-toki) fissa un trigger molto preciso: non quando
  attacca, ma quando lo scontro è già stato vinto.
- Il payoff è espresso in modo nudo e violento: `{{9|ここの}}つブレイクする`.
  La parte da fissare qui è soprattutto la relazione `condizione di vittoria ->
  rottura massiccia degli scudi`.

### 3. 自分のマナゾーンからクリーチャーを好きな数、バトルゾーンに出す

- [{{好|す}}きな{{数|かず}}](term:term-suki-na-kazu) non sceglie quali creature in
  astratto, ma quanti pezzi della tua mana zone vuoi spostare in questa
  risoluzione.
- La virgola separa bene `oggetto scelto` e `destinazione`: prima viene il
  gruppo di creature preso dalla mana zone, poi il testo dice che finiscono nel
  [バトルゾーン](term:term-battle-zone).
- `その{{後|あと}}` nella frase successiva è importante perché chiude davvero
  questa metà dello spell prima di aprire la metà avversaria.

### 4. 進化でもNEOでもないクリーチャーを、バトルゾーンの上限になるまでランダムに

- [～でも～でもない](grammar:grammar-demo-demo-nai) qui non vale come `anche`:
  ripete `でも` per escludere entrambe le categorie. La creatura dell'avversario
  deve quindi passare due filtri insieme: non essere né `{{進化|しんか}}` né NEO.
- [{{上限|じょうげん}}](term:term-jougen) è il tetto massimo della zona.
  `{{上限|じょうげん}}になるまで` non significa `tutte quelle possibili`: vuol dire
  `finché il battle zone non raggiunge il suo cap`.
- `ランダムに` sposta il controllo fuori dal giocatore: dopo il tuo blocco
  iniziale, il secondo blocco non è più una scelta mirata.

### 5. これらがバトルゾーンに出ることによって起こる効果はすべて無視する

- [これら](term:term-kore-ra) raccoglie in un solo gruppo le creature appena
  fatte entrare con lo spell.
- [ことによって](grammar:grammar-koto-ni-yotte) lega l'evento e il suo
  risultato: qui il testo sta parlando proprio degli effetti che nascono dal
  fatto che quelle creature entrano nel battle zone.
- [{{起|お}}こる](term:term-okoru) in giapponese generale vuol dire `succedere,
  verificarsi` — qualcosa che avviene da solo (un terremoto `{{起|お}}こる`). Nel
  rules text questo significato si specializza: indica un effetto che scatta
  automaticamente come conseguenza di un evento di gioco.
  `{{起|お}}こる[{{効果|こうか}}](term:term-effect)` quindi non parla di tutti gli
  effetti scritti sulla carta, ma solo di quelli che si attivano da soli perché
  quelle creature sono entrate in gioco.
- [{{無視|むし}}する](term:term-mushi-suru) in giapponese generale vuol dire
  `ignorare` — scegliere di non considerare qualcosa (puoi `{{無視|むし}}する`
  un messaggio, una regola, una persona). Nel rules text funziona allo stesso
  modo: il gioco ti dice di trattare quegli effetti come se non ci fossero. Non
  li cancella dalla carta — le creature mantengono le loro abilità per dopo —
  ma nella risoluzione corrente quegli effetti d'ingresso vengono saltati.

## Lessico utile in questa carta

- [ツインパクトカード](term:term-twinpact-card) qui va presa alla lettera: una
  sola carta, ma due lati con due costi e due grammatiche diverse.
- [{{好|す}}きな{{数|かず}}](term:term-suki-na-kazu) è un chunk molto utile perché
  compare quando il testo ti lascia decidere la quantità e non solo il
  bersaglio.
- [{{上限|じょうげん}}](term:term-jougen) è utile oltre questa carta: ogni volta
  che compare, il testo sta fissando un limite massimo e non una quantità libera.
- [これら](term:term-kore-ra) è piccolo ma decisivo: se perdi il referente,
  perdi subito anche il perimetro di `{{無視|むし}}する`.
- [{{起|お}}こる](term:term-okoru) è un verbo intransitivo che in giapponese
  generale vuol dire `succedere` (un terremoto `{{起|お}}こる`, un problema
  `{{起|お}}こる`). In questa carta si specializza: indica effetti che scattano
  da soli come conseguenza dell'ingresso nel battle zone.
- [{{無視|むし}}する](term:term-mushi-suru) vuol dire `ignorare` in qualsiasi
  contesto giapponese. In questa carta non cancella le abilità delle creature:
  dice solo che gli effetti d'ingresso vengono saltati in questa risoluzione.
