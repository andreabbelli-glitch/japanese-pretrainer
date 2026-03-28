---
id: lesson-duel-masters-dm25-live-duel-encounters-king-the-septon
media_id: media-duel-masters-dm25
slug: live-duel-encounters-king-the-septon
title: Carte incontrate - King the Septon e il filtro del topdeck
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
  King the Septon: rivelazione dei primi tre della cima, filtro su tutti i
  Jokerz e recupero delle carte con lo stesso costo.
---

# キング・ザ・セプトン

:::image
src: assets/cards/live-duel/king-the-septon.png
alt: "King the Septon card."
caption: >-
  キング・ザ・セプトン。 Razza: ジョーカーズ. Riga centrale: rivela le
  prime 3 carte dalla cima del mazzo; se sono tutte Jokerz, mette una
  creatura nel battle zone, poi aggiunge le carte dello stesso costo e manda
  il resto in fondo al mazzo in ordine casuale.
:::

## Keyword presenti sulla carta

- [W・ブレイカー](term:term-w-breaker)

`W・ブレイカー` è già nel keyword bank. Qui il lavoro vero è leggere il
blocco procedurale che rivela, filtra e riordina le carte pescate dalla cima.

## Effetti da leggere

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

:::example_sentence
jp: >-
  [{{それら|それら}}](grammar:grammar-sorera)が
  [{{すべて|すべて}}](term:term-subete)ジョーカーズなら、その{{中|なか}}から
  [クリーチャー](term:term-creature){{1枚|いちまい}}を
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}す](term:term-dasu)。
translation_it: >-
  Se tutte quelle carte sono Jokerz, ne mette una creatura nel battle zone
  scegliendola da quel gruppo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  その{{後|あと}}、{{残|のこ}}りの{{中|なか}}から、
  [それと{{同|おな}}じ](grammar:grammar-to-onaji)
  [コスト](term:term-cost)のカードを
  [{{すべて|すべて}}](term:term-subete)[{{手札|てふだ}}](term:term-hand)に
  [{{加|くわ}}える](term:term-add)。{{残|のこ}}りをランダムな
  [{{順番|じゅんばん}}](term:term-junban)で
  [{{山札|やまふだ}}](term:term-deck)の
  [{{一番下|いち.ばん.した}}](term:term-bottom-of-deck)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Poi aggiunge in mano tutte le carte dello stesso costo e mette il resto in
  fondo al mazzo in ordine casuale.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. バトルゾーンに出た時

- [{{出|で}}た](term:term-deru) + [{{時|とき}}](grammar:grammar-toki) è il trigger
  base di ingresso: l'effetto parte nel momento in cui la creatura entra nel
  battle zone.
- [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{3枚|さんまい}} dice
  esattamente quante carte prendere e da quale posizione: non "tre carte
  qualsiasi", ma le prime tre della cima.
- [{{表向|おもてむ}}き](term:term-face-up) significa rendere pubbliche quelle
  carte durante la risoluzione, non spostarle ancora da nessuna parte.

### 2. それらがすべてジョーカーズなら

- [{{それら|それら}}](grammar:grammar-sorera) riprende il gruppo appena
  rivelato: le tre carte scoperte nella frase precedente.
- [{{すべて|すべて}}](term:term-subete) chiude lo scope sul gruppo intero: il
  ramo positivo si apre solo se tutte e tre le carte passano il filtro.
- `ジョーカーズなら` è il controllo finale sulla tribù. Se una sola delle tre
  carte non è Jokerz, il ramo positivo salta.
- `その{{中|なか}}から` restringe la scelta al gruppo già verificato: la
  creatura non arriva da fuori, ma da quelle carte appena controllate.

### 3. その後、残りの中から

- `その後` segnala una sequenza precisa: il secondo controllo parte dopo la
  risoluzione del primo ramo.
- `{{残|のこ}}り` non è un nuovo gruppo: sono le carte che sono rimaste dopo
  aver estratto la creatura.
- [それと{{同|おな}}じ](grammar:grammar-to-onaji)[コスト](term:term-cost) punta
  alla creatura appena messa in campo e usa il suo costo come filtro per il
  recupero.
- [{{すべて|すべて}}](term:term-subete)[{{手札|てふだ}}](term:term-hand)に
  [{{加|くわ}}える](term:term-add) significa che tutte le carte compatibili
  salgono in mano, non solo una.
- [{{順番|じゅんばん}}](term:term-junban) non è un dettaglio ornamentale: ti
  dice che anche l'ordine finale delle carte rimaste fa parte della procedura e
  qui viene fissato come casuale.
- [{{一番下|いち.ばん.した}}](term:term-bottom-of-deck)に[{{置|お}}く](term:term-oku)
  chiude il resto della procedura: ciò che non è stato preso sparisce dalla
  cima e va in fondo al mazzo.

## Lessico utile in questa carta

- [{{すべて|すべて}}](term:term-subete) è il marcatore di scope decisivo qui:
  prima filtra il gruppo intero, poi lascia partire il ramo positivo solo se il
  gruppo passa tutto insieme.
- [{{それら|それら}}](grammar:grammar-sorera) è il dimostrativo che riaggancia le
  tre carte appena rivelate. È il ponte che ti impedisce di perdere il
  referente nel mezzo della procedura.
- [それと{{同|おな}}じ](grammar:grammar-to-onaji) è un chunk di giapponese molto
  generale: vuol dire `uguale a quello`, ma qui si specializza e copia proprio
  il costo della creatura appena messa in campo per filtrare il gruppo rimasto.
- `その{{中|なか}}から` e `{{残|のこ}}りの{{中|なか}}から` sono i due punti di
  selezione più importanti: prima scegli da un gruppo verificato, poi lavori
  solo su ciò che è rimasto.
- [{{順番|じゅんばん}}](term:term-junban) in giapponese generale è `ordine /
  sequenza`; qui ti segnala che il testo non sta solo spostando carte, ma sta
  anche imponendo in che tipo di ordine devono finire sotto al mazzo.
- `ジョーカーズ` è la razza che decide il ramo positivo: la carta non cerca
  "qualunque creatura", cerca una creatura del gruppo Jokerz.
