---
id: lesson-duel-masters-dm25-live-duel-encounters-kpg-legend-skill
media_id: media-duel-masters-dm25
slug: live-duel-encounters-kpg-legend-skill
title: "KPG: la prima carta eseguita costa 5 in meno"
order: 99
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, app, ui, legend-skill, cost-reduction, duel-plays]
prerequisites:
  [
    lesson-duel-masters-dm25-duel-plays-app-rewards-and-claim-flow,
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-felix-misery
  ]
summary: >-
  Stage select contro KPG: leggere una Legend Skill che controlla scudi,
  prima carta eseguita e limite minimo del costo.
---

# KPG: la prima carta eseguita costa 5 in meno

Nella [ステージ{{選択|せんたく}}](term:term-stage-select) di `幻想の決闘者4 第2話`,
il pannello di setup contro KPG concentra tutta la regola speciale in una sola
frase lunga. Il testo non sta solo dicendo che esiste una
[レジェンドスキル](term:term-legend-skill): sta fissando quando vale, quale
condizione sugli scudi deve essere vera, quale carta riceve lo sconto e quale
limite finale impedisce al costo di scendere troppo.

La chiave è leggere la frase da sinistra a destra come una catena di filtri:
turno del player, scudi a {{3|みっ}}つ o meno, prima carta eseguita, riduzione
del [コスト](term:term-cost), poi restrizione con
[ただし](grammar:grammar-tadashi). Se salti uno di questi pezzi, lo sconto
sembra più ampio di quanto dica davvero il giapponese.

## Termini chiave

- [レジェンドスキル](term:term-legend-skill) — abilità speciale mostrata nel
  setup dello stage
- [{{実行|じっこう}}する](term:term-jikkou-suru) — eseguire / mandare in
  esecuzione un'azione o una carta
- [コスト](term:term-cost) — costo della carta, qui valore ridotto dalla skill
- [{{少|すく}}なくする](term:term-sukunaku-suru) — ridurre una quantità

## Espressioni ricorrenti

- プレイヤーのターン[{{中|ちゅう}}](grammar:grammar-ui-chuu) — durante il turno del
  player
- プレイヤーのシールドが{{3|みっ}}つ[{{以下|いか}}](grammar:grammar-ika-ijou)なら —
  se gli scudi del player sono tre o meno
- {{初|はじ}}めて[{{実行|じっこう}}する](term:term-jikkou-suru)プレイヤーのカード — la
  prima carta del player che viene eseguita
- [コスト](term:term-cost)を{{5|ご}}[{{少|すく}}なくする](term:term-sukunaku-suru) —
  ridurre il costo di cinque

## Pattern grammaticali chiave

- ターン[{{中|ちゅう}}](grammar:grammar-ui-chuu) — finestra in cui il turno è in
  corso
- [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) — soglia
  inclusiva: il numero scritto è compreso
- [なら](grammar:grammar-nara) — ramo condizionale che vale se il filtro passa
- [ただし](grammar:grammar-tadashi) — limitazione finale applicata dopo
  l'effetto principale

## Etichette da riconoscere

- [ステージ{{選択|せんたく}}](term:term-stage-select) — schermata in cui scegli
  stage, costo di ingresso, reward e setup
- VS 一条莉々華 — stage selezionato nella lista a sinistra
- KPG — deck o profilo avversario mostrato nel pannello di preparazione
- NEXT REWARD — preview della ricompensa successiva

---

:::image
src: assets/ui/kpg-legend-skill-stage-select.jpg
alt: >-
  Schermata stage select di デュエプレ contro KPG con pannello レジェンドスキル,
  testo su turno del player, scudi a tre o meno, prima carta eseguita e costo
  ridotto di cinque.
caption: >-
  La [レジェンドスキル](term:term-legend-skill) usa una frase a catena:
  プレイヤーのターン[{{中|ちゅう}}](grammar:grammar-ui-chuu),
  シールドが{{3|みっ}}つ[{{以下|いか}}](grammar:grammar-ika-ijou)なら,
  {{初|はじ}}めて[{{実行|じっこう}}する](term:term-jikkou-suru)カードの
  [コスト](term:term-cost)を{{5|ご}}
  [{{少|すく}}なくする](term:term-sukunaku-suru)。
:::

