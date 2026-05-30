---
id: lesson-duel-masters-dm25-tcg-core-patterns
media_id: media-duel-masters-dm25
slug: tcg-core-patterns
title: Montare il testo effetto delle carte
order: 20
segment_ref: tcg-core
difficulty: n4
status: active
tags: [core, grammar, rules-text, effects]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-overview,
    lesson-duel-masters-dm25-tcg-card-types,
  ]
summary: >-
  Trigger, sequenze, opzionalità, sostituzioni, controlli di stato e
  restrizioni che fanno funzionare il rules text di Duel Masters.
---

# Montare il testo effetto delle carte

Su una carta di Duel Masters il giapponese non racconta l'effetto come farebbe
un dialogo. Lo compatta in una procedura: prima ti dà il momento in cui il
testo si accende, poi l'azione, poi il bersaglio, la zona, il filtro numerico e
le restrizioni che impediscono letture troppo larghe.

Quando vedi una riga come `{{出|で}}た{{時|とき}}` o `その{{後|あと}}`,
non stai solo traducendo parole isolate. Stai montando l'ordine di risoluzione:
che cosa è già successo, che cosa puoi scegliere, che cosa dipende da una
condizione e che cosa resta vero anche se una carta si sposta.

## Termini chiave

- [{{出|で}}る](term:term-deru) — entrare o uscire come evento che accade alla
  carta; nel rules text spesso segnala il punto da cui parte un trigger.
- [{{出|だ}}す](term:term-dasu) — mettere in campo o far uscire qualcosa da una
  zona; qui il testo presenta un'azione compiuta dal giocatore o dall'effetto.
- [{{置|お}}く](term:term-oku) — mettere una carta in una zona precisa, spesso
  dal mazzo al cimitero o in fondo al mazzo.
- [{{選|えら}}ぶ](term:term-erabu) — scegliere un bersaglio valido prima di
  applicare l'azione.
- [{{離|はな}}れる](term:term-hanareru) — lasciare una zona; il focus è sul fatto
  che la carta non si trova più dov'era.
- [{{戻|もど}}す](term:term-modosu) — riportare una carta in una zona indicata,
  spesso mano o mazzo.
- [{{残|のこ}}る](term:term-nokoru) — restare nella zona o nello stato corrente
  nonostante un altro evento.
- [{{扱|あつか}}う](term:term-atsukau) — trattare o contare qualcosa come una
  certa categoria di carta.
- [{{効果|こうか}}](term:term-effect) — il blocco operativo che produce il
  risultato; `この{{効果|こうか}}` punta a quell'effetto specifico, non alla carta
  intera.
- [クリーチャー](term:term-creature) — corpo che resta in battle zone e può
  attaccare, bloccare o essere scelto.

## Espressioni ricorrenti

- [その後](grammar:grammar-sonoato) — continua la procedura dopo il blocco
  appena risolto.
- [そうしたら](grammar:grammar-soushitara) — apre un seguito dipendente dal fatto
  che il passo precedente sia stato davvero eseguito.
- [かわりに](grammar:grammar-kawarini) — sostituisce un evento con un altro, senza
  sommarli.
- [{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}で](grammar:grammar-igai-no-houhou-de)
  — esclude un metodo specifico e lascia validi gli altri modi di mettere in
  campo.
- [または](grammar:grammar-matawa) — unisce due categorie come alternative sotto
  lo stesso filtro.
- [ただし](grammar:grammar-tadashi) — aggiunge una limitazione finale al blocco
  appena letto.

## Pattern grammaticali chiave

- [～{{時|とき}} / ～た{{時|とき}}](grammar:grammar-toki) — momento in cui un
  trigger controlla o fa partire un effetto
- [～てもよい](grammar:grammar-temoyoi) — permesso: puoi fare l'azione, ma non
  sei obbligato
- [～なければ ... ない](grammar:grammar-nakereba) — condizione negativa forte:
  se manca X, l'effetto non vale
- [～ていれば](grammar:grammar-teireba) — stato già in corso preso come
  condizione del testo
- [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) — soglia
  numerica: al massimo / almeno
- [～のはじめに / ～の{{終|お}}わりに](grammar:grammar-turn-timing) — finestra
  temporale all'inizio o alla fine di un turno

## Etichette da riconoscere

- [{{山札|やまふだ}}](term:term-deck) — il mazzo; con の{{上|うえ}}から indica
  la cima come punto di partenza.
