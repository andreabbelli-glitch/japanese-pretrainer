---
id: lesson-duel-masters-dm25-live-duel-encounters-do-sumonma
media_id: media-duel-masters-dm25
slug: live-duel-encounters-do-sumonma
title: "Do:Sumonma: scegliere una sola opzione fra cimitero e deck"
order: 75
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, blocker, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-dm25-sd1-overview,
    lesson-duel-masters-dm25-live-duel-encounters-doorknocker-nordocker
  ]
summary: >-
  Do Sumonma: focus su tsugi no uchi, izureka hitotsu e sul comando di
  scegliere una sola opzione fra quelle che seguono.
---

# Do:Sumonma: scegliere una sola opzione fra cimitero e deck

[ド:スモンマー](term:term-do-sumonma) mette davanti a una scelta vera: quando la
creatura entra, il testo non risolve tutto in sequenza, ma apre un elenco e ti
chiede di prendere una sola strada. La parte più densa non è il nome della
keyword, ma il blocco
`{{次|つぎ}}のうちいずれか{{1|ひと}}つを{{選|えら}}ぶ`: lì il giapponese
delimita le opzioni, restringe la quantità e chiude con il verbo di scelta.

Dopo quella prima riga, le due alternative si riconoscono per direzione. Una
muove carte dal [{{墓地|ぼち}}](term:term-graveyard) al fondo del
[{{山札|やまふだ}}](term:term-deck) e apre [アビス・メクレイド](term:term-abyss-mekureido){{8|はち}};
l'altra prende carte dalla cima del deck e le manda al cimitero. In entrambi i
casi, particelle come `から`, `に` e l'espressione
[{{置|お}}いてもよい](grammar:grammar-temoyoi) decidono che cosa è obbligatorio,
che cosa è facoltativo e quale zona cambia.


## Termini chiave

- [ド:スモンマー](term:term-do-sumonma) — creatura Noir Abyss che fa scegliere una sola opzione quando entra
- [{{選|えら}}ぶ](term:term-erabu) — scegliere un'opzione o un bersaglio valido
- [{{墓地|ぼち}}](term:term-graveyard) — cimitero, zona da cui può partire il movimento delle carte
- [{{山札|やまふだ}}](term:term-deck) — deck / mazzo, zona con cima e fondo leggibili nel testo
- [{{置|お}}く](term:term-oku) — mettere / piazzare una carta in una zona indicata

## Espressioni ricorrenti

- [{{次|つぎ}}の](grammar:grammar-tsugi-no)[～のうち](grammar:grammar-no-uchi)[いずれか](grammar:grammar-izureka){{1|ひと}}つを[{{選|えら}}ぶ](term:term-erabu) — scegliere una sola fra le opzioni seguenti
- [{{墓地|ぼち}}](term:term-graveyard)から[{{山札|やまふだ}}](term:term-deck)の{{下|した}}に[{{置|お}}く](term:term-oku) — spostare dal cimitero al fondo del deck
- {{好|す}}きな{{順序|じゅんじょ}}で — nell'ordine che preferisci, senza vincolare la sequenza delle carte
- そうしたら — se fai così / in quel caso, ponte che collega l'azione facoltativa alla ricompensa

## Pattern grammaticali chiave

- [{{出|で}}た{{時|とき}}](grammar:grammar-toki) — quando entra, finestra che fa partire l'effetto
- [{{次|つぎ}}の](grammar:grammar-tsugi-no) — seguente, punta all'elenco che arriva subito dopo
- [～のうち](grammar:grammar-no-uchi) — fra / all'interno di un gruppo delimitato
- [いずれか](grammar:grammar-izureka) — uno qualsiasi fra candidati già definiti
- [{{置|お}}いてもよい](grammar:grammar-temoyoi) — puoi mettere / sei autorizzato a mettere

## Etichette da riconoscere

- [ブロッカー](term:term-blocker) — keyword difensiva già riconoscibile nel frame della carta
- [アビス・メクレイド](term:term-abyss-mekureido){{8|はち}} — keyword Abyss con numero di costo massimo indicato

---

:::image
src: assets/cards/live-duel/do-sumonma.jpg
alt: "Do:Sumonma card."
caption: >-
  [ド:スモンマー](term:term-do-sumonma) combina le keyword
  [ブロッカー](term:term-blocker) e
  [アビス・メクレイド](term:term-abyss-mekureido) con una riga di scelta:
  `{{次|つぎ}}のうちいずれか{{1|ひと}}つを{{選|えら}}ぶ`.
:::

## 1. La riga che apre la scelta

La prima frase crea il telaio dell'effetto. `このクリーチャーが` mette
[ド:スモンマー](term:term-do-sumonma) come soggetto della condizione, mentre
[{{出|で}}た{{時|とき}}](grammar:grammar-toki) non descrive una qualità stabile:
apre il momento esatto in cui l'effetto si attiva, cioè l'ingresso della
creatura nella battle zone.

