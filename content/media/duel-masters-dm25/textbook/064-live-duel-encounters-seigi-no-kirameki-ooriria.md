---
id: lesson-duel-masters-dm25-live-duel-encounters-seigi-no-kirameki-ooriria
media_id: media-duel-masters-dm25
slug: live-duel-encounters-seigi-no-kirameki-ooriria
title: Carte incontrate - 正義の煌き オーリリア / Orlilia, Flash of Justice
order: 92
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [
    live-duel,
    card-encounter,
    labyrinth,
    shield-count,
    spell-lock,
    metallica,
    duel-masters
  ]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-dm25-sd1-overview
  ]
summary: >-
  Orlilia: reindirizza l'attacco con attack target e henkou, poi usa kazu e
  yori per attivare Labyrinth solo se hai più scudi dell'avversario.
---

# 正義の煌き オーリリア

:::image
src: assets/cards/live-duel/seigi-no-kirameki-ooriria.jpg
alt: "Orlilia, Flash of Justice card."
caption: >-
  {{正義|せいぎ}}の{{煌|きら}}き オーリリア。
  Razza: [メタリカ](term:term-metallica). La prima riga sposta il bersaglio
  dell'attacco su questa creatura o su una tua creatura tapped; la seconda
  accende [ラビリンス](term:term-labyrinth) se i tuoi scudi sono più di quelli
  dell'avversario e blocca gli spell a costo 5 o meno.
:::

## Keyword presenti sulla carta

- [ラビリンス](term:term-labyrinth)

La keyword è nuova e ora sta anche nella keyword bank. Qui il punto didattico
più utile è come il testo esprime il confronto tra i due giocatori:
`{{自分|じぶん}}のシールドの{{数|かず}}が{{相手|あいて}}より{{多|おお}}ければ`.

## Effetti da leggere

:::example_sentence
jp: >-
  この[クリーチャー](term:term-creature)を[アンタップ](term:term-untap)して、
  [{{相手|あいて}}](term:term-opponent)[クリーチャー](term:term-creature)の
  [{{攻撃先|こうげきさき}}](term:term-attack-target)をこの
  [クリーチャー](term:term-creature)または
  [{{自分|じぶん}}](term:term-self)の[タップ](term:term-tap)している
  [クリーチャー](term:term-creature)に
  [{{変更|へんこう}}](term:term-henkou)してもよい。
translation_it: >-
  Puoi stappare questa creatura e cambiare il bersaglio dell'attacco di una
  creatura avversaria su questa creatura oppure su una tua creatura tapped.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [ラビリンス](term:term-labyrinth)：
  [{{自分|じぶん}}](term:term-self)のシールドの
  [{{数|かず}}](term:term-kazu)が
  [{{相手|あいて}}](term:term-opponent)[より](grammar:grammar-yori)
  [{{多|おお}}ければ](grammar:grammar-seigi-no-shield-count-yori-ookereba)、
  [{{相手|あいて}}](term:term-opponent)は[コスト](term:term-cost)
  {{5以下|ごいか}}の[{{呪文|じゅもん}}](term:term-spell)を
  [{{唱|とな}}えられない](term:term-tonaeru)。
translation_it: >-
  Labyrinth: se il numero dei tuoi scudi è maggiore di quello dell'avversario,
  l'avversario non può lanciare spell di costo 5 o meno.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーをアンタップして

- `アンタップして` usa la forma in `て` per legare il primo gesto al resto
  dell'effetto: prima la creatura si stappa, poi diventa disponibile come nuova
  destinazione dell'attacco.
- Non è una descrizione vaga di stato. La carta ti fa eseguire un'azione
  concreta che prepara il reindirizzamento subito dopo.

### 2. 相手クリーチャーの攻撃先をこのクリーチャーまたは自分のタップしているクリーチャーに変更してもよい

- [{{攻撃先|こうげきさき}}](term:term-attack-target) è il bersaglio effettivo
  dell'attacco già dichiarato.
