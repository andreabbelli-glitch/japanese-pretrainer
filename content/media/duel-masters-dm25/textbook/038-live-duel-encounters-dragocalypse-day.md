---
id: lesson-duel-masters-dm25-live-duel-encounters-dragocalypse-day
media_id: media-duel-masters-dm25
slug: live-duel-encounters-dragocalypse-day
title: "Dragocalypse Day: stato iniziale, shield zone e S-Trigger"
order: 66
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, multiplayer, spell, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-crash-hadou,
    lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
  ]
summary: >-
  Dragocalypse Day lega lo stato iniziale della partita alla posizione nello
  shield zone, poi usa la totalità per distruggere i non-Dragon.
---

# Dragocalypse Day: stato iniziale, shield zone e S-Trigger

Nel rules text di [ドラゴカリプス・デイ](term:term-dragocalypse-day), la keyword non è scritta come una proprietà fissa della carta. Arriva dopo una condizione lunga: prima la partita deve essere cominciata in un certo [{{状態|じょうたい}}](term:term-state), poi questa [{{呪文|じゅもん}}](term:term-spell) deve trovarsi nello [シールドゾーン](term:term-shield-zone).

La carta allena una lettura molto utile nei testi di Duel Masters: separare il setup iniziale, la posizione attuale della carta e l'effetto finale. Se tieni distinti questi tre piani, la frase smette di sembrare un blocco unico e diventa una sequenza di controlli leggibili.


## Termini chiave

- [ドラゴカリプス・デイ](term:term-dragocalypse-day) — Dragocalypse Day, magia che combina condizione multiplayer e rimozione totale
- [{{呪文|じゅもん}}](term:term-spell) — magia / spell
- [{{相手|あいて}}](term:term-opponent) — avversario
- [{{状態|じょうたい}}](term:term-state) — stato / situazione
- [シールドゾーン](term:term-shield-zone) — shield zone
- [{{与|あた}}える](term:term-ataeru) — dare, conferire, assegnare
- [すべて](term:term-subete) — tutto / senza eccezioni
- [{{破壊|はかい}}する](term:term-destroy) — distruggere

## Espressioni ricorrenti

- {{2人以上|ふたりいじょう}}の[{{相手|あいて}}](term:term-opponent)がいる[{{状態|じょうたい}}](term:term-state) — lo stato in cui ci sono due o più avversari
- [S・トリガー](term:term-s-trigger)を[{{与|あた}}える](term:term-ataeru) — conferire S-Trigger a qualcosa
- ドラゴンではないクリーチャー — creature che non sono Dragon

## Pattern grammaticali chiave

- [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) — essere iniziato così e mantenere quel fatto come premessa
- `〜にあれば` — se si trova in / se è presente in un certo luogo o stato
- `〜ではない` davanti a un nome — costruire il filtro "che non è..."

## Etichette da riconoscere

- [S・トリガー](term:term-s-trigger) — keyword che permette a una carta negli scudi di essere giocata quando viene rivelata
- ドラゴン — tratto controllato dalla seconda riga dell'effetto

---

:::image
src: assets/cards/live-duel/dragocalypse-day.webp
alt: "Dragocalypse Day card."
caption: >-
  [ドラゴカリプス・デイ](term:term-dragocalypse-day) è una
  [{{呪文|じゅもん}}](term:term-spell) legata ai ドラゴン di fuoco. Il testo
  controlla lo [{{状態|じょうたい}}](term:term-state) iniziale della partita,
  la presenza nello [シールドゾーン](term:term-shield-zone), poi concede
  [S・トリガー](term:term-s-trigger) e distrugge tutti i non-Dragon.
:::

## 1. Lo stato iniziale: quando `状態` impacchetta il tavolo

La prima metà del testo non chiede semplicemente "ci sono molti avversari?". Formula una condizione più precisa: questa partita deve essere iniziata dentro uno [{{状態|じょうたい}}](term:term-state) particolare, cioè uno stato in cui esistono due o più [{{相手|あいて}}](term:term-opponent).

