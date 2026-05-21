---
id: lesson-gundam-arsenal-base-arcade-onboarding
media_id: media-gundam-arsenal-base
slug: arcade-onboarding
title: "Tessera, carte e primo avvio al cabinato"
order: 10
segment_ref: arcade-onboarding
difficulty: n4
status: active
tags: [arcade, onboarding, ui, account]
prerequisites: []
summary: >-
  Separare tessera IC, lettore, slot carte, My Page e comandi di avvio per
  leggere senza confondere profilo, deck fisico e ingresso in battaglia.
---

# Dal cabinato alla partita: tessera, carte e primo avvio

Davanti a un cabinato di *Gundam Arsenal Base*, il giapponese parte dagli
oggetti fisici: la tessera da appoggiare, le carte da inserire, il pannello da
toccare e il pulsante da premere. Se leggi subito questi nomi come una mappa di
azioni, [カードリーダー](term:term-card-reader) e
[カードスロット](term:term-card-slot) smettono di sembrare due "posti per carte"
intercambiabili: il primo legge il profilo, il secondo costruisce il deck.

Il primo avvio alterna tre livelli. La
[アミューズメントICカード](term:term-amusement-ic-card) richiama dati già
salvati, il [デッキ](term:term-deck) mette insieme [MSカード](term:term-ms-card)
e [PLカード](term:term-pl-card), e [{{出撃|しゅつげき}}](term:term-sortie)
sposta la preparazione verso la battaglia. Tenere separati questi livelli
evita l'errore più comune: cercare sullo schermo un'azione che il cabinato vuole
farti compiere con una tessera o con una carta fisica.

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

## 1. Tessera IC e dati salvati: quando il cabinato capisce chi sei

La [アミューズメントICカード](term:term-amusement-ic-card) non appartiene al
deck. `ICカード` segnala il supporto che salva e richiama dati, mentre
`アミューズメント` colloca quel supporto nella sala giochi. Quando il testo ti
manda al [カードリーダー](term:term-card-reader), il punto non è "giocare una
carta": è far riconoscere al cabinato il profilo collegato alla tessera.

Il verbo [{{呼|よ}}び{{出|だ}}す](term:term-call-up) rende visibile proprio quel
movimento dei dati. `{{呼|よ}}ぶ` è "chiamare / richiamare"; `{{出|だ}}す` è
"far uscire / portare fuori". In un dialogo narrativo potrebbe voler dire
chiamare qualcuno, ma nel flusso arcade significa far riemergere dati già
registrati, come il profilo o la sessione precedente.

:::example_sentence
jp: >-
  アミューズメントICカードをカードリーダーにタッチすることで、プレイデータを{{呼|よ}}び{{出|だ}}せます。
translation_it: >-
  Toccando la tessera IC sul lettore, puoi richiamare i dati di gioco.
:::

#### 🗺️ Anatomia della frase