## 1. La frase della Legend Skill parte dalla finestra del turno

Il primo blocco, プレイヤーのターン[{{中|ちゅう}}](grammar:grammar-ui-chuu), apre
una finestra temporale. [{{中|ちゅう}}](grammar:grammar-ui-chuu) non descrive
un oggetto della schermata: dice che sei dentro il turno del player. Subito
dopo, プレイヤーのシールドが{{3|みっ}}つ[{{以下|いか}}](grammar:grammar-ika-ijou)なら
aggiunge la condizione reale: gli scudi devono essere tre o meno. La soglia è
inclusiva, quindi {{3|みっ}}つ passa; {{4|よっ}}つ no.

La ripetizione di プレイヤー evita pronomi ambigui. Prima nomina il turno del
player, poi gli scudi del player, poi la carta del player. In un pannello con
tab come 相手 e 自分, questa ripetizione è utile perché tiene agganciati tutti
i pezzi allo stesso lato della skill invece di farli sembrare condizioni
indipendenti.

:::example_sentence
jp: >-
  プレイヤーのターン[{{中|ちゅう}}](grammar:grammar-ui-chuu)、プレイヤーのシールドが
  {{3|みっ}}つ[{{以下|いか}}](grammar:grammar-ika-ijou)なら、
  {{初|はじ}}めて[{{実行|じっこう}}する](term:term-jikkou-suru)
  プレイヤーのカードの[コスト](term:term-cost)を{{5|ご}}
  [{{少|すく}}なくする](term:term-sukunaku-suru)。
translation_it: >-
  Durante il turno del player, se gli scudi del player sono tre o meno, riduce
  di cinque il costo della prima carta del player che viene eseguita.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   プレイヤーのターン[{{中|ちゅう}}](grammar:grammar-ui-chuu) ➔ **Finestra attiva**:
    lo sconto non è una regola permanente fuori turno; viene letto dentro il
    turno del player.
*   プレイヤーのシールドが{{3|みっ}}つ[{{以下|いか}}](grammar:grammar-ika-ijou)なら ➔
    **Condizione sugli scudi**: が marca gli scudi come soggetto del controllo;
    なら apre il ramo solo se la soglia passa.
*   {{初|はじ}}めて[{{実行|じっこう}}する](term:term-jikkou-suru)プレイヤーのカードの
    [コスト](term:term-cost)を ➔ **Oggetto ridotto**: non viene ridotta la carta
    intera, ma il costo della prima carta che entra in esecuzione.
*   {{5|ご}}[{{少|すく}}なくする](term:term-sukunaku-suru) ➔ **Payoff numerico**:
    la quantità dello sconto è cinque.

#### ⚖️ Contrasto operativo: tre scudi include esattamente tre

`以下` include il valore indicato e tutto cio' che sta sotto quel limite. Se il player ha {{3|みっ}}つ scudi, la condizione è già vera; se ne ha
{{4|よっ}}つ, non lo è. Il numero scritto nella UI è l'ultimo valore valido,
non il primo valore escluso.

## 2. 実行する rende la carta un'azione eseguita dal sistema

[{{実行|じっこう}}する](term:term-jikkou-suru) è più formale di
{{使|つか}}う: in UI e testo tecnico significa "eseguire", "mandare in
esecuzione", "mettere in pratica". Qui il verbo non è scelto per dare colore
narrativo; serve a trattare la carta come un'azione che il sistema sta per
risolvere. La carta non è solo vista o selezionata: viene eseguita.

Il blocco {{初|はじ}}めて[{{実行|じっこう}}する](term:term-jikkou-suru) è quello che
restringe lo sconto. {{初|はじ}}めて non dice "per la prima volta nella vita del
deck" o "la prima volta nell'evento"; dentro プレイヤーのターン[{{中|ちゅう}}](grammar:grammar-ui-chuu)
punta alla prima esecuzione rilevante in quella finestra. Dopo quella carta, la
frase non promette che ogni altra carta continui a costare cinque in meno.

:::example_sentence
jp: >-
  {{初|はじ}}めて[{{実行|じっこう}}する](term:term-jikkou-suru)
  プレイヤーのカードの[コスト](term:term-cost)を{{5|ご}}
  [{{少|すく}}なくする](term:term-sukunaku-suru)。
