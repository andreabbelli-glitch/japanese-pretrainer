---
id: lesson-duel-masters-dm25-live-duel-encounters-magic-circle-of-the-wicked-heart
media_id: media-duel-masters-dm25
slug: live-duel-encounters-magic-circle-of-the-wicked-heart
title: "邪心臓の魔法陣: quando il Tamaseed fa da base"
order: 81
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, tamaseed, shinkarize, discard-draw, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-tcg-card-types,
    lesson-duel-masters-dm25-dm25-sd2-overview
  ]
summary: >-
  Leggere un Tamaseed che funziona come base di evoluzione, poi seguire una
  catena di scarto, pescata, nuovo scarto e untap in mana.
---

# 邪心臓の魔法陣: quando il Tamaseed fa da base

{{邪心臓|じゃしんぞう}}の{{魔法陣|まほうじん}} concentra tre gesti molto diversi in poche righe: tratta un [タマシード](term:term-tamaseed) come se fosse una [クリーチャー](term:term-creature), risolve una catena di mano con scarto, pescata e nuovo scarto, poi controlla cosa succede quando la stessa carta viene messa nella [マナゾーン](term:term-mana-zone).

Il giapponese della carta è compatto ma ordinato. [かのように](grammar:grammar-kanoyouni) crea una finzione utile solo per l'evoluzione, [{{時|とき}}](grammar:grammar-toki) apre finestre di trigger, e [～てもよい](grammar:grammar-temoyoi) distingue una possibilità concessa da un obbligo.


## Termini chiave

- [タマシード](term:term-tamaseed) — carta permanente che qui può fare da base
- [クリーチャー](term:term-creature) — tipo che Shinkarize prende come modello
- [{{進化|しんか}}クリーチャー](term:term-evolution-creature) — creatura da mettere sopra una base valida
- [{{自分|じぶん}}](term:term-self) — il tuo lato del tavolo o la tua zona
- [{{手札|てふだ}}](term:term-hand) — la mano da cui scarti e da cui puoi mettere la carta in mana
- [マナゾーン](term:term-mana-zone) — zona di destinazione del trigger finale
- [{{出|で}}る](term:term-deru) — entrare in una zona di gioco
- [{{置|お}}く](term:term-oku) — mettere o collocare una carta
- [{{捨|す}}てる](term:term-suteru) — scartare dalla mano
- [{{引|ひ}}く](term:term-hiku) — pescare una carta
- [アンタップ](term:term-untap) — raddrizzare una carta tappata

## Espressioni ricorrenti

- [シンカライズ](term:term-shinkarize) — keyword che rende il Tamaseed usabile come base di evoluzione
- クリーチャーである [かのように](grammar:grammar-kanoyouni) — come se fosse una creatura
- `この{{上|うえ}}に` — sopra questa carta, come destinazione fisica
- `{{1枚|いちまい}}{{捨|す}}て、カードを{{3枚|さんまい}}{{引|ひ}}き、もう{{一度|いちど}}...` — catena scarta, pesca, poi ripeti lo scarto

## Pattern grammaticali chiave

- [かのように](grammar:grammar-kanoyouni) — come se fosse così, senza dichiarare un cambio reale e permanente
- [～てもよい](grammar:grammar-temoyoi) — puoi farlo, il testo concede una scelta
- [～た{{時|とき}}](grammar:grammar-toki) — quando l'evento è accaduto e apre il trigger

## Etichette da riconoscere

- [G（ガード）・ストライク](term:term-g-strike) — keyword difensiva dichiarata sulla carta
- [シンカライズ](term:term-shinkarize) — label che introduce la riga del “come se fosse creatura”
- {{邪心臓|じゃしんぞう}}の{{魔法陣|まほうじん}} — nome della carta, letteralmente “cerchio magico del cuore malvagio”

---

:::image
src: assets/cards/live-duel/magic-circle-of-the-wicked-heart.webp
alt: "Magic Circle of the Wicked Heart card."
caption: >-
  {{邪心臓|じゃしんぞう}}の{{魔法陣|まほうじん}}: [タマシード](term:term-tamaseed)
  Water/Darkness/Fire con [G（ガード）・ストライク](term:term-g-strike) e
  [シンカライズ](term:term-shinkarize). La riga
  `クリーチャーであるかのように` non cambia per sempre il tipo della carta: dice
  come leggerla nel momento in cui metti sopra una
  [{{進化|しんか}}クリーチャー](term:term-evolution-creature).
