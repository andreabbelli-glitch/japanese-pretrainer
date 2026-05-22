---
id: lesson-duel-masters-dm25-live-duel-encounters-garchainsaw-dragon
media_id: media-duel-masters-dm25
slug: live-duel-encounters-garchainsaw-dragon
title: "Garchainsaw Dragon: zone, limiti e break distribuiti"
order: 60
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, armored-dragon, battle-trigger, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Leggere Garchainsaw Dragon quando collega entrata, risorse, battle forzato e
  primo break degli scudi con conteggi per avversario.
---

# Garchainsaw Dragon: zone, limiti e break distribuiti

ガルチェンソ・ドラゴン mette in fila tre movimenti tipici del rules text di Duel Masters: una creatura entra, una carta passa dal mazzo alla mana zone, un Dragon torna in mano, poi un altro Dragon può trascinare una creatura avversaria in battle. La difficoltà non è il singolo verbo, ma il modo in cui il giapponese compatta timing, quantità e destinazione nella stessa riga.

Il testo diventa molto leggibile quando separi tre domande: quando parte l'effetto, quante volte si applica, e su chi o che cosa ricade. Qui quelle risposte arrivano con `{{時|とき}}`, `につき`, `{{各|かく}}ターン`, `はじめて` e `ずつ`: piccoli segnali che decidono la procedura.


## Termini chiave

- [{{出|で}}る](term:term-deru) — entrare in gioco / apparire nel campo
- [{{相手|あいて}}](term:term-opponent) — avversario, lato opposto del testo
- [{{自分|じぶん}}](term:term-self) — il tuo lato / il controllore dell'effetto
- [{{山札|やまふだ}}](term:term-deck) — mazzo, soprattutto come fonte con の{{上|うえ}}から
- [マナゾーン](term:term-mana-zone) — zona risorsa in cui la carta viene messa tappata
- [{{手札|てふだ}}](term:term-hand) — mano, destinazione del Dragon recuperato
- [バトルさせる](term:term-battle-saseru) — far combattere due creature

## Espressioni ricorrenti

- このクリーチャーが[{{出|で}}た](term:term-deru){{時|とき}} — trigger sull'ingresso di questa creatura
- [その{{後|あと}}](grammar:grammar-sonoato) — passo successivo dopo la prima risoluzione
- [{{選|えら}}んでもよい](grammar:grammar-temoyoi) — scelta permessa, non obbligatoria
- シールドを[ブレイク](term:term-break)した{{時|とき}} — trigger quando il break è avvenuto

## Pattern grammaticali chiave

