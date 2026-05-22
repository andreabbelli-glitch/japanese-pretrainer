---
id: lesson-duel-masters-dm25-live-duel-encounters-babyponnosuke
media_id: media-duel-masters-dm25
slug: live-duel-encounters-babyponnosuke
title: "Babyponnosuke: quando il costo supera il mana"
order: 76
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, jokers, replacement, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-sofa-softysonia,
    lesson-duel-masters-dm25-live-duel-encounters-jenny-jane
  ]
summary: >-
  Babyponnosuke mostra come leggere soglia con yori, costo più alto, finestra
  deru toki e sostituzione kawarini.
---

# [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke): quando il costo supera il mana

Nel testo di [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke), l'ingresso di una creatura avversaria viene letto come una sequenza precisa: prima il turno, poi il numero di carte nel mana, poi il costo della creatura, infine la sostituzione che cambia la destinazione.

La carta non dice semplicemente "blocca una creatura grande". Usa [より](grammar:grammar-yori) per fissare una soglia numerica, [{{大|おお}}きい](term:term-ookii) per dire che il costo la supera, [{{出|で}}る](term:term-deru)[{{時|とき}}](grammar:grammar-toki) per agganciarsi alla finestra di ingresso e [かわりに](grammar:grammar-kawarini) per trasformare quell'ingresso in un movimento verso il fondo del mazzo.

:::image
src: assets/cards/live-duel/babyponnosuke.jpg
alt: "Babyponnosuke card."
caption: >-
  [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke) usa una sola frase lunga:
  durante il turno avversario confronta il costo della creatura in ingresso con
  le carte nella [マナゾーン](term:term-mana-zone), controlla i ジョーカーズ tra
  [バトルゾーン](term:term-battle-zone) e mana, poi sostituisce l'ingresso con il
  fondo della [{{山札|やまふだ}}](term:term-deck).
:::

## Termini chiave

- [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke) — creatura ジョーカーズ che interviene sull'ingresso avversario
- [{{相手|あいて}}](term:term-opponent) — avversario; qui è sia il possessore del turno sia il possessore della creatura
- [マナゾーン](term:term-mana-zone) — zona da cui si conta il benchmark numerico
- [コスト](term:term-cost) — costo della creatura, letto come valore confrontabile
- [{{大|おお}}きい](term:term-ookii) — grande / alto; con `コスト` significa costo più alto
- [{{合計|ごうけい}}](term:term-goukei) — totale, somma tra più zone
- [{{山札|やまふだ}}](term:term-deck) — mazzo; qui la destinazione è il fondo del mazzo

## Espressioni ricorrenti

- `{{相手|あいて}}のターン{{中|ちゅう}}に` — durante il turno avversario
- `{{枚数|まいすう}}よりコストが{{大|おお}}きい` — con costo più alto del numero di carte
- [{{出|で}}る](term:term-deru)[{{時|とき}}](grammar:grammar-toki) — quando entra / nel momento in cui sta entrando
- `{{3枚以上|さんまいいじょう}}あれば` — se ce ne sono almeno tre

## Pattern grammaticali chiave

- [より](grammar:grammar-yori) — benchmark del confronto: più di / rispetto a
- [{{時|とき}}](grammar:grammar-toki) — finestra temporale collegata all'azione precedente
- [かわりに](grammar:grammar-kawarini) — invece, al posto dell'evento normale

## Etichette da riconoscere

- ジョーカーズ — razza richiesta per attivare la condizione
- [バトルゾーン](term:term-battle-zone) — zona di campo in cui le creature sono presenti
- [マナゾーン](term:term-mana-zone) — zona del mana, usata sia nel confronto sia nel conteggio dei ジョーカーズ
- [{{山札|やまふだ}}](term:term-deck)の{{下|した}} — fondo del mazzo

---

## 1. La soglia: turno avversario, mana e costo più alto

La prima metà della frase costruisce una soglia. `{{相手|あいて}}のターン{{中|ちゅう}}に` restringe il timing al turno dell'avversario; `{{相手|あいて}}のマナゾーンにあるカードの{{枚数|まいすう}}` prende il numero di carte nella sua mana zone; [より](grammar:grammar-yori) trasforma quel numero nel punto di riferimento del confronto.

