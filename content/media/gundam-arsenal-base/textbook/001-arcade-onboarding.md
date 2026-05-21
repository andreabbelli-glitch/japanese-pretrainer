---
id: lesson-gundam-arsenal-base-arcade-onboarding
media_id: media-gundam-arsenal-base
slug: arcade-onboarding
title: Onboarding arcade
order: 10
segment_ref: arcade-onboarding
difficulty: n4
status: active
tags: [arcade, onboarding, ui, account]
prerequisites: []
summary: >-
  Riconosci il cabinato, distingui IC card, account e My Page, e segui il
  flusso di una prima partita.
---

# Dal cabinato alla partita: tessera, carte e primo avvio

Davanti a un cabinato di *Gundam Arsenal Base*, il giapponese non descrive solo
oggetti: ti dice dove appoggiare la tessera, dove mettere le carte, quale dato
stai caricando e quale comando ti porta davvero in battaglia. La prima lettura
da separare è fisica: [カードリーダー](term:term-card-reader) non è il
[カードスロット](term:term-card-slot), e una
[アミューズメントICカード](term:term-amusement-ic-card) non funziona come una
[MSカード](term:term-ms-card).

Il flusso iniziale alterna tre livelli: profilo salvato, mazzo fisico e
conferme sul [タッチパネル](term:term-touch-panel). Quando riconosci questi
livelli, parole come [{{呼|よ}}び{{出|だ}}す](term:term-call-up),
[デッキ](term:term-deck) e [{{出撃|しゅつげき}}](term:term-sortie) smettono di
essere etichette sparse e diventano istruzioni in sequenza: carica i dati,
prepara le unità, poi entra in partita.

## Termini chiave

- [アミューズメントICカード](term:term-amusement-ic-card) — tessera IC che identifica il profilo giocatore
- [タッチパネル](term:term-touch-panel) — schermo tattile dove selezioni e confermi
- [カードスロット](term:term-card-slot) — alloggiamento delle carte da gioco
- [カードリーダー](term:term-card-reader) — lettore della tessera IC
- [ボタン](term:term-button) — pulsante fisico del cabinato
- [イヤホンジャック](term:term-earphone-jack) — presa cuffie
- [カード{{取|と}}り{{出|だ}}し{{口|ぐち}}](term:term-card-outlet) — uscita delle carte erogate
- [MSカード](term:term-ms-card) — carta Mobile Suit
- [PLカード](term:term-pl-card) — carta pilota
- [ユニット](term:term-unit) — coppia MS + PL usata in battaglia
- [デッキ](term:term-deck) — insieme delle carte preparate per la partita
- [スターターデッキ](term:term-starter-deck) — mazzo iniziale già pronto

## Espressioni ricorrenti

- [{{呼|よ}}び{{出|だ}}す](term:term-call-up) — richiamare dati già salvati
- [{{出撃|しゅつげき}}](term:term-sortie) — far entrare in campo / partire in battaglia
- [MY PAGE](term:term-mypage) — servizio web dove rivedi dati del profilo
- [{{戦績|せんせき}}](term:term-battle-record) — risultati di battaglia salvati

## Pattern grammaticali chiave

- [～をセットする](grammar:grammar-wo-setto-suru) — mettere l'oggetto richiesto nello slot o nella posizione prevista
- [～をタッチする](grammar:grammar-wo-tacchi-suru) — toccare l'elemento indicato con input breve
- [～することで](grammar:grammar-suru-koto-de) — compiendo X, ottieni Y

## Etichette da riconoscere

- [{{作戦|さくせん}}カード](term:term-tactics-card) — carta tattica digitale equipaggiata in slot dedicati
- [メイン{{枠|わく}}](term:term-main-slot) — slot principale
- [サブ{{枠|わく}}](term:term-sub-slot) — slot secondario

---

## 1. Profilo, tessera e dati: chi sei per il cabinato

