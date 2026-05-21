---
id: lesson-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
media_id: media-web-giapponese
slug: 030-dmps-takaratomy-deckbuilder-create-or-code-input
title: Creare o inserire un mazzo dal deckbuilder
order: 30
segment_ref: dmps-takaratomy-deckbuilder
difficulty: n4
status: active
tags: [web, dmps, duel-masters-plays, deckbuilder, ui]
summary: >-
  Leggere la schermata di composizione mazzo: distinguere creazione da zero,
  codice già pronto e conferma finale.
---

# Creare o inserire: le due strade di デッキ{{編成|へんせい}}

La schermata デッキ{{編成|へんせい}} di *DUEL MASTERS PLAY'S* non ti porta subito
alla lista delle carte. Prima imposta una cornice: scegli una Division, poi
decidi se partire da una lista vuota o se richiamare una lista già codificata.

Il giapponese della UI è compatto ma molto regolare. A sinistra trovi una frase
che costruisce un mazzo nuovo; a destra una frase che chiede di immettere un
codice. Leggerle insieme fa vedere bene come una pagina web giapponese alterna
frasi guida complete, pulsanti compressi e conferme finali.

## Termini chiave

- [{{新規|しんき}}](term:term-shinki) — nuovo, da zero, come nuova creazione
- [{{作成|さくせい}}する](term:term-sakusei-suru) — creare o generare un oggetto
  nella UI
- [デッキコード](term:term-deck-code) — codice del mazzo, stringa che richiama
  una lista già pronta
- [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) — inserire, digitare,
  immettere un valore

## Espressioni ricorrenti

- [{{新規|しんき}}](term:term-shinki)でデッキを[{{作成|さくせい}}する](term:term-sakusei-suru)
  — creare un mazzo partendo da una lista nuova
- [デッキコード](term:term-deck-code)を[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru)
  — inserire il codice del mazzo in un campo
- `{{新規|しんき}}デッキ{{作成|さくせい}}` — pulsante nominale che comprime la
  frase di creazione

## Pattern grammaticali chiave

- [{{新規|しんき}}で〜する](grammar:grammar-state-de) — fare qualcosa in modalità
  nuova, non in un luogo fisico

## Etichette da riconoscere

- デッキ[{{編成|へんせい}}](term:term-hensei) — sezione di composizione del
  mazzo
- `Divisionを{{選択|せんたく}}する` — istruzione preliminare: scegliere la
  Division
- `{{決定|けってい}}` — conferma dopo l'immissione del codice

---

## 1. La cornice: prima la Division, poi l'azione

La schermata è divisa in due livelli. In alto, `Divisionを{{選択|せんたく}}する`
usa `を` per marcare ciò che devi scegliere: la Division. Le due opzioni,
ニュー・ディビジョン e オール・ディビジョン, sono label in katakana e inglese
grafico; il punto grammaticale è il verbo `{{選択|せんたく}}する`, cioè
"selezionare".

Sotto quella scelta preliminare, la UI passa a due azioni vere. Entrambe
ruotano attorno a `デッキ`, ma il verbo cambia il gesto: con
[{{作成|さくせい}}する](term:term-sakusei-suru) nasce una lista nuova, con
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) entra un valore in un campo.

:::image
src: assets/dmps-deckbuilder-overview.png
alt: >-
  Schermata di composizione mazzo di Duel Masters Plays con scelta della
  Division e due azioni principali.
caption: >-
  `Divisionを{{選択|せんたく}}する` prepara la scelta iniziale; sotto, la
  schermata contrappone [{{新規|しんき}}](term:term-shinki)でデッキを
  [{{作成|さくせい}}する](term:term-sakusei-suru) a
  [デッキコード](term:term-deck-code)を
  [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru).
:::

> [!NOTE]
> **⚖️ Contrasto operativo:** `{{選択|せんたく}}する` sceglie tra opzioni già
> visibili, mentre [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) richiede
> un dato che l'utente mette dentro un campo. In una UI web, questa differenza
> spesso decide se devi cliccare un'opzione o digitare/incollare qualcosa.

## 2. Creare da zero: `{{新規|しんき}}でデッキを{{作成|さくせい}}する`

Il blocco di sinistra è la via della creazione. In
[{{新規|しんき}}](term:term-shinki)でデッキを
[{{作成|さくせい}}する](term:term-sakusei-suru),
[{{新規|しんき}}](term:term-shinki) non descrive un mazzo "recente" o "ultimo":
indica che l'azione parte come nuova registrazione, senza usare un codice
preparato altrove.

Il `で` di [{{新規|しんき}}で〜する](grammar:grammar-state-de) non è il `で` di
luogo. Qui marca la modalità dell'azione: "creare in stato nuovo", cioè
avviare la composizione da una lista vuota. Poi `デッキを` dà l'oggetto
dell'azione, e [{{作成|さくせい}}する](term:term-sakusei-suru) dà il verbo
tecnico da UI: creare o generare un oggetto gestibile dal sistema.

:::example_sentence
jp: >-
  {{新規|しんき}}でデッキを{{作成|さくせい}}する。
translation_it: >-
  Creare un mazzo nuovo da zero.
:::

#### 🗺️ Anatomia della frase

- `{{新規|しんき}}で` -> modalità dell'azione: il mazzo nasce come elemento
  nuovo, non come recupero di una lista esistente.
- `デッキを` -> oggetto diretto: è il mazzo a essere creato.
- `{{作成|さくせい}}する` -> verbo operativo: non "fare" in modo generico, ma
  creare una nuova entità nella UI.

