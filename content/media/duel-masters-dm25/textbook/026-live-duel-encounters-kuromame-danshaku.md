---
id: lesson-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
media_id: media-duel-masters-dm25
slug: live-duel-encounters-kuromame-danshaku
title: Kuromame Danshaku e il filtro sulle abilità di ingresso
order: 55
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, twinpact, gransect, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-kenzan-no-sabaki
  ]
summary: >-
  Kuromame Danshaku legge le parole iniziali delle abilità avversarie, poi il
  lato spell trasforma la prima carta del mazzo in mana e permette un recupero.
---

# [{{黒豆|くろまめ}}だんしゃく](term:term-kuromame-danshaku) / {{白米|はくまい}}{{男|だん}}しゃく: parole iniziali e scambio di mana

Questo Twinpact accosta due modi diversi di leggere una carta natura. Il lato
creatura controlla l'inizio letterale delle abilità avversarie: non chiede se
un effetto "sembra" un trigger di ingresso, ma se comincia con una formula
precisa. Il lato spell, invece, costruisce una sequenza di zone molto pulita:
prima cima del mazzo verso mana, poi mana verso mano se vuoi.


## Termini chiave

- [{{黒豆|くろまめ}}だんしゃく](term:term-kuromame-danshaku) — lato creatura del Twinpact
- [{{能力|のうりょく}}](term:term-ability) — abilità / blocco di effetto posseduto da una carta
- [{{自分|じぶん}}](term:term-self) e [{{相手|あいて}}](term:term-opponent) — lato
  che controlla l'effetto e lato avversario da filtrare.
- [バトルゾーン](term:term-battle-zone) e [マナゾーン](term:term-mana-zone) —
  zone tra cui si muovono creature e risorse.
- [クリーチャー](term:term-creature) — corpo che può entrare, attivare abilità e
  poi spostarsi in mana.
- [このクリーチャーが{{出|で}}た](term:term-deru) — formula di ingresso letta come
  trigger citato.
- [{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}](term:term-top-card-of-deck) — la prima carta dalla cima del mazzo
- [{{置|お}}く](term:term-oku) — mettere una carta in una zona indicata
- [{{手札|てふだ}}](term:term-hand) — mano
- [{{戻|もど}}す](term:term-modosu) — riportare una carta alla mano o alla zona
  indicata.

## Espressioni ricorrenti

- [～で{{始|はじ}}まる](grammar:grammar-de-hajimaru) — cominciare con una forma precisa
- [その{{後|あと}}](grammar:grammar-sonoato) — dopo quel primo passo, continua la procedura
- [～てもよい](grammar:grammar-temoyoi) — puoi farlo, ma il testo non lo impone

## Pattern grammaticali chiave

- [～で{{始|はじ}}まる](grammar:grammar-de-hajimaru) — trasforma una citazione
  testuale nel criterio di filtro.
- [{{時|とき}}](grammar:grammar-toki) — apre il momento in cui la creatura
  avversaria entra e viene controllata.
- [その{{後|あと}}](grammar:grammar-sonoato) — ordina il secondo passo dopo la
  carta messa in mana.
- [～てもよい](grammar:grammar-temoyoi) — rende facoltativo il recupero dalla
  mana alla mano.

## Etichette da riconoscere

- [T・ブレイカー](term:term-t-breaker) — keyword offensiva già compatta
- グランセクト / スペシャルズ — razze del lato creatura

---

:::image
src: assets/cards/live-duel/kuromame-danshaku.webp
alt: "Kuromame Danshaku / Hakumai Danshaku card."
caption: >-
  [{{黒豆|くろまめ}}だんしゃく](term:term-kuromame-danshaku) /
  {{白米|はくまい}}{{男|だん}}しゃく。
  Twinpact naturale. Razze del lato creatura: グランセクト / スペシャルズ.
  Riga centrale: filtra le abilità avversarie che iniziano con
  「このクリーチャーが{{出|で}}た{{時|とき}}」; sotto,
  {{白米|はくまい}}{{男|だん}}しゃく mette in mana la prima carta del mazzo e poi
  può recuperare una carta dalla mana.
:::

## 1. Il filtro: quando le virgolette diventano bersaglio