- [{{相手|あいて}}{{1人|ひとり}}につき](grammar:grammar-aite-hitori-nitsuki) — per ogni avversario
- [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido) — una volta per turno
- [はじめて〜した{{時|とき}}](grammar:grammar-hajimete-shita-toki) — quando succede per la prima volta
- [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite) — ciascun altro avversario
- [{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu) — uno a uno / uno per ciascuno
- [～てもよい](grammar:grammar-temoyoi) — puoi farlo, ma il testo non lo impone

## Etichette da riconoscere

- ガルチェンソ・ドラゴン — nome della creatura, tutto in katakana tranne il tipo Dragon
- アーマード・ドラゴン — razza della creatura, importante quando altri effetti cercano Dragon
- {{火|ひ}} / {{自然|しぜん}} — civiltà stampate sulla carta, cioè i colori di risorsa
- [{{戻|もど}}す](term:term-modosu) — rimandare / restituire

---

[ブレイク](term:term-break) resta il risultato sugli scudi: quando compare dopo un battle o un attacco, chiediti prima chi ha rotto lo scudo e solo dopo quale effetto si apre.

:::image
src: assets/cards/live-duel/garchainsaw-dragon.png
alt: "Garchainsaw Dragon card."
caption: >-
  ガルチェンソ・ドラゴン。{{文明|ぶんめい}}: {{火|ひ}} / {{自然|しぜん}}。
  {{種族|しゅぞく}}: アーマード・ドラゴン。 La carta combina
  [{{相手|あいて}}{{1人|ひとり}}につき](grammar:grammar-aite-hitori-nitsuki),
  [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido),
  [はじめて〜した{{時|とき}}](grammar:grammar-hajimete-shita-toki) e
  [{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu) dentro effetti di zona,
  battle e break degli scudi.
:::

## 1. Entrata in campo: per ogni avversario e tra due zone

Il primo effetto comincia con このクリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}. が marca la creatura come soggetto dell'evento, {{出|で}}た è la forma passata che modifica {{時|とき}}, e l'intero blocco vuol dire "quando questa creatura è entrata". Non sta dicendo chi la mette in gioco: il punto grammaticale è il momento in cui la creatura risulta già presente.

Subito dopo arriva [{{相手|あいて}}{{1人|ひとり}}につき](grammar:grammar-aite-hitori-nitsuki). {{1人|ひとり}} conta persone, non carte; につき distribuisce la stessa procedura su ogni avversario contato. In una partita normale lo leggerai spesso come "per l'avversario", ma la forma giapponese resta più ampia: se il contesto ha più avversari, l'azione si ripete una volta per ciascuno.

:::example_sentence
jp: >-
  このクリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}、
  [{{相手|あいて}}{{1人|ひとり}}につき](grammar:grammar-aite-hitori-nitsuki)、
  [{{自分|じぶん}}](term:term-self)の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{1枚目|いちまいめ}}をタップして[マナゾーン](term:term-mana-zone)に{{置|お}}く。
  [その{{後|あと}}](grammar:grammar-sonoato)、[マナゾーン](term:term-mana-zone)からドラゴンを{{1枚|いちまい}}
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}す](term:term-modosu)。
translation_it: >-
  Quando questa creatura entra, per ogni avversario metti tappata nella mana
  zone la prima carta del tuo mazzo. Poi fai tornare in mano un Dragon dalla
  mana zone.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   このクリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}: il trigger parte dopo l'ingresso della creatura. {{出|で}}る è intransitivo: la frase guarda la creatura che entra, non l'azione di qualcuno che la mette.
*   [{{相手|あいて}}{{1人|ひとり}}につき](grammar:grammar-aite-hitori-nitsuki): il contatore è una persona avversaria. Tutto il blocco successivo, fino al primo punto operativo, viene letto una volta per ogni avversario.
*   [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を: から indica la fonte e {{1枚目|いちまいめ}} restringe la scelta alla prima carta dall'alto. Non è una carta qualsiasi del mazzo.
*   タップして[マナゾーン](term:term-mana-zone)に{{置|お}}く: タップして dice lo stato con cui la carta viene messa; に marca la destinazione. La carta non passa semplicemente in mana, entra in mana già tappata.
*   [その{{後|あと}}](grammar:grammar-sonoato)、[マナゾーン](term:term-mana-zone)からドラゴンを{{1枚|いちまい}}[{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}す](term:term-modosu): il secondo movimento usa から e に al contrario: parte dalla mana zone e arriva in mano.

#### ⚖️ Contrasto operativo: `{{1枚目|いちまいめ}}` non è `{{1枚|いちまい}}`

`{{1枚目|いちまいめ}}` include `目`, quindi ordina la carta in una sequenza: è "la prima carta" dalla cima del mazzo. `ドラゴンを{{1枚|いちまい}}`, invece, conta una singola carta Dragon dalla mana zone, senza dire che sia la prima, l'ultima o una posizione specifica. Se leggi entrambi come "una carta", perdi la differenza tra posizione obbligata e quantità scelta.

#### 🧠 Gancio cognitivo: `から` e `に` come binari

Come trucco mnemonico, tratta から e に come due estremi di un binario: {{山札|やまふだ}}の{{上|うえ}}から ... [マナゾーン](term:term-mana-zone)に manda una carta verso la mana zone; [マナゾーン](term:term-mana-zone)から ... [{{手札|てふだ}}](term:term-hand)に fa tornare un Dragon verso la mano. Non è etimologia, ma aiuta a non confondere fonte e destinazione.

## 2. Una volta per turno: scelta facoltativa e battle forzato

La seconda riga cambia ritmo: non guarda più soltanto l'ingresso di Garchainsaw, ma ogni volta in cui una tua creatura Dragon entra. Il limite [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido) sta prima del trigger e governa tutta la procedura successiva: in quel turno puoi arrivare a questa risoluzione una sola volta.

Dentro la frase, [{{選|えら}}んでもよい](grammar:grammar-temoyoi) è il punto di scelta. {{選|えら}}ぶ prende un bersaglio con を, mentre てもよい concede l'azione senza renderla obbligatoria. Dopo la scelta, però, その{{2体|にたい}} riprende la tua creatura Dragon appena entrata e la creatura avversaria scelta: quelle due, non altre, vengono fatte combattere.

:::example_sentence
jp: >-
  [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido)、
  [{{自分|じぶん}}](term:term-self)のドラゴン・クリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}、
  [{{相手|あいて}}](term:term-opponent)のクリーチャーを{{1体|いったい}}
  [{{選|えら}}んでもよい](grammar:grammar-temoyoi)。
  その{{2体|にたい}}を[バトルさせる](term:term-battle-saseru)。
