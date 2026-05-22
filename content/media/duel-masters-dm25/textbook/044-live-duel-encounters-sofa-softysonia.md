---
id: lesson-duel-masters-dm25-live-duel-encounters-sofa-softysonia
media_id: media-duel-masters-dm25
slug: live-duel-encounters-sofa-softysonia
title: "Sofa Softysonia: soglia, scelta e recupero Abyss"
order: 72
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, twinpact, abyss-royal, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-dm25-sd2-overview,
    lesson-duel-masters-dm25-live-duel-encounters-infelstarge,
    lesson-duel-masters-dm25-live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari
  ]
summary: >-
  Leggere Sofa Softysonia come sequenza di soglia: macina due carte, confronta
  la somma dei costi e sceglie fino a due bersagli.
---

# [ソファ＝ソフティソニア](term:term-sofa-softysonia): soglia, scelta e recupero Abyss

[ソファ＝ソフティソニア](term:term-sofa-softysonia) legge il campo come un problema di soglia. Prima manda due carte dal mazzo al cimitero, poi trasforma il costo di quelle carte in un benchmark e infine sceglie creature avversarie che restano sotto quel limite. La frase è lunga, ma non è disordinata: ogni blocco prepara il successivo.

Il lato spell è più breve e serve da conferma pratica: `{{2体|にたい}}まで` non obbliga a prendere due creature, ma mette un tetto massimo. Quando lo stesso pattern appare su entrambi i lati della Twinpact, puoi riconoscerlo come limite operativo stabile.

:::image
src: assets/cards/live-duel/sofa-softysonia.jpg
alt: "Sofa = Softysonia card."
caption: >-
  [ソファ＝ソフティソニア](term:term-sofa-softysonia) / 「どんな{{夢|ゆめ}}がお{{望|のぞ}}みだ？」。
  Il lato creatura combina [アビスラッシュ](term:term-abyss-rush),
  [ブロッカー](term:term-blocker), [T・ブレイカー](term:term-t-breaker) e
  una rimozione costruita su `{{合計|ごうけい}}`, `より`, `ように` e `まで`.
:::

## Termini chiave

- [ソファ＝ソフティソニア](term:term-sofa-softysonia) — creatura/spell Twinpact che usa una soglia di costo per scegliere cosa distruggere
- [{{合計|ごうけい}}](term:term-goukei) — totale, somma dei costi usata come benchmark
- [コスト](term:term-cost) — valore numerico da confrontare, non taglia fisica della creatura
- [{{山札|やまふだ}}](term:term-deck) — mazzo, fonte delle due carte che generano la soglia
- [{{墓地|ぼち}}](term:term-graveyard) — cimitero, destinazione delle carte mandate giù e fonte del recupero
- [{{手札|てふだ}}](term:term-hand) — mano, destinazione delle creature recuperate dallo spell
- [{{置|お}}く](term:term-oku) — mettere in una zona indicata
- [{{戻|もど}}す](term:term-modosu) — far tornare verso una zona precedente o prevista
- [{{破壊|はかい}}する](term:term-destroy) — distruggere una creatura scelta

## Espressioni ricorrenti

- `このクリーチャーがタップした{{時|とき}}` — trigger di timing: quando questa creatura si tappa
- `その{{2枚|にまい}}のコストの{{合計|ごうけい}}` — la somma dei costi di quelle due carte appena viste
- `よりコストが{{少|すく}}なくなるように` — in modo che il costo resti inferiore alla soglia
- `{{2体|にたい}}まで{{選|えら}}び` — scegli fino a due creature, senza obbligo di arrivare a due
- `{{墓地|ぼち}}から{{手札|てふだ}}に{{戻|もど}}す` — recuperare dal cimitero alla mano

## Pattern grammaticali chiave

- [{{時|とき}}](grammar:grammar-toki) — apre la finestra in cui l'effetto si attiva
- [より](grammar:grammar-yori) — introduce il termine di confronto, qui una soglia numerica
- [ように](grammar:grammar-youni) — trasforma una condizione in criterio di scelta
- [まで](grammar:grammar-made) — con numero e contatore, indica il massimo consentito

## Etichette da riconoscere

