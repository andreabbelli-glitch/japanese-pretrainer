---
id: lesson-web-giapponese-dmps-takaratomy-deckbuilder-create-or-code-input
media_id: media-web-giapponese
slug: 030-dmps-takaratomy-deckbuilder-create-or-code-input
title: "Creare o inserire: le due strade del deckbuilder"
order: 30
segment_ref: dmps-takaratomy-deckbuilder
difficulty: n4
status: active
tags: [web, dmps, duel-masters-plays, deckbuilder, ui]
prerequisites: []
summary: >-
  Leggere la schermata di composizione mazzo: distinguere creazione da zero,
  codice già pronto e conferma finale.
---

# Creare o inserire: le due strade di デッキ{{編成|へんせい}}

La schermata デッキ{{編成|へんせい}} di *DUEL MASTERS PLAY'S* non apre subito la
lista delle carte. Prima ti fa stabilire due cose: in quale Division lavorare e
da dove deve nascere il mazzo. La UI separa quindi scelta preliminare, creazione
da zero e recupero tramite codice.

Il giapponese è breve, ma non è vago: `{{新規|しんき}}でデッキを{{作成|さくせい}}する`
ti dice che il mazzo viene creato come nuova voce, mentre
`デッキコードを{{入力|にゅうりょく}}する` ti dice che un valore già pronto va
immesso in un campo. La differenza tra queste due frasi decide se clicchi per
iniziare una composizione nuova o se incolli un codice e poi confermi.

## Termini chiave

- [{{新規|しんき}}](term:term-shinki) — nuovo, da zero, come nuova creazione
- [{{作成|さくせい}}する](term:term-sakusei-suru) — creare o generare un oggetto
  nella UI
- [デッキコード](term:term-deck-code) — codice del mazzo, stringa che richiama
  una lista già pronta
- [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) — inserire, digitare,
  immettere un valore

## Espressioni ricorrenti

- [{{新規|しんき}}](term:term-shinki)でデッキを[{{作成|さくせい}}する](term:term-sakusei-suru) —
  creare un mazzo come nuova voce del sistema
- [デッキコード](term:term-deck-code)を[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) —
  immettere nel campo il codice di un mazzo già preparato
- `{{新規|しんき}}デッキ{{作成|さくせい}}` — pulsante compatto per iniziare una
  nuova composizione

## Pattern grammaticali chiave

- [{{新規|しんき}}で〜する](grammar:grammar-state-de) — fare qualcosa in modalità
  nuova, non in un luogo fisico

## Etichette da riconoscere

- デッキ[{{編成|へんせい}}](term:term-hensei) — sezione di composizione del
  mazzo
- `Divisionを{{選択|せんたく}}する` — istruzione preliminare: scegliere la
  Division
- `{{決定|けってい}}` — conferma il valore immesso nel campo

---

## 1. La cornice: prima la Division, poi l'azione

La prima riga operativa è `Divisionを{{選択|せんたく}}する`. `Division` resta in
inglese grafico, ma la grammatica è giapponese: `を` marca l'oggetto della
scelta e `{{選択|せんたく}}する` chiude con il verbo tecnico "selezionare". Le due
opzioni, ニュー・ディビジョン e オール・ディビジョン, sono le strade disponibili;
la frase sopra di loro dice quale tipo di gesto la UI si aspetta.

デッキ[{{編成|へんせい}}](term:term-hensei) è la cornice di tutto il flusso.
[{{編成|へんせい}}](term:term-hensei) non significa solo "modifica": in una UI di
Duel Masters indica la composizione concreta del mazzo, quindi scelta di carte,
Division e formato di partenza. Se leggi `デッキ{{編成|へんせい}}` come titolo di
sezione, preparati a una schermata di costruzione, non a una semplice lista
informativa.

Sotto questa cornice, la schermata passa a due azioni sul `デッキ`. A sinistra
il mazzo viene creato con [{{作成|さくせい}}する](term:term-sakusei-suru); a
destra il mazzo viene richiamato tramite [デッキコード](term:term-deck-code), e
quindi il verbo diventa [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru). La
UI non sta offrendo due sinonimi: sta distinguendo una nuova entità da un dato
da immettere.

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

:::example_sentence
jp: >-
  Divisionを{{選択|せんたく}}する。
translation_it: >-
  Selezionare la Division.
:::

#### 🗺️ Anatomia della frase

*   `Divisionを` ➔ **oggetto della selezione**: `を` indica che la Division è la
    cosa da scegliere, non il luogo in cui avviene l'azione.