:::example_sentence
jp: >-
  このクリーチャーが[{{出|で}}た{{時|とき}}](grammar:grammar-toki)、
  [{{次|つぎ}}の](grammar:grammar-tsugi-no)
  [～のうち](grammar:grammar-no-uchi)
  [いずれか](grammar:grammar-izureka){{1|ひと}}つを
  [{{選|えら}}ぶ](term:term-erabu)。
translation_it: >-
  Quando questa creatura entra, scegli una delle seguenti opzioni.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーが` — soggetto della condizione: l'effetto parla di questa creatura, non di una creatura qualsiasi.
*   [{{出|で}}た{{時|とき}}](grammar:grammar-toki) — timing di ingresso: la scelta si apre quando la creatura è entrata.
*   [{{次|つぎ}}の](grammar:grammar-tsugi-no) — puntatore in avanti: il testo ti prepara a leggere le righe successive come opzioni.
*   [～のうち](grammar:grammar-no-uchi) — confine del gruppo: quelle righe diventano l'insieme chiuso da cui scegliere.
*   [いずれか](grammar:grammar-izureka){{1|ひと}}つを — quantità selezionabile: una qualsiasi tra le alternative, ma una sola.
*   [{{選|えら}}ぶ](term:term-erabu) — verbo operativo finale: non osservi una lista, devi compiere una scelta.

#### ⚖️ Contrasto operativo: elenco aperto vs insieme chiuso

[{{次|つぎ}}の](grammar:grammar-tsugi-no) da solo indica ciò che segue; non dice
ancora come usare quell'elenco. [～のうち](grammar:grammar-no-uchi) lo trasforma
in un bacino chiuso, [いずれか](grammar:grammar-izureka) prende un candidato
dentro quel bacino e `{{1|ひと}}つ` blocca la quantità. Se salti `のうち`, la
frase sembra una lista di effetti. Se salti `{{1|ひと}}つ`, sembra possibile
prendere più opzioni.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, immagina `のうち` come il bordo di una scatola: tutto ciò
che sta dopo entra nella scatola delle opzioni. [いずれか](grammar:grammar-izureka)
è la mano che ne prende una, mentre `{{1|ひと}}つ` ti impedisce di prenderne due.
Non è etimologia, ma rende visibile il movimento logico della frase.

## 2. L'opzione che rimette carte sotto il deck

La prima alternativa è lunga perché tiene insieme cinque informazioni: quante
carte muovi, da dove partono, in quale ordine le sistemi, dove finiscono e che
cosa succede se accetti l'azione. Il blocco
`カードを{{4枚|よんまい}}` fissa l'oggetto contato; subito dopo,
[{{墓地|ぼち}}](term:term-graveyard)から dà la zona di partenza. Il testo non
sta ancora dicendo "pesca" o "guarda": sta preparando un movimento fisico di
carte tra zone.

:::example_sentence
jp: >-
  カードを{{4枚|よんまい}}、{{自分|じぶん}}の
  [{{墓地|ぼち}}](term:term-graveyard)から{{好|す}}きな
  {{順序|じゅんじょ}}で
  [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に[{{置|お}}いてもよい](grammar:grammar-temoyoi)。
  そうしたら、[アビス・メクレイド](term:term-abyss-mekureido){{8|はち}}する。
translation_it: >-
  Puoi mettere 4 carte dal tuo cimitero in fondo al mazzo nell'ordine che
  preferisci. Se lo fai, fai Abyss Mekureido 8.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `カードを{{4枚|よんまい}}` — oggetto e quantità: sono quattro carte, non fino a quattro e non una carta nominata.
*   {{自分|じぶん}}の[{{墓地|ぼち}}](term:term-graveyard)から — origine: le carte partono dal tuo cimitero, marcato da から.
*   `{{好|す}}きな{{順序|じゅんじょ}}で` — modo dell'azione: puoi decidere l'ordine in cui le carte vengono rimesse.
*   [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に — destinazione precisa: non semplicemente nel deck, ma sotto il deck.
*   [{{置|お}}いてもよい](grammar:grammar-temoyoi) — permesso facoltativo: l'effetto ti autorizza a farlo, non ti obbliga.
*   `そうしたら` — ponte condizionale: solo se metti davvero le carte sotto il deck, arriva l'azione successiva.
*   [アビス・メクレイド](term:term-abyss-mekureido){{8|はち}}する — payoff: la keyword si attiva con il numero {{8|はち}} come limite operativo.

#### ⚖️ Contrasto operativo: libertà di ordine vs libertà di quantità

`{{好|す}}きな{{順序|じゅんじょ}}で` libera l'ordine, non la quantità. La quantità
è già stata chiusa da `カードを{{4枚|よんまい}}`: il testo ti lascia scegliere
come disporre quelle quattro carte, non quante prenderne. La facoltatività sta
in [{{置|お}}いてもよい](grammar:grammar-temoyoi), quindi la scelta reale è
eseguire o non eseguire l'intero movimento.

## 3. L'opzione che manda carte al cimitero

La seconda alternativa è più corta, ma cambia direzione. Invece di partire dal
[{{墓地|ぼち}}](term:term-graveyard), parte dalla cima del
[{{山札|やまふだ}}](term:term-deck). Il chunk
[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から è il punto da cui prendi
le carte; [{{墓地|ぼち}}](term:term-graveyard)に è il punto in cui finiscono.
La frase non contiene [{{置|お}}いてもよい](grammar:grammar-temoyoi), quindi il
verbo [{{置|お}}く](term:term-oku) chiude l'azione come istruzione diretta.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{4枚|よんまい}}を[{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Metti nel cimitero le prime 4 carte del tuo mazzo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から — origine: dalla cima del tuo deck.
*   `{{4枚|よんまい}}を` — oggetto contato: quattro carte vengono trattate come il blocco da muovere.
*   [{{墓地|ぼち}}](term:term-graveyard)に — destinazione: il cimitero è segnato da に.
*   [{{置|お}}く](term:term-oku) — verbo di collocazione: il risultato è mettere quelle carte nella zona indicata.

#### ⚖️ Contrasto operativo: `から` e `に` cambiano la freccia del movimento

Nella prima alternativa, [{{墓地|ぼち}}](term:term-graveyard)から apre il
movimento e [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に lo chiude sotto
il deck. Nella seconda, il percorso si rovescia:
[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から parte dalla cima del deck e
[{{墓地|ぼち}}](term:term-graveyard)に chiude nel cimitero. Le zone sono le
stesse, ma le particelle ti dicono quale direzione sta prendendo l'effetto.

## 4. Keyword e numero: leggere il payoff senza perdere la grammatica

[ブロッカー](term:term-blocker) è un'etichetta compatta: la riconosci come
keyword di ruolo difensivo e non richiede una frase lunga da risolvere.
[アビス・メクレイド](term:term-abyss-mekureido){{8|はち}}, invece, arriva dentro
una catena condizionale. Il numero {{8|はち}} non è un contatore di carte mosse:
si lega alla keyword e definisce il limite operativo del Mekureido.

Quando leggi そうしたら、[アビス・メクレイド](term:term-abyss-mekureido){{8|はち}}する,
il punto grammaticale è `そうしたら`. `そう` riprende l'azione appena descritta,
mentre `したら` la tratta come condizione compiuta. Il payoff non parte perché
hai scelto la prima opzione in astratto: parte se hai davvero messo le
{{4枚|よんまい}} dal cimitero sotto il deck.

#### 🧠 Gancio cognitivo

Per riconoscere `そうしたら`, pensa a "fatto così, allora...". È un gancio
pratico, non una scomposizione etimologica completa: ti aiuta a non leggere
Mekureido {{8|はち}} come effetto indipendente quando il testo lo lega
all'azione precedente.

---

## Esempi guidati di riepilogo

Le stesse forme diventano stabili quando ricombini scelta, quantità e direzione
del movimento:

:::example_sentence
jp: >-
  このクリーチャーが[{{出|で}}た{{時|とき}}](grammar:grammar-toki)、
  [{{次|つぎ}}の](grammar:grammar-tsugi-no)[～のうち](grammar:grammar-no-uchi)
  [いずれか](grammar:grammar-izureka){{1|ひと}}つを[{{選|えら}}ぶ](term:term-erabu)。
translation_it: >-
  Quando questa creatura entra, scegli una delle opzioni seguenti.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{墓地|ぼち}}](term:term-graveyard)からカードを{{4枚|よんまい}}、
  {{好|す}}きな{{順序|じゅんじょ}}で[{{山札|やまふだ}}](term:term-deck)の
  {{下|した}}に[{{置|お}}いてもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Puoi mettere 4 carte dal tuo cimitero in fondo al deck nell'ordine che preferisci.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  そうしたら、[アビス・メクレイド](term:term-abyss-mekureido){{8|はち}}する。
translation_it: >-
  Se lo fai, fai Abyss Mekureido 8.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{4枚|よんまい}}を
  [{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Metti 4 carte dalla cima del deck nel cimitero.
reveal_mode: sentence
:::

---

## Nota finale

[ド:スモンマー](term:term-do-sumonma) si legge separando tre piani: la riga
[{{次|つぎ}}の](grammar:grammar-tsugi-no)[～のうち](grammar:grammar-no-uchi)[いずれか](grammar:grammar-izureka){{1|ひと}}つを[{{選|えら}}ぶ](term:term-erabu)
crea una scelta singola, [{{置|お}}いてもよい](grammar:grammar-temoyoi) rende
facoltativo il movimento dal cimitero al fondo del deck, e
[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から più
[{{墓地|ぼち}}](term:term-graveyard)に rovesciano la direzione nell'altra
opzione. Quando le particelle di origine e destinazione sono chiare, anche una
carta con due alternative smette di sembrare una massa unica di testo.