- [バトルゾーン](term:term-battle-zone) — zona in cui le creature sono in campo.
- [{{墓地|ぼち}}](term:term-graveyard) — il cimitero; spesso è destinazione o
  fonte di recupero.
- [{{手札|てふだ}}](term:term-hand) — la mano; quando qualcosa vi entra, il testo
  usa spesso `に{{加|くわ}}える` o `に{{戻|もど}}す`.
- [コスト](term:term-cost) — filtro numerico su cosa puoi scegliere o mettere in
  campo.
- [パワー](term:term-power) — filtro numerico legato alla forza della creatura.
- [タップ](term:term-tap) e [アンタップ](term:term-untap) — stato ruotato e
  ripristino dello stato.
- [{{攻撃|こうげき}}](term:term-attack), [{{破壊|はかい}}](term:term-destroy) e
  [{{重|かさ}}ねる](term:term-kasaneru) — azioni che trasformano un timing in
  conseguenza concreta.
- [アビス](term:term-abyss), [{{侵略|しんりゃく}}](term:term-invasion),
  [W・ブレイカー](term:term-w-breaker) e [コマンド](term:term-command) —
  keyword o famiglie che cambiano quali righe del rules text diventano operative.
- [{{合計|ごうけい}}](term:term-goukei) — somma usata come soglia o criterio di
  scelta.

---

[{{効果|こうか}}](term:term-effect), [パワー](term:term-power), [タップ](term:term-tap) e [アンタップ](term:term-untap) sono i quattro segnali da tenere separati: effetto, valore numerico, stato ruotato e stato ripristinato non descrivono lo stesso livello della carta.

## 1. Trigger e timing: prima capisci quando parla la carta

Il primo pezzo da isolare è quasi sempre il timing. Una carta può avere un
effetto forte, ma se leggi male il momento in cui si accende, sposti tutta la
procedura nel punto sbagliato della partita.

- [～{{時|とき}} / ～た{{時|とき}}](grammar:grammar-toki) aggancia il blocco
  successivo a un evento: `{{出|で}}た{{時|とき}}` significa "quando è entrata",
  `{{攻撃|こうげき}}する{{時|とき}}` significa "quando attacca",
  `{{離|はな}}れる{{時|とき}}` significa "quando lascia la zona". La parte prima
  di `{{時|とき}}` non è ancora il payoff: è l'interruttore che decide quando
  leggere ciò che viene dopo.
- [～のはじめに / ～の{{終|お}}わりに](grammar:grammar-turn-timing) non parla di un
  evento qualunque, ma di una finestra del turno. `{{自分|じぶん}}のターンのはじめに`
  sposta l'effetto all'inizio del tuo turno; このクリーチャーの{{最初|さいしょ}}の
  {{攻撃|こうげき}}の{{終|お}}わりに lo colloca alla fine del primo attacco di
  quella creatura. Il testo precisa la finestra esatta in cui quella creatura puo' essere scelta o applicata.