*   `アミューズメントICカードを` ➔ **Oggetto del tocco** (`を` marca la tessera: è l'oggetto che devi appoggiare o avvicinare).
*   `カードリーダーに` ➔ **Destinazione fisica** (`に` indica il punto del cabinato verso cui porti la tessera).
*   `タッチすることで` ➔ **Azione che produce un risultato** ([～することで](grammar:grammar-suru-koto-de) collega il gesto al payoff: facendo X, diventa possibile Y).
*   `プレイデータを{{呼|よ}}び{{出|だ}}せます` ➔ **Recupero dati possibile** (`{{呼|よ}}び{{出|だ}}す` richiama fuori dati già salvati; `〜せます` dice che l'azione è possibile).

> [!NOTE]
> **⚖️ Contrasto operativo:** [カードリーダー](term:term-card-reader) legge la
> tessera IC; [カードスロット](term:term-card-slot) riceve le carte MS e PL. Se
> confondi `リーダー` e `スロット`, confondi identità del profilo e costruzione
> del deck.

[MY PAGE](term:term-mypage) sposta lo stesso profilo fuori dal cabinato. Il
nome è inglese, ma la funzione è giapponese da UI: una pagina personale dove
rivedere missioni, avanzamento e [{{戦績|せんせき}}](term:term-battle-record).
Non sostituisce la tessera durante la partita. Se compare in una guida, il
testo sta passando dal gesto in sala giochi alla consultazione dei dati salvati.

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

Le parti del cabinato si leggono bene se associ ogni nome al verbo che lo
attiva. [タッチパネル](term:term-touch-panel) riceve `タッチする`;
[カードスロット](term:term-card-slot) riceve `セットする`;
[ボタン](term:term-button) riceve `{{押|お}}す`. La differenza non è estetica:
ti dice se il gioco vuole un tap su schermo, una carta infilata nello slot o un
input fisico sul comando laterale.

*   [タッチパネル](term:term-touch-panel) è il pannello dove il bersaglio prima
    di `を` viene toccato. In [～をタッチする](grammar:grammar-wo-tacchi-suru),
    `を` non marca una scelta astratta: marca il punto preciso su cui fai tap.
*   [カードスロット](term:term-card-slot) è lo spazio delle carte da gioco. In
    [～をセットする](grammar:grammar-wo-setto-suru), `セットする` non è
    "impostare" in senso generico: è mettere l'oggetto nella posizione prevista.
*   [カード{{取|と}}り{{出|だ}}し{{口|ぐち}}](term:term-card-outlet) contiene già
    `{{取|と}}り{{出|だ}}し`, "estrazione / tirare fuori", e `{{口|ぐち}}`,
    "apertura". Il nome non ti chiede di premere qualcosa: ti dice dove
    recuperare la carta erogata.
*   [イヤホンジャック](term:term-earphone-jack) è trasparente come prestito
    tecnico. Non appartiene al menu: è il punto fisico per collegare le cuffie
    quando la sala giochi copre l'audio.

:::example_sentence
jp: >-
  タッチパネルの{{表示|ひょうじ}}を{{確認|かくにん}}してから、ボタンを{{押|お}}します。
translation_it: >-
  Dopo aver controllato ciò che appare sul touch panel, premi il pulsante.
:::

#### 🗺️ Anatomia della frase

*   `タッチパネルの{{表示|ひょうじ}}を` ➔ **Contenuto mostrato** (`の` collega il pannello alla visualizzazione: guardi l'informazione sullo schermo, non il pannello come oggetto).
*   `{{確認|かくにん}}してから` ➔ **Prima conferma, poi azione** (`〜してから` ordina la sequenza: controllare precede premere).
*   `ボタンを{{押|お}}します` ➔ **Input fisico** (`{{押|お}}す` è "premere"; il bersaglio è il [ボタン](term:term-button), non il [タッチパネル](term:term-touch-panel)).

> [!NOTE]
> **🧠 Gancio cognitivo:** in
> [カード{{取|と}}り{{出|だ}}し{{口|ぐち}}](term:term-card-outlet), pensa a
> `{{口|ぐち}}` come all'apertura da cui esce qualcosa. È un trucco di memoria:
> il valore pratico è riconoscere l'uscita delle carte, non un altro slot di
> inserimento.

## 3. MS, PL e unità: quando due carte diventano un pezzo giocabile

Nel [カードスロット](term:term-card-slot), le carte non vengono lette come un
mazzo da pescare. [MSカード](term:term-ms-card) nomina il Mobile Suit,
[PLカード](term:term-pl-card) nomina il pilota, e la coppia costruisce una
[ユニット](term:term-unit). Qui `ユニット` non è una parola generica da menu:
è il blocco MS + PL che il gioco può mandare sul campo.

[デッキ](term:term-deck) è quindi la composizione preparata per la partita, non
un pacchetto di carte da mescolare. [スターターデッキ](term:term-starter-deck)
aggiunge `スターター`, cioè "iniziale": quando lo vedi durante il primo avvio,
il gioco non ti sta chiedendo di ottimizzare subito, ma ti sta offrendo una
struttura pronta per capire la logica delle coppie.

:::example_sentence
jp: >-
  {{上段|じょうだん}}にMSカード、{{下段|げだん}}にPLカードをセットします。
translation_it: >-
  Metti le carte MS nella fila superiore e le carte PL in quella inferiore.
:::

#### 🗺️ Anatomia della frase

*   `{{上段|じょうだん}}にMSカード` ➔ **Posizione alta + carta MS** (`{{上段|じょうだん}}` è la fila superiore; `に` marca dove va collocata la carta).
*   `{{下段|げだん}}にPLカードを` ➔ **Posizione bassa + carta PL** (`{{下段|げだん}}` crea il contrasto spaziale con la fila superiore).
*   `セットします` ➔ **Collocazione nello slot** ([～をセットする](grammar:grammar-wo-setto-suru) chiude l'istruzione come azione fisica, non come scelta mentale del deck).

> [!WARNING]
> **⚖️ Contrasto operativo: carta singola vs unità**
> [MSカード](term:term-ms-card) e [PLカード](term:term-pl-card) restano oggetti
> separati, ma il cabinato legge la coppia come [ユニット](term:term-unit).
> Se guardi solo la carta singola, perdi il rapporto verticale che decide quale
> Mobile Suit combatte con quale pilota.

## 4. Slot tattici e 出撃: dalla preparazione all'ingresso in battaglia

Le [{{作戦|さくせん}}カード](term:term-tactics-card) aggiungono un livello che
non passa dagli slot MS e PL. `{{作戦|さくせん}}` significa piano, operazione,
tattica; per questo la carta non rappresenta un Mobile Suit o un pilota, ma un
effetto da equipaggiare. [メイン{{枠|わく}}](term:term-main-slot) e
[サブ{{枠|わく}}](term:term-sub-slot) usano `{{枠|わく}}`, "cornice / slot":
il testo sta parlando dello spazio in cui inserire l'effetto, non di un'altra
unità da schierare.

Quando compare [{{出撃|しゅつげき}}](term:term-sortie), il lessico cambia fase.
`{{出|しゅつ}}` porta l'idea di uscire, `{{撃|げき}}` quella del colpire: nel
registro militare di Gundam, [{{出撃|しゅつげき}}](term:term-sortie) è l'uscita
operativa verso lo scontro. Non leggerlo come un semplice "start"; è il punto
in cui ciò che hai preparato diventa presenza sul campo.

:::example_sentence
jp: >-
  {{作戦|さくせん}}カードが{{未解放|みかいほう}}なら、この{{手順|てじゅん}}は{{飛|と}}ばします。
translation_it: >-
  Se le carte tattiche non sono ancora sbloccate, questo passaggio si salta.
:::

#### 🗺️ Anatomia della frase

*   `{{作戦|さくせん}}カードが` ➔ **Tema controllato dalla condizione** (`が` mette a fuoco lo stato delle carte tattiche).
*   `{{未解放|みかいほう}}なら` ➔ **Condizione di non sblocco** (`{{未|み}}` segnala "non ancora"; `{{解放|かいほう}}` è lo sblocco; `なら` trasforma lo stato in una condizione pratica).
*   `この{{手順|てじゅん}}は{{飛|と}}ばします` ➔ **Passaggio saltato** (`{{手順|てじゅん}}` è la procedura; `{{飛|と}}ばす` qui significa saltare, non far volare qualcosa).

> [!NOTE]
> **⚖️ Contrasto operativo:** `{{未解放|みかいほう}}` non vuol dire che la carta
> fisica manca o che il cabinato è in errore. Vuol dire che quella funzione non
> è ancora utilizzabile nel profilo o nel flusso corrente, quindi il passaggio
> non va cercato negli slot MS/PL.

:::example_sentence
jp: >-
  メイン{{枠|わく}}に{{作戦|さくせん}}カードをセットしてから、{{出撃|しゅつげき}}します。
translation_it: >-
  Dopo aver messo una carta tattica nello slot principale, esci in battaglia.
:::

#### 🗺️ Anatomia della frase

*   `メイン{{枠|わく}}に` ➔ **Slot di destinazione** (`{{枠|わく}}` è lo spazio previsto; `メイン` lo distingue dal sub-slot).
*   `{{作戦|さくせん}}カードをセットしてから` ➔ **Preparazione completata prima dell'azione** (`〜してから` dice che l'equipaggiamento precede la fase successiva).
*   `{{出撃|しゅつげき}}します` ➔ **Ingresso operativo** (`{{出撃|しゅつげき}}する` porta la preparazione dentro la battaglia).

## Esempi guidati di riepilogo

Le schermate di avvio diventano più leggibili se segui il bersaglio marcato da
`を` e la posizione marcata da `に`. Se il bersaglio è la
[アミューズメントICカード](term:term-amusement-ic-card), stai lavorando sul
profilo; se è [MSカード](term:term-ms-card), [PLカード](term:term-pl-card) o
[{{作戦|さくせん}}カード](term:term-tactics-card), stai preparando il
[デッキ](term:term-deck) o uno slot tattico.

:::example_sentence
jp: >-
  カードリーダーにアミューズメントICカードをタッチして、{{前回|ぜんかい}}のデータを{{呼|よ}}び{{出|だ}}します。
translation_it: >-
  Tocchi la tessera IC sul lettore e richiami i dati della volta precedente.
:::

:::example_sentence
jp: >-
  MSカードとPLカードをカードスロットにセットすると、{{1|ひと}}つのユニットになります。
translation_it: >-
  Quando metti una carta MS e una carta PL nel card slot, diventano una unità.
:::

:::example_sentence
jp: >-
  タッチパネルの{{表示|ひょうじ}}を{{確認|かくにん}}して、{{出撃|しゅつげき}}ボタンをタッチします。
translation_it: >-
  Controlli ciò che appare sul touch panel e tocchi il pulsante di sortita.
:::

:::example_sentence
jp: >-
  {{戦績|せんせき}}は、プレイ{{後|ご}}にMY PAGEで{{確認|かくにん}}できます。
translation_it: >-
  Dopo la partita, puoi controllare i risultati su MY PAGE.
:::

## Nota finale

Il primo flusso arcade si legge come una catena di oggetti e verbi: tessera IC
più [カードリーダー](term:term-card-reader) per richiamare dati, carte MS/PL più
[カードスロット](term:term-card-slot) per costruire una
[ユニット](term:term-unit), [タッチパネル](term:term-touch-panel) e
[ボタン](term:term-button) per confermare, poi
[{{出撃|しゅつげき}}](term:term-sortie) per entrare in battaglia. Quando separi
profilo, deck e comando di sortita, il giapponese del cabinato smette di essere
una sequenza di etichette e diventa un percorso operativo leggibile.