translation_it: >-
  Riduce di cinque il costo della prima carta del player che viene eseguita.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   {{初|はじ}}めて ➔ **Ordine nella sequenza**: segnala la prima occorrenza
    dentro la finestra già aperta dal turno.
*   [{{実行|じっこう}}する](term:term-jikkou-suru) ➔ **Azione tecnica**: la carta
    passa dall'essere disponibile all'essere eseguita.
*   プレイヤーのカード ➔ **Carta posseduta dal player**: の collega la carta al
    player nominato nei blocchi precedenti.
*   [コスト](term:term-cost)を{{5|ご}}[{{少|すく}}なくする](term:term-sukunaku-suru)
    ➔ **Riduzione mirata**: を marca il costo come oggetto dell'azione
    {{少|すく}}なくする.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, leggi [{{実行|じっこう}}する](term:term-jikkou-suru) come
il momento in cui il sistema preme "run" sulla carta. Non è un'etimologia: è
solo un modo pratico per distinguere una carta guardata, scelta o preparata da
una carta che viene davvero eseguita.

## 3. ただし chiude lo sconto con il pavimento del costo

La seconda frase è breve, ma cambia il risultato finale:
[ただし](grammar:grammar-tadashi)、[コスト](term:term-cost)は{{0以下|ゼロいか}}にはならない.
[ただし](grammar:grammar-tadashi) non apre un nuovo effetto; restringe quello
appena letto. Anche se la riduzione è di {{5|ご}}, il costo non può diventare
{{0以下|ゼロいか}}.

La particella は rimette [コスト](term:term-cost) come tema della restrizione,
mentre にはならない dice "non diventa in quello stato". Il punto non è vietare
il numero scritto nella riduzione, ma controllare il valore finale dopo aver
applicato lo sconto.

:::example_sentence
jp: >-
  [ただし](grammar:grammar-tadashi)、[コスト](term:term-cost)は
  {{0以下|ゼロいか}}にはならない。
translation_it: >-
  Tuttavia, il costo non diventa 0 o inferiore.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [ただし](grammar:grammar-tadashi) ➔ **Limitazione finale**: il testo non
    cancella lo sconto; lo mette entro un limite.
*   [コスト](term:term-cost)は ➔ **Tema della restrizione**: il confine riguarda
    il valore di costo, non la validità della carta.
*   {{0以下|ゼロいか}}にはならない ➔ **Stato vietato**: il risultato non può arrivare
    a zero o sotto zero.

#### ⚖️ Contrasto operativo: ridurre non significa rendere gratis

{{5|ご}}[{{少|すく}}なくする](term:term-sukunaku-suru) crea uno sconto forte,
ma [ただし](grammar:grammar-tadashi) impedisce la lettura "gratis se il costo è
cinque o meno". La frase finale impone un pavimento: lo sconto si applica, ma
il risultato non entra nella zona {{0以下|ゼロいか}}.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  シールドが{{4|よっ}}つなら、この
  [レジェンドスキル](term:term-legend-skill)の{{条件|じょうけん}}を
  {{満|み}}たさない。
translation_it: >-
  Se gli scudi sono quattro, non soddisfa la condizione di questa Legend Skill.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  シールドが{{3|みっ}}つ[{{以下|いか}}](grammar:grammar-ika-ijou)なら、
  {{初|はじ}}めて[{{実行|じっこう}}する](term:term-jikkou-suru)カードの
  [コスト](term:term-cost)を{{5|ご}}
  [{{少|すく}}なくする](term:term-sukunaku-suru)。
translation_it: >-
  Se gli scudi sono tre o meno, riduce di cinque il costo della prima carta
  eseguita.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [ただし](grammar:grammar-tadashi)、[コスト](term:term-cost)は
  {{0以下|ゼロいか}}にはならない。
translation_it: >-
  Però il costo non diventa 0 o inferiore.
reveal_mode: sentence
:::

## Nota finale

La [レジェンドスキル](term:term-legend-skill) di KPG si legge bene quando
separi tre livelli: condizione sugli scudi, prima carta
[{{実行|じっこう}}する](term:term-jikkou-suru), limite finale con
[ただし](grammar:grammar-tadashi). La schermata sembra una preview di stage,
ma il giapponese funziona già come rules text compatto: ogni particella decide
quanto lontano può arrivare lo sconto.