:::

## 1. Shinkarize: una finzione grammaticale per l'evoluzione

La prima riga non dice che il [タマシード](term:term-tamaseed) diventa una [クリーチャー](term:term-creature) in ogni contesto. Dice che, mentre stai usando [シンカライズ](term:term-shinkarize), puoi trattarlo [かのように](grammar:grammar-kanoyouni), “come se” fosse una creatura, per mettere sopra una [{{進化|しんか}}クリーチャー](term:term-evolution-creature).

*   [シンカライズ](term:term-shinkarize) è l'etichetta di effetto, ma la lettura vera parte subito dopo: このタマシードが mette come soggetto proprio questa carta, non qualunque Tamaseed del tuo campo.
*   クリーチャーである costruisce lo stato immaginato: essere una [クリーチャー](term:term-creature). La forma である è più scritta e regolistica di だ, quindi si adatta bene a una definizione di rules text.
*   [かのように](grammar:grammar-kanoyouni) protegge la frase da una lettura troppo forte. Non stai cambiando categoria alla carta per tutto il gioco: stai leggendo il Tamaseed “come creatura” solo per questa operazione.
*   この{{上|うえ}}に aggiunge la destinazione fisica. La [{{進化|しんか}}クリーチャー](term:term-evolution-creature) non va semplicemente “in campo”: va sopra questa carta, perché l'evoluzione in Duel Masters è anche una pila leggibile nello spazio.