La [アミューズメントICカード](term:term-amusement-ic-card) è la chiave fisica del
profilo. `ICカード` segnala la tessera, mentre `アミューズメント` restringe il
contesto alla sala giochi: quando la appoggi al [カードリーダー](term:term-card-reader),
il cabinato non sta leggendo una carta del mazzo, ma sta identificando il
giocatore e i dati di gioco collegati.

[{{呼|よ}}び{{出|だ}}す](term:term-call-up) è il verbo giusto per questa azione:
`{{呼|よ}}ぶ` richiama, `{{出|だ}}す` porta fuori. In una schermata di avvio,
non significa "chiamare qualcuno" in senso narrativo, ma recuperare dati già
registrati e renderli disponibili alla macchina. Per questo si combina
naturalmente con parole come `プレイデータ` e con il gesto sul
[カードリーダー](term:term-card-reader).

[MY PAGE](term:term-mypage) appartiene invece al livello web. Mostra profilo,
missioni, [{{戦績|せんせき}}](term:term-battle-record) e avanzamento fuori dalla
sessione arcade, ma non sostituisce il gesto fisico della tessera sul cabinato.
Se una schermata parla di registrazione o consultazione dati, chiediti prima se
sta nominando il supporto fisico, il profilo salvato o la pagina web: sono tre
cose collegate, ma non intercambiabili.

:::example_sentence
jp: >-
  アミューズメントICカードをタッチして、プレイデータを{{読|よ}}み{{込|こ}}みます。
translation_it: >-
  Tocca la carta IC e carica i dati di gioco.
:::

#### 🗺️ Anatomia della frase

- `アミューズメントICカードを` -> `を` marca la tessera come oggetto dell'azione: è ciò che devi toccare, non il risultato che ottieni.
- `タッチして` -> forma in `-te`: prima fai il contatto sul lettore, poi avviene l'azione successiva.
- `プレイデータを{{読|よ}}み{{込|こ}}みます` -> `{{読|よ}}み{{込|こ}}む` dice "leggere dentro / caricare"; il dato entra nel sistema del cabinato.

> [!NOTE]
> **⚖️ Contrasto operativo:** [カードリーダー](term:term-card-reader) legge la
> tessera IC; [カードスロット](term:term-card-slot) riceve le carte MS e PL. Se
> confondi `リーダー` e `スロット`, confondi identità del profilo e costruzione
> del mazzo.

## 2. Il cabinato come mappa di verbi operativi

:::image
src: assets/ui/arcade-cabinet-overview.webp
alt: "Cabinato ufficiale di Gundam Arsenal Base visto frontalmente, con schermo, fila di card slot, pulsante destro e uscita carte inferiore ben visibili."
caption: >-
  Vista ufficiale del cabinato: lo schermo corrisponde al
  [タッチパネル](term:term-touch-panel), la fila orizzontale ai
  [カードスロット](term:term-card-slot), il comando fisico al
  [ボタン](term:term-button) e l'uscita inferiore al
  [カード{{取|と}}り{{出|だ}}し{{口|ぐち}}](term:term-card-outlet).
:::

I nomi dei componenti sono quasi tutti composti trasparenti se li leggi come
etichette d'azione. [タッチパネル](term:term-touch-panel) è il pannello che
riceve `タッチする`; [カードスロット](term:term-card-slot) è lo spazio in cui
`セットする` le carte; [カード{{取|と}}り{{出|だ}}し{{口|ぐち}}](term:term-card-outlet)
contiene già la forma `{{取|と}}り{{出|だ}}し`, "tirare fuori", e `{{口|ぐち}}`,
"bocca / apertura". Il nome stesso ti dice che non è un comando da premere, ma
l'apertura da controllare quando la macchina eroga una carta.

- [タッチパネル](term:term-touch-panel): qui leggi menu, tocchi opzioni e
  confermi. In frasi con [～をタッチする](grammar:grammar-wo-tacchi-suru),
  l'elemento prima di `を` è il bersaglio preciso del tocco.