:::example_sentence
jp: >-
  このクリーチャーが[バトルゾーン](term:term-battle-zone)に
  [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{1枚目|いちまいめ}}を[{{墓地|ぼち}}](term:term-graveyard)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando questa creatura entra nel battle zone, metti la prima carta dalla cima
  del tuo mazzo nel cimitero.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーが` ➔ **Soggetto del trigger**: è questa creatura, non una
    creatura qualsiasi, a produrre la finestra di attivazione.
*   [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru) ➔
    **Evento già avvenuto**: la creatura è entrata; il testo successivo parte
    da quel fatto.
*   [{{時|とき}}](grammar:grammar-toki) ➔ **Cerniera temporale**: tutto ciò
    che segue va risolto quando quel momento si verifica.
*   [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を ➔
    **Fonte e oggetto**: non una carta a scelta, ma la prima dalla cima del
    mazzo.
*   [{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku) ➔
    **Destinazione e azione**: la carta viene messa nel cimitero.

#### ⚖️ Contrasto operativo: trigger non vuol dire effetto già risolto

`{{出|で}}た{{時|とき}}` dice che l'ingresso è il momento che attiva la riga.
Non dice che tutte le azioni successive sono già accadute. Prima riconosci
l'evento, poi risolvi il blocco dopo la virgola.

#### 🧠 Gancio cognitivo

Come trucco di memoria, tratta `{{時|とき}}` come una cerniera: tutto ciò che
sta a sinistra apre la porta, tutto ciò che sta a destra è la procedura che
passa da quella porta.

## 2. Sequenza e dipendenza: その後 continua, そうしたら aggancia

Dopo il trigger, molte carte concatenano due istruzioni. La distinzione utile e' tra sequenza ordinata e condizione agganciata a un evento.

- [その後](grammar:grammar-sonoato) significa "dopo quello": chiude il blocco
  precedente e apre il blocco successivo. La frase resta procedurale; prima
  fai A, poi leggi B.
- [そうしたら](grammar:grammar-soushitara) è più vincolante: rimanda a
  "se hai fatto così". Quando il primo blocco è opzionale con
  [～てもよい](grammar:grammar-temoyoi), そうしたら impedisce di prendere il
  secondo risultato se non hai eseguito davvero il primo passo.
- [～てもよい](grammar:grammar-temoyoi) marca una possibilità concessa al
  giocatore. Non rende automaticamente opzionale tutto il resto della carta:
  bisogna guardare se il testo successivo è collegato da `そうしたら`, da
  `その{{後|あと}}` o da un'altra struttura.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{4枚|よんまい}}を[{{墓地|ぼち}}](term:term-graveyard)に
  [{{置|お}}く](term:term-oku)。[その{{後|あと}}](grammar:grammar-sonoato)、
  [コスト](term:term-cost){{4以下|よんいか}}の[アビス](term:term-abyss)を
  {{1枚|いちまい}}、{{自分|じぶん}}の
  [{{墓地|ぼち}}](term:term-graveyard)から[{{出|だ}}す](term:term-dasu)。
translation_it: >-
  Metti le prime 4 carte del tuo mazzo nel cimitero. Poi metti in gioco 1
  Abyss di costo 4 o inferiore dal tuo cimitero.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{山札|やまふだ}}の{{上|うえ}}から{{4枚|よんまい}}を` ➔ **Gruppo iniziale**:
    il testo prende quattro carte dalla cima del mazzo.
*   `{{墓地|ぼち}}に{{置|お}}く` ➔ **Prima istruzione completa**: quelle carte
    vanno nel cimitero.
*   [その{{後|あと}}](grammar:grammar-sonoato) ➔ **Sequenza ordinata**: il
    blocco successivo parte dopo la prima istruzione.
*   `コスト{{4以下|よんいか}}のアビスを{{1枚|いちまい}}` ➔ **Filtro e quantità**:
    l'oggetto valido è un Abyss di costo 4 o inferiore, uno solo.
