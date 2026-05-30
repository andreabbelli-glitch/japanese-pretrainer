---
id: lesson-gundam-arsenal-base-battle-screen-and-core-actions
media_id: media-gundam-arsenal-base
slug: battle-screen-and-core-actions
title: Gauge, ruoli e comandi nella schermata di battaglia
order: 20
segment_ref: battle-core
difficulty: n4
status: active
tags: [battle, ui, roles, resources]
prerequisites: [lesson-gundam-arsenal-base-arcade-onboarding]
summary: >-
  Leggi gauge, minimappa, ruoli e comandi di battaglia per capire dove mandare
  le unità, quando spendere costo e quando usare la tecnica speciale.
---

# Gauge, ruoli e comandi nella schermata di battaglia

In *Gundam Arsenal Base* la battaglia non si legge seguendo soltanto le
animazioni dei Mobile Suit. Lo schermo ti dà {{2|ふた}}つの gauge, una
[ミニマップ](term:term-minimap), pannelli [ユニット](term:term-unit) e comandi che
compaiono quando una risorsa o una condizione è pronta. Se guardi tutto come
effetto visivo, reagisci in ritardo; se leggi le label come una frase tattica,
capisci prima quale corsia sta cedendo e quale comando ha davvero valore.

La grammatica della UI è molto concreta. [{{出撃|しゅつげき}}](term:term-sortie)
trasforma una carta preparata in presenza sul campo, [アビリティ](term:term-ability)
spende costo per applicare l'effetto della MS, e
[{{戦術技|せんじゅつぎ}}](term:term-special-attack) usa la [SPゲージ](term:term-sp-gauge)
nel momento in cui il bersaglio giustifica la spesa. I kanji dei ruoli fanno il
resto: [{{殲滅|せんめつ}}](term:term-role-shoumetsu) toglie unità,
[{{制圧|せいあつ}}](term:term-role-seiatsu) converte una corsia aperta in danno,
[{{防衛|ぼうえい}}](term:term-role-bouei) tiene vivo l'obiettivo che non deve
cadere.

## Termini chiave

