---
id: lesson-duel-masters-dm25-live-duel-encounters-bad-brand-first
media_id: media-duel-masters-dm25
slug: live-duel-encounters-bad-brand-first
title: Bad Brand 1st e il bivio della carta rivelata
order: 53
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, beat-jockey, topdeck, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-dama-vaishingu
  ]
summary: >-
  Bad Brand 1st: trigger di attacco, rivelazione della prima carta del mazzo e
  bivio tra ingresso diretto di un Beat Jockey non evoluzione o fondo del
  mazzo.
---

# [“{{罰怒|バッド}}”ブランド {{1st|ファースト}}](term:term-bad-brand-first)

[“{{罰怒|バッド}}”ブランド {{1st|ファースト}}](term:term-bad-brand-first)
legge la cima del mazzo come una piccola procedura a bivi. Le keyword iniziali
lo rendono aggressivo, ma la riga decisiva arriva quando attacca: la prima
carta viene girata [{{表向|おもてむ}}き](term:term-face-up), controllata come
[ビートジョッキー](term:term-beat-jockey) non
[{{進化|しんか}}](term:term-evolution), poi mandata in
[バトルゾーン](term:term-battle-zone) oppure in fondo al
[{{山札|やまふだ}}](term:term-deck).

Il giapponese procede in ordine molto pulito: timing, posizione esatta,
cambio di stato, filtro, destinazione. Se tieni fermo quel flusso, `それ` non si
perde mai: riprende sempre la carta appena rivelata.

:::image
src: assets/cards/live-duel/bad-brand-first.png
alt: "Bad Brand 1st card."
caption: >-
  [“{{罰怒|バッド}}”ブランド {{1st|ファースト}}](term:term-bad-brand-first).
  Razza: [ビートジョッキー](term:term-beat-jockey). La riga centrale parte
  dall'attacco, rivela la prima carta del mazzo e decide se quella stessa
  carta entra nel battle zone o scivola in fondo al mazzo.
:::

## Termini chiave

- [“{{罰怒|バッド}}”ブランド {{1st|ファースト}}](term:term-bad-brand-first) -
  nome proprio della creatura che attiva il controllo durante l'attacco.
- [{{攻撃|こうげき}}](term:term-attack) - l'azione che apre il timing
  dell'effetto.
- [{{山札|やまふだ}}](term:term-deck) - il mazzo, qui letto come pila con cima e
  fondo.
- [{{表向|おもてむ}}き](term:term-face-up) - stato scoperto: la carta diventa
  informazione visibile prima del filtro.
- [ビートジョッキー](term:term-beat-jockey) - razza richiesta dal ramo positivo.
- [{{進化|しんか}}](term:term-evolution) - categoria esclusa da `でない`.
- [バトルゾーン](term:term-battle-zone) - destinazione positiva della carta
  rivelata.

## Espressioni ricorrenti

- [{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}](term:term-top-card-of-deck)
  - non una carta qualsiasi: proprio la prima carta dalla cima.
- [{{山札|やまふだ}}の{{一番下|いちばんした}}](term:term-bottom-of-deck) -
  il punto meno immediato del mazzo.
- [それ{{以外|いがい}}なら](grammar:grammar-soreigai-nara) - il ramo che raccoglie
  tutto ciò che non ha passato il filtro precedente.

## Pattern grammaticali chiave

- [{{時|とき}}](grammar:grammar-toki) - aggancia l'effetto al momento
  dell'attacco.
- [それが...なら](grammar:grammar-sorega-nara) - riusa il referente appena
  introdotto e apre una condizione.
- [{{1枚目|いちまいめ}}](grammar:grammar-me-ordinal) - `{{目|め}}` trasforma il
  conteggio in posizione nell'ordine.

## Etichette da riconoscere

- [{{B・A・D 2|びーえーでぃーつー}}](term:term-b-a-d-two) - costo ridotto ora,
  distruzione a fine turno.
- [スピードアタッカー](term:term-speed-attacker) - attacco immediato senza
  aspettare il turno successivo.
- [W・ブレイカー](term:term-w-breaker) - rottura di due scudi.

---

## 1. Il trigger di attacco sceglie una carta precisa

La prima frase non pesca e non sposta ancora nulla. Costruisce il momento e
l'oggetto: `{{攻撃|こうげき}}する{{時|とき}}` apre la finestra dell'effetto, mentre
`{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}` restringe il campo alla
carta che in quel momento sta in cima al mazzo.