*   `{{墓地|ぼち}}から{{出|だ}}す` ➔ **Fonte e azione transitiva**: l'effetto fa
    uscire quella carta dal cimitero e la mette in campo.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{3枚|さんまい}}を[{{墓地|ぼち}}](term:term-graveyard)に
  [{{置|お}}いてもよい](grammar:grammar-temoyoi)。
  [そうしたら](grammar:grammar-soushitara)、[アビス](term:term-abyss)を
  {{1枚|いちまい}}、{{自分|じぶん}}の
  [{{墓地|ぼち}}](term:term-graveyard)から
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}してもよい](term:term-modosu)。
translation_it: >-
  Puoi mettere le prime 3 carte del tuo mazzo nel cimitero. Se lo fai, puoi
  riprendere 1 Abyss dal tuo cimitero nella tua mano.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{置|お}}いてもよい` ➔ **Scelta locale**: il primo movimento di zona è
    permesso, non obbligatorio.
*   [そうしたら](grammar:grammar-soushitara) ➔ **Dipendenza dal passo scelto**:
    il seguito si apre solo se hai davvero messo le carte nel cimitero.
*   `アビスを{{1枚|いちまい}}` ➔ **Oggetto recuperabile**: il testo restringe il
    recupero a una carta Abyss.
*   `{{墓地|ぼち}}から{{手札|てふだ}}に{{戻|もど}}してもよい` ➔ **Seconda scelta**:
    anche il recupero è facoltativo, ma arriva dentro il ramo creato da
    `そうしたら`.

#### ⚖️ Contrasto operativo: その後 non controlla se hai scelto A

`その{{後|あと}}` ordina due blocchi; `そうしたら` lega il secondo al fatto che
il primo sia stato eseguito. Se una riga contiene `てもよい` e poi
`そうしたら`, la seconda parte non è un premio gratuito: è il ramo che segue la
scelta appena fatta.

## 3. Azione, bersaglio e zona: chi sposta che cosa

Il testo effetto di Duel Masters usa molte frasi di movimento. Per leggerle
bene, separa sempre il verbo dal percorso: da dove parte la carta, dove arriva,
e chi o che cosa la sta muovendo.

- [{{出|で}}る](term:term-deru) è intransitivo: la carta entra, esce o appare
  come evento. In `バトルゾーンに{{出|で}}た{{時|とき}}`, il focus è "questa
  creatura è entrata".
- [{{出|だ}}す](term:term-dasu) è transitivo: qualcuno o qualcosa mette in
  campo una carta. In `{{墓地|ぼち}}から{{出|だ}}す`, il testo ti fa cercare la
  fonte e l'oggetto.
- [{{置|お}}く](term:term-oku) non è un generico "lasciare": nel rules text
  posiziona fisicamente o proceduralmente una carta in una zona. Per questo le
  particelle sono decisive: `から` indica la fonte, `に` indica la destinazione,
  `を` indica ciò che viene mosso.
- [{{選|えら}}ぶ](term:term-erabu) crea un target prima dell'azione. Se leggi
  prima il verbo finale e poi cerchi `を`, trovi che cosa viene scelto, distrutto,
  aggiunto o spostato.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{墓地|ぼち}}](term:term-graveyard)から
  [クリーチャー](term:term-creature)を{{1体|いったい}}
  [{{選|えら}}び](term:term-erabu)、[{{手札|てふだ}}](term:term-hand)に
  [{{戻|もど}}す](term:term-modosu)。
translation_it: >-
  Scegli 1 creatura dal tuo cimitero e falla tornare nella tua mano.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{自分|じぶん}}の{{墓地|ぼち}}から` ➔ **Fonte**: il target deve trovarsi nel tuo
    cimitero.
*   `クリーチャーを{{1体|いったい}}` ➔ **Tipo e quantità**: la scelta riguarda una
    creatura, una sola.
*   `{{選|えら}}び` ➔ **Selezione prima del risultato**: il testo stabilisce il
    target valido.
*   `{{手札|てふだ}}に{{戻|もど}}す` ➔ **Destinazione finale**: la carta scelta
    torna in mano.

#### 🧠 Gancio cognitivo

Come trucco di memoria, leggi le particelle come coordinate: `から` è il punto
di partenza, `に` è il punto di arrivo, `を` è la carta che stai seguendo con lo
sguardo.

## 4. Sostituzione e opzionalità: かわりに non aggiunge, rimpiazza

Le carte spesso danno un modo per evitare un evento, pagare un costo alternativo
o cambiare la conseguenza. `かわりに` apre un ramo alternativo dentro lo stesso effetto.

:::example_sentence
jp: >-
  このクリーチャーが[{{離|はな}}れる](term:term-hanareru)
  [{{時|とき}}](grammar:grammar-toki)、
  [かわりに](grammar:grammar-kawarini){{自分|じぶん}}の
  [{{手札|てふだ}}](term:term-hand)を{{2枚|にまい}}{{捨|す}}ててもよい。