*   `{{選択|せんたく}}する` ➔ **verbo tecnico da UI**: trasforma il nome
    `{{選択|せんたく}}` ("selezione") nell'azione "selezionare".

#### ⚖️ Contrasto operativo

`{{選択|せんたく}}する` sceglie tra opzioni già
visibili, mentre [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) richiede
un dato che l'utente mette dentro un campo. In una UI web, questa differenza
spesso decide se devi cliccare un'opzione o digitare/incollare qualcosa.

## 2. Creare da zero: `{{新規|しんき}}でデッキを{{作成|さくせい}}する`

Il blocco di sinistra parla come una frase guida completa:
[{{新規|しんき}}](term:term-shinki)でデッキを
[{{作成|さくせい}}する](term:term-sakusei-suru). Qui
[{{新規|しんき}}](term:term-shinki) non vuol dire "recente" nel senso di ultimo
arrivato; indica lo stato iniziale dell'operazione, cioè una nuova voce creata
nel sistema.

Il で di [{{新規|しんき}}で〜する](grammar:grammar-state-de) non ti porta in un
luogo: marca la modalità con cui avviene l'azione. Prima la frase imposta
"come" parte la creazione (`{{新規|しんき}}で`), poi dice "che cosa" viene creato
(`デッキを`), infine chiude con il verbo tecnico
[{{作成|さくせい}}する](term:term-sakusei-suru). In una UI, {{作成|さくせい}}する
non è un "fare" generico: è creare un oggetto che il sistema potrà salvare,
modificare e riaprire.

:::example_sentence
jp: >-
  {{新規|しんき}}でデッキを{{作成|さくせい}}する。
translation_it: >-
  Creare un mazzo nuovo da zero.
:::

#### 🗺️ Anatomia della frase

*   `{{新規|しんき}}で` ➔ **modalità dell'azione**: il mazzo nasce come elemento
    nuovo, non come recupero di una lista esistente.
*   `デッキを` ➔ **oggetto diretto**: è il mazzo a ricevere l'azione di
    creazione.
*   `{{作成|さくせい}}する` ➔ **verbo operativo**: crea una nuova entità nella UI,
    invece di limitarsi a descrivere una costruzione manuale.

#### 🧠 Gancio cognitivo

Quando [{{新規|しんき}}](term:term-shinki) appare
prima di un'azione di sistema, leggilo come "nuova voce / nuovo elemento".
Non è etimologia: è un trucco pratico per non scambiarlo con "recente".

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

Nel pulsante `{{新規|しんき}}デッキ{{作成|さくせい}}`, la UI taglia `で`, `を` e
`する`. Rimangono tre blocchi nominali: `{{新規|しんき}}`, `デッキ`,
`{{作成|さくせい}}`. È una compressione tipica dei pulsanti giapponesi: il
testo non spiega più la frase, ma etichetta l'azione che parte al clic.

#### ⚖️ Contrasto operativo

`{{新規|しんき}}でデッキを{{作成|さくせい}}する` è una
frase guida, quindi mostra particelle e verbo finale. `{{新規|しんき}}デッキ{{作成|さくせい}}`
è una label da pulsante, quindi conserva solo i nomi funzionali. Non cercare
un `を` nascosto: il ruolo dell'oggetto è implicito nella posizione del testo.

## 3. Inserire un codice: `デッキコードを{{入力|にゅうりょく}}する`

Il blocco di destra parte da un oggetto diverso:
[デッキコード](term:term-deck-code). La parola è in katakana perché viene dal
lessico di prodotto, ma la frase intorno è ordinaria: `デッキコードを` marca il
codice come oggetto e [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) dice che
quel valore deve entrare nel campo.

[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) non equivale a "scrivere" in
senso libero. In una schermata web indica input controllato: password, codice,
numero, nome utente. La casella nera sotto la frase conferma il frame
linguistico: il testo chiede un valore preciso, non una scelta tra opzioni.
Dopo l'immissione, `{{決定|けってい}}` chiude l'azione come conferma.

:::example_sentence
jp: >-
  デッキコードを{{入力|にゅうりょく}}する。
translation_it: >-
  Inserire il codice del mazzo.
:::

#### 🗺️ Anatomia della frase

*   `デッキコードを` ➔ **oggetto diretto**: il valore da immettere è il codice
    del mazzo, non un nome libero.
*   `{{入力|にゅうりょく}}する` ➔ **azione di input**: mettere un dato dentro un
    campo della UI.
*   `{{決定|けってい}}` ➔ **conferma successiva**: chiude il valore già immesso,
    non sostituisce il gesto di inserimento.

:::image
src: assets/dmps-deckbuilder-input.png
alt: >-
  Blocco di destra con campo per codice del mazzo e pulsante di conferma.