- [カードスロット](term:term-card-slot): qui metti le carte fisiche. In frasi
  con [～をセットする](grammar:grammar-wo-setto-suru), `セットする` non significa
  "impostare" in astratto: significa collocare la carta nello slot corretto.
- [ボタン](term:term-button) e [イヤホンジャック](term:term-earphone-jack):
  restano componenti fisici, non categorie del menu. Il primo si preme, il
  secondo riceve le cuffie.
- [カード{{取|と}}り{{出|だ}}し{{口|ぐち}}](term:term-card-outlet): `{{口|ぐち}}`
  segnala l'imboccatura di uscita; se il gioco ha stampato o erogato una carta,
  questo è il punto da controllare prima di alzarti.

:::example_sentence
jp: >-
  タッチパネルの{{表示|ひょうじ}}を{{確認|かくにん}}して、ボタンを{{押|お}}します。
translation_it: >-
  Controlli ciò che appare sul touch panel e premi il pulsante.
:::

#### 🗺️ Anatomia della frase

- `タッチパネルの{{表示|ひょうじ}}を` -> `の` collega pannello e contenuto mostrato: non guardi il pannello come oggetto fisico, ma l'informazione visualizzata.
- `{{確認|かくにん}}して` -> prima confermi mentalmente o visivamente il contenuto; la forma in `-te` prepara l'azione successiva.
- `ボタンを{{押|お}}します` -> `{{押|お}}す` è il verbo fisico "premere"; il bersaglio è il [ボタン](term:term-button), non il [タッチパネル](term:term-touch-panel).

> [!NOTE]
> **🧠 Gancio cognitivo:** in `カード{{取|と}}り{{出|だ}}し{{口|ぐち}}`, pensa a
> `{{口|ぐち}}` come all'apertura da cui qualcosa "esce dalla bocca" della
> macchina. È un trucco mnemonico, non una spiegazione tecnica del cabinato.

## 3. MS, PL e unit: come il mazzo diventa schierabile

Nel [カードスロット](term:term-card-slot), le carte non sono solo archiviate:
vengono lette come coppie. [MSカード](term:term-ms-card) nomina il Mobile Suit,
[PLカード](term:term-pl-card) nomina il pilota, e la coppia verticale diventa
un [ユニット](term:term-unit). Qui `ユニット` non indica una "unità" generica
da menu gestionale, ma il blocco giocabile che può entrare in campo.

[デッキ](term:term-deck) è il contenitore della composizione, mentre
[スターターデッキ](term:term-starter-deck) è una composizione già pronta. Se sei
alla prima partita, il valore linguistico di `スターター` è proprio "iniziale":
non ti sta chiedendo di ottimizzare, ti sta offrendo una struttura completa per
vedere subito la logica MS + PL.

:::example_sentence
jp: >-
  {{上|うえ}}の{{段|だん}}にMSカード、{{下|した}}の{{段|だん}}にPLカードをセットします。
translation_it: >-
  Metti le carte MS nella fila superiore e le carte PL in quella inferiore.
:::

#### 🗺️ Anatomia della frase

- `{{上|うえ}}の{{段|だん}}に` -> `{{段|だん}}` è la fila/livello; `に` indica la posizione di destinazione.
- `MSカード、{{下|した}}の{{段|だん}}にPLカードを` -> la frase mette in parallelo la fila alta e quella bassa: il contrasto spaziale è parte dell'istruzione.
- `セットします` -> [～をセットする](grammar:grammar-wo-setto-suru) chiude la frase come azione di collocazione nello slot, non come scelta astratta nel menu.

> [!WARNING]
> **⚖️ Contrasto operativo: carta singola vs unità**
> [MSカード](term:term-ms-card) e [PLカード](term:term-pl-card) sono oggetti
> separati, ma in battaglia leggi la coppia come [ユニット](term:term-unit).
> Se guardi solo la carta singola, perdi il rapporto verticale che il cabinato
> usa per costruire l'unità schierabile.

## 4. Sblocchi, slot tattici e uscita verso la battaglia