translation_it: >-
  Quando questa creatura lascia il campo, al suo posto puoi scartare 2 carte
  dalla tua mano.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーが{{離|はな}}れる{{時|とき}}` ➔ **Evento minacciato**: la creatura
    sta per lasciare la zona.
*   [かわりに](grammar:grammar-kawarini) ➔ **Sostituzione**: il testo prepara
    un'alternativa al movimento appena descritto.
*   `{{手札|てふだ}}を{{2枚|にまい}}{{捨|す}}ててもよい` ➔ **Costo facoltativo**:
    puoi scartare due carte dalla mano per prendere il ramo sostitutivo.

#### ⚖️ Contrasto operativo: sostituire non significa fare entrambe le cose

Se leggi `かわりに` come "poi", ottieni una risoluzione sbagliata: la creatura
lascia il campo e in più scarti carte. Il giapponese invece dice "al posto di
quell'evento, puoi fare questo".

## 5. Condizioni negative e stati già presenti

Non tutte le frasi effetto comandano una nuova azione. Alcune controllano se
una carta conta come creatura, se una condizione era già vera o se una carta
resta dov'è. Questi blocchi sembrano meno dinamici, ma decidono quali righe del
rules text sono davvero attive.

- [～なければ ... ない](grammar:grammar-nakereba) crea una condizione negativa:
  se il requisito non è soddisfatto, il risultato non si applica. Nel rules
  text spesso chiude uno status, per esempio "non viene trattata come creatura".
`進化していれば` controlla lo stato gia' raggiunto dalla creatura: evoluta o meno.
- [{{残|のこ}}る](term:term-nokoru) descrive continuità. Se un'altra carta
  lascia la zona ma `このカードは{{残|のこ}}る`, il testo separa il destino della
  carta rimasta dal movimento della carta uscita.

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{闇|やみ}}の[クリーチャー](term:term-creature)
  [または](grammar:grammar-matawa){{闇|やみ}}のタマシードが
  [{{合計|ごうけい}}](term:term-goukei){{4|よっ}}つ{{以上|いじょう}}
  [なければ](grammar:grammar-nakereba)、[バトルゾーン](term:term-battle-zone)に
  あるこのタマシードはクリーチャーとして[{{扱|あつか}}わない](term:term-atsukau)。
translation_it: >-
  Se non hai in totale almeno 4 creature oscure o Tamashido oscuri, questo
  Tamashido nel battle zone non viene trattato come creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{闇|やみ}}のクリーチャーまたは{{闇|やみ}}のタマシード` ➔ **Due categorie valide**:
    il controllo ammette creature oscure oppure Tamashido oscuri.
*   `{{合計|ごうけい}}{{4|よっ}}つ{{以上|いじょう}}` ➔ **Soglia aggregata**: il
    numero richiesto è il totale delle due categorie, non quattro per ciascuna.
*   [なければ](grammar:grammar-nakereba) ➔ **Condizione negativa**: il blocco
    successivo vale quando la soglia non è raggiunta.
*   `クリーチャーとして{{扱|あつか}}わない` ➔ **Risultato di status**: la carta non
    viene contata come creatura.

:::example_sentence
jp: >-
  タマシードから{{進化|しんか}}していれば、カードをもう{{1枚|いちまい}}{{引|ひ}}く。
translation_it: >-
  Se si è evoluta da un Tamashido, pesca 1 carta in più.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `タマシードから` ➔ **Origine dello stato**: il controllo guarda da che cosa
    arriva l'evoluzione.
*   `{{進化|しんか}}していれば` ➔ **Stato già vero**: non ordina di evolvere ora,
    verifica che l'evoluzione sia già avvenuta.
*   `カードをもう{{1枚|いちまい}}{{引|ひ}}く` ➔ **Payoff condizionato**: la carta in
    più arriva solo se il controllo di stato passa.

#### ⚖️ Contrasto operativo: condizione e timing non sono la stessa cosa

`{{時|とき}}` ti dice quando parte un effetto; `ていれば` ti dice se uno stato è
vero nel momento del controllo. La prima forma apre una finestra, la seconda
verifica una qualità già presente.

## 6. Filtri, alternative e restrizioni: i numeri decidono i target

Quando una carta dice `コスト{{4以下|よんいか}}` o
`パワー{{2000以下|にせんいか}}`, non sta aggiungendo un dettaglio secondario:
sta definendo quali oggetti possono essere scelti. Nei rules text moderni, i
numeri sono spesso il confine tra target valido e target illegale.

- [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) include il
  numero indicato. `コスト{{4以下|よんいか}}` comprende costo 4; non significa
  "meno di 4". `{{合計|ごうけい}}{{4|よっ}}つ{{以上|いじょう}}` comprende il
  totale 4; non richiede 5 o più.
- [{{合計|ごうけい}}](term:term-goukei) aggrega il conteggio. Se due categorie
  sono collegate da [または](grammar:grammar-matawa), {{合計|ごうけい}} ti dice
  di sommarle nello stesso controllo.
- [～{{以外|いがい}}の{{方法|ほうほう}}で](grammar:grammar-igai-no-houhou-de)
  esclude un mezzo, non un risultato. In
  `{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}で{{出|だ}}した`, la creatura
  è comunque entrata; il punto è che non è entrata tramite evocazione normale.
- [ただし](grammar:grammar-tadashi) restringe il risultato appena costruito. Il
  blocco prima di `ただし` rimane il corpo principale; il blocco dopo impone il
  limite da applicare alla fine.