:::example_sentence
jp: >-
  [{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  [{{1枚目|いちまいめ}}](grammar:grammar-me-ordinal)を
  [{{表向|おもてむ}}き](term:term-face-up)にする。
translation_it: >-
  Quando attacca, rende scoperta la prima carta dalla cima del proprio mazzo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{攻撃|こうげき}}する{{時|とき}}` - **Timing**: il verbo in forma piana prima
    di `{{時|とき}}` dice quando parte l'effetto, non quale carta viene scelta.
*   `{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から` - **Origine**: `の` lega
    proprietario, mazzo e posizione; `から` fa partire il prelievo dalla cima.
*   `{{1枚目|いちまいめ}}を` - **Oggetto diretto**: `{{目|め}}` non conta una
    carta generica, ma marca la prima posizione della pila.
*   `{{表向|おもてむ}}きにする` - **Cambio di stato**: `にする` rende la carta
    scoperta; non la mette ancora in mano e non la mette ancora in campo.

#### ⚖️ Contrasto operativo: rivelare non è pescare

[{{表向|おもてむ}}き](term:term-face-up) descrive lo stato visibile della carta.
Se il testo volesse farla entrare in mano, useresti una formula come
[{{手札|てふだ}}](term:term-hand)に[{{加|くわ}}える](term:term-add). Qui invece
la carta resta il referente della frase successiva: prima la vedi, poi il
testo decide che cosa farne.

#### 🧠 Gancio cognitivo: il `目` mette un segnaposto

Come trucco di memoria, leggi `{{1枚目|いちまいめ}}` come una carta con un
segnaposto sopra: non stai contando `una carta`, stai indicando `la carta
numero uno` nella sequenza. Questo aiuta a non confondere
`{{1枚|いちまい}}` con `{{1枚目|いちまいめ}}`.

## 2. Il filtro ha due porte: non evoluzione e Beat Jockey

La seconda frase parte da `それが`: il referente non cambia, e non viene
introdotto un nuovo oggetto. `それ` è la carta appena resa
[{{表向|おもてむ}}き](term:term-face-up). Su quella carta il testo applica un
filtro doppio: deve essere un [ビートジョッキー](term:term-beat-jockey) e non
deve essere [{{進化|しんか}}](term:term-evolution).

:::example_sentence
jp: >-
  それが[{{進化|しんか}}](term:term-evolution)でない
  [ビートジョッキー](term:term-beat-jockey)なら
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}し](term:term-dasu)、
  [それ{{以外|いがい}}なら](grammar:grammar-soreigai-nara)
  [{{山札|やまふだ}}](term:term-deck)の
  [{{一番下|いちばんした}}](term:term-bottom-of-deck)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Se quella carta è un Beat Jockey non evoluzione, la mette nel battle zone;
  altrimenti la mette sul fondo del mazzo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `それが` - **Referente mantenuto**: `それ` punta alla carta rivelata nella
    frase precedente, non a Bad Brand 1st.
*   `{{進化|しんか}}でないビートジョッキーなら` - **Condizione composta**:
    `でない` nega la categoria `{{進化|しんか}}`; `なら` apre il ramo solo se la
    carta resta comunque [ビートジョッキー](term:term-beat-jockey).
*   `バトルゾーンに{{出|だ}}し` - **Ramo positivo**: `に` marca la destinazione,
    `{{出|だ}}し` mette la carta in campo e collega la procedura al ramo
    alternativo.
*   `それ{{以外|いがい}}なら` - **Ramo alternativo**: tutto ciò che non è
    `{{進化|しんか}}でないビートジョッキー` passa qui.
*   `{{山札|やまふだ}}の{{一番下|いちばんした}}に{{置|お}}く` - **Destinazione
    negativa**: `{{一番下|いちばんした}}` chiude la carta in fondo alla pila,
    lontano dalla cima appena controllata.

#### ⚖️ Contrasto operativo: `でない` non annulla la razza

`{{進化|しんか}}でないビートジョッキー` non significa "non evoluzione oppure Beat
Jockey". È un unico blocco nominale: un Beat Jockey che non è evoluzione. Una
carta evoluzione con la razza giusta fallisce comunque il filtro, e una carta
non evoluzione di un'altra razza fallisce allo stesso modo.

#### 🧠 Gancio cognitivo: due controlli, una sola carta

Immagina la carta rivelata con due timbri da ottenere: `non evoluzione` e
`Beat Jockey`. Se mancano entrambi o ne manca uno solo, `それ以外なら` raccoglie
quel caso e lo manda al fondo del mazzo.

## 3. Le destinazioni cambiano il valore della stessa carta

Il blocco finale usa due verbi semplici ma molto diversi.
[{{出|だ}}す](term:term-dasu) porta una carta nel
[バトルゾーン](term:term-battle-zone), quindi la rende presenza attiva sul
tavolo. [{{置|お}}く](term:term-oku), con
[{{山札|やまふだ}}の{{一番下|いちばんした}}](term:term-bottom-of-deck), invece la
ricolloca dentro il mazzo nella posizione meno immediata.

La particella `に` resta la stessa in entrambi i rami, ma la lettura cambia
perché cambia il luogo: `バトルゾーンに` è ingresso in campo, mentre
`{{山札|やまふだ}}の{{一番下|いちばんした}}に` è sepoltura temporanea nel mazzo. La
frase non giudica se la carta è buona o cattiva: controlla una condizione e
assegna una destinazione.

## Esempi guidati di riepilogo

`{{攻撃|こうげき}}する{{時|とき}}` ti prepara a leggere un effetto che parte
durante l'attacco, non all'ingresso nel battle zone. Subito dopo,
`{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}` blocca la carta precisa:
quella in cima, non una carta scelta dal mazzo.

Quando compare `それが`, resta agganciato a quella carta rivelata. Se leggi
`{{進化|しんか}}でないビートジョッキーなら`, controlla insieme le due condizioni;
quando leggi `それ{{以外|いがい}}なら`, raccogli tutti i casi che non hanno
superato quel controllo.

## Nota finale

[“{{罰怒|バッド}}”ブランド {{1st|ファースト}}](term:term-bad-brand-first) è un buon
esempio di rules text procedurale: una frase rende visibile una carta precisa,
l'altra usa `それ` per non cambiare referente e decide la destinazione. Il
punto da riconoscere in partita è questa catena: attacco, cima del mazzo,
stato scoperto, filtro doppio, battle zone o fondo.