Il pezzo [コスト](term:term-cost)が[{{大|おお}}きい](term:term-ookii) non parla di dimensione fisica. Con `コスト`, [{{大|おお}}きい](term:term-ookii) vale "alto" in senso numerico: la creatura è rilevante solo se il suo costo supera il numero contato nel mana avversario.

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}}に、
  [{{相手|あいて}}](term:term-opponent)の[マナゾーン](term:term-mana-zone)にあるカードの
  {{枚数|まいすう}}
  [より](grammar:grammar-yori)[コスト](term:term-cost)が
  [{{大|おお}}きい](term:term-ookii)[{{相手|あいて}}](term:term-opponent)の
  [クリーチャー](term:term-creature)が
  [{{出|で}}る](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  [バトルゾーン](term:term-battle-zone)または[マナゾーン](term:term-mana-zone)に
  {{自分|じぶん}}のジョーカーズが[{{合計|ごうけい}}](term:term-goukei)
  {{3枚以上|さんまいいじょう}}あれば、{{相手|あいて}}は
  [かわりに](grammar:grammar-kawarini)そのクリーチャーを
  [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に[{{置|お}}き](term:term-oku)、
  その{{後|あと}}、このクリーチャーを[{{山札|やまふだ}}](term:term-deck)の
  {{下|した}}に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Durante il turno avversario, quando sta per entrare una creatura avversaria
  con costo maggiore del numero di carte nel mana dell'avversario, se tra
  battle zone e mana zone hai in totale almeno 3 Joker, l'avversario mette
  invece quella creatura in fondo al mazzo e poi mette in fondo al mazzo anche
  questa creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{相手|あいて}}のターン{{中|ちゅう}}に`: cornice temporale. Il controllo non è sempre attivo; si apre solo durante il turno dell'avversario.
*   `{{相手|あいて}}のマナゾーンにあるカード`: gruppo nominale. `にある` dice "che si trovano nella mana zone", quindi non stai contando tutto il mana possibile, ma le carte effettivamente presenti lì.
*   `カードの{{枚数|まいすう}}より`: benchmark. `{{枚数|まいすう}}` trasforma le carte in un numero, e [より](grammar:grammar-yori) dice che il costo deve stare sopra quel numero.
*   `コストが{{大|おお}}きい{{相手|あいて}}のクリーチャー`: bersaglio della condizione. La creatura è avversaria e il suo costo è più alto del benchmark appena fissato.
*   `{{出|で}}る{{時|とき}}`: finestra dell'evento. L'effetto guarda il momento in cui la creatura entra, non una creatura già rimasta stabilmente in campo.

#### ⚖️ Contrasto operativo

`{{枚数|まいすう}}よりコストが{{大|おお}}きい` non significa "costo pari al mana" e non significa "costo entro il mana". La direzione è sopra la soglia: se l'avversario ha tre carte nel mana, la formula guarda un costo maggiore di tre, non un costo tre.

#### 🧠 Gancio cognitivo

Pensa a [より](grammar:grammar-yori) come a una linea di riferimento tracciata sul tavolo: tutto ciò che è sotto o uguale resta fuori dalla condizione, tutto ciò che la supera diventa leggibile come `コストが{{大|おお}}きい`. È un trucco mnemonico, non un'etimologia.

## 2. La finestra di ingresso: `{{出|で}}る{{時|とき}}`

[{{出|で}}る](term:term-deru) è intransitivo: la creatura "esce fuori", "entra in campo", senza che la frase presenti un giocatore come agente diretto. Per questo `{{相手|あいて}}のクリーチャーが{{出|で}}る` usa `が`: il soggetto dell'evento è la creatura avversaria che sta entrando.

[{{時|とき}}](grammar:grammar-toki) aggancia l'effetto a quel momento. In un rules text, questa scelta cambia la lettura pratica: non stai aspettando "dopo che la creatura ha fatto qualcosa", stai guardando la finestra in cui l'ingresso viene intercettato.

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の[クリーチャー](term:term-creature)が
  [{{出|で}}る](term:term-deru)[{{時|とき}}](grammar:grammar-toki)
translation_it: >-
  Quando entra una creatura dell'avversario.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{相手|あいて}}のクリーチャー`: creatura appartenente all'avversario. `の` qui non è decorativo: delimita il possessore della creatura controllata dalla condizione.
*   `が`: marca il soggetto dell'evento di ingresso. La frase non dice ancora chi fa entrare la creatura; dice quale creatura entra.
*   `{{出|で}}る`: ingresso intransitivo. In Duel Masters può corrispondere all'entrare nel battle zone o allo stare per entrarci.
*   `{{時|とき}}`: cornice temporale. Il blocco precedente diventa "nel momento in cui succede quell'ingresso".

#### ⚖️ Contrasto operativo

`{{出|で}}る{{時|とき}}` non equivale a `{{出|で}}た{{後|あと}}`. Con `{{時|とき}}`, l'effetto si aggancia al momento dell'ingresso; con `{{後|あと}}`, leggeresti invece un evento successivo. La presenza di [かわりに](grammar:grammar-kawarini) più avanti conferma che qui la frase sta preparando una sostituzione, non una punizione ritardata.

## 3. La condizione dei ジョーカーズ: sommare due zone

Dopo il timing, la frase apre una condizione con `あれば`: se la quantità richiesta esiste, il resto dell'effetto procede. Il nome `ジョーカーズ` resta in katakana perché è una razza del gioco, mentre [{{合計|ごうけい}}](term:term-goukei) dice che il conteggio non va fatto zona per zona in modo separato.

Il blocco `バトルゾーンまたはマナゾーンに{{自分|じぶん}}のジョーカーズが{{合計|ごうけい}}{{3枚以上|さんまいいじょう}}あれば` chiede di guardare due luoghi, [バトルゾーン](term:term-battle-zone) e [マナゾーン](term:term-mana-zone), e sommare le tue carte ジョーカーズ presenti lì. `{{3枚以上|さんまいいじょう}}` include tre e qualsiasi numero superiore.

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)または[マナゾーン](term:term-mana-zone)に
  {{自分|じぶん}}のジョーカーズが[{{合計|ごうけい}}](term:term-goukei)
  {{3枚以上|さんまいいじょう}}あれば
