---
id: lesson-duel-masters-dm25-live-duel-encounters-star-pippi
media_id: media-duel-masters-dm25
slug: live-duel-encounters-star-pippi
title: Carte incontrate - スター・ピッピー / Star Pippi
order: 89
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [
    live-duel,
    card-encounter,
    cost-reduction,
    multicolor,
    coordination,
    duel-masters
  ]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Star Pippi: la virgola dopo il primo 1 separa due riduzioni di costo
  parallele, una per Light e una per Fire, con limite finale che non fa
  scendere il costo a 0 o meno.
---

# Star Pippi: due riduzioni parallele e il limite del costo

スター・ピッピー concentra tutto il suo effetto in una riga di rules text molto
compatta. Il giapponese non dice soltanto "riduci il costo": costruisce prima
due gruppi di creature, li separa con una virgola e solo alla fine lascia
arrivare il verbo che vale per entrambi.

La carta è Light/Fire, quindi la lettura della punteggiatura cambia davvero il
risultato. Se il primo ramo riguarda le creature [{{光|ひかり}}](term:term-light)
e il secondo riguarda le creature {{火|ひ}}, una creatura che appartiene a tutte
e due le civiltà viene presa da entrambi i rami. Poi [ただし](grammar:grammar-tadashi)
chiude la frase e impedisce al [コスト](term:term-cost) di scendere fino a zero.

:::image
src: assets/cards/live-duel/star-pippi.jpg
alt: "Star Pippi card."
caption: >-
  スター・ピッピー. La riga chiave coordina
  [{{光|ひかり}}](term:term-light) e {{火|ひ}} come due rami paralleli:
  `{{1|いち}}、` non chiude l'effetto, ma prepara il secondo costo da ridurre.
:::

## Termini chiave

- [{{自分|じぶん}}](term:term-self) — il giocatore che controlla l'effetto; qui si legge come "tu / le tue".
- [{{光|ひかり}}](term:term-light) — civiltà Light; in rules text è un filtro operativo, non una descrizione poetica.
- [クリーチャー](term:term-creature) — il tipo di carta il cui costo viene modificato.
- [{{召喚|しょうかん}}](term:term-summon) — evocazione normale della creatura.
- [コスト](term:term-cost) — valore numerico ridotto dall'effetto, poi bloccato dalla restrizione finale.

## Espressioni ricorrenti