caption: >-
  Qui [デッキコード](term:term-deck-code) è l'oggetto da inserire,
  [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) è l'azione e
  `{{決定|けってい}}` arriva solo dopo l'immissione.
:::

#### ⚖️ Contrasto operativo

[{{作成|さくせい}}する](term:term-sakusei-suru)
genera qualcosa di nuovo nel sistema; [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru)
mette nel sistema un valore che hai già. Se leggi [デッキコード](term:term-deck-code),
aspettati un campo; se leggi `{{新規|しんき}}デッキ{{作成|さくせい}}`, aspettati
l'avvio di una nuova composizione.

#### 🧠 Gancio cognitivo

In `{{入力|にゅうりょく}}`, il kanji `{{入|にゅう}}`
richiama l'idea di "entrata". Usalo come ancora visiva: un dato entra nel
campo. Il valore tecnico completo resta "input / immissione".

## 4. Confermare non è inserire

`{{決定|けってい}}` è una parola breve, ma nella UI ha un ruolo preciso: decide
o conferma ciò che è già stato scelto o immesso. Dopo
`デッキコードを{{入力|にゅうりょく}}する`, il pulsante non ti chiede di digitare
ancora; prende il codice presente nel campo e passa allo step successivo.

Il contrasto con `{{選択|せんたく}}する` aiuta a non confondere i passaggi.
`{{選択|せんたく}}する` nomina l'atto di scegliere tra opzioni; `{{決定|けってい}}`
arriva quando quella scelta deve diventare definitiva. Nella schermata del
codice, invece, [{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) è il gesto di
riempire il campo e `{{決定|けってい}}` è il clic che conferma il contenuto.

:::example_sentence
jp: >-
  デッキコードを{{入力|にゅうりょく}}してから、{{決定|けってい}}を{{押|お}}す。
translation_it: >-
  Dopo aver inserito il codice del mazzo, premo Conferma.
:::

#### 🗺️ Anatomia della frase

*   `デッキコードを{{入力|にゅうりょく}}してから` ➔ **sequenza temporale**:
    `〜してから` dice che prima inserisci il codice e solo dopo fai l'azione
    successiva.
*   `{{決定|けってい}}を` ➔ **oggetto del clic**: il target non è il codice, ma il
    pulsante di conferma.
*   `{{押|お}}す` ➔ **azione fisica sulla UI**: premere/cliccare il pulsante.

#### ⚖️ Contrasto operativo

`{{決定|けってい}}` non è il contrario di
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru). {{入力|にゅうりょく}}する
descrive l'immissione del codice; `{{決定|けってい}}` conferma il valore già
immesso. Se li confondi, rischi di leggere il pulsante come "inserisci" quando
in realtà significa "conferma".

## 5. Leggere la UI per registri: frase guida, campo, pulsante

La schermata alterna tre registri. Le frasi guida sono complete:
`{{新規|しんき}}でデッキを{{作成|さくせい}}する` e
`デッキコードを{{入力|にゅうりょく}}する`; qui cerchi particelle e verbo finale. Il
campo è quasi muto: si capisce dal sostantivo che lo precede,
[デッキコード](term:term-deck-code). I pulsanti comprimono: {{新規|しんき}}デッキ{{作成|さくせい}}
nomina l'azione, `{{決定|けってい}}` nomina la conferma.

Questo schema torna spesso nelle UI giapponesi. Quando una riga contiene `を` e
`する`, stai leggendo un'azione esplicita. Quando il testo è un blocco nominale
senza particelle, probabilmente sei davanti a un'etichetta o a un pulsante.
Quando compare un campo, il sostantivo prima del campo ti dice che tipo di dato
deve entrarci.

#### 🧠 Gancio cognitivo

Pensa alla schermata come a tre corsie: frase guida =
"che azione è", campo = "che dato serve", pulsante = "che cosa parte adesso".
È un trucco di lettura, non una regola grammaticale assoluta.

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
  Inserire il codice del mazzo.
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

La schermata diventa prevedibile quando separi modalità, oggetto e azione. A
sinistra [{{新規|しんき}}](term:term-shinki) + [{{作成|さくせい}}する](term:term-sakusei-suru)
apre una composizione nuova; a destra [デッキコード](term:term-deck-code) +
[{{入力|にゅうりょく}}する](term:term-nyuryoku-suru) chiede un valore già pronto;
`{{決定|けってい}}` conferma solo dopo l'immissione. Le label dei pulsanti
comprimono la grammatica, ma non cambiano il flusso: scegliere, creare,
inserire, confermare.