translation_it: >-
  Se tra battle zone e mana zone hai in totale almeno 3 Joker.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `バトルゾーンまたはマナゾーンに`: luogo della verifica. `または` significa "oppure", ma con [{{合計|ごうけい}}](term:term-goukei) il risultato pratico è un conteggio complessivo tra le due zone indicate.
*   `{{自分|じぶん}}のジョーカーズ`: le tue carte o creature della razza ジョーカーズ. `{{自分|じぶん}}の` distingue subito il tuo lato da quello dell'avversario.
*   `{{合計|ごうけい}}{{3枚以上|さんまいいじょう}}`: totale almeno tre. [{{合計|ごうけい}}](term:term-goukei) forza la somma, mentre `{{以上|いじょう}}` include il limite.
*   `あれば`: condizione di esistenza. La frase non ti chiede di scegliere tre carte; controlla se quella quantità è presente.

#### ⚖️ Contrasto operativo

`または` da solo può farti pensare a "una zona o l'altra". Qui però [{{合計|ごうけい}}](term:term-goukei) cambia la lettura: il testo permette di sommare i ジョーカーズ in [バトルゾーン](term:term-battle-zone) e quelli in [マナゾーン](term:term-mana-zone). Non devi raggiungere tre in una singola zona.

## 4. La sostituzione: `かわりに`, `そのクリーチャー`, `その後`

Quando la condizione è soddisfatta, [かわりに](grammar:grammar-kawarini) introduce l'effetto che prende il posto dell'ingresso normale. La creatura avversaria non resta semplicemente nel battle zone: `そのクリーチャーを{{山札|やまふだ}}の{{下|した}}に{{置|お}}き` la manda in fondo al mazzo.