:::example_sentence
jp: >-
  {{相手|あいて}}が[{{召喚|しょうかん}}{{以外|いがい}}の
  {{方法|ほうほう}}で](grammar:grammar-igai-no-houhou-de)
  [クリーチャー](term:term-creature)を[{{出|だ}}した](term:term-dasu)
  [{{時|とき}}](grammar:grammar-toki)、そのクリーチャーを
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Quando il tuo avversario mette in gioco una creatura con un metodo diverso
  dall'evocazione, distruggi quella creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{相手|あいて}}が` ➔ **Attore del trigger**: è l'avversario a mettere in
    campo la creatura.
*   `{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}で` ➔ **Metodo escluso**:
    l'evocazione normale non conta; gli altri metodi sì.
*   `クリーチャーを{{出|だ}}した{{時|とき}}` ➔ **Evento controllato**: una creatura
    è stata messa in campo in quel modo.
*   `そのクリーチャーを{{破壊|はかい}}する` ➔ **Bersaglio ripreso**: `その` punta alla
    creatura appena entrata.

:::example_sentence
jp: >-
  ただし、[コスト](term:term-cost)は{{0以下|ゼロいか}}にはならない。
translation_it: >-
  Tuttavia, il costo non può diventare 0 o inferiore.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [ただし](grammar:grammar-tadashi) ➔ **Limitazione finale**: il testo sta
    correggendo il raggio dell'effetto precedente.
*   `コストは` ➔ **Oggetto della restrizione**: il limite riguarda il costo, non
    la carta intera.
*   `{{0以下|ゼロいか}}にはならない` ➔ **Soglia vietata**: il risultato non può
    scendere fino a 0 o sotto 0.

#### ⚖️ Contrasto operativo: filtro numerico e quantità scelta non coincidono

`コスト{{4以下|よんいか}}のクリーチャーを{{1体|いったい}}` contiene due numeri con
ruoli diversi: `{{4以下|よんいか}}` filtra quali creature sono valide,
`{{1体|いったい}}` dice quante ne scegli. Mescolarli produce target sbagliati.

## 7. Keyword e parentesi: la label dà il nome, la parentesi dà la procedura

Molte keyword di Duel Masters funzionano come etichette compatte seguite da una
parentesi esplicativa. La label ti dice quale meccanica stai vedendo; la
parentesi ti dice esattamente quando, da dove e come si risolve.

Keyword da riconoscere qui:

- [{{侵略|しんりゃく}}](term:term-invasion) — keyword che permette una
  sovrapposizione dalla mano su un attaccante valido.
- [W・ブレイカー](term:term-w-breaker) — keyword di rottura multipla; il nome
  è compatto, ma nel testo effetto resta separato dalle procedure di timing,
  costo e bersaglio.

:::example_sentence
jp: >-
  [{{侵略|しんりゃく}}](term:term-invasion)：{{火|ひ}}の
  [コマンド](term:term-command)（{{自分|じぶん}}の{{火|ひ}}の
  [コマンド](term:term-command)が[{{攻撃|こうげき}}する](term:term-attack)
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [{{手札|てふだ}}](term:term-hand)にあるこのクリーチャーをその{{上|うえ}}に
  [{{重|かさ}}ねてもよい](term:term-kasaneru)）
translation_it: >-
  Invasione: comando di fuoco (quando un tuo comando di fuoco attacca, puoi
  sovrapporre su di esso questa creatura che hai in mano).
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{侵略|しんりゃく}}](term:term-invasion)：{{火|ひ}}のコマンド ➔ **Nome e
    requisito**: la keyword è Invasion, valida per un comando di fuoco.
*   `{{自分|じぶん}}の{{火|ひ}}のコマンドが{{攻撃|こうげき}}する{{時|とき}}` ➔
    **Timing della parentesi**: il momento è l'attacco del tuo comando di fuoco.
*   `{{手札|てふだ}}にあるこのクリーチャーを` ➔ **Fonte e oggetto**: la creatura da
    sovrapporre deve essere nella tua mano.
*   `その{{上|うえ}}に{{重|かさ}}ねてもよい` ➔ **Azione opzionale**: puoi metterla
    sopra l'attaccante indicato da `その`.

#### ⚖️ Contrasto operativo: la parentesi non è testo di colore

In una keyword, la parentesi non è una spiegazione ornamentale. È la procedura:
requisito, timing, fonte, oggetto e azione. Se salti la parentesi, conosci il
nome della keyword ma non sai quando puoi usarla.

