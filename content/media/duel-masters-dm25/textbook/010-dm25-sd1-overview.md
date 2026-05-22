---
id: lesson-duel-masters-dm25-dm25-sd1-overview
media_id: media-duel-masters-dm25
slug: dm25-sd1-overview
title: "DM25-SD1 技の王道: cimitero, Abyss e keyword compatte"
order: 30
segment_ref: analisi-mazzi
difficulty: n4
status: active
tags: [deck, abyss, graveyard, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Nel deck DM25-SD1 Waza no Oudo, il rules text Abyss trasforma cimitero,
  filtri di costo e keyword in una sequenza leggibile di setup, sostituzione e
  pressione.
---

# DM25-SD1 技の王道: cimitero, Abyss e keyword compatte

`DM25-SD1 技の王道` presenta l'asse Abyss come un deck che non tratta il
cimitero come semplice scarto. Molte righe partono da una carta che entra,
lascia il campo, finisce nel [{{墓地|ぼち}}](term:term-graveyard) o viene
ripresa da lì; il giapponese costruisce questa sequenza con zone, condizioni e
sostituzioni molto compatte.

Quando scorri le carte del mazzo, il punto non è memorizzare ogni ruling a
parte. Il testo ti chiede di riconoscere tre segnali che tornano insieme:
famiglia [アビス](term:term-abyss), filtro di [コスト](term:term-cost) e keyword
come [アビスラッシュ](term:term-abyss-rush) o
[シビルカウント](term:term-civil-count). Se questi tre livelli restano separati
nel parsing, anche una carta lunga diventa una procedura leggibile.

## Termini chiave

- [アビス](term:term-abyss) — famiglia centrale del deck, spesso legata a
  rientri dal cimitero e attacchi ripetuti
- [アビスロイヤル](term:term-abyss-royal) — sottofamiglia Abyss più selettiva,
  utile quando il testo filtra per razza
- [{{墓地|ぼち}}](term:term-graveyard) — cimitero, zona da cui il mazzo recupera
  risorse invece di archiviarle soltanto
- [{{出|だ}}す](term:term-dasu) — mettere in campo o far uscire una carta da una
  zona verso il battle zone
- [{{戻|もど}}す](term:term-modosu) — far tornare una carta in una zona
  precedente o indicata dal testo
- [{{破壊|はかい}}](term:term-destroy) — distruzione, cioè spostamento della
  creatura dal campo al cimitero
- [とばす](term:term-tobasu) — saltare una parte del turno, non "volare"
- [{{攻撃|こうげき}}{{先|さき}}](term:term-attack-target) — bersaglio concreto di
  un attacco già dichiarato

## Pattern grammaticali chiave

- [～{{時|とき}} / ～た{{時|とき}}](grammar:grammar-toki) — trigger temporale:
  quando succede X, parte l'effetto collegato
- [その後](grammar:grammar-sonoato) — sequenza successiva: prima si risolve un
  blocco, poi il testo apre il passo seguente
- [～てもよい](grammar:grammar-temoyoi) — permesso opzionale: puoi fare
  l'azione, ma non sei obbligato
- [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) — limiti
  numerici: al massimo / almeno rispetto a un costo o a una quantità
- [ただし](grammar:grammar-tadashi) — restrizione dopo una concessione o un
  effetto apparentemente più largo
- [～を{{2回|にかい}}{{行|おこな}}う](grammar:grammar-nikai-okonau) — ripetizione
  procedurale: esegui due volte l'azione appena definita

## Etichette da riconoscere

- [アビスラッシュ](term:term-abyss-rush) — keyword Abyss basata su uscita dal
  campo e sostituzione
- [シビルカウント](term:term-civil-count) — keyword di soglia: controlla un
  conteggio prima di permettere un'azione
- [アビスベル=ジャシン{{帝|てい}}](term:term-abyssbell-jashintei) — creatura-ancora
  del deck, utile per vedere insieme keyword e sostituzione
- [{{邪侵入|じゃしんにゅう}}](term:term-jashinnyuu) — spell che incarna il ciclo
  `{{墓地|ぼち}}に{{置|お}}く ➔ その{{後|あと}} ➔ {{出|だ}}す`
- [ジャブラッド](term:term-jablood) — nome Abyss ricorrente nel pacchetto, da
  leggere come riferimento di contesto più che come parola comune

---

## 1. Il motore Abyss: cimitero, uscita dal campo e sostituzione

Nel cuore del deck, [{{墓地|ぼち}}](term:term-graveyard) non chiude la storia di
una carta: spesso diventa la zona da cui una creatura viene rimessa in gioco o
la zona che rende attivo un altro effetto. Per questo i verbi di movimento
contano più della traduzione secca: [{{出|だ}}す](term:term-dasu) porta una carta
fuori da una zona verso il campo, [{{戻|もど}}す](term:term-modosu) la rimanda a
una zona indicata, mentre [{{破壊|はかい}}](term:term-destroy) descrive un'uscita
dal campo con destinazione naturale nel cimitero.

:::image
src: assets/cards/abyssbell-jashintei.webp
alt: "Carta di アビスベル=ジャシンてい centrata e leggibile."
card_id: card-abyssbell-jashintei-recognition
caption: >-
  Immagine ufficiale di [アビスベル=ジャシン{{帝|てい}}](term:term-abyssbell-jashintei):
  nome e keyword mettono subito in primo piano il piano Abyss del deck.
:::

:::image
src: assets/cards/dm25-sd1/02-abyssbell-jashin-emperor.webp
alt: Carta 2 del mazzo DM25-SD1, creatura centrale del pacchetto Abyss.
card_id: card-abyssbell-jashintei-recognition
caption: >-
  `DM25-SD1 2/13`: [アビスベル=ジャシン{{帝|てい}}](term:term-abyssbell-jashintei)。
  [アビスラッシュ](term:term-abyss-rush) + `かわりに` trasformano l'uscita dal
  campo in una scelta di sostituzione pagata dalla mano.
:::

[アビスラッシュ](term:term-abyss-rush) è il punto in cui la keyword smette di
essere una label e diventa una frase da leggere. Il blocco non dice solo
"questa creatura ha Abyss Rush": apre una condizione di uscita, poi propone un
costo alternativo introdotto da `かわりに`.

:::example_sentence
jp: >-
  [アビスラッシュ](term:term-abyss-rush)：このクリーチャーが
  [{{離|はな}}れる](term:term-hanareru){{時|とき}}、かわりに
  {{自分|じぶん}}の{{手札|てふだ}}を{{2枚|にまい}}{{捨|す}}ててもよい。
translation_it: >-
  Abyss Rush: quando questa creatura sta per lasciare il campo, puoi invece
  scartare 2 carte dalla tua mano.
:::

#### 🗺️ Anatomia della frase

*   [アビスラッシュ](term:term-abyss-rush) ➔ **Keyword apribile**. La parola
    compatta annuncia una regola, ma la riga dopo i due punti ti dice quando e
    come applicarla.
*   `このクリーチャーが{{離|はな}}れる{{時|とき}}` ➔ **Trigger di uscita**.
    [{{離|はな}}れる](term:term-hanareru) indica che la
    creatura lascia la zona; non restringe automaticamente il caso alla sola
    distruzione.
*   `かわりに` ➔ **Sostituzione**. Il testo ti chiede di leggere l'azione
    successiva come "al posto di" ciò che stava per accadere.
*   `{{自分|じぶん}}の{{手札|てふだ}}を{{2枚|にまい}}{{捨|す}}ててもよい` ➔
    **Costo opzionale**. [～てもよい](grammar:grammar-temoyoi) rende la
    sostituzione permessa, non obbligatoria: puoi scartare due carte per
    impedire l'uscita, ma il testo non ti forza a farlo.

#### ⚖️ Contrasto operativo: uscita, distruzione e sostituzione

*   [{{破壊|はかい}}](term:term-destroy) è un modo specifico in cui una creatura
    può lasciare il campo.
*   [{{離|はな}}れる](term:term-hanareru) è più largo: copre il fatto di
    allontanarsi dalla zona, qualunque sia il meccanismo che lo produce.
*   `かわりに` non aggiunge un effetto dopo l'uscita: lo inserisce al posto
    dell'uscita prevista. Se lo leggi come "poi", sbagli la finestra.

#### 🧠 Gancio cognitivo

Pensa a `かわりに` come a un cartello di scambio: la freccia non è
`lascia il campo ➔ scarta`, ma `stava per lasciare il campo ➔ puoi pagare
scartando per sostituire quell'evento`. È un trucco di memoria, non una
spiegazione etimologica.

## 2. Tempo difensivo: quel turno e il resto da saltare

Il piano Abyss attacca e ricicla, ma il deck contiene anche righe difensive
molto corte. Proprio perché sono corte, vanno lette senza riempire i vuoti:
`そのターン` aggancia un turno già determinato, `{{残|のこ}}り` ne prende la parte
non ancora risolta, e [とばす](term:term-tobasu) cancella quella parte dalla
sequenza.

:::image
src: assets/cards/dm25-sd1/05-ragnarok-the-clock.webp
alt: Carta 5 del mazzo DM25-SD1, figura meccanica del The Clock.
caption: >-
  `DM25-SD1 5/13`: {{終末|しゅうまつ}}の{{時計|とけい}} ザ・クロック。
  La riga fissa il valore operativo di [とばす](term:term-tobasu): saltare il
  resto di un turno già in corso.
:::

:::example_sentence
jp: >-
  {{相手|あいて}}は、そのターンの{{残|のこ}}りを
  [とばす](term:term-tobasu)。
translation_it: >-
  L'avversario salta il resto di quel turno.
:::

#### 🗺️ Anatomia della frase

*   `{{相手|あいて}}は` ➔ **Tema operativo**. L'avversario è la parte che subisce
    la modifica alla sequenza del turno.
*   `そのターンの{{残|のこ}}りを` ➔ **Oggetto compatto**. `そのターン` rimanda a quel
    turno preciso, `の` lega il turno al suo resto, `を` marca ciò che verrà
    saltato.
*   [とばす](term:term-tobasu) ➔ **Azione sul flusso**. Qui non descrive un
    movimento fisico: fa saltare una porzione di turno.

#### ⚖️ Contrasto operativo: `とばす` fisico vs `とばす` procedurale

In giapponese generale [とばす](term:term-tobasu) può evocare "far volare" o
"saltare". Nel rules text di The Clock, l'oggetto `そのターンの{{残|のこ}}り` rende
impossibile la lettura fisica: non stai spostando qualcosa nello spazio, stai
togliendo dalla procedura ciò che restava da fare.

## 3. Ripetizione e quantità: quando il testo compatta due applicazioni

Le carte di rimozione del deck usano spesso quantità, limiti e ripetizioni. In
questo tipo di riga devi individuare prima l'azione base, poi il moltiplicatore:
[～を{{2回|にかい}}{{行|おこな}}う](grammar:grammar-nikai-okonau) non introduce un
secondo effetto diverso, ma ordina di eseguire di nuovo lo stesso blocco.

:::image
src: assets/cards/dm25-sd1/06-doorknocker-nordocker.webp
alt: >-
  Carta 6 del mazzo DM25-SD1, Twinpact ドアノッカ＝ノアドッカ /
  「…あけるか？」 con arte viola e dorata.
caption: >-
  `DM25-SD1 6/13`: ドアノッカ＝ノアドッカ / 「…{{開|あ}}けるか？」。
  Il testo usa [～を{{2回|にかい}}{{行|おこな}}う](grammar:grammar-nikai-okonau) per
  applicare due volte una riduzione già definita.
:::

:::example_sentence
jp: >-
  {{相手|あいて}}のクリーチャー{{1体|いったい}}のパワーを
  `{{-4000|マイナスよんせん}}`する。これを
  [{{2回|にかい}}{{行|おこな}}う](grammar:grammar-nikai-okonau)。
translation_it: >-
  Dai `-4000` a 1 creatura dell'avversario. Esegui questo due volte.
:::

#### 🗺️ Anatomia della frase

*   `{{相手|あいて}}のクリーチャー{{1体|いったい}}のパワーを` ➔ **Bersaglio e
    parametro**. Il testo non colpisce il giocatore: prende una creatura
    avversaria e modifica il suo valore di power.
*   `` `{{-4000|マイナスよんせん}}`する `` ➔ **Azione numerica**. Il numero
    negativo è l'effetto applicato al parametro appena nominato.
*   `これを{{2回|にかい}}{{行|おこな}}う` ➔ **Ripetizione del blocco precedente**.
    [～を{{2回|にかい}}{{行|おこな}}う](grammar:grammar-nikai-okonau) usa `これ`
    per riprendere l'azione appena detta; `{{2回|にかい}}` fissa quante volte;
    `{{行|おこな}}う` la tratta come procedura da eseguire.

#### ⚖️ Contrasto operativo: due volte non significa per forza due bersagli

La frase non dice automaticamente "due creature diverse". Dice: esegui
l'azione due volte. Ogni applicazione segue le regole del testo appena letto,
quindi la domanda giusta è: il bersaglio viene scelto di nuovo per ogni
applicazione oppure la frase mantiene lo stesso riferimento? In questa carta,
`これを{{2回|にかい}}{{行|おこな}}う` ti obbliga a rileggere il blocco precedente,
non a cercare una seconda riga nascosta.

Lo stesso tipo di precisione serve con i limiti numerici:
[～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) cambia il filtro
prima ancora dell'effetto. `コスト{{5以下|ごいか}}` non vuol dire "circa costo
5": include 5 e tutti i costi più bassi; `{{3以上|さんいじょう}}` include 3 e
tutto ciò che supera quella soglia.

## 4. Recuperare dal cimitero e cambiare il bersaglio dell'attacco

Quando il deck passa dal setup all'attacco, il giapponese lega più azioni in
catena: trigger di attacco, filtro di costo, origine nel
[{{墓地|ぼち}}](term:term-graveyard), permesso opzionale e cambio del
[{{攻撃|こうげき}}{{先|さき}}](term:term-attack-target). La riga di Cobra è utile
perché mette tutti questi pezzi nello stesso periodo.

:::image
src: assets/cards/dm25-sd1/07-cobra-snake-ninja-holy-chaos.webp
alt: Carta 7 del mazzo DM25-SD1, creatura serpente Cobra.
caption: >-
  `DM25-SD1 7/13`: **Cobra, Snake Ninja Holy Chaos**.
  Qui [{{攻撃|こうげき}}{{先|さき}}](term:term-attack-target) e
  `{{変更|へんこう}}する` entrano dopo il recupero di una creatura dal cimitero.
:::

:::example_sentence
jp: >-
  このクリーチャーが{{攻撃|こうげき}}する{{時|とき}}、コスト{{5以下|ごいか}}の
  {{進化|しんか}}ではないクリーチャーを{{1体|いったい}}、
  {{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}してもよい。そうしたら、その
  クリーチャーに[{{攻撃|こうげき}}{{先|さき}}](term:term-attack-target)を{{変更|へんこう}}する。
translation_it: >-
  Quando questa creatura attacca, puoi mettere in gioco dal tuo cimitero 1
  creatura non evoluzione di costo 5 o inferiore. Se lo fai, cambi il bersaglio
  dell'attacco a quella creatura.
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーが{{攻撃|こうげき}}する{{時|とき}}` ➔ **Finestra di trigger**.
    [～{{時|とき}} / ～た{{時|とき}}](grammar:grammar-toki) aggancia l'effetto al
    momento dell'attacco, non a una fase generica del turno.
*   `コスト{{5以下|ごいか}}の{{進化|しんか}}ではないクリーチャーを{{1体|いったい}}`
    ➔ **Filtro sul bersaglio da recuperare**. Il costo deve essere 5 o meno e
    la creatura non deve essere evoluzione.
*   `{{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}してもよい` ➔ **Origine e
    opzionalità**. `から` indica la zona di partenza; `てもよい` conferma che
    puoi scegliere se mettere in campo quella creatura.
*   `そうしたら` ➔ **Condizione retroattiva**. Il cambio successivo dipende dal
    fatto che tu abbia davvero eseguito l'azione appena descritta.
*   `そのクリーチャーに{{攻撃|こうげき}}{{先|さき}}を{{変更|へんこう}}する` ➔
    **Riassegnazione dell'attacco**. `そのクリーチャー` è la creatura appena
    uscita dal cimitero; [{{攻撃|こうげき}}{{先|さき}}](term:term-attack-target)
    è il bersaglio dell'attacco in corso.

#### ⚖️ Contrasto operativo: `そのクリーチャー` non è "una creatura qualsiasi"

Il dimostrativo `その` riprende la creatura appena messa in campo con
`{{墓地|ぼち}}から{{出|だ}}す`. Se lo leggi come riferimento libero, perdi la
catena: il testo non cambia il bersaglio verso una creatura scelta a piacere,
ma verso quella specifica creatura recuperata.

## 5. Soglie, sequenze e restrizioni

[シビルカウント](term:term-civil-count) porta nel deck un altro tipo di lettura:
prima di usare un effetto, devi controllare se una soglia è stata raggiunta. Il
giapponese lo segnala con `{{合計|ごうけい}}`, [～{{以下|いか}} /
～{{以上|いじょう}}](grammar:grammar-ika-ijou) e formule condizionali come
`であれば`.

:::example_sentence
jp: >-
  [シビルカウント{{3|さん}}](term:term-civil-count)：
  {{自分|じぶん}}の{{闇|やみ}}のカードのコストの{{合計|ごうけい}}が
  {{3以上|さんいじょう}}であれば、このクリーチャーの「S・トリガー」を
  {{使|つか}}ってもよい。
translation_it: >-
  Civil Count 3: se la somma dei costi delle tue carte oscurità è 3 o più, puoi
  usare l'S-Trigger di questa creatura.
:::

#### 🗺️ Anatomia della frase

*   [シビルカウント{{3|さん}}](term:term-civil-count) ➔ **Keyword di soglia**.
    Il numero dopo la keyword è la soglia da verificare, non il numero di volte
    in cui l'effetto si applica.
*   `{{自分|じぶん}}の{{闇|やみ}}のカードのコストの{{合計|ごうけい}}が` ➔
    **Soggetto calcolato**. Il testo non conta quante carte hai: somma i loro
    costi.
*   `{{3以上|さんいじょう}}であれば` ➔ **Condizione minima**.
    `{{以上|いじょう}}` include 3; `であれば` trasforma il totale in condizione.
*   `{{使|つか}}ってもよい` ➔ **Permesso risultante**. Se la soglia passa, puoi
    usare l'S-Trigger; non diventa automaticamente obbligatorio.

#### ⚖️ Contrasto operativo: conteggio delle carte vs somma dei costi

La trappola è leggere [シビルカウント](term:term-civil-count) come "ho tre carte
oscurità". Qui la frase dice `コストの{{合計|ごうけい}}`: il totale è numerico e
nasce dai costi stampati, non dal numero fisico di carte. La keyword ti chiede
quindi "quanto sommano?", non "quante sono?".

La stessa precisione vale quando dopo un effetto compare
[その後](grammar:grammar-sonoato): il testo sta segnando una sequenza, non una
frase accessoria. Se la riga dice `{{墓地|ぼち}}に{{置|お}}く。その{{後|あと}}、
...{{出|だ}}す`, prima risolvi il movimento verso il cimitero e solo dopo passi
alla carta da mettere in campo.

:::example_sentence
jp: >-
  ただし、その「S・トリガー」は{{使|つか}}えない。
translation_it: >-
  Tuttavia, quell'S-Trigger non può essere usato.
:::

#### 🗺️ Anatomia della frase

*   [ただし](grammar:grammar-tadashi) ➔ **Restrizione correttiva**. Il testo
    riapre una concessione precedente e ne taglia una parte.
*   `その「S・トリガー」は` ➔ **Tema ristretto**. `その` riprende proprio
    quell'S-Trigger, non tutti gli S-Trigger possibili.
*   `{{使|つか}}えない` ➔ **Impossibilità**. La forma potenziale negativa non
    dice "non lo usi di solito": dice che in questa condizione non puoi usarlo.

## 6. Nomi-ancora e circuito di supporto Abyss

Alcuni nomi del deck sono molto verticali, ma il testo intorno a loro ripete
forme generali: mettere carte nel cimitero, recuperare creature, restringere
per famiglia [アビス](term:term-abyss) o [アビスロイヤル](term:term-abyss-royal),
poi chiudere con un payoff. Leggili come punti di ancoraggio del contesto, non
come parole comuni da tradurre alla lettera.

:::image
src: assets/cards/jablood.webp
alt: "Carta di ジャブラッド con epiteto じゃりゅう, centrata e leggibile."
card_id: card-jablood-recognition
caption: >-
  Immagine ufficiale di {{邪龍|じゃりゅう}} [ジャブラッド](term:term-jablood):
  nome-ancora del pacchetto Abyss e punto di contesto per le righe su cimitero
  e pressione.
:::

*   **[{{邪侵入|じゃしんにゅう}}](term:term-jashinnyuu)** condensa il movimento più
    tipico dell'asse Abyss: una carta va nel [{{墓地|ぼち}}](term:term-graveyard),
    [その後](grammar:grammar-sonoato) apre il passo successivo, e una creatura
    viene [{{出|だ}}す](term:term-dasu) da una zona controllata dal testo. Il
    nome proprio è verticale, ma la grammatica attorno è riutilizzabile.
*   **[ジャブラッド](term:term-jablood)** funziona come nome-ancora: quando lo
    vedi accanto a [アビス](term:term-abyss) o
    [アビスロイヤル](term:term-abyss-royal), aspettati righe che parlano di
    pressione, protezione o mantenimento delle risorse. Non devi ricavare il
    significato dal nome; devi usare il contesto per leggere gli effetti.
*   **`{{召喚|しょうかん}}{{以外|いがい}}`** nelle carte di supporto esclude la
    normale summon dalla condizione. `{{以外|いがい}}` sposta la lettura da
    "quando viene evocata" a "quando arriva in un modo diverso dalla summon".
    Questo è il tipo di filtro che decide se un rientro dal cimitero attiva
    davvero la riga.
*   **[ただし](grammar:grammar-tadashi)** dopo un effetto largo va letto subito:
    spesso concede qualcosa e poi taglia un uso specifico. Nel deck, una frase
    come `ただし、その「S・トリガー」は{{使|つか}}えない` impedisce di trasformare un
    recupero in un accesso completo a tutte le proprietà della carta.

#### 🧠 Gancio cognitivo

Per leggere il pacchetto Abyss, immagina una procedura a tre caselle:
`zona di partenza ➔ filtro ➔ destinazione`. [{{墓地|ぼち}}](term:term-graveyard)
ti dà spesso la casella iniziale, `コスト{{4以下|よんいか}}` o
`アビスロイヤル` stringono il filtro, [{{出|だ}}す](term:term-dasu) o
[{{戻|もど}}す](term:term-modosu) chiudono la destinazione. È un gancio di
lettura: non sostituisce il rules text, ma ti dice dove cercare i pezzi.

## Esempi guidati di riepilogo

Queste frasi ricombinano i segnali principali del deck: zona, filtro, keyword e
conseguenza.

:::example_sentence
jp: >-
  {{墓地|ぼち}}からアビスを{{出|だ}}す。
translation_it: >-
  Metti in gioco un Abyss dal cimitero.
:::

:::example_sentence
jp: >-
  このクリーチャーが{{離|はな}}れる{{時|とき}}、かわりに
  {{手札|てふだ}}を{{2枚|にまい}}{{捨|す}}ててもよい。
translation_it: >-
  Quando questa creatura sta per lasciare il campo, puoi invece scartare 2
  carte dalla mano.
:::

:::example_sentence
jp: >-
  コスト{{5以下|ごいか}}のクリーチャーを{{1体|いったい}}、
  {{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}してもよい。
translation_it: >-
  Puoi mettere in gioco dal tuo cimitero 1 creatura di costo 5 o inferiore.
:::

:::example_sentence
jp: >-
  そのクリーチャーに{{攻撃|こうげき}}{{先|さき}}を{{変更|へんこう}}する。
translation_it: >-
  Cambi il bersaglio dell'attacco a quella creatura.
:::

## Nota finale

`DM25-SD1 技の王道` diventa leggibile quando separi ciò che il testo tende a
comprimere: prima la zona, poi il filtro, poi la conseguenza. Le keyword
[アビスラッシュ](term:term-abyss-rush) e
[シビルカウント](term:term-civil-count) sembrano scorciatoie, ma funzionano solo
se apri il giapponese che le accompagna: trigger, soglia, opzionalità,
sostituzione e restrizione.