Poi arriva `その{{後|あと}}`: dopo quel primo movimento, anche `このクリーチャー`, cioè [ベイビーポンの{{助|すけ}}](term:term-babyponnosuke), viene messo in fondo alla [{{山札|やまふだ}}](term:term-deck). La differenza tra `そのクリーチャー` e `このクリーチャー` è decisiva: `その` riprende la creatura avversaria appena descritta, `この` punta alla carta che porta questo testo.

:::example_sentence
jp: >-
  {{相手|あいて}}は[かわりに](grammar:grammar-kawarini)そのクリーチャーを
  [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に[{{置|お}}き](term:term-oku)、
  その{{後|あと}}、このクリーチャーを[{{山札|やまふだ}}](term:term-deck)の{{下|した}}に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  L'avversario mette invece quella creatura in fondo al mazzo e poi mette in
  fondo al mazzo anche questa creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{相手|あいて}}は`: soggetto operativo del movimento. Anche se l'effetto nasce da Babyponnosuke, il testo presenta l'avversario come chi mette la propria creatura sotto il mazzo.
*   `かわりに`: sostituzione. L'evento normale, cioè l'ingresso della creatura, viene rimpiazzato da un'altra destinazione.
*   `そのクリーチャーを`: oggetto ripreso dal contesto. `その` guarda indietro alla creatura avversaria con costo superiore alla soglia.
*   `{{山札|やまふだ}}の{{下|した}}に{{置|お}}き`: destinazione più verbo. `に` marca il punto di arrivo, `{{置|お}}き` è la forma continuativa che collega il primo movimento al passaggio successivo.
*   `その{{後|あと}}、このクリーチャーを`: secondo passaggio. `この` sposta il riferimento sulla creatura che contiene il testo, non sulla creatura avversaria.

#### ⚖️ Contrasto operativo

`そのクリーチャー` e `このクリーチャー` non sono intercambiabili. `その` riprende un referente già introdotto fuori dalla carta, la creatura avversaria che sta entrando; `この` indica la carta stessa. Se li scambi, perdi il costo reale dell'effetto: Babyponnosuke risolve il problema, ma poi si sposta anche lui sotto il mazzo.

#### 🧠 Gancio cognitivo

Trucco mnemonico: `その` ha il dito puntato verso qualcosa appena nominato, `この` tiene il dito sulla carta davanti a te. Nel testo di Duel Masters questa differenza spesso decide quale creatura si muove, viene distrutta o resta in campo.

## Esempi guidati di riepilogo

Le stesse forme diventano più rapide da riconoscere quando le ricombini in frasi brevi di rules text:

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の[マナゾーン](term:term-mana-zone)にあるカードの
  {{枚数|まいすう}}[より](grammar:grammar-yori)[コスト](term:term-cost)が
  [{{大|おお}}きい](term:term-ookii)[クリーチャー](term:term-creature)が
  [{{出|で}}る](term:term-deru)。
translation_it: >-
  Entra una creatura con costo maggiore del numero di carte nella mana zone
  dell'avversario.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)または[マナゾーン](term:term-mana-zone)に
  {{自分|じぶん}}のジョーカーズが[{{合計|ごうけい}}](term:term-goukei)
  {{3枚以上|さんまいいじょう}}ある。
translation_it: >-
  Tra battle zone e mana zone ci sono in totale almeno 3 Joker tuoi.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [かわりに](grammar:grammar-kawarini)その[クリーチャー](term:term-creature)を
  [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Invece, metti quella creatura in fondo al mazzo.
reveal_mode: sentence
:::

---

## Nota finale

[ベイビーポンの{{助|すけ}}](term:term-babyponnosuke) è una carta compatta, ma il suo giapponese ha una catena completa: [より](grammar:grammar-yori) fissa la soglia, [コスト](term:term-cost)が[{{大|おお}}きい](term:term-ookii) identifica ciò che la supera, [{{出|で}}る](term:term-deru)[{{時|とき}}](grammar:grammar-toki) apre la finestra di ingresso e [かわりに](grammar:grammar-kawarini) sostituisce quell'ingresso con il fondo della [{{山札|やまふだ}}](term:term-deck). Quando ritrovi questi pezzi su altre carte, leggi prima benchmark, timing e referente dei pronomi: il movimento finale diventa molto più facile da seguire.
