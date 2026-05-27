---
id: lesson-duel-masters-dm25-live-duel-encounters-senkou-koukou-vs-screen
media_id: media-duel-masters-dm25
slug: live-duel-encounters-senkou-koukou-vs-screen
title: "Primo e secondo player nel VS screen"
order: 100
segment_ref: live-duel-encounters
difficulty: n4
status: active
tags: [live-duel, app, ui, starting-order, turn-order, duel-plays]
prerequisites:
  [
    lesson-duel-masters-dm25-duel-plays-app-rewards-and-claim-flow,
    lesson-duel-masters-dm25-tcg-core-patterns
  ]
summary: >-
  VS screen di Duel Plays: leggere i cartigli che assegnano primo e secondo
  player prima dell'inizio della partita.
---

# {{先攻|せんこう}} e {{後攻|こうこう}}: il VS screen decide chi parte

Nel VS screen la partita non è ancora cominciata, ma la UI ha già fissato
l'ordine dei turni. Il cartiglio blu sopra Andrea mostra
[{{先攻|せんこう}}](term:term-senkou); il cartiglio rosa sopra
{{一条莉々華|いちじょうりりか}} mostra
[{{後攻|こうこう}}](term:term-koukou). Sono due label brevi, ma dentro una
partita TCG cambiano subito la lettura pratica della schermata: chi riceve la
prima mossa e chi agirà dopo.

La parte da non perdere è che entrambi i composti finiscono con
{{攻|こう}}. Il kanji porta l'idea di attacco o lato offensivo; nel verbo
{{攻|せ}}める si legge せ, ma in questi label usa la lettura on'yomi こう.
La differenza vera sta nel primo kanji: {{先|せん}} guarda avanti, al primo
posto; {{後|こう}} guarda dopo, al secondo lato dell'ordine.

## Termini chiave

- [{{先攻|せんこう}}](term:term-senkou) — andare per primi / player che parte
  per primo
- [{{後攻|こうこう}}](term:term-koukou) — andare per secondi / player che parte
  dopo
- [{{対戦|たいせん}}](term:term-match) — confronto o partita tra due lati
- [{{相手|あいて}}](term:term-opponent) — avversario, il lato opposto della
  schermata

## Espressioni ricorrenti

- [{{先攻|せんこう}}](term:term-senkou)のプレイヤー — il player assegnato al lato
  che parte per primo
- [{{後攻|こうこう}}](term:term-koukou)のプレイヤー — il player assegnato al lato
  che agisce dopo
- {{先|さき}}に{{動|うご}}く — muoversi / agire prima
- {{後|あと}}に{{動|うご}}く — muoversi / agire dopo

## Pattern grammaticali chiave

- ～のプレイヤー — il player del tipo indicato dal label precedente
- ～が[{{先攻|せんこう}}](term:term-senkou) / ～が
  [{{後攻|こうこう}}](term:term-koukou) — が assegna il ruolo al nome mostrato
  nella schermata

## Etichette da riconoscere

- Andrea — profilo a sinistra, associato al cartiglio blu
  [{{先攻|せんこう}}](term:term-senkou)
- {{一条莉々華|いちじょうりりか}} — profilo avversario a destra, associato al
  cartiglio rosa [{{後攻|こうこう}}](term:term-koukou)
- VS — separatore centrale tra i due lati della partita

---

:::image
src: assets/ui/starting-order-senkou-koukou-vs-screen.jpg
alt: >-
  Schermata VS di Duel Plays con Andrea a sinistra assegnato al primo turno e
  l'avversaria a destra assegnata al secondo turno.
caption: >-
  Il cartiglio blu [{{先攻|せんこう}}](term:term-senkou) è sopra Andrea: quel
  lato parte per primo. Il cartiglio rosa
  [{{後攻|こうこう}}](term:term-koukou) è sopra
  {{一条莉々華|いちじょうりりか}}: quel lato parte dopo.
:::

## 1. {{先攻|せんこう}}: {{先|せん}} decide il lato che apre

[{{先攻|せんこう}}](term:term-senkou) combina {{先|せん}} e {{攻|こう}}. In parole
isolate puoi incontrare {{先|さき}} con il senso di "prima / davanti", ma nel
composto della UI la lettura è せん. Il valore resta riconoscibile: il label
marca il lato che viene prima nell'ordine della partita.

Nel cartiglio blu, [{{先攻|せんこう}}](term:term-senkou) non descrive la
personalità del deck e non promette un attacco immediato. Dice semplicemente
che Andrea è il player che apre. Dentro una schermata VS, questo è un dato di
setup: prima ancora di vedere la mano o le carte, sai quale lato avrà la prima
azione utile.

:::example_sentence
jp: >-
  この[{{対戦|たいせん}}](term:term-match)ではAndreaが
  [{{先攻|せんこう}}](term:term-senkou)で、{{先|さき}}に
  {{動|うご}}く。
translation_it: >-
  In questa partita Andrea è il player che va per primo e agisce prima.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   この[{{対戦|たいせん}}](term:term-match)では ➔ **Cornice della partita**: では
    limita l'affermazione a questo match specifico.
*   Andreaが[{{先攻|せんこう}}](term:term-senkou)で ➔ **Ruolo assegnato**: が
    collega Andrea al label [{{先攻|せんこう}}](term:term-senkou); で porta quel
    ruolo nella frase successiva.
*   {{先|さき}}に{{動|うご}}く ➔ **Conseguenza pratica**: il lato marcato
    [{{先攻|せんこう}}](term:term-senkou) agisce prima.