- [{{変更|へんこう}}](term:term-henkou) dice che non stai creando un nuovo
  attacco: stai riassegnando dove va quello che esiste già.
- `または` apre due destinazioni valide: questa creatura oppure una tua
  creatura che è già in stato tapped.
- `してもよい` rende l'azione facoltativa: la finestra esiste, ma puoi anche
  scegliere di non spostare l'attacco.

### 3. 自分のシールドの数が相手より多ければ

- [{{自分|じぶん}}](term:term-self)のシールドの
  [{{数|かず}}](term:term-kazu) costruisce il numero che devi guardare dal tuo
  lato del campo: non il contenuto degli scudi, ma quanti scudi hai.
- [より](grammar:grammar-yori) qui è il comparativo più normale possibile:
  `rispetto a / di`. Il punto non è un uso speciale di `より`, ma il fatto che
  la frase è abbreviata.
- Se il testo fosse completamente esplicito, qui leggeresti
  `{{自分|じぶん}}のシールドの{{数|かず}}が{{相手|あいて}}のシールドの{{数|かず}}より{{多|おお}}ければ`:
  il numero dei tuoi scudi confrontato con il numero degli scudi
  dell'avversario.
- La carta invece omette il secondo `シールドの数` e lascia solo
  `{{相手|あいて}}より`. È un'ellissi molto naturale nei testi concisi: il
  lettore ricostruisce mentalmente `rispetto al numero degli scudi
  dell'avversario`, anche se sulla carta resta scritto solo `rispetto
  all'avversario`.
- Il dubbio più comune nasce qui: a prima vista sembra quasi che siano gli
  scudi dell'avversario a dover essere più dei tuoi. In realtà non c'è nessun
  ribaltamento grammaticale.
- Il blocco `{{相手|あいて}}より` significa semplicemente `rispetto
  all'avversario` ed è solo la base del paragone. Per capire chi ha davvero
  `di più`, devi guardare il soggetto della frase, cioè ciò che porta `が`.
- Qui il soggetto è
  `{{自分|じぶん}}のシールドの{{数|かず}}が`: è il numero dei tuoi scudi quello a
  cui si applica `{{多|おお}}ければ`. Quindi la carta dice che devi essere tu ad
  avere più scudi.
- Se il testo avesse voluto dire il contrario, avrebbe dovuto invertire i due
  poli del confronto, mettendo come soggetto il lato avversario.
- `{{多|おお}}ければ` è il condizionale di `{{多|おお}}い`: la carta controlla se
  il tuo conteggio supera davvero quel benchmark.
- La soglia quindi è relativa, non assoluta. Se avete lo stesso numero di
  scudi, [ラビリンス](term:term-labyrinth) non si accende.

### 4. 相手はコスト5以下の呪文を唱えられない

- [{{相手|あいて}}](term:term-opponent)は marca il giocatore che subisce la
  restrizione.
- `コスト{{5以下|ごいか}}の[{{呪文|じゅもん}}](term:term-spell)` definisce il
  gruppo proibito: tutti gli spell con costo 5 o meno.
- [{{唱|とな}}えられない](term:term-tonaeru) qui vale `non può lanciare`, non
  `non vuole lanciare` o `non conviene lanciare`.
- Quindi la seconda riga si legge in due blocchi netti: prima controlli se hai
  più scudi, poi imponi all'avversario il divieto di castare quel gruppo di
  spell.

## Lessico e chunk utili in questa carta

- [{{数|かず}}](term:term-kazu) è il nome semplice del conteggio. Quando appare
  dopo una zona o un gruppo, ti sta chiedendo di trasformare quel gruppo in un
  numero.
- `{{相手|あいて}}より{{多|おお}}ければ` non vuol dire genericamente `se sono
  tanti`: vuol dire `se sono più di quelli dell'avversario`.
- [ラビリンス](term:term-labyrinth) è una keyword di soglia: non ti insegna da
  sola cosa fa la carta, ma ti avvisa subito che devi confrontare il tuo numero
  di scudi con quello dell'altro giocatore.