La prima riga lunga si legge da destra verso un referente molto concreto: una
creatura avversaria entra, ma viene controllata solo se possiede un'abilità che
inizia con la frase citata tra virgolette. La particella `で` in
[～で{{始|はじ}}まる](grammar:grammar-de-hajimaru) prende quella citazione come
punto di partenza testuale: il filtro guarda le parole iniziali dell'abilità.

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の、「[バトルゾーン](term:term-battle-zone)に
  [このクリーチャーが{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)」で
  [{{始|はじ}}まる](grammar:grammar-de-hajimaru)
  [{{能力|のうりょく}}](term:term-ability)を{{持|も}}つ
  [クリーチャー](term:term-creature)が
  [バトルゾーン](term:term-battle-zone)に
  [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、その
  クリーチャーを[マナゾーン](term:term-mana-zone)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando una creatura avversaria con un'abilità che comincia con "quando questa
  creatura entra" entra nel battle zone, metti quella creatura nel mana zone.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{相手|あいて}}](term:term-opponent)の indica possesso o lato di controllo:
    la creatura filtrata è dell'avversario.
*   「[バトルゾーン](term:term-battle-zone)にこのクリーチャーが{{出|で}}た{{時|とき}}」で
    è la formula citata. Il `で` non marca una zona, ma il criterio con cui
    comincia l'abilità.
*   [{{始|はじ}}まる](grammar:grammar-de-hajimaru)
    [{{能力|のうりょく}}](term:term-ability)を{{持|も}}つ
    [クリーチャー](term:term-creature) è un blocco nominale unico: una
    creatura che possiede un'abilità fatta in quel modo.
*   [バトルゾーン](term:term-battle-zone)に
    [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki) apre il
    timing effettivo. Non è ancora il risultato: è il momento in cui il filtro
    viene controllato.
*   そのクリーチャーを[マナゾーン](term:term-mana-zone)に
    [{{置|お}}く](term:term-oku) richiama la stessa creatura appena entrata e
    ne fissa la destinazione.

#### ⚖️ Contrasto operativo: trigger di ingresso vs inizio testuale

`このクリーチャーが{{出|で}}た{{時|とき}}` è la formula tipica di un trigger di
ingresso, ma [～で{{始|はじ}}まる](grammar:grammar-de-hajimaru) rende il controllo
più stretto: conta come parte l'abilità che comincia così. Se un testo parla di
entrata in campo più avanti, o usa una struttura diversa, non basta l'idea
generale di "quando entra"; il giapponese chiede proprio l'apertura della
frase.

#### 🧠 Gancio cognitivo

Immagina le virgolette come la porta dell'abilità: `{{始|はじ}}まる` guarda il
primo passo oltre quella porta. È un trucco di memoria, non etimologia, ma aiuta
a non leggere [～で{{始|はじ}}まる](grammar:grammar-de-hajimaru) come "ha più o
meno questo tema".

## 2. Il referente: dalla creatura filtrata a `そのクリーチャー`

Il cuore della riga è `{{能力|のうりょく}}を{{持|も}}つクリーチャー`. Prima il testo
costruisce il tipo di creatura, poi aggiunge l'evento が{{出|で}}た
{{時|とき}}. Questo ordine evita un errore frequente: il soggetto che entra non
è l'abilità, ma la creatura che possiede quell'abilità.

Quando compare `そのクリーチャー`, `その` non apre un nuovo bersaglio. Riprende la
creatura appena definita: avversaria, entrata nel battle zone, e dotata di una
abilità che comincia con la formula citata. Il movimento finale
[マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku) dice dove finisce
quella carta; non la distrugge, non la rimanda in mano, la sposta nella zona
mana.

#### ⚖️ Contrasto operativo: abilità posseduta, non abilità risolta

`{{能力|のうりょく}}を{{持|も}}つクリーチャー` descrive una proprietà della creatura.
La frase non dice che l'abilità avversaria debba prima risolversi: la lettura
parte dal fatto che una creatura con quel tipo di testo è entrata. Per questo
`そのクリーチャーを` può agganciare direttamente la carta appena arrivata e
mandarla al mana.

## 3. Lo spell side: cima del mazzo, poi recupero opzionale

Sotto la linea Twinpact, {{白米|はくまい}}{{男|だん}}しゃく cambia ritmo. Non filtra
abilità: esegue due movimenti di zona. Il primo è obbligatorio e parte dalla
cima del mazzo; il secondo è aperto da
[その{{後|あと}}](grammar:grammar-sonoato) e diventa facoltativo con
[～てもよい](grammar:grammar-temoyoi).

:::example_sentence
jp: >-
  [{{自分|じぶん}}](term:term-self)の
  [{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}](term:term-top-card-of-deck)を
  [マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku)。
  [その{{後|あと}}](grammar:grammar-sonoato)、カードを{{1枚|いちまい}}、
  {{自分|じぶん}}の[マナゾーン](term:term-mana-zone)から
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}して](term:term-modosu)もよい。
translation_it: >-
  Metti nel mana zone la prima carta del tuo mazzo. Poi puoi restituire una
  carta dal tuo mana zone alla mano.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{自分|じぶん}}](term:term-self)の
    [{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}](term:term-top-card-of-deck)を
    marca l'oggetto preso: la prima carta dalla cima del tuo mazzo.