translation_it: >-
  Una volta per turno, quando entra una tua creatura Dragon, puoi scegliere una
  creatura avversaria. Quelle due combattono.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido): {{各|かく}} distribuisce il limite su ogni turno, {{一度|いちど}} chiude il contatore a una volta. La frase non dice "una volta per partita".
*   [{{自分|じぶん}}](term:term-self)のドラゴン・クリーチャーが[{{出|で}}た](term:term-deru){{時|とき}}: il soggetto del trigger è una tua creatura Dragon che entra. ドラゴン・クリーチャー è il filtro che decide quali ingressi contano.
*   [{{相手|あいて}}](term:term-opponent)のクリーチャーを{{1体|いったい}}[{{選|えら}}んでもよい](grammar:grammar-temoyoi): を marca il bersaglio, {{1体|いったい}} limita la scelta a una creatura, てもよい rende la scelta opzionale.
*   その{{2体|にたい}}を[バトルさせる](term:term-battle-saseru): その guarda indietro ai due corpi già individuati. させる è causativo: l'effetto fa avvenire il battle, non descrive un attacco normale dichiarato da una creatura.

#### ⚖️ Contrasto operativo: permesso e conseguenza non hanno la stessa forza

[～てもよい](grammar:grammar-temoyoi) governa la scelta della creatura avversaria: puoi scegliere o non scegliere. その{{2体|にたい}}を[バトルさせる](term:term-battle-saseru), invece, è la conseguenza del bersaglio scelto: una volta formata la coppia, il testo non sta più chiedendo se vuoi un battle separato, sta dicendo che quei due combattono.

#### 🧠 Gancio cognitivo: `{{各|かく}}` azzera il contatore

Come memoria pratica, immagina {{各|かく}}ターン come un nuovo segnalino su ogni turno. [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido) non blocca la carta per sempre: azzera il contatore a ogni turno, ma lo richiude appena l'effetto è stato usato una volta.

## 3. Primo break: altri avversari e distribuzione uno a uno

La terza riga usa {{各|かく}}ターン senza に{{一度|いちど}}, poi restringe il trigger con [はじめて〜した{{時|とき}}](grammar:grammar-hajimete-shita-toki). La differenza è sottile ma importante: il limite non è espresso come "puoi farlo una volta"; è costruito come "quando accade per la prima volta in quel turno". Dopo quel primo break, i break successivi dello stesso turno non riaprono questa finestra.

Il pezzo [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite) fa due operazioni in una forma corta. {{他|ほか}}の esclude l'avversario appena coinvolto nel primo break; {{各|かく}} distribuisce il risultato sugli avversari rimanenti. Poi [{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu) dice come procedere: uno scudo per ciascun altro avversario, non un blocco indistinto di scudi.