- `{{2人以上|ふたりいじょう}}` significa "due o più persone". Il numero non indica una quantità qualsiasi di carte o creature: con `人` conta persone, quindi in questo contesto conta gli avversari al tavolo.
- {{2人以上|ふたりいじょう}}の[{{相手|あいて}}](term:term-opponent)がいる è una piccola frase interna: "ci sono due o più avversari". Quando questa frase arriva davanti a [{{状態|じょうたい}}](term:term-state), diventa un modificatore nominale: "lo stato in cui ci sono due o più avversari".
- Il で dopo [{{状態|じょうたい}}](term:term-state) marca la circostanza in cui avviene l'inizio della partita. `で` marca la configurazione di partenza della partita.
- [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) non descrive la partita che sta iniziando adesso. Descrive un fatto già avvenuto che resta valido per leggere il resto della frase: la partita è cominciata così, e quel dato iniziale continua a contare.

:::example_sentence
jp: >-
  このゲームが{{2人以上|ふたりいじょう}}の
  [{{相手|あいて}}](term:term-opponent)がいる
  [{{状態|じょうたい}}](term:term-state)で
  [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite)、この
  [{{呪文|じゅもん}}](term:term-spell)が
  [シールドゾーン](term:term-shield-zone)にあれば、この
  [{{呪文|じゅもん}}](term:term-spell)に「
  [S・トリガー](term:term-s-trigger)」を
  [{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Se questa partita è iniziata in uno stato con due o più avversari e questa
  magia si trova nello shield zone, a questa magia viene conferito S-Trigger.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

- `このゲームが` introduce il soggetto del blocco iniziale: non una creatura, non la carta, ma la partita stessa.
- {{2人以上|ふたりいじょう}}の[{{相手|あいて}}](term:term-opponent)がいる[{{状態|じょうたい}}](term:term-state) costruisce un gruppo nominale lungo: "lo stato in cui ci sono due o più avversari".
- [{{状態|じょうたい}}](term:term-state)で[{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) lega quello stato al verbo "iniziare" e lo mantiene come premessa attiva.
- この[{{呪文|じゅもん}}](term:term-spell)が[シールドゾーン](term:term-shield-zone)にあれば aggiunge una seconda condizione, diversa dalla prima: ora non si guarda più il setup della partita, ma il luogo in cui si trova la magia.
- この[{{呪文|じゅもん}}](term:term-spell)に「[S・トリガー](term:term-s-trigger)」を[{{与|あた}}える](term:term-ataeru) usa に per la cosa che riceve la proprietà e を per la proprietà conferita.

#### ⚖️ Contrasto operativo: inizio della partita vs stato attuale

[{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) punta al modo in cui la partita è cominciata; にあれば punta alla posizione della magia nel momento in cui la condizione viene letta. Sono due controlli diversi. Se li fondi in un unico "se ci sono avversari e la carta è negli scudi", perdi il peso di [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite): la carta sta richiamando il setup iniziale, non solo una fotografia generica del presente.

#### 🧠 Gancio cognitivo

Pensa a [{{状態|じょうたい}}](term:term-state) come a uno "scatto" del tavolo. Non è una singola azione: è una configurazione completa che il testo può trasformare in nome e poi agganciare a un verbo come {{始|はじ}}まる. È un'immagine mnemonica, non un'etimologia.

## 2. La keyword concessa: `与える` cambia la proprietà della magia

Dopo il controllo sullo stato iniziale, il testo restringe ancora il caso: questa [{{呪文|じゅもん}}](term:term-spell) deve essere nello [シールドゾーン](term:term-shield-zone). Solo allora riceve [S・トリガー](term:term-s-trigger).

- この[{{呪文|じゅもん}}](term:term-spell)が mette la magia come soggetto della condizione con あれば: la frase chiede dove si trova la carta, non chi la sta usando.
- [シールドゾーン](term:term-shield-zone)にあれば è costruito su ある, il verbo dell'esistenza per cose inanimate. Con 〜ば, diventa "se è nello shield zone".
- [S・トリガー](term:term-s-trigger)を[{{与|あた}}える](term:term-ataeru) non significa "attivare S-Trigger" in modo diretto. [{{与|あた}}える](term:term-ataeru) indica che una proprietà viene data a un destinatario: la magia ottiene quella keyword quando le condizioni sono vere.

#### ⚖️ Contrasto operativo: dare una keyword vs lanciare una magia

この[{{呪文|じゅもん}}](term:term-spell)に marca il destinatario dell'effetto, mentre [S・トリガー](term:term-s-trigger)を marca ciò che viene conferito. Il testo non sta ancora dicendo "lancia questa magia"; sta dicendo che, in quel contesto, questa magia possiede [S・トリガー](term:term-s-trigger).

## 3. Il filtro finale: i non-Dragon vengono distrutti tutti

La seconda riga cambia ritmo. Dopo la condizione lunga della keyword, l'effetto di rimozione è diretto: prende le creature che non sono ドラゴン, estende il filtro con [すべて](term:term-subete), e applica [{{破壊|はかい}}する](term:term-destroy).

:::example_sentence
jp: >-
  ドラゴンではないクリーチャーを
  [すべて](term:term-subete)
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Distruggi tutte le creature che non sono Dragon.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

- `ドラゴンではない` è una negazione nominale: "non è Dragon". Messo davanti a `クリーチャー`, diventa un filtro: "creature che non sono Dragon".
- `クリーチャーを` marca l'oggetto dell'azione. La frase non chiede di scegliere una singola creatura: prepara una classe intera di oggetti validi.
- [すべて](term:term-subete) allarga il filtro alla totalità. Tutto ciò che rientra in ドラゴンではないクリーチャー viene incluso.
- [{{破壊|はかい}}する](term:term-destroy) è il verbo operativo finale: dopo aver definito il gruppo, la carta applica distruzione a quel gruppo.

#### ⚖️ Contrasto operativo: filtro prima, totalità dopo

ドラゴンではないクリーチャー decide quali creature rientrano nel gruppo; [すべて](term:term-subete) decide l'estensione dell'azione dentro quel gruppo. Se leggi prima [すべて](term:term-subete) e poi il filtro, rischi di sentire "distruggi tutto" in modo troppo largo. Il giapponese invece restringe prima il campo ai non-Dragon e solo dopo dice che non ci sono eccezioni dentro quel campo.

#### 🧠 Gancio cognitivo

Per [すべて](term:term-subete), immagina una rete che passa solo attraverso il filtro già costruito. Non copre l'intero tavolo: copre tutto ciò che il filtro ドラゴンではないクリーチャー lascia passare.

## 4. Come leggere la carta in sequenza

La struttura completa diventa lineare se mantieni separati i tre passaggi:

- prima: {{2人以上|ふたりいじょう}}の[{{相手|あいて}}](term:term-opponent)がいる[{{状態|じょうたい}}](term:term-state)で[{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) richiama il modo in cui la partita è partita;
- poi: この[{{呪文|じゅもん}}](term:term-spell)が[シールドゾーン](term:term-shield-zone)にあれば controlla dove si trova ora la magia;
- infine: [S・トリガー](term:term-s-trigger)を[{{与|あた}}える](term:term-ataeru) e ドラゴンではないクリーチャーを[すべて](term:term-subete)[{{破壊|はかい}}する](term:term-destroy) indicano ciò che la carta ottiene e ciò che distrugge.

Questa progressione è il cuore della frase: stato iniziale, posizione attuale, proprietà concessa, rimozione totale.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  このゲームが{{2人以上|ふたりいじょう}}の
  [{{相手|あいて}}](term:term-opponent)がいる
  [{{状態|じょうたい}}](term:term-state)で
  {{始|はじ}}まっている。
translation_it: >-
  Questa partita è iniziata in uno stato con due o più avversari.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  この[{{呪文|じゅもん}}](term:term-spell)が
  [シールドゾーン](term:term-shield-zone)にあれば、「
  [S・トリガー](term:term-s-trigger)」を
  [{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Se questa magia si trova nello shield zone, conferisce S-Trigger.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  ドラゴンではないクリーチャーを
  [すべて](term:term-subete)
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Distruggi tutte le creature che non sono Dragon.
reveal_mode: sentence
:::

---

## Nota finale

[ドラゴカリプス・デイ](term:term-dragocalypse-day) sembra lunga perché mette insieme condizioni e payoff, ma la grammatica procede con ordine: [{{状態|じょうたい}}](term:term-state) compatta il setup multiplayer, [{{始|はじ}}まっていて](grammar:grammar-hajimatte-ite) lo mantiene come premessa, にあれば controlla lo [シールドゾーン](term:term-shield-zone), [{{与|あた}}える](term:term-ataeru) concede la keyword, e [すべて](term:term-subete) rende totale la distruzione dei non-Dragon.