*   [マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku) è il primo
    movimento. La destinazione viene prima di `{{置|お}}く`, quindi il verbo va
    letto insieme alla zona.
*   [その{{後|あと}}](grammar:grammar-sonoato) ordina i due passi: il recupero
    arriva dopo che la carta è stata messa in mana.
*   `カードを{{1枚|いちまい}}` introduce una carta singola, ma non dice
    `そのカード`. Il giapponese non obbliga a scegliere proprio la carta appena
    messa in mana.
*   [マナゾーン](term:term-mana-zone)から
    [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}して](term:term-modosu)もよい
    contiene origine, destinazione e facoltatività: dalla mana alla mano, se
    decidi di farlo.

#### ⚖️ Contrasto operativo: `カードを1枚` non è `そのカード`

Dopo il primo movimento potresti aspettarti che il testo riprenda la carta
appena messa in mana. Invece usa `カードを{{1枚|いちまい}}` e poi
`{{自分|じぶん}}のマナゾーンから`: una carta qualsiasi dalla tua mana, non
necessariamente quella nuova. Il contrasto è tutto nel referente: `そのカード`
avrebbe puntato alla carta precedente, mentre `カードを{{1枚|いちまい}}` riapre
la scelta dentro la zona.

## 4. Le parole che tengono insieme i due lati

*   [{{能力|のうりょく}}](term:term-ability) non indica una statistica o una
    qualità astratta della creatura. Nel rules text è il blocco di effetto che
    una carta possiede. In `{{能力|のうりょく}}を{{持|も}}つクリーチャー`, il nome
    viene letto insieme a `を{{持|も}}つ`: "una creatura che ha un'abilità".
*   [～で{{始|はじ}}まる](grammar:grammar-de-hajimaru) è il pezzo più selettivo
    del lato creatura. `{{始|はじ}}まる` guarda l'inizio; `で` aggancia la forma
    citata come criterio. La domanda di lettura è: con quali parole comincia
    l'abilità?
*   [その{{後|あと}}](grammar:grammar-sonoato) non è un semplice "poi" narrativo.
    Nei testi procedurali tiene in ordine due istruzioni: prima metti una carta
    in mana, dopo puoi recuperarne una.
*   [～てもよい](grammar:grammar-temoyoi) cambia la forza dell'effetto. Il primo
    `{{置|お}}く` è secco; il secondo movimento con `{{戻|もど}}してもよい` è una
    possibilità concessa.
*   グランセクト e スペシャルズ sono etichette di razza. Qui servono a riconoscere
    il lato creatura come natura e tribale, ma non modificano la struttura
    grammaticale delle due righe di effetto.
*   [T・ブレイカー](term:term-t-breaker) dice il volume dell'attacco sugli scudi.
    È breve e compatto; la parte da leggere con più attenzione resta il filtro
    `「...」で{{始|はじ}}まる{{能力|のうりょく}}`.

## Esempi guidati di riepilogo

Questi blocchi ricombinano i pezzi principali: prima il controllo sull'inizio
testuale dell'abilità, poi la sequenza di mana e recupero.

:::example_sentence
jp: >-
  「このクリーチャーが{{出|で}}た{{時|とき}}」で{{始|はじ}}まる
  {{能力|のうりょく}}を{{持|も}}つクリーチャーが
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)。
translation_it: >-
  È entrata nel battle zone una creatura con un'abilità che comincia con
  "quando questa creatura entra".
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}](term:term-top-card-of-deck)を
  [マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku)。
  [その{{後|あと}}](grammar:grammar-sonoato)、カードを{{1枚|いちまい}}
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}して](term:term-modosu)もよい。
translation_it: >-
  Metti la prima carta dalla cima del mazzo nel mana zone. Poi puoi riportare
  una carta in mano.
reveal_mode: sentence
:::

## Nota finale

Su questo Twinpact il lato creatura richiede una lettura quasi tipografica:
guarda la prima formula dell'abilità e segue il referente fino a
`そのクリーチャーを`. Il lato spell è più lineare, ma vive di ordine e scelta:
[その{{後|あと}}](grammar:grammar-sonoato) tiene insieme i due movimenti, mentre
[～てもよい](grammar:grammar-temoyoi) trasforma il recupero dalla mana in una
decisione.