- [アビスラッシュ](term:term-abyss-rush) — keyword Abyss legata all'uso dal cimitero
- [ブロッカー](term:term-blocker) — keyword difensiva che sposta un attacco verso questa creatura
- [T・ブレイカー](term:term-t-breaker) — keyword offensiva: questa creatura rompe tre scudi
- `アビス・クリーチャー` — filtro del lato spell: il recupero non prende qualunque creatura
- `どんな{{夢|ゆめ}}がお{{望|のぞ}}みだ？` — frase di tono della carta: "che genere di sogno desideri?"

---

## 1. Dal tap alla soglia: prima si crea il benchmark

Il primo effetto non parte dalla distruzione. Parte da un evento fisico sul campo: `タップした{{時|とき}}`. La creatura si tappa, `{{時|とき}}` apre la finestra temporale e solo dopo il testo ti dice quale risorsa guardare.

*   `{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{2枚|にまい}}` restringe la fonte con precisione: non una carta qualsiasi, ma due carte dalla cima del tuo mazzo. `から` marca il punto di partenza e `{{上|うえ}}` chiarisce che il conteggio inizia dall'alto.
*   `{{墓地|ぼち}}に{{置|お}}く` chiude il primo movimento. `に` indica la destinazione e `{{置|お}}く` è il verbo operativo del "mettere" una carta in una zona.
*   `その{{2枚|にまい}}` riprende esattamente le due carte appena mandate nel cimitero. Non lascia scegliere un nuovo gruppo e non parla di una media: quelle due carte diventano il riferimento per calcolare `{{合計|ごうけい}}`.