:::example_sentence
jp: >-
  {{各|かく}}ターン、
  [はじめて{{相手|あいて}}のシールドをブレイクした{{時|とき}}](grammar:grammar-hajimete-shita-toki)、
  [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite)
  のシールドも[{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu)ブレイクする。
translation_it: >-
  Ogni turno, quando rompe per la prima volta gli scudi di un avversario,
  rompe anche gli scudi di ciascun altro avversario uno a uno.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{各|かく}}ターン`: lo scope si riapre a ogni turno. Da solo non dice ancora quante volte l'effetto può accadere; prepara il contesto temporale.
*   [はじめて{{相手|あいて}}のシールドをブレイクした{{時|とき}}](grammar:grammar-hajimete-shita-toki): はじめて sposta il focus sulla prima occorrenza. ブレイクした modifica {{時|とき}}, quindi il trigger parte quando il break è già avvenuto.
*   [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite)のシールドも: {{他|ほか}}の toglie dal gruppo l'avversario già colpito, {{各|かく}} guarda ciascun altro avversario separatamente, も aggiunge anche i loro scudi al risultato.
*   [{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu)ブレイクする: {{1|ひと}}つ fissa l'unità, ずつ la distribuisce. Il testo non dice "un totale di uno", ma "uno per volta / uno per ciascuno".

#### ⚖️ Contrasto operativo: `につき` conta fonti, `ずつ` distribuisce risultato

[{{相手|あいて}}{{1人|ひとり}}につき](grammar:grammar-aite-hitori-nitsuki) nel primo effetto conta quanti avversari producono copie della stessa procedura. [{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu) nel terzo effetto descrive invece come il risultato viene ripartito sugli scudi degli altri avversari. Entrambi suonano come "per ciascuno", ma uno moltiplica l'azione, l'altro serializza il payoff.

#### 🧠 Gancio cognitivo: `{{他|ほか}}の` sottrae prima di distribuire

Per ricordare [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite), pensa a due passaggi: prima {{他|ほか}}の rimuove l'avversario già colpito, poi {{各|かく}} passa uno per uno sugli avversari rimasti. È un trucco di lettura, non una spiegazione etimologica.

## Esempi guidati di riepilogo

Le tre righe della carta usano gli stessi segnali in combinazioni diverse: zona di partenza, destinazione, limite per turno e distribuzione su avversari o scudi.

:::example_sentence
jp: >-
  [{{相手|あいて}}{{1人|ひとり}}につき](grammar:grammar-aite-hitori-nitsuki)、
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を
  [マナゾーン](term:term-mana-zone)に{{置|お}}く。
translation_it: >-
  Per ogni avversario, metti nella mana zone la prima carta dalla cima del
  mazzo.
:::

:::example_sentence
jp: >-
  [その{{後|あと}}](grammar:grammar-sonoato)、[マナゾーン](term:term-mana-zone)からドラゴンを
  {{1枚|いちまい}}[{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}す](term:term-modosu)。
translation_it: >-
  Poi fai tornare in mano un Dragon dalla mana zone.
:::

:::example_sentence
jp: >-
  [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido)、
  [{{相手|あいて}}](term:term-opponent)のクリーチャーを{{1体|いったい}}
  [{{選|えら}}んでもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Una volta per turno, puoi scegliere una creatura avversaria.
:::

:::example_sentence
jp: >-
  [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite)
  のシールドも[{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu)ブレイクする。
translation_it: >-
  Rompe anche gli scudi di ciascun altro avversario, uno a uno.
:::

---

## Nota finale

ガルチェンソ・ドラゴン non è difficile perché usa parole rare: è difficile perché ogni riga sposta l'attenzione su un asse diverso. Nel primo effetto leggi traiettorie tra [{{山札|やまふだ}}](term:term-deck), [マナゾーン](term:term-mana-zone) e [{{手札|てふだ}}](term:term-hand); nel secondo riconosci [{{各|かく}}ターンに{{一度|いちど}}](grammar:grammar-kaku-turn-ni-ichido) e [～てもよい](grammar:grammar-temoyoi); nel terzo separi [はじめて〜した{{時|とき}}](grammar:grammar-hajimete-shita-toki), [{{他|ほか}}の{{各|かく}}{{相手|あいて}}](grammar:grammar-hoka-no-kaku-aite) e [{{1|ひと}}つずつ](grammar:grammar-hitotsu-zutsu). Quando questi segnali sono chiari, la carta smette di essere una massa di effetti e diventa una sequenza leggibile.