> [!NOTE]
> **🧠 Gancio cognitivo:** quando [{{新規|しんき}}](term:term-shinki) appare
> prima di un'azione di sistema, leggilo come "nuova voce / nuovo elemento".
> Non è etimologia: è un trucco pratico per non scambiarlo con "recente".

:::image
src: assets/dmps-deckbuilder-create.png
alt: >-
  Blocco di sinistra con testo di creazione di un nuovo mazzo e pulsante
  principale.
caption: >-
  La frase guida usa [{{新規|しんき}}](term:term-shinki)でデッキを
  [{{作成|さくせい}}する](term:term-sakusei-suru); il pulsante la comprime in
  `{{新規|しんき}}デッキ{{作成|さくせい}}`.
:::

Nel pulsante `{{新規|しんき}}デッキ{{作成|さくせい}}`, la frase perde `で`, `を` e
`する`. Rimangono tre blocchi nominali: `{{新規|しんき}}`, `デッキ`,
`{{作成|さくせい}}`. È una compressione tipica dei pulsanti: non serve una
frase completa, basta nominare l'azione in modo leggibile a colpo d'occhio.

## 3. Inserire un codice: `デッキコードを{{入力|にゅうりょく}}する`

Il blocco di destra cambia logica. Qui il mazzo non nasce nella schermata:
arriva attraverso un [デッキコード](term:term-deck-code), cioè una stringa che
rappresenta una lista già pronta. Per questo il verbo non è
[{{作成|さくせい}}する](term:term-sakusei-suru), ma
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru).

[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) non significa semplicemente
"scrivere" in senso libero. In una UI indica l'immissione di un valore in un
campo: password, codice, numero, nome utente. La casella nera sotto
`デッキコードを{{入力|にゅうりょく}}する` conferma il frame: prima metti dentro il
codice, poi premi `{{決定|けってい}}`.

:::example_sentence
jp: >-
  デッキコードを{{入力|にゅうりょく}}する。
translation_it: >-
  Inserire il codice del mazzo.
:::

#### 🗺️ Anatomia della frase

- `デッキコードを` -> oggetto diretto: il valore da immettere è il codice del
  mazzo, non un nome libero.
- `{{入力|にゅうりょく}}する` -> azione di input: mettere un dato dentro un
  campo della UI.
- `{{決定|けってい}}` -> conferma successiva: chiude la scelta dopo
  l'immissione, non sostituisce il verbo di inserimento.

:::image
src: assets/dmps-deckbuilder-input.png
alt: >-
  Blocco di destra con campo per codice del mazzo e pulsante di conferma.
caption: >-
  Qui [デッキコード](term:term-deck-code) è l'oggetto da inserire,
  [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) è l'azione e
  `{{決定|けってい}}` arriva solo dopo l'immissione.
:::

> [!NOTE]
> **⚖️ Contrasto operativo:** [{{作成|さくせい}}する](term:term-sakusei-suru)
> genera qualcosa di nuovo nel sistema; [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru)
> mette nel sistema un valore che hai già. Se leggi `デッキコード`, aspettati un
> campo; se leggi `{{新規|しんき}}デッキ{{作成|さくせい}}`, aspettati l'avvio di
> una nuova composizione.

> [!NOTE]
> **🧠 Gancio cognitivo:** in `{{入力|にゅうりょく}}`, il kanji `{{入|にゅう}}`
> richiama l'idea di "entrata". Usalo come ancora visiva: un dato entra nel
> campo. Il valore tecnico completo resta "input / immissione".

## 4. Dal testo guida al pulsante compatto

La schermata mostra due registri della stessa UI. Le righe esplicative sono
frasi verbali complete: `{{新規|しんき}}でデッキを{{作成|さくせい}}する` e
`デッキコードを{{入力|にゅうりょく}}する`. I pulsanti invece preferiscono
etichette dense: `{{新規|しんき}}デッキ{{作成|さくせい}}` e
`{{決定|けってい}}`.

Questa alternanza è molto trasferibile nelle pagine web giapponesi. Quando vedi
una frase guida, cerca particelle e verbo finale: `で` marca la modalità, `を`
marca l'oggetto, `する` chiude l'azione. Quando vedi un pulsante, aspettati un
composto nominale o una parola di conferma: meno grammatica esplicita, più
funzione immediata.

> [!WARNING]
> `{{決定|けってい}}` non è il contrario di
> [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru). `{{入力|にゅうりょく}}する`
> descrive l'immissione del codice; `{{決定|けってい}}` conferma il valore già
> immesso. Se li confondi, rischi di leggere il pulsante come "inserisci" quando
> in realtà significa "conferma".

## Esempi guidati di riepilogo

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
  Inserisco il codice del mazzo.
:::

:::example_sentence
jp: >-
  デッキコードを{{入力|にゅうりょく}}してから、{{決定|けってい}}を{{押|お}}す。
translation_it: >-
  Dopo aver inserito il codice del mazzo, premo Conferma.
:::

:::example_sentence
jp: >-
  {{新規|しんき}}デッキ{{作成|さくせい}}を{{選|えら}}ぶと、{{新|あたら}}しいデッキから{{始|はじ}}まる。
translation_it: >-
  Se scelgo Creazione nuovo mazzo, parto da un mazzo nuovo.
:::

## Nota finale

La schermata si legge bene se separi modalità, oggetto e azione. A sinistra
[{{新規|しんき}}](term:term-shinki) + [{{作成|さくせい}}する](term:term-sakusei-suru)
apre una composizione nuova; a destra [デッキコード](term:term-deck-code) +
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) ti dice di immettere un
valore già pronto. I pulsanti comprimono, ma non cambiano il sistema:
creazione, immissione, conferma.