#### ⚖️ Contrasto operativo: primo a giocare, non per forza primo ad attaccare

Il kanji {{攻|こう}} può far pensare subito ad "attaccare", ma nel VS screen
[{{先攻|せんこう}}](term:term-senkou) assegna l'ordine di partenza. In lettura
pratica conviene tradurlo come "going first" o "chi parte per primo", non come
"sta già attaccando".

## 2. {{後攻|こうこう}}: {{後|こう}} sposta il lato nel secondo tempo della sequenza

[{{後攻|こうこう}}](term:term-koukou) usa lo stesso {{攻|こう}}, ma cambia il
primo kanji. {{後|こう}} in questo composto è la lettura on'yomi di 後; fuori
da composti simili puoi incontrarlo anche come {{後|あと}} o {{後|うし}}ろ, con
il senso di "dopo / dietro". Qui il valore operativo è "secondo nell'ordine".

Nel lato rosa, [{{後攻|こうこう}}](term:term-koukou) è assegnato a
{{一条莉々華|いちじょうりりか}}. La schermata quindi non sta dicendo che
l'avversaria è "in svantaggio" in senso narrativo; sta solo fissando il suo
posto nella sequenza: prima Andrea, poi il lato avversario.

:::example_sentence
jp: >-
  この[{{対戦|たいせん}}](term:term-match)では
  {{一条莉々華|いちじょうりりか}}が
  [{{後攻|こうこう}}](term:term-koukou)で、Andreaの
  {{後|あと}}に{{動|うご}}く。
translation_it: >-
  In questa partita 一条莉々華 va per seconda e agisce dopo Andrea.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   {{一条莉々華|いちじょうりりか}}が
    [{{後攻|こうこう}}](term:term-koukou)で ➔ **Ruolo assegnato**: il nome a
    destra riceve il label [{{後攻|こうこう}}](term:term-koukou).
*   Andreaの{{後|あと}}に ➔ **Ordine relativo**: の collega il "dopo" ad Andrea,
    non a un momento generico.
*   {{動|うご}}く ➔ **Azione nel turno**: il verbo riassume il lato operativo:
    quel player farà la propria mossa dopo il player marcato
    [{{先攻|せんこう}}](term:term-senkou).

#### ⚖️ Contrasto operativo: {{後攻|こうこう}} non è "dietro" nello spazio

{{後|うし}}ろ può significare "dietro", ma [{{後攻|こうこう}}](term:term-koukou)
nel VS screen non parla della posizione grafica del personaggio. Il personaggio
è a destra perché la UI divide i due profili; il label
[{{後攻|こうこう}}](term:term-koukou) parla invece dell'ordine della partita.

## 3. Il kanji 攻 resta uguale, il primo kanji cambia la direzione

La coppia funziona perché il secondo kanji rimane stabile:
[{{先攻|せんこう}}](term:term-senkou) e
[{{後攻|こうこう}}](term:term-koukou) finiscono entrambi in {{攻|こう}}. Questo
ti dice che i due label appartengono allo stesso campo semantico: lato
offensivo, ordine di gioco, chi prende l'iniziativa nella partita.

Il primo kanji è il vero interruttore. {{先|せん}} punta al "prima";
{{後|こう}} punta al "dopo". Quando li vedi sovrapposti ai profili, puoi
leggere la schermata senza tradurre parola per parola: blu a sinistra =
[{{先攻|せんこう}}](term:term-senkou), primo lato; rosa a destra =
[{{後攻|こうこう}}](term:term-koukou), secondo lato.

:::example_sentence
jp: >-
  [{{先攻|せんこう}}](term:term-senkou)のプレイヤーが{{先|さき}}に
  {{動|うご}}き、[{{後攻|こうこう}}](term:term-koukou)のプレイヤーが
  {{後|あと}}に{{動|うご}}く。
translation_it: >-
  Il player che parte per primo agisce prima, e il player che parte dopo agisce
  dopo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{先攻|せんこう}}](term:term-senkou)のプレイヤー ➔ **Player del primo lato**:
    の lega il label al player.
*   {{先|さき}}に{{動|うご}}き ➔ **Prima azione nella sequenza**: la forma in
    -masu stem collega il primo movimento al secondo.
*   [{{後攻|こうこう}}](term:term-koukou)のプレイヤー ➔ **Player del secondo lato**:
    la struttura è parallela alla prima metà.
*   {{後|あと}}に{{動|うご}}く ➔ **Seconda azione nella sequenza**: 後に chiude
    il contrasto temporale con 先に.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, leggi i due label come frecce: {{先|せん}} spinge in
avanti, {{後|こう}} rimane dietro nella sequenza. Non è un'etimologia completa;
serve solo a fissare che il kanji diverso è quello che decide l'ordine.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  Andreaは[{{先攻|せんこう}}](term:term-senkou)なので、
  {{最初|さいしょ}}に{{動|うご}}く。
translation_it: >-
  Andrea è il player che parte per primo, quindi agisce per primo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{相手|あいて}}は[{{後攻|こうこう}}](term:term-koukou)なので、
  Andreaの{{後|あと}}に{{動|うご}}く。
translation_it: >-
  L'avversaria va per seconda, quindi agisce dopo Andrea.
reveal_mode: sentence
:::

## Nota finale

Nel VS screen, [{{先攻|せんこう}}](term:term-senkou) e
[{{後攻|こうこう}}](term:term-koukou) sono più importanti dei colori decorativi:
sono i due segnali che trasformano la presentazione dei profili in ordine di
partita. Appena riconosci {{先|せん}} contro {{後|こう}}, sai quale lato apre e
quale lato seguirà.