:::example_sentence
jp: >-
  [シンカライズ](term:term-shinkarize)：この[タマシード](term:term-tamaseed)が
  [クリーチャー](term:term-creature)である
  [かのように](grammar:grammar-kanoyouni)、この{{上|うえ}}に
  [{{進化|しんか}}クリーチャー](term:term-evolution-creature)を
  [{{置|お}}いてもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Shinkarize: puoi mettere sopra questa carta una creatura evoluzione trattando
  questo Tamaseed come se fosse una creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [シンカライズ](term:term-shinkarize): label che segnala una regola speciale di evoluzione.
*   この[タマシード](term:term-tamaseed)が: soggetto locale, cioè la carta che porta questo testo.
*   [クリーチャー](term:term-creature)である: stato di riferimento, “essere una creatura”.
*   [かのように](grammar:grammar-kanoyouni): cornice di somiglianza, non trasformazione assoluta.
*   `この{{上|うえ}}に`: punto di arrivo, sopra questa stessa carta.
*   [{{進化|しんか}}クリーチャー](term:term-evolution-creature)を[{{置|お}}いてもよい](grammar:grammar-temoyoi): oggetto più permesso opzionale, quindi puoi mettere sopra una evolution creature ma non sei obbligato.

#### ⚖️ Contrasto operativo: “come creatura” non significa “diventa creatura”

クリーチャーである da solo suonerebbe come una dichiarazione: “è una creatura”. Con [かのように](grammar:grammar-kanoyouni), invece, il testo introduce una lettura funzionale: per l'azione di mettere sopra una [{{進化|しんか}}クリーチャー](term:term-evolution-creature), il [タマシード](term:term-tamaseed) viene trattato come base valida. Fuori da quella finestra, non leggere automaticamente tutti gli effetti che chiedono una [クリーチャー](term:term-creature) come se includessero questo Tamaseed.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, pensa a よう come a una “forma percepita”: la carta si presenta alla frase con l'aspetto necessario per l'evoluzione. Non è una spiegazione etimologica completa, ma aiuta a ricordare che [かのように](grammar:grammar-kanoyouni) parla di lettura “come se”, non di identità definitiva.

---

## 2. Scarto, pescata, nuovo scarto: la catena di ingresso

La seconda riga comincia con [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki), quindi aspetta che questo [タマシード](term:term-tamaseed) sia entrato. Da lì la frase diventa una catena: una carta dalla [{{手札|てふだ}}](term:term-hand) viene scartata, tre carte vengono pescate, poi もう{{一度|いちど}} riporta la mano in scena per un secondo scarto.

*   `このタマシードが{{出|で}}た{{時|とき}}` fissa il timing, non il costo. Non stai pagando lo scarto per giocare la carta: stai risolvendo un effetto dopo l'ingresso.
*   [{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand) resta il referente stabile. La prima e l'ultima azione colpiscono la tua mano; la pescata centrale usa invece カードを{{3枚|さんまい}}, cioè il gruppo di carte che aggiungi.
*   [{{捨|す}}て](term:term-suteru) e [{{引|ひ}}き](term:term-hiku) sono forme connettive: tengono aperta la sequenza fino al verbo finale [{{捨|す}}てる](term:term-suteru). In italiano puoi leggerle come “scarta, pesca, poi scarta”.
*   `もう{{一度|いちど}}` non crea una nuova condizione. Segnala che l'azione di scartare si ripete dopo la pescata, così il rules text ti fa seguire l'ordine esatto della mano.

:::example_sentence
jp: >-
  この[タマシード](term:term-tamaseed)が[{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  [{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)を
  {{1枚|いちまい}}[{{捨|す}}て](term:term-suteru)、カードを{{3枚|さんまい}}
  [{{引|ひ}}き](term:term-hiku)、もう{{一度|いちど}}
  [{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)を
  {{1枚|いちまい}}[{{捨|す}}てる](term:term-suteru)。
translation_it: >-
  Quando questo Tamaseed entra, scarta 1 carta dalla tua mano, pescane 3 e poi
  scarta ancora 1 carta dalla tua mano.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   この[タマシード](term:term-tamaseed)が[{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki): trigger d'ingresso, con {{時|とき}} che trasforma l'evento in finestra.
*   [{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)を{{1枚|いちまい}}[{{捨|す}}て](term:term-suteru): primo oggetto e prima azione, una carta della tua mano viene scartata.
*   カードを{{3枚|さんまい}}[{{引|ひ}}き](term:term-hiku): azione centrale, tre carte vengono pescate prima del secondo scarto.
*   もう{{一度|いちど}}[{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)を{{1枚|いちまい}}[{{捨|す}}てる](term:term-suteru): ripetizione esplicita, con il verbo finale in forma conclusiva.

#### ⚖️ Contrasto operativo: ordine della frase, ordine della risoluzione

La serie {{捨|す}}て、{{引|ひ}}き、もう{{一度|いちど}}{{捨|す}}てる non è un riassunto libero. Le forme connettive conservano l'ordine: prima scarti dalla [{{手札|てふだ}}](term:term-hand), poi [{{引|ひ}}く](term:term-hiku) ti dà tre carte, poi もう{{一度|いちど}} ti fa tornare allo scarto. Se inverti pescata e primo scarto, stai leggendo contro la grammatica della catena.

#### 🧠 Gancio cognitivo

`もう{{一度|いちど}}` funziona come un segnale di replay: la frase non riparte dall'inizio, ma richiama l'azione già vista e la fa accadere di nuovo dopo la pescata.

---

## 3. Dalla mano alla mana zone: fonte, destinazione e stato finale

L'ultima riga usa lo stesso verbo [{{置|お}}く](term:term-oku), ma cambia grammatica. In Shinkarize avevi [{{置|お}}いてもよい](grammar:grammar-temoyoi), cioè un permesso. Qui hai [{{置|お}}いた](term:term-oku)[{{時|とき}}](grammar:grammar-toki), cioè “quando l'hai messo”. Il testo non sta concedendo una posa: sta reagendo a una posa già avvenuta.

*   このタマシードを marca la carta come oggetto spostato. Anche se la frase poi omette un pronome prima di [アンタップ](term:term-untap)する, il referente naturale resta questa stessa carta.
*   [{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)から dà la fonte: il trigger si aggancia al movimento dalla tua mano, non a qualsiasi arrivo in [マナゾーン](term:term-mana-zone).
*   [マナゾーン](term:term-mana-zone)に dà la destinazione. Insieme, から e に costruiscono una traiettoria completa: dalla mano alla mana zone.
*   [アンタップ](term:term-untap)する chiude con lo stato finale. La carta viene messa in mana e poi raddrizzata, quindi il testo ti fa leggere una destinazione più un cambiamento di stato.

:::example_sentence
jp: >-
  この[タマシード](term:term-tamaseed)を[{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)から
  [マナゾーン](term:term-mana-zone)に[{{置|お}}いた](term:term-oku)
  [{{時|とき}}](grammar:grammar-toki)、[アンタップ](term:term-untap)する。
translation_it: >-
  Quando metti questo Tamaseed dalla tua mano nella mana zone, si stappa.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   この[タマシード](term:term-tamaseed)を: oggetto del movimento, non soggetto grammaticale marcato da が.
*   [{{自分|じぶん}}](term:term-self)の[{{手札|てふだ}}](term:term-hand)から: punto di partenza, la tua mano.
*   [マナゾーン](term:term-mana-zone)に: punto di arrivo, la zona del mana.
*   [{{置|お}}いた](term:term-oku)[{{時|とき}}](grammar:grammar-toki): evento completato che apre il trigger.
*   [アンタップ](term:term-untap)する: risultato di stato, con il referente recuperato dal Tamaseed appena nominato.

#### ⚖️ Contrasto operativo: `置いてもよい` e `置いた時`

[{{置|お}}いてもよい](grammar:grammar-temoyoi) guarda avanti: ti permette di mettere una [{{進化|しんか}}クリーチャー](term:term-evolution-creature) sopra il [タマシード](term:term-tamaseed). [{{置|お}}いた](term:term-oku)[{{時|とき}}](grammar:grammar-toki) guarda invece un fatto già avvenuto: quando hai messo questo Tamaseed dalla mano alla [マナゾーン](term:term-mana-zone), allora si [アンタップ](term:term-untap)する.

#### 🧠 Gancio cognitivo

Per leggere から e に, immagina due puntini sulla mappa della carta: [{{手札|てふだ}}](term:term-hand) è il punto di partenza, [マナゾーン](term:term-mana-zone) è il punto di arrivo. Solo quando la traiettoria è quella, la frase finale accende [アンタップ](term:term-untap)する.

---

## Esempi guidati di riepilogo

Le tre righe della carta diventano più leggibili se separi tipo fittizio, catena di mano e traiettoria verso la mana zone.

:::example_sentence
jp: >-
  この[タマシード](term:term-tamaseed)が[クリーチャー](term:term-creature)である
  [かのように](grammar:grammar-kanoyouni)、この{{上|うえ}}に
  [{{進化|しんか}}クリーチャー](term:term-evolution-creature)を
  [{{置|お}}いてもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Puoi mettere una creatura evoluzione sopra questa carta trattando questo
  Tamaseed come se fosse una creatura.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  この[タマシード](term:term-tamaseed)が[{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  [{{手札|てふだ}}](term:term-hand)を{{1枚|いちまい}}[{{捨|す}}て](term:term-suteru)、
  カードを{{3枚|さんまい}}[{{引|ひ}}き](term:term-hiku)、もう{{一度|いちど}}
  [{{手札|てふだ}}](term:term-hand)を{{1枚|いちまい}}[{{捨|す}}てる](term:term-suteru)。
translation_it: >-
  Quando questo Tamaseed entra, scarta 1 carta dalla mano, pesca 3 carte e
  scarta ancora 1 carta dalla mano.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{手札|てふだ}}](term:term-hand)から[マナゾーン](term:term-mana-zone)に
  [{{置|お}}いた](term:term-oku)[{{時|とき}}](grammar:grammar-toki)、
  [アンタップ](term:term-untap)する。
translation_it: >-
  Quando la metti dalla mano nella mana zone, si stappa.
reveal_mode: sentence
:::

---

## Nota finale

{{邪心臓|じゃしんぞう}}の{{魔法陣|まほうじん}} è leggibile quando tieni separati i tre segnali: [かのように](grammar:grammar-kanoyouni) crea una lettura “come se” per [シンカライズ](term:term-shinkarize), [{{時|とき}}](grammar:grammar-toki) apre i trigger, e i verbi [{{捨|す}}てる](term:term-suteru), [{{引|ひ}}く](term:term-hiku), [{{置|お}}く](term:term-oku) e [アンタップ](term:term-untap)する fanno avanzare la carta da mano, campo e mana zone senza cambiare referente a sorpresa.