Le [{{作戦|さくせん}}カード](term:term-tactics-card) aggiungono un livello
tattico al [デッキ](term:term-deck). `{{作戦|さくせん}}` significa piano o
operazione: non è una carta MS e non è una carta pilota, ma un effetto da
equipaggiare in uno spazio dedicato. [メイン{{枠|わく}}](term:term-main-slot) e
[サブ{{枠|わく}}](term:term-sub-slot) usano `{{枠|わく}}`, "cornice / slot":
il nome ti dice che stai scegliendo dove inserire l'effetto, non chi mandare in
campo.

Quando compare [{{出撃|しゅつげき}}](term:term-sortie), il testo cambia fase.
`{{出|しゅつ}}` porta l'idea di uscire, `{{撃|げき}}` quella dell'attacco:
in contesto militare e arcade, [{{出撃|しゅつげき}}](term:term-sortie) è
l'uscita operativa verso la battaglia. Non leggerlo come un semplice "avvia":
è il comando che trasforma la preparazione del mazzo in ingresso sul campo.

:::example_sentence
jp: >-
  {{作戦|さくせん}}カードが{{未解放|みかいほう}}なら、この{{手順|てじゅん}}は{{飛|と}}ばします。
translation_it: >-
  Se le carte tattiche non sono ancora sbloccate, questo passaggio si salta.
:::

#### 🗺️ Anatomia della frase

- `{{作戦|さくせん}}カードが` -> `が` marca ciò di cui si controlla lo stato: la domanda è se quella funzione è disponibile.
- `{{未解放|みかいほう}}なら` -> `{{未|み}}` nega/indica "non ancora", `{{解放|かいほう}}` è lo sblocco; `なら` trasforma lo stato in condizione.
- `この{{手順|てじゅん}}は{{飛|と}}ばします` -> `{{手順|てじゅん}}` è il passaggio della procedura; `{{飛|と}}ばす` qui significa saltarlo, non farlo volare.

> [!NOTE]
> **⚖️ Contrasto operativo:** `{{未解放|みかいほう}}` non vuol dire che la carta
> è rotta o assente fisicamente. Vuol dire che quella funzione non è ancora
> utilizzabile nel profilo o nel flusso corrente, quindi il passaggio va
> ignorato finché il gioco non lo rende disponibile.

## Esempi guidati di riepilogo

Quando leggi una schermata di avvio, cerca prima il bersaglio marcato da `を`:
se è [アミューズメントICカード](term:term-amusement-ic-card), l'azione riguarda
il profilo; se è [MSカード](term:term-ms-card) o [PLカード](term:term-pl-card),
riguarda la costruzione del [デッキ](term:term-deck).

:::example_sentence
jp: >-
  カードリーダーにアミューズメントICカードをタッチすることで、プレイデータを{{呼|よ}}び{{出|だ}}せます。
translation_it: >-
  Toccando la carta IC sul lettore, puoi richiamare i dati di gioco.
:::

:::example_sentence
jp: >-
  MSカードとPLカードをカードスロットにセットすると、{{1|ひと}}つのユニットになります。
translation_it: >-
  Quando metti una carta MS e una carta PL nel card slot, diventano una unità.
:::

:::example_sentence
jp: >-
  メイン{{枠|わく}}に{{作戦|さくせん}}カードをセットしてから、{{出撃|しゅつげき}}します。
translation_it: >-
  Dopo aver messo una carta tattica nello slot principale, esci in battaglia.
:::

## Nota finale

Il primo onboarding si legge bene se separi tre domande: quale dato sto
richiamando, quale carta sto collocando, quale comando mi manda in battaglia.
[アミューズメントICカード](term:term-amusement-ic-card), [カードスロット](term:term-card-slot)
e [{{出撃|しゅつげき}}](term:term-sortie) rispondono a domande diverse; tenerle
separate ti evita di cercare sullo schermo ciò che in realtà va fatto con una
tessera, una carta fisica o un pulsante.