- [{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost) — costo di evocazione, cioè il valore toccato dalla riduzione.
- [{{少|すく}}なくしてもよい](grammar:grammar-star-pippi-double-cost-reduction) — puoi rendere più piccolo / puoi ridurre.
- [ただし](grammar:grammar-tadashi) — introduce una limitazione dopo un effetto già concesso.
- [コスト](term:term-cost)は{{0以下|ゼロいか}}にならない — il costo non diventa 0 o meno.

## Pattern grammaticali chiave

- [{{自分|じぶん}}の{{光|ひかり}}のクリーチャーの{{召喚|しょうかん}}コストを{{1|いち}}、{{火|ひ}}のクリーチャーの{{召喚|しょうかん}}コストを{{1|いち}}{{少|すく}}なくしてもよい](grammar:grammar-star-pippi-double-cost-reduction) — due rami oggetto-valore condividono lo stesso verbo finale.
- [〜してもよい](grammar:grammar-temoyoi) — possibilità concessa: puoi farlo, non sei obbligato.
- [ただし](grammar:grammar-tadashi) — correzione restrittiva: l'effetto resta valido, ma entro un confine preciso.

## Etichette da riconoscere

- スター・ピッピー — creatura Light/Fire; il nome ti prepara a leggere una carta multicolore, non un effetto mono-civiltà.
- [{{光|ひかり}}](term:term-light) / {{火|ひ}} — coppia di civiltà: qui non significa "scegline una", ma "leggi due filtri paralleli".

---

## 1. Il primo ramo: leggere il gruppo prima del verbo

La prima metà della frase non arriva subito a `{{少|すく}}なくしてもよい`. Prima
costruisce un gruppo nominale lungo e preciso:
[{{自分|じぶん}}](term:term-self)の[{{光|ひかり}}](term:term-light)の[クリーチャー](term:term-creature)の[{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost).
Il nome finale è [コスト](term:term-cost); tutto ciò che lo precede restringe
quale costo stai guardando.

- [{{自分|じぶん}}](term:term-self)の non è un possessivo generico da tradurre lentamente come "di me stesso": nel rules text indica il tuo lato del campo e del turno. Il ramo non riduce tutte le creature Light possibili, ma quelle che appartengono al giocatore che controlla questo effetto.
- [{{光|ひかり}}](term:term-light)の[クリーチャー](term:term-creature) restringe il gruppo per civiltà. `の` lega Light a creature come filtro di appartenenza: non stai leggendo "creature luminose" in senso narrativo, ma creature della civiltà Light.
- [{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost) è il bersaglio numerico della riduzione. La carta non abbassa il power, non cambia il tipo della creatura e non sposta una carta: modifica il costo richiesto per evocarla.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{光|ひかり}}](term:term-light)の[クリーチャー](term:term-creature)の
  [{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を{{1|いち}}、
  {{火|ひ}}の[クリーチャー](term:term-creature)の
  [{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を{{1|いち}}
  [{{少|すく}}なくしてもよい](grammar:grammar-star-pippi-double-cost-reduction)。
translation_it: >-
  Puoi ridurre di 1 il costo di evocazione delle tue creature Light e di 1 il
  costo di evocazione delle tue creature Fire.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `[{{自分|じぶん}}](term:term-self)の` — **campo del controllore**: restringe l'effetto alle tue creature, non a ogni creatura in gioco.
*   `[{{光|ひかり}}](term:term-light)の[クリーチャー](term:term-creature)の` — **filtro di civiltà più tipo**: la catena di `の` porta fino al costo delle creature Light.
*   `[{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を{{1|いち}}、` — **oggetto più quantità**: il costo di evocazione è ciò che viene ridotto; la virgola lascia il ramo in sospeso.
*   `{{火|ひ}}の[クリーチャー](term:term-creature)の[{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を{{1|いち}}` — **secondo ramo parallelo**: cambia la civiltà, ma la struttura rimane la stessa.
*   `[{{少|すく}}なくしてもよい](grammar:grammar-star-pippi-double-cost-reduction)` — **verbo finale condiviso**: autorizza la riduzione per entrambi i rami.

#### ⚖️ Contrasto operativo

`{{1|いち}}、{{火|ひ}}の...` non è una pausa decorativa dopo un numero. Se la
tratti come una pausa vaga, rischi di comprimere tutto in "riduci di 1 se la
creatura è Light o Fire". La frase invece ha due oggetti marcati da `を`:
prima il [{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost) delle
creature [{{光|ひかり}}](term:term-light), poi quello delle creature {{火|ひ}}.

#### 🧠 Gancio cognitivo

Pensa alla virgola dopo `{{1|いち}}` come a una staffetta grammaticale: il primo
ramo passa il testimone al secondo, e il verbo finale
`{{少|すく}}なくしてもよい` corre per tutti e due. È un trucco di lettura, non una
spiegazione etimologica.

## 2. Il verbo finale: ridurre, non azzerare

`{{少|すく}}なくする` significa "rendere meno / rendere più piccolo". Quando si
lega a [コスト](term:term-cost), il valore non diventa "piccolo" in senso vago:
scende di una quantità precisa, qui `{{1|いち}}`. Il pezzo
[〜してもよい](grammar:grammar-temoyoi) aggiunge permesso, quindi la carta ti
autorizza a ridurre il costo senza trasformare la riduzione in un obbligo.

- `{{少|すく}}なくして` è la forma in `-te` di `{{少|すく}}なくする`: il costo viene reso più basso, non viene pagato né sostituito.
- `もよい` dà valore di concessione. In un rules text, questo spesso si traduce con "puoi"; la scelta resta permessa al controllore.
- Il verbo arriva una sola volta, ma la struttura precedente contiene due rami. Per questo non devi cercare un secondo `{{少|すく}}なくしてもよい` dopo il ramo Light: il finale già lo copre.

#### ⚖️ Contrasto operativo

[{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を
`{{1|いち}}{{少|すく}}なくしてもよい` non equivale a "evoca gratis". La frase
parla di una riduzione numerica. Per arrivare a una gratuità il testo dovrebbe
usare altri segnali, come `コストを{{支払|しはら}}わずに`; qui invece rimane dentro
il linguaggio del costo abbassato.

## 3. La doppia civiltà: perché Light/Fire prende entrambe le metà

La carta è multicolore, e il giapponese sfrutta proprio questa doppia
appartenenza. Il primo ramo chiede se la creatura rientra in
[{{光|ひかり}}](term:term-light)の[クリーチャー](term:term-creature); il secondo
chiede se rientra in {{火|ひ}}の[クリーチャー](term:term-creature). Una creatura
Light/Fire risponde sì a tutti e due i filtri.

- Il testo non usa `または` e non presenta una scelta alternativa. La coordinazione con virgola mette in fila due riduzioni parallele, ciascuna con il proprio gruppo nominale.
- La ripetizione di `[{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を{{1|いち}}` rende visibile il parallelismo. Se la carta volesse una singola riduzione comune, non avrebbe bisogno di costruire due oggetti completi in questo modo.
- La conseguenza pratica nasce dalla grammatica: una creatura che è sia Light sia Fire viene letta una volta nel ramo Light e una volta nel ramo Fire.

#### 🧠 Gancio cognitivo

Immagina due caselle di controllo, una per [{{光|ひかり}}](term:term-light) e una
per {{火|ひ}}. Star Pippi non ti chiede di scegliere una casella sola: controlla
entrambe. Se una creatura spunta tutte e due le caselle, attraversa entrambe le
riduzioni.

## 4. ただし: il pavimento del costo

Dopo aver concesso una riduzione ampia, la carta chiude con
[ただし](grammar:grammar-tadashi). Questo connettore non cancella la frase
precedente; la corregge mettendo un limite finale. Il punto da leggere è
[コスト](term:term-cost)は{{0以下|ゼロいか}}にならない: il costo può scendere, ma
non può diventare 0 o meno.

:::example_sentence
jp: >-
  [ただし](grammar:grammar-tadashi)、[コスト](term:term-cost)は{{0以下|ゼロいか}}にならない。
translation_it: >-
  Tuttavia, il costo non diventa 0 o meno.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `[ただし](grammar:grammar-tadashi)、` — **restrizione correttiva**: quello che segue limita l'effetto appena letto.
*   `[コスト](term:term-cost)は` — **tema della restrizione**: il valore controllato è il costo finale, non il numero della riduzione.
*   `{{0以下|ゼロいか}}` — **soglia inclusiva**: include 0 e qualunque valore più basso.
*   `にならない` — **stato vietato**: il costo non deve diventare quel valore.

#### ⚖️ Contrasto operativo

`{{0以下|ゼロいか}}` non significa "meno di 0". [{{以下|いか}}](grammar:grammar-ika-ijou)
include il numero scritto, quindi 0 è già dentro il divieto. Il costo può
scendere fino al minimo consentito dal testo, ma questa riga impedisce di
trasformare le due riduzioni in un costo 0.

## Esempi guidati di riepilogo

Quando la riga viene spezzata in parti leggibili, ogni pezzo conserva il proprio
ruolo: il gruppo nominale identifica il costo, la virgola coordina i rami, il
verbo autorizza la riduzione e [ただし](grammar:grammar-tadashi) mette il limite.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{光|ひかり}}](term:term-light)の[クリーチャー](term:term-creature)の
  [{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を{{1|いち}}
  {{少|すく}}なくしてもよい。
translation_it: >-
  Puoi ridurre di 1 il costo di evocazione delle tue creature Light.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{火|ひ}}の[クリーチャー](term:term-creature)の
  [{{召喚|しょうかん}}](term:term-summon)[コスト](term:term-cost)を{{1|いち}}
  {{少|すく}}なくしてもよい。
translation_it: >-
  Puoi ridurre di 1 il costo di evocazione delle creature Fire.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [ただし](grammar:grammar-tadashi)、[コスト](term:term-cost)は{{0以下|ゼロいか}}にならない。
translation_it: >-
  Tuttavia, il costo non diventa 0 o meno.
reveal_mode: sentence
:::

---

## Nota finale

スター・ピッピー si legge bene quando non salti direttamente al verbo finale.
Prima segui i due gruppi con `の`, poi osservi la virgola dopo
`{{1|いち}}`, e solo alla fine applichi
[{{少|すく}}なくしてもよい](grammar:grammar-star-pippi-double-cost-reduction) a
entrambi i rami. [ただし](grammar:grammar-tadashi) non indebolisce questa lettura:
serve a dire dove si ferma il [コスト](term:term-cost) dopo le riduzioni.