- [{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) — resistenza complessiva di basi e nave alleate
- [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge) — resistenza complessiva di basi e nave nemiche
- [ユニット](term:term-unit) — coppia MS + PL mandata in campo
- [ミニマップ](term:term-minimap) — mappa ridotta della pressione sulle corsie
- [バトルフィールド](term:term-battlefield) — campo di battaglia mostrato in grande
- [コスト](term:term-cost) — risorsa che cresce e viene spesa per agire
- [SPゲージ](term:term-sp-gauge) — barra per le tecniche speciali
- [{{役割|やくわり}}](term:term-role) — funzione tattica dell'unità

## Espressioni ricorrenti

- [{{出撃|しゅつげき}}](term:term-sortie) — far entrare una unità in campo
- [アビリティ](term:term-ability) — abilità speciale della MS
- [{{戦術技|せんじゅつぎ}}](term:term-special-attack) — tecnica speciale dell'unità
- [{{作戦|さくせん}}カード](term:term-tactics-card) — carta tattica digitale di supporto
- [クライマックスブースト](term:term-climax-boost) — finale con recupero costo accelerato

## Pattern grammaticali chiave

- [～が{{表示|ひょうじ}}される](grammar:grammar-ga-hyouji-sareru) — X viene mostrato sulla schermata
- [～することで](grammar:grammar-suru-koto-de) — compiendo X, si ottiene Y
- [～をタッチする](grammar:grammar-wo-tacchi-suru) — toccare l'elemento indicato

## Etichette da riconoscere

- [{{殲滅|せんめつ}}](term:term-role-shoumetsu) — ruolo che punta prima alle unità nemiche
- [{{制圧|せいあつ}}](term:term-role-seiatsu) — ruolo che danneggia basi e nave
- [{{防衛|ぼうえい}}](term:term-role-bouei) — ruolo che protegge base o nave
- [{{拠点|きょてん}}](term:term-base) — base intermedia della mappa
- [{{戦艦|せんかん}}](term:term-warship) — nave madre, obiettivo finale

---

[～をタッチする](grammar:grammar-wo-tacchi-suru) è la formula tattile della UI: il nome prima di `を` è l'elemento da premere, non un luogo da raggiungere.

## 1. Gauge e minimappa: la battaglia come frase di stato

La prima opposizione da leggere è
[{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) contro
[{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge).
`{{自軍|じぐん}}` è il tuo schieramento, `{{敵軍|てきぐん}}` quello avversario,
mentre `{{戦力|せんりょく}}` non indica la vita di una singola unità. Qui la
gauge riassume quanta resistenza resta agli obiettivi: [{{拠点|きょてん}}](term:term-base)
e [{{戦艦|せんかん}}](term:term-warship). Per questo una vittoria locale sul
[バトルフィールド](term:term-battlefield) può ancora essere una cattiva lettura
se intanto la nave sta perdendo la partita.

:::image
src: assets/ui/battle-screen-reference.webp
alt: "Schermata ufficiale di battaglia con gauge dei due lati, pannelli unità, costo, SP gauge e minimappa visibili nello stesso frame."
caption: >-
  In alto leggi [{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) e [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge); in basso [コスト](term:term-cost), [SPゲージ](term:term-sp-gauge) e pannelli [ユニット](term:term-unit); al centro la [ミニマップ](term:term-minimap) comprime corsie, obiettivi e pressione.
:::

La [ミニマップ](term:term-minimap) rende leggibile ciò che la scena grande
nasconde con movimento ed effetti. Se compare un
[{{制圧|せいあつ}}](term:term-role-seiatsu) vicino a una base senza
[{{防衛|ぼうえい}}](term:term-role-bouei), la frase tattica è già quasi
scritta: "la pressione sta passando". Se la pressione è diretta alla
[{{戦艦|せんかん}}](term:term-warship), non stai più leggendo una scaramuccia di
corsia, ma una condizione di fine partita.

:::example_sentence
jp: >-
  {{自軍|じぐん}}{{戦力|せんりょく}}ゲージが{{残|のこ}}り{{少|すく}}ないなら、{{無理|むり}}に{{攻|せ}}めず{{戦艦|せんかん}}の{{防衛|ぼうえい}}を{{優先|ゆうせん}}します。
translation_it: >-
  Se la gauge alleata è quasi finita, dai priorità alla difesa della nave
  invece di forzare l'attacco.
:::

#### 🗺️ Anatomia della frase

*   `{{自軍|じぐん}}{{戦力|せんりょく}}ゲージが{{残|のこ}}り{{少|すく}}ないなら` ➔ **Condizione di stato** (`なら` prende la gauge quasi finita come premessa della decisione).
*   `{{無理|むり}}に{{攻|せ}}めず` ➔ **Azione evitata** (`～ず` nega il forzare l'attacco e prepara la scelta alternativa).
*   `{{戦艦|せんかん}}の{{防衛|ぼうえい}}を{{優先|ゆうせん}}します` ➔ **Priorità operativa** (`を` marca ciò che viene portato in cima: difendere la nave, non inseguire un duello locale).

#### ⚖️ Contrasto operativo

La gauge non è "HP del Gundam che stai guardando".
Una unità può vincere il combattimento davanti a te mentre la
[{{戦艦|せんかん}}](term:term-warship) perde abbastanza resistenza da chiudere il
match. Quando la gauge è bassa, la schermata va letta dagli obiettivi verso le
unità, non il contrario.

## 2. Pannelli unità: dal tocco alla posizione sulla mappa

Il pannello [ユニット](term:term-unit) è il punto in cui la UI passa da
informazione a comando. [{{出撃|しゅつげき}}](term:term-sortie) unisce
`{{出|しゅつ}}`, "uscire", e `{{撃|げき}}`, "colpire / attaccare": non è un
generico "seleziona", ma l'uscita armata di una unità nel match. Quando il
gioco parla di `{{出撃|しゅつげき}}{{先|さき}}`, il centro è il punto di
destinazione: dove quella unità entra e quale corsia cambia.

Le tre azioni base non consumano tutte la stessa risorsa mentale.

*   [{{出撃|しゅつげき}}](term:term-sortie) chiede posizione e [コスト](term:term-cost): paghi per mettere presenza reale sul campo. Se la corsia sbagliata è scoperta, una sortita corretta vale più di una unità forte nel punto morto.
*   [アビリティ](term:term-ability) riguarda l'effetto della MS. Il katakana sembra trasparente, ma in questa UI non è una qualità passiva: è un comando che spesso richiede costo, bersaglio o timing.
*   [{{作戦|さくせん}}カード](term:term-tactics-card) non è una carta MS o PL: è supporto digitale. {{作戦|さくせん}} porta l'idea di piano operativo, quindi va letta come intervento sul flusso della battaglia, non come nuova unità in campo.

:::example_sentence
jp: >-
  {{画面|がめん}}の{{出撃|しゅつげき}}ボタンをタッチすると、ユニットの{{配置|はいち}}{{先|さき}}を{{選|えら}}べます。
translation_it: >-
  Se tocchi il pulsante di sortita sullo schermo, puoi scegliere dove piazzare
  l'unità.
:::

#### 🗺️ Anatomia della frase

*   `{{画面|がめん}}の{{出撃|しゅつげき}}ボタンを` ➔ **Oggetto dell'input** (`を` marca il pulsante, non l'unità: prima tocchi il comando).
*   `タッチすると` ➔ **Trigger UI** (`～と` presenta la conseguenza prevedibile del tocco).
*   `ユニットの{{配置|はいち}}{{先|さき}}を{{選|えら}}べます` ➔ **Risultato sbloccato** (`{{配置|はいち}}{{先|さき}}` è il punto di collocazione; dopo il tap scegli la destinazione, non solo confermi la carta).

#### 🧠 Gancio cognitivo

[{{出撃|しゅつげき}}](term:term-sortie) è "uscire per
colpire". È un trucco di memoria: immagina la carta che smette di essere
preparazione e diventa una presenza fisica nella corsia.

#### ⚖️ Contrasto operativo

[アビリティ](term:term-ability) non significa
semplicemente "questa MS è forte". Se lo leggi come stato passivo, perdi il
punto della UI: quando compare come comando, il gioco ti sta chiedendo se vuoi
spendere una risorsa per produrre un effetto adesso.

## 3. Tre ruoli, due bersagli: chi apre, chi passa, chi protegge

I {{3|みっ}}つの [{{役割|やくわり}}](term:term-role) ordinano la mappa più delle
statistiche isolate. [{{殲滅|せんめつ}}](term:term-role-shoumetsu) contiene
l'idea di annientare: in pratica punta prima alle unità che bloccano la
corsia. [{{制圧|せいあつ}}](term:term-role-seiatsu) porta controllo e pressione:
non serve a vincere ogni scontro, serve a far passare danno su
[{{拠点|きょてん}}](term:term-base) e [{{戦艦|せんかん}}](term:term-warship).
[{{防衛|ぼうえい}}](term:term-role-bouei) è la protezione dell'obiettivo:
quando resta vicino alla base o alla nave, rende molto meno libera la lettura
della pressione nemica.

La triade funziona come una frase con soggetti diversi: la
[{{防衛|ぼうえい}}](term:term-role-bouei) rallenta la
[{{制圧|せいあつ}}](term:term-role-seiatsu), la
[{{殲滅|せんめつ}}](term:term-role-shoumetsu) rimuove ciò che difende, la
[{{制圧|せいあつ}}](term:term-role-seiatsu) punisce lo spazio aperto. Se inverti
questo ordine e mandi pressione contro una linea ancora protetta, il kanji
sembra offensivo ma la schermata ti sta già dicendo perché il danno non passa.

:::example_sentence
jp: >-
  {{防衛|ぼうえい}}を{{自軍|じぐん}}{{拠点|きょてん}}に{{置|お}}くと、{{相手|あいて}}の{{制圧|せいあつ}}が{{通|とお}}りにくくなります。
translation_it: >-
  Se metti una unità di difesa sulla tua base, la pressione avversaria passa con
  molta più difficoltà.
:::

#### 🗺️ Anatomia della frase

*   `{{防衛|ぼうえい}}を{{自軍|じぐん}}{{拠点|きょてん}}に{{置|お}}くと` ➔ **Condizione di posizione** (`に` marca il luogo dove metti la difesa; `～と` lega posizione e conseguenza).
*   `{{相手|あいて}}の{{制圧|せいあつ}}が` ➔ **Pressione avversaria come soggetto** (`が` mette in primo piano il ruolo che prova a passare).
*   `{{通|とお}}りにくくなります` ➔ **Difficoltà aumentata** (`通りにくくなる` descrive una corsia che diventa piu' difficile da attraversare).

#### ⚖️ Contrasto operativo

[{{制圧|せいあつ}}](term:term-role-seiatsu) non è
"attaccante generico". Il suo valore nasce quando arriva a
[{{拠点|きょてん}}](term:term-base) o [{{戦艦|せんかん}}](term:term-warship).
Contro una [{{防衛|ぼうえい}}](term:term-role-bouei) ben piazzata, prima serve
spesso una [{{殲滅|せんめつ}}](term:term-role-shoumetsu) che apra la corsia.

## 4. Costo, SP e finale: quando la risorsa autorizza davvero il comando

[コスト](term:term-cost) e [SPゲージ](term:term-sp-gauge) sembrano entrambe
"barre da spendere", ma scandiscono due ritmi diversi. Il costo cresce e paga
presenza: [{{出撃|しゅつげき}}](term:term-sortie), [アビリティ](term:term-ability)
e interventi tattici. La SP gauge alimenta la
[{{戦術技|せんじゅつぎ}}](term:term-special-attack), l'azione forte che deve
colpire un bersaglio vulnerabile. `{{戦術|せんじゅつ}}` è la tattica,
`{{技|ぎ}}` è la tecnica: la parola ti ricorda che non stai solo guardando una
cut-in spettacolare, ma una scelta di timing.

Quando una condizione si attiva, la UI tende a dirlo con
[～が{{表示|ひょうじ}}される](grammar:grammar-ga-hyouji-sareru): qualcosa viene
mostrato. Questo pattern è utile perché sposta l'attenzione dal giocatore
all'informazione comparsa sullo schermo. Se la guida dice che un'indicazione
viene visualizzata a destra, la decisione non è ancora "premi subito": prima
devi leggere quale bersaglio rende sensata la spesa.

[～することで](grammar:grammar-suru-koto-de) lavora invece sul rapporto
mezzo-risultato: compiendo un'azione, ottieni una conseguenza tattica. Qui il costo funziona come mezzo: spendere quella risorsa rende possibile l'azione. Quando lo incontri in guide o tutorial, cerca prima l'azione prima
di `ことで`, poi l'effetto che diventa disponibile dopo.

:::example_sentence
jp: >-
  {{条件|じょうけん}}を{{満|み}}たすと、{{画面|がめん}}{{右側|みぎがわ}}に{{戦術技|せんじゅつぎ}}の{{案内|あんない}}が{{表示|ひょうじ}}されます。
translation_it: >-
  Quando soddisfi la condizione, sul lato destro dello schermo compare
  l'indicazione della tecnica speciale.
:::

#### 🗺️ Anatomia della frase

*   `{{条件|じょうけん}}を{{満|み}}たすと` ➔ **Condizione completata** (`を` marca la condizione che viene soddisfatta; `～と` introduce l'esito automatico).
*   `{{画面|がめん}}{{右側|みぎがわ}}に` ➔ **Luogo dell'informazione** (`に` dice dove guardare: lato destro della schermata).
*   `{{戦術技|せんじゅつぎ}}の{{案内|あんない}}が{{表示|ひょうじ}}されます` ➔ **Comparsa passiva** (`が` marca l'indicazione che appare; `されます` rende la UI il luogo in cui l'informazione viene mostrata).

Nel finale, [クライマックスブースト](term:term-climax-boost) accelera il recupero
del [コスト](term:term-cost). クライマックス segnala il punto culminante,
`ブースト` il ritmo spinto in avanti. Le scelte diventano più ravvicinate: una
[{{防衛|ぼうえい}}](term:term-role-bouei) in ritardo lascia passare danno, una
[{{戦術技|せんじゅつぎ}}](term:term-special-attack) su una base protetta brucia
valore, una [{{出撃|しゅつげき}}](term:term-sortie) nella corsia giusta può
tenere aperta la partita.

#### ⚖️ Contrasto operativo

[SPゲージ](term:term-sp-gauge) pronta e
[{{戦術技|せんじゅつぎ}}](term:term-special-attack) utile non sono la stessa
cosa. La prima è una condizione di risorsa; la seconda richiede bersaglio,
corsia e timing.

## Esempi guidati di riepilogo

Le label più importanti si combinano in frasi brevi: stato della gauge,
pressione sulla mappa, comando disponibile e bersaglio da proteggere o chiudere.

:::example_sentence
jp: >-
  {{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージがわずかなら、{{制圧|せいあつ}}を{{通|とお}}して{{戦艦|せんかん}}を{{狙|ねら}}う{{判断|はんだん}}になります。
translation_it: >-
  Se la gauge nemica è quasi finita, la decisione giusta diventa far passare una
  unità di pressione e puntare alla nave.
:::

:::example_sentence
jp: >-
  コストが{{足|た}}りたら、{{右|みぎ}}レーンへ{{制圧|せいあつ}}ユニットを{{出撃|しゅつげき}}させます。
translation_it: >-
  Quando hai costo sufficiente, fai uscire una unità di pressione nella corsia
  di destra.
:::

:::example_sentence
jp: >-
  {{殲滅|せんめつ}}の{{仕事|しごと}}は、{{制圧|せいあつ}}の{{前|まえ}}に{{敵|てき}}ユニットを{{片|かた}}づけることです。
translation_it: >-
  Il compito dell'annientamento è eliminare le unità nemiche prima che entri la
  pressione.
:::

:::example_sentence
jp: >-
  SPゲージが{{満|まん}}タンでも、{{守|まも}}られた{{拠点|きょてん}}には{{戦術技|せんじゅつぎ}}を{{撃|う}}たないほうがいいです。
translation_it: >-
  Anche con la barra SP piena, è meglio non usare la tecnica speciale su una
  base ancora protetta.
:::

## Nota finale

La schermata di battaglia diventa leggibile quando le informazioni smettono di
essere pezzi separati: le gauge dicono quanto manca alla vittoria o alla
sconfitta, la [ミニマップ](term:term-minimap) mostra dove nasce la pressione, i
[{{役割|やくわり}}](term:term-role) spiegano chi deve agire e [コスト](term:term-cost)
o [SPゲージ](term:term-sp-gauge) decidono quando puoi trasformare quella lettura
in comando.
