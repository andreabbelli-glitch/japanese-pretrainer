---
id: lesson-duel-masters-dm25-live-duel-encounters-king-the-septon
media_id: media-duel-masters-dm25
slug: live-duel-encounters-king-the-septon
title: "King the Septon: filtro Jokerz e costo uguale"
order: 58
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, jokers, topdeck, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari
  ]
summary: >-
  Leggere King the Septon: rivela tre carte, controlla che siano tutte Jokerz,
  recupera quelle con lo stesso costo e rimette il resto in fondo.
---

# King the Septon: filtro Jokerz e costo uguale

キング・ザ・セプトン legge la cima del deck come una piccola procedura a stati:
prima rende visibili tre carte, poi controlla se appartengono tutte ai
ジョーカーズ, infine usa il costo della creatura scelta come criterio per
recuperare altre carte.

Il testo non è una semplice pescata. Le particelle e i dimostrativi tengono
separati tre gruppi diversi: le carte appena rivelate, la creatura messa nel
battle zone e ciò che rimane dopo quella scelta. Se perdi uno di questi
referenti, `それら`, `その{{中|なか}}から`, `それと{{同|おな}}じ` e
`{{残|のこ}}り` sembrano vaghi; letti in sequenza, invece, costruiscono una
catena molto precisa.


## Termini chiave