:::example_sentence
jp: >-
  このクリーチャーが[タップ](term:term-tap)した[{{時|とき}}](grammar:grammar-toki)、
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{2枚|にまい}}を[{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku)。
  その{{2枚|にまい}}の[コスト](term:term-cost)の[{{合計|ごうけい}}](term:term-goukei)
  [より](grammar:grammar-yori)コストが{{少|すく}}なくなる
  [ように](grammar:grammar-youni)、{{相手|あいて}}の
  [クリーチャー](term:term-creature)を{{2体|にたい}}
  [まで](grammar:grammar-made)[{{選|えら}}び](term:term-erabu)、
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Quando questa creatura si tappa, metti nel cimitero le prime 2 carte del tuo
  mazzo. Poi scegli e distruggi fino a 2 creature dell'avversario, in modo che
  il costo resti inferiore alla somma dei costi di quelle 2 carte.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーがタップした{{時|とき}}`: **trigger di timing**. `が` marca la creatura che compie l'evento, mentre `{{時|とき}}` trasforma l'evento in finestra di attivazione.
*   `{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{2枚|にまい}}を`: **fonte più quantità**. La catena di `の` restringe il punto esatto, poi `{{2枚|にまい}}を` marca le due carte come oggetto del movimento.
*   `{{墓地|ぼち}}に{{置|お}}く`: **destinazione più verbo**. Il testo non scarta genericamente: mette quelle carte nel cimitero, zona che poi può contare per effetti Abyss.
*   `その{{2枚|にまい}}のコストの{{合計|ごうけい}}`: **benchmark costruito al momento**. `その` punta indietro alle due carte viste, `{{合計|ごうけい}}` trasforma due costi separati in un solo valore di riferimento.
*   `よりコストが{{少|すく}}なくなるように`: **criterio della scelta**. `より` fissa il confronto e `ように` dice che la selezione deve soddisfarlo.
*   `{{相手|あいて}}のクリーチャーを{{2体|にたい}}まで{{選|えら}}び、{{破壊|はかい}}する`: **bersaglio, limite, risultato**. Scegli creature avversarie entro il tetto e poi le distruggi.

#### ⚖️ Contrasto operativo

*   `より` non significa `da` o `a partire da` in questa riga. Il blocco prima di `より` è il valore di riferimento; ciò che scegli deve stare sotto quel valore.
*   `{{少|すく}}なくなる` non parla di una creatura "piccola" in senso fisico. Con `コスト`, `{{少|すく}}ない` indica un valore numerico più basso.
*   `その{{2枚|にまい}}` evita una lettura troppo libera: la soglia viene dalle due carte appena messe nel `{{墓地|ぼち}}`, non da due carte scelte dopo.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, pensa a `{{合計|ごうけい}}` come al totale scritto in fondo a un conto. Non è una spiegazione etimologica: serve solo a ricordare che la carta non guarda due costi isolati, ma il valore finale dopo averli sommati.

## 2. ように: il criterio non è un desiderio

`ように` può comparire in frasi di speranza o desiderio, ma qui lavora in modo più tecnico. La clausola prima di `ように`, `コストが{{少|すく}}なくなる`, descrive lo stato che la tua scelta deve rendere vero: il costo deve risultare inferiore alla somma fissata da `{{合計|ごうけい}}より`.

*   Se leggi solo `よりコストが{{少|すく}}なくなる`, capisci la direzione del confronto: sotto la soglia, non sopra.
*   Se aggiungi `ように`, capisci la procedura: non scegli prima a caso e controlli dopo, ma componi la scelta perché rispetti quel criterio.
*   Se chiudi con `{{選|えら}}び、{{破壊|はかい}}する`, il giapponese separa l'atto mentale di selezionare dal risultato di distruggere. La distruzione arriva sui bersagli che hanno superato il filtro grammaticale.

:::example_sentence
jp: >-
  その{{2枚|にまい}}のコストの{{合計|ごうけい}}よりコストが{{少|すく}}なくなるように、
  {{相手|あいて}}のクリーチャーを{{2体|にたい}}まで{{選|えら}}び、
  {{破壊|はかい}}する。
translation_it: >-
  Scegli e distruggi fino a 2 creature dell'avversario in modo che il costo
  resti inferiore alla somma dei costi di quelle 2 carte.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `その{{2枚|にまい}}のコストの{{合計|ごうけい}}`: **valore di riferimento**. La soglia nasce da carte già determinate dal testo precedente.
*   `より`: **comparatore**. Introduce il termine rispetto al quale il costo deve essere più basso.
*   `コストが{{少|すく}}なくなる`: **stato richiesto**. Il costo deve risultare numericamente minore.
*   `ように`: **ponte procedurale**. Collega quello stato alla scelta che devi fare.
*   `{{2体|にたい}}まで{{選|えら}}び`: **scelta limitata**. La quantità massima è due, ma la grammatica non ti obbliga a riempire il massimo.

#### ⚖️ Contrasto operativo

*   `コストが{{少|すく}}なくなるように` non è "spero che il costo diventi basso". Nel rules text è "scegli in modo che il costo sia più basso".
*   `{{選|えら}}び、{{破壊|はかい}}する` non sono due effetti indipendenti. La virgola collega prima la selezione valida e poi l'applicazione della distruzione.

## 3. 2体まで: un tetto massimo su due lati della carta

Il lato spell riprende la stessa quantità, ma in una frase più pulita. Qui `まで` non deve competere con `より` o `ように`: resta attaccato a `{{2体|にたい}}` e si legge come "fino a due".

*   `アビス・クリーチャーを` è l'oggetto filtrato: la carta non recupera qualunque creatura, ma una creatura che rientra nella famiglia Abyss.
*   `{{2体|にたい}}まで` mette il tetto. Puoi recuperare una creatura, due creature o anche nessuna se non ci sono bersagli validi; il testo non dice `{{2体|にたい}}を`, quindi non sta imponendo due bersagli esatti.
*   `{{墓地|ぼち}}から{{手札|てふだ}}に{{戻|もど}}す` disegna il percorso completo: fonte, destinazione e verbo di ritorno. `{{戻|もど}}す` fa sentire che la carta rientra nella mano, non entra direttamente nel battle zone.

:::example_sentence
jp: >-
  アビス・クリーチャーを{{2体|にたい}}[まで](grammar:grammar-made)、
  {{自分|じぶん}}の[{{墓地|ぼち}}](term:term-graveyard)から
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}す](term:term-modosu)。
translation_it: >-
  Rimetti in mano dal tuo cimitero fino a 2 creature Abyss.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `アビス・クリーチャーを`: **oggetto con filtro**. Il nome dopo `を` delimita quali creature possono essere prese.
*   `{{2体|にたい}}まで`: **limite superiore**. `{{2体|にたい}}` conta creature, `まで` fissa il massimo.
*   `{{自分|じぶん}}の{{墓地|ぼち}}から`: **zona di partenza**. Il recupero guarda il tuo cimitero, non quello dell'avversario.
*   `{{手札|てふだ}}に{{戻|もど}}す`: **destinazione più ritorno**. La carta finisce nella mano e non viene messa direttamente in campo.

#### ⚖️ Contrasto operativo

*   `まで` può segnare anche un punto di arrivo in frasi diverse, ma con `{{2体|にたい}}` davanti a un'azione di scelta o recupero si comporta da tetto massimo.
*   Il lato creatura e il lato spell confermano la stessa lettura: `{{2体|にたい}}まで` non significa "esattamente due", ma "non più di due".

#### 🧠 Gancio cognitivo

Come immagine mentale, `まで` è il cartello "fino a qui". Con un numero e un contatore, il cartello non dice che devi arrivarci per forza: dice solo dove finisce lo spazio consentito.

## 4. Etichette e voce della carta: cosa resta fuori dalla frase lunga

Le keyword stampate sulla creatura non cambiano il parsing della riga di rimozione. [アビスラッシュ](term:term-abyss-rush), [ブロッカー](term:term-blocker) e [T・ブレイカー](term:term-t-breaker) stanno come etichette compatte: ti dicono come la creatura si comporta in combattimento o dal cimitero, mentre la frase lunga governa il momento in cui si tappa e distrugge creature.

Il sottotitolo 「どんな{{夢|ゆめ}}がお{{望|のぞ}}みだ？」 invece è voce di carta. Non imposta un bersaglio e non risolve un effetto, ma vale la pena leggerlo perché combina una domanda naturale con un tono leggermente teatrale.

:::example_sentence
jp: >-
  どんな{{夢|ゆめ}}がお{{望|のぞ}}みだ？
translation_it: >-
  Che genere di sogno desideri?
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `どんな{{夢|ゆめ}}`: **tipo di cosa richiesta**. `どんな` chiede "che genere di", non "quale tra queste opzioni".
*   `が`: **marcatore del soggetto desiderato**. Il sogno è ciò che viene desiderato.
*   `お{{望|のぞ}}み`: **forma nominale cortese**. `{{望|のぞ}}む` significa desiderare; `お...み` dà alla parola un tono più elegante.
*   `だ`: **chiusura assertiva**. La frase suona più diretta di una domanda cortese completa come `ですか`.

#### ⚖️ Contrasto operativo

*   Le keyword `アビスラッシュ`, `ブロッカー` e `T・ブレイカー` sono etichette: le riconosci come blocchi già pronti.
*   「どんな{{夢|ゆめ}}がお{{望|のぞ}}みだ？」 è flavor text: si legge per tono e lessico, non per determinare target, zone o timing.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  このクリーチャーがタップした{{時|とき}}、
  {{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{2枚|にまい}}を
  {{墓地|ぼち}}に{{置|お}}く。
translation_it: >-
  Quando questa creatura si tappa, metti nel cimitero le prime 2 carte del tuo
  mazzo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  その{{2枚|にまい}}のコストの{{合計|ごうけい}}よりコストが{{少|すく}}なくなるように
  クリーチャーを{{選|えら}}ぶ。
translation_it: >-
  Scegli creature in modo che il costo resti inferiore alla somma dei costi di
  quelle 2 carte.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  アビス・クリーチャーを{{2体|にたい}}まで、
  {{墓地|ぼち}}から{{手札|てふだ}}に{{戻|もど}}す。
translation_it: >-
  Rimetti in mano dal cimitero fino a 2 creature Abyss.
reveal_mode: sentence
:::

---

## Nota finale

[ソファ＝ソフティソニア](term:term-sofa-softysonia) diventa leggibile quando separi tre movimenti: prima le due carte entrano nel `{{墓地|ぼち}}`, poi `{{合計|ごうけい}}より` costruisce la soglia, infine `ように` e `まで` regolano scelta e quantità. Se tieni insieme questi blocchi, il testo non sembra più una riga lunga: diventa una procedura ordinata.