## Esempi guidati di riepilogo

Leggere il rules text diventa più stabile se applichi sempre la stessa
sequenza: timing, azione, bersaglio, zona, condizione e restrizione.

**Esempio 1: ingresso e movimento di zona**

:::example_sentence
jp: >-
  このクリーチャーが[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を
  [{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando questa creatura entra, metti la prima carta del tuo mazzo nel
  cimitero.
reveal_mode: sentence
:::

- `{{出|で}}た{{時|とき}}` fissa il trigger.
- `{{山札|やまふだ}}の{{上|うえ}}から` dà la fonte.
- `{{墓地|ぼち}}に{{置|お}}く` dà destinazione e azione.

**Esempio 2: scelta opzionale e ramo dipendente**

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{3枚|さんまい}}を[{{墓地|ぼち}}](term:term-graveyard)に
  [{{置|お}}いてもよい](grammar:grammar-temoyoi)。
  [そうしたら](grammar:grammar-soushitara)、[アビス](term:term-abyss)を
  {{1枚|いちまい}}、{{自分|じぶん}}の[{{墓地|ぼち}}](term:term-graveyard)から
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}してもよい](term:term-modosu)。
translation_it: >-
  Puoi mettere le prime 3 carte del tuo mazzo nel cimitero. Se lo fai, puoi
  riprendere 1 Abyss dal tuo cimitero nella tua mano.
reveal_mode: sentence
:::

- `{{置|お}}いてもよい` apre una scelta.
- `そうしたら` rende il secondo passo dipendente dalla scelta precedente.
- `{{墓地|ぼち}}から{{手札|てふだ}}に` chiarisce il percorso della carta recuperata.

**Esempio 3: alternativa, totale e status**

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{闇|やみ}}の[クリーチャー](term:term-creature)
  [または](grammar:grammar-matawa){{闇|やみ}}のタマシードが
  [{{合計|ごうけい}}](term:term-goukei){{4|よっ}}つ{{以上|いじょう}}
  [なければ](grammar:grammar-nakereba)、このタマシードはクリーチャーとして
  [{{扱|あつか}}わない](term:term-atsukau)。
translation_it: >-
  Se non hai in totale almeno 4 creature oscure o Tamashido oscuri, questo
  Tamashido non viene trattato come creatura.
reveal_mode: sentence
:::

- `または` crea due categorie valide nello stesso controllo.
- `{{合計|ごうけい}}{{4|よっ}}つ{{以上|いじょう}}` dice che il totale deve arrivare
  almeno a quattro.
- `{{扱|あつか}}わない` non distrugge né sposta la carta: cambia come viene
  considerata.

**Esempio 4: keyword con procedura interna**

:::example_sentence
jp: >-
  [{{侵略|しんりゃく}}](term:term-invasion)：{{火|ひ}}の
  [コマンド](term:term-command)（{{自分|じぶん}}の{{火|ひ}}の
  [コマンド](term:term-command)が[{{攻撃|こうげき}}する](term:term-attack)
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [{{手札|てふだ}}](term:term-hand)にあるこのクリーチャーをその{{上|うえ}}に
  [{{重|かさ}}ねてもよい](term:term-kasaneru)）
translation_it: >-
  Invasione: comando di fuoco (quando un tuo comando di fuoco attacca, puoi
  sovrapporre su di esso questa creatura che hai in mano).
reveal_mode: sentence
:::

- `{{侵略|しんりゃく}}：{{火|ひ}}のコマンド` dà nome e requisito.
- `{{攻撃|こうげき}}する{{時|とき}}` dà il timing.
- `{{手札|てふだ}}にあるこのクリーチャーをその{{上|うえ}}に{{重|かさ}}ねてもよい`
  dà fonte, oggetto, bersaglio implicito e opzionalità.

## Nota finale

La difficoltà del testo effetto non sta nel singolo vocabolo raro, ma nel modo
in cui i pezzi si agganciano. `{{時|とき}}` apre il timing,
`その{{後|あと}}` ordina la sequenza, `そうしたら` crea dipendenza,
`かわりに` sostituisce, `なければ ... ない` blocca lo status e
`ただし` chiude con una restrizione. Quando questi segnali sono separati, anche
una riga molto compressa smette di sembrare caos e diventa una procedura
leggibile.
