---
id: lesson-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
media_id: media-web-giapponese
slug: 030-dmps-takaratomy-deckbuilder-create-or-code-input
title: デッキ編成
order: 30
segment_ref: dmps-takaratomy-deckbuilder
difficulty: n4
status: active
tags: [web, dmps, duel-masters-plays, deckbuilder, ui]
summary: >-
  Leggi i due ingressi della pagina deckbuilder e distingui creazione di un
  nuovo mazzo da inserimento di un deck code.
---

# Obiettivo

Capire la differenza tra [{{新規|しんき}}](term:term-shinki)で
デッキを
[{{作成|さくせい}}する](term:term-sakusei-suru) e
[デッキコード](term:term-deck-code)を
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru). La schermata offre due
strade diverse: costruire un mazzo da zero oppure ricostruirne uno da un codice
già pronto.

## Contesto

Questa è la pagina iniziale del deckbuilder di DUEL MASTERS PLAY'S. Prima di
entrare nell'editor vero e proprio, la UI ti fa scegliere la Division e poi ti
chiede quale flusso vuoi usare. Il giapponese è molto compatto: una frase
verbale a sinistra per la creazione da zero, una frase verbale a destra per
l'inserimento del codice, e una CTA abbreviata che comprime la stessa azione in
pochi caratteri.

:::image
src: assets/dmps-deckbuilder-overview.png
alt: >-
  Pagina deckbuilder di Duel Masters Plays con selezione division e due azioni
  principali.
caption: >-
  La schermata separa subito
  [{{新規|しんき}}](term:term-shinki)で
  デッキを
  [{{作成|さくせい}}する](term:term-sakusei-suru) da
  [デッキコード](term:term-deck-code)を
  [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru).
:::

## Termini chiave

- [{{新規|しんき}}](term:term-shinki)
- [{{作成|さくせい}}する](term:term-sakusei-suru)
- [デッキコード](term:term-deck-code)
- [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru)

## Pattern grammaticali chiave

- [{{新規|しんき}}で〜する](grammar:grammar-state-de)

## Spiegazione

`デッキ` qui va letto nel senso operativo dell'app: la lista che prepari fuori
dal match. La pagina non ti fa ancora modificare le carte: prima ti fa
scegliere se vuoi partire da un mazzo nuovo o se vuoi richiamare una lista già
condivisa altrove.

Il blocco di sinistra è la via da zero. In
[{{新規|しんき}}](term:term-shinki)で
デッキを
[{{作成|さくせい}}する](term:term-sakusei-suru),
[{{新規|しんき}}](term:term-shinki) non vuol dire “recente” o “ultimo”:
significa “nuovo”, “fresh”, “da zero”. Il `で` non indica un luogo. Segna il
frame in cui fai l'azione: creare il deck come nuova lista, non aprire o
duplicare qualcosa che esiste già.

[{{作成|さくせい}}する](term:term-sakusei-suru) è il verbo operativo del blocco.
In una UI di questo tipo vuol dire creare o generare un oggetto nuovo. Qui
l'oggetto è `デッキ`, quindi il senso completo è “creare un
nuovo mazzo”, non semplicemente “fare” qualcosa in astratto.

:::image
src: assets/dmps-deckbuilder-create.png
alt: >-
  Blocco di sinistra con testo di creazione nuovo mazzo e pulsante principale.
caption: >-
  La frase esplicativa usa la forma verbale
  [{{新規|しんき}}](term:term-shinki)で
  デッキを
  [{{作成|さくせい}}する](term:term-sakusei-suru), mentre la CTA la comprime in
  `{{新規|しんき}}デッキ{{作成|さくせい}}`.
:::

Il bottone [{{新規|しんき}}デッキ{{作成|さくせい}}] non è una frase completa,
ma una label compressa. La pagina toglie l'oggetto marcato da `を` e il verbo
`する`, perché sul pulsante basta nominare l'azione. Questo è un contrasto
molto tipico del web giapponese: testo guida più esplicito accanto a CTA più
nominali e dense.

Il blocco di destra cambia logica. Qui non costruisci un mazzo da zero:
prendi un [デッキコード](term:term-deck-code), cioè una stringa che rappresenta
un deck già definito, e la inserisci nel campo. Per questo il verbo giusto è
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru): digitare o incollare un
valore dentro una casella.

:::image
src: assets/dmps-deckbuilder-input.png
alt: >-
  Blocco di destra con campo per codice deck e pulsante di conferma.
caption: >-
  Qui [デッキコード](term:term-deck-code) è l'oggetto da inserire e
  [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) è l'azione; `{{決定|けってい}}`
  arriva solo dopo l'immissione.
:::

[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) è quindi più vicino a
“immettere un valore” che a un generico “scrivere”. La sequenza visuale lo
conferma: campo nero prima, conferma con `{{決定|けってい}}` dopo. La parola
[デッキコード](term:term-deck-code) ti dice anche che il contenuto del box non è
un nome libero del mazzo, ma un codice esportabile o condivisibile.

## Esempi guidati

:::example_sentence
jp: >-
  {{新規|しんき}}でデッキを{{作成|さくせい}}する。
translation_it: >-
  Creo un mazzo nuovo da zero.
:::

:::example_sentence
jp: >-
  デッキコードを{{入力|にゅうりょく}}する。
translation_it: >-
  Inserisco il deck code.
:::

## Nota finale

La distinzione utile da fissare è questa: a sinistra il giapponese parla di
creazione nuova, a destra di inserimento di un codice già esistente. Se leggi
bene [{{新規|しんき}}](term:term-shinki),
[{{作成|さくせい}}する](term:term-sakusei-suru) e
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru), capisci subito quale dei
due flussi stai per aprire.