- [{{山札|やまふだ}}](term:term-deck) — il deck fisico da cui si prendono le carte
- [{{表向|おもてむ}}き](term:term-face-up) — scoperto / visibile per il controllo
- [クリーチャー](term:term-creature) — tipo di carta che può essere messo nel battle zone
- [コスト](term:term-cost) — numero usato qui come filtro sulle carte rimaste
- [{{手札|てふだ}}](term:term-hand) — destinazione delle carte recuperate
- [{{順番|じゅんばん}}](term:term-junban) — ordine / sequenza con cui il resto viene rimesso
- [{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck) — fondo del deck, posizione opposta alla cima

## Espressioni ricorrenti

- [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki) — trigger quando la creatura entra nel battle zone
- [すべて](term:term-subete) — tutto / tutti, scope totale del controllo
- [{{手札|てふだ}}](term:term-hand)に[{{加|くわ}}える](term:term-add) — aggiungere alla mano
- [{{山札|やまふだ}}](term:term-deck)の[{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に[{{置|お}}く](term:term-oku) — mettere in fondo al deck

## Pattern grammaticali chiave

- [～{{時|とき}} / ～た{{時|とき}}](grammar:grammar-toki) — quando / nel momento in cui accade l'evento
- [それら](grammar:grammar-sorera) — quelle cose, ripresa plurale del gruppo appena nominato
- [それと{{同|おな}}じ](grammar:grammar-to-onaji) — uguale a quello, usato come filtro di equivalenza

## Etichette da riconoscere

- ジョーカーズ — razza che deve comparire su tutte le carte rivelate
- [{{出|だ}}す](term:term-dasu) — far uscire / mettere in gioco

---

:::image
src: assets/cards/live-duel/king-the-septon.png
alt: "King the Septon card."
caption: >-
  キング・ザ・セプトン。 Razza: ジョーカーズ. Riga centrale: rivela le
  prime 3 carte dalla cima del mazzo; se sono tutte Jokerz, mette una
  creatura nel battle zone, poi aggiunge le carte dello stesso costo e manda
  il resto in fondo al mazzo in ordine casuale.
:::

## 1. Il trigger di entrata: rendere visibile la cima del deck

La prima frase stabilisce il momento e il materiale iniziale. バトルゾーンに
{{出|で}}た{{時|とき}} usa [{{出|で}}る](term:term-deru), verbo intransitivo:
la creatura entra, quindi l'effetto parte. Subito dopo,
`{{山札|やまふだ}}の{{上|うえ}}から{{3枚|さんまい}}` restringe la fonte: non tre
carte qualsiasi, ma le prime tre dalla cima del tuo deck.

Il finale [{{表向|おもてむ}}き](term:term-face-up)にする non sposta ancora le
carte in mano o nel battle zone. Cambia il loro stato informativo: le carte
diventano scoperte, quindi il testo può controllare razza, tipo e costo senza
averle ancora assegnate a una destinazione finale.

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{3枚|さんまい}}を[{{表向|おもてむ}}き](term:term-face-up)にする。
translation_it: >-
  Quando entra nel battle zone, rende scoperte le prime 3 carte dalla cima del
  proprio mazzo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [バトルゾーン](term:term-battle-zone)に marca la destinazione in cui la
    creatura è appena entrata; il trigger non guarda mano, mana o graveyard.
*   [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki) costruisce
    il momento di attivazione: "quando è entrata".
*   {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から impila due
    possessivi: il tuo deck, e dentro quel deck la sua cima.
*   {{3枚|さんまい}}を[{{表向|おもてむ}}き](term:term-face-up)にする prende un
    conteggio preciso e lo porta nello stato "scoperto".

#### ⚖️ Contrasto operativo

[{{出|で}}る](term:term-deru) e [{{出|だ}}す](term:term-dasu) non fanno lo stesso
lavoro. `バトルゾーンに{{出|で}}た{{時|とき}}` descrive King the Septon che entra e
fa partire il trigger; più avanti クリーチャー{{1枚|いちまい}}をバトルゾーンに
{{出|だ}}す descrive l'effetto che mette un'altra creatura nel battle zone.
Il primo è evento, il secondo è azione causata.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, immagina `{{山札|やまふだ}}の{{上|うえ}}から` come una pila
verticale: `{{上|うえ}}` è il punto da cui sollevi le prime carte, mentre
[{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck) sarà il punto in cui
rimetterai ciò che resta.

## 2. Il controllo totale: `それらがすべてジョーカーズなら`

Dopo la rivelazione, il testo non ripete `le tre carte`. Usa
[それら](grammar:grammar-sorera), cioè "quelle cose", per riprendere l'intero
gruppo appena reso scoperto. La particella `が` mette quel gruppo come soggetto
del controllo, mentre [すべて](term:term-subete) chiude lo scope: la condizione
non passa se una sola carta rivelata non è ジョーカーズ.

`なら` trasforma quel controllo in una soglia operativa: se il gruppo intero è
Jokerz, allora puoi scegliere una [クリーチャー](term:term-creature)
`その{{中|なか}}から`, da dentro quello stesso gruppo. La scelta non cerca nel
deck, nella mano o nel battle zone: resta confinata alle carte appena rivelate.

:::example_sentence
jp: >-
  [それら](grammar:grammar-sorera)が
  [すべて](term:term-subete)ジョーカーズなら、その{{中|なか}}から
  [クリーチャー](term:term-creature){{1枚|いちまい}}を
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}す](term:term-dasu)。
translation_it: >-
  Se tutte quelle carte sono Jokerz, ne mette una creatura nel battle zone
  scegliendola da quel gruppo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [それら](grammar:grammar-sorera)が riprende le tre carte rivelate e le
    mette come gruppo da verificare.
*   [すべて](term:term-subete)ジョーカーズなら dice "se sono tutte Jokerz": lo
    scope è totale, non parziale.
*   `その{{中|なか}}から` restringe la fonte della scelta: da dentro quel gruppo
    già controllato.
*   [クリーチャー](term:term-creature){{1枚|いちまい}}を fissa il bersaglio
    singolo della selezione.
*   [バトルゾーン](term:term-battle-zone)に[{{出|だ}}す](term:term-dasu) chiude
    l'azione causata: l'effetto mette quella creatura in gioco.

#### ⚖️ Contrasto operativo

[すべて](term:term-subete) non significa "prendi tutto" in questa frase.
Prima di [{{出|だ}}す](term:term-dasu), serve a controllare che tutto il gruppo
sia Jokerz. La quantità scelta arriva dopo, in
`クリーチャー{{1枚|いちまい}}`: anche se tutte e tre le carte passano il filtro,
il testo mette nel battle zone una sola creatura da quel gruppo.

#### 🧠 Gancio cognitivo

`それら` funziona come un'etichetta appiccicata sul mucchietto appena rivelato.
Finché il testo dice `それら`, `その{{中|なか}}` o `{{残|のこ}}り`, stai ancora
lavorando su quel mucchietto, non su una nuova zona.

## 3. Il costo uguale: dal pezzo scelto alle carte rimaste

Una volta messa una creatura nel battle zone, il testo non abbandona le carte
rimaste. `その{{後|あと}}` segnala che la seconda operazione arriva dopo la
prima, e `{{残|のこ}}りの{{中|なか}}から` restringe il nuovo filtro alle carte che
non sono state scelte come creatura.

Il cuore grammaticale è [それと{{同|おな}}じ](grammar:grammar-to-onaji). それ
non punta a King the Septon e non punta a tutte le carte rivelate: punta alla
creatura appena messa nel battle zone. `と{{同|おな}}じコスト` copia quel costo
e lo usa come condizione per decidere quali carte rimaste salgono in mano.

:::example_sentence
jp: >-
  その{{後|あと}}、{{残|のこ}}りの{{中|なか}}から、
  [それと{{同|おな}}じ](grammar:grammar-to-onaji)
  [コスト](term:term-cost)のカードを
  [すべて](term:term-subete)[{{手札|てふだ}}](term:term-hand)に
  [{{加|くわ}}える](term:term-add)。{{残|のこ}}りをランダムな
  [{{順番|じゅんばん}}](term:term-junban)で
  [{{山札|やまふだ}}](term:term-deck)の
  [{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Poi aggiunge in mano tutte le carte dello stesso costo e mette il resto in
  fondo al mazzo in ordine casuale.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `その{{後|あと}}` collega questa frase al ramo precedente: prima scegli e
    metti la creatura, poi lavori sulle carte rimaste.
*   `{{残|のこ}}りの{{中|なか}}から` crea una fonte ridotta: non tutto il gruppo
    iniziale, ma solo ciò che resta dopo la prima estrazione.
*   [それと{{同|おな}}じ](grammar:grammar-to-onaji)[コスト](term:term-cost)のカード
    forma il filtro nominale: carte il cui costo è uguale a quello della
    creatura appena messa nel battle zone.
*   [すべて](term:term-subete)[{{手札|てふだ}}](term:term-hand)に
    [{{加|くわ}}える](term:term-add) sposta tutte le carte compatibili in mano;
    qui [すべて](term:term-subete) torna a essere quantità recuperata.
*   {{残|のこ}}りをランダムな[{{順番|じゅんばん}}](term:term-junban)で riapre il
    gruppo non recuperato e specifica come deve essere ordinato.
*   [{{山札|やまふだ}}](term:term-deck)の
    [{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に
    [{{置|お}}く](term:term-oku) chiude la procedura: il resto lascia la cima
    e va in fondo al deck.

#### ⚖️ Contrasto operativo

[それと{{同|おな}}じ](grammar:grammar-to-onaji) non significa "lo stesso costo
di King the Septon" per default. In giapponese, `それ` riprende l'elemento più
attivo nel contesto immediato: qui è la [クリーチャー](term:term-creature)
appena messa nel battle zone. Se nessuna creatura è stata messa, questo filtro
non ha quel referente operativo.

## 4. Il resto in fondo: ordine casuale e destinazione finale

L'ultima parte è piccola, ma evita una lettura troppo libera. Dopo il recupero
in mano, un nuovo `{{残|のこ}}り` indica ciò che non è stato né messo nel battle
zone né aggiunto alla mano. Quel resto non torna semplicemente "nel deck":
ランダムな[{{順番|じゅんばん}}](term:term-junban)で toglie il controllo
sull'ordine, e [{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に
[{{置|お}}く](term:term-oku) fissa la destinazione sotto la pila.

:::example_sentence
jp: >-
  {{残|のこ}}りをランダムな[{{順番|じゅんばん}}](term:term-junban)で
  [{{山札|やまふだ}}](term:term-deck)の
  [{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Mette il resto in fondo al mazzo in ordine casuale.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{残|のこ}}りを` marca l'oggetto finale: le carte rimaste dopo tutti i
    filtri precedenti.
*   ランダムな[{{順番|じゅんばん}}](term:term-junban)で descrive il modo in cui
    vengono ordinate, non una zona.
*   [{{山札|やまふだ}}](term:term-deck)の
    [{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に indica la
    destinazione precisa: fondo del deck.
*   [{{置|お}}く](term:term-oku) è il verbo generico di collocazione in zona;
    il significato pratico dipende da `に`, che qui punta al fondo del deck.

#### ⚖️ Contrasto operativo

[{{手札|てふだ}}](term:term-hand)に[{{加|くわ}}える](term:term-add) e
[{{山札|やまふだ}}](term:term-deck)の[{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に
[{{置|お}}く](term:term-oku) usano due verbi diversi perché producono due stati
diversi. [{{加|くわ}}える](term:term-add) rende una carta disponibile in mano;
[{{置|お}}く](term:term-oku) la colloca in una zona indicata senza implicare che
tu possa usarla subito.

## Esempi guidati di riepilogo

Gli stessi pezzi tornano come una procedura compatta: trigger, gruppo
rivelato, controllo totale, filtro sul costo e destinazione finale.

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{3枚|さんまい}}を[{{表向|おもてむ}}き](term:term-face-up)にする。
translation_it: >-
  Quando entra nel battle zone, rende scoperte 3 carte dalla cima del mazzo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [それら](grammar:grammar-sorera)が[すべて](term:term-subete)ジョーカーズなら、
  その{{中|なか}}から[クリーチャー](term:term-creature){{1枚|いちまい}}を
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}す](term:term-dasu)。
translation_it: >-
  Se quelle carte sono tutte Jokerz, mette nel battle zone 1 creatura da quel
  gruppo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{残|のこ}}りの{{中|なか}}から、
  [それと{{同|おな}}じ](grammar:grammar-to-onaji)[コスト](term:term-cost)のカードを
  [すべて](term:term-subete)[{{手札|てふだ}}](term:term-hand)に
  [{{加|くわ}}える](term:term-add)。
translation_it: >-
  Tra le carte rimaste, aggiunge in mano tutte le carte con lo stesso costo di
  quella.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{残|のこ}}りをランダムな[{{順番|じゅんばん}}](term:term-junban)で
  [{{山札|やまふだ}}](term:term-deck)の
  [{{一番|いちばん}}{{下|した}}](term:term-bottom-of-deck)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Mette il resto in fondo al mazzo in ordine casuale.
reveal_mode: sentence
:::

---

## Nota finale

King the Septon diventa leggibile quando segui i referenti uno dopo l'altro:
[それら](grammar:grammar-sorera) guarda le tre carte rivelate, その{{中|なか}}から
sceglie una creatura da quel gruppo, [それと{{同|おな}}じ](grammar:grammar-to-onaji)
copia il costo della creatura scelta e `{{残|のこ}}り` raccoglie ciò che non è
stato preso. La carta non chiede di ricordare una regola isolata: chiede di
seguire come il giapponese sposta il focus da un gruppo al pezzo scelto, poi
dal pezzo scelto al resto.
