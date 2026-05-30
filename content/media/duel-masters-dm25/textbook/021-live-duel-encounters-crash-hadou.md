---
id: lesson-duel-masters-dm25-live-duel-encounters-crash-hadou
media_id: media-duel-masters-dm25
slug: live-duel-encounters-crash-hadou
title: Crash Hadou e il turno extra da stato tapped
order: 50
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, extra-turn, beat-jockey, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Crash Hadou: leggere distruzione, stato tapped, finestra di battle e turno
  extra inserito subito dopo il turno attuale.
---

# [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou): stato tapped e turno extra

Quando 勝利龍装 クラッシュ覇道 arriva sul tavolo, la riga da leggere non è solo “se muore, fai qualcosa”. Il giapponese costruisce una piccola catena: prima l’evento di distruzione, poi il controllo dello stato tapped, infine il punto esatto in cui viene inserito il turno extra.

La carta è un buon esempio di rules text che sembra lungo ma diventa stabile appena separi i ruoli: `が` marca chi subisce l’evento, `～された時` apre il timing, `～たら` controlla la condizione, `～の後に` colloca il risultato nella sequenza dei turni.


## Termini chiave

- [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou) — carta incontrata: il nome proprio va letto insieme a stato tapped e turno extra.
- [{{破壊|はかい}}](term:term-destroy) — distruzione della creatura come evento che fa partire il controllo.
- [タップ{{状態|じょうたい}}](term:term-tap-state) — stato tapped già presente al momento della distruzione.
- [{{自分|じぶん}}](term:term-self) — prospettiva del giocatore che controlla l’effetto: il turno aggiunto è il tuo.
- [ターンを{{追加|ついか}}する](term:term-add-turn) — aggiungere un turno alla sequenza, non “fare subito un’azione”.
- [バトル](term:term-battle) e [パワー](term:term-power) — finestra di combattimento e valore modificato nella seconda riga.

## Espressioni ricorrenti

- このクリーチャーが破壊された時 — quando questa creatura viene distrutta.
- タップ状態でいたら — se era in stato tapped.
- このターンの後に — dopo questo turno, nella sequenza temporale della partita.
- バトル中 — durante il battle, dentro quella finestra precisa.

## Pattern grammaticali chiave

- [～された{{時|とき}}](grammar:grammar-sareta-toki) — trigger passivo: l’effetto guarda al momento in cui il soggetto subisce l’azione.
- [～たら](grammar:grammar-tara) — condizione: qui non crea lo stato, verifica se quello stato era vero.
- [～の{{後|あと}}に](grammar:grammar-no-ato-ni) — collocazione dopo un punto di riferimento: il turno attuale.
- [{{中|ちゅう}}](grammar:grammar-ui-chuu) — “durante / nel mezzo di” quando si attacca a una finestra di gioco.

## Etichette da riconoscere

- [{{B・A・D 2|びーえーでぃーつー}}](term:term-b-a-d-two) — keyword di costo
  ridotto con distruzione a fine turno
- [スピードアタッカー](term:term-speed-attacker) — keyword che permette di
  attaccare subito
- [W・ブレイカー](term:term-w-breaker) — keyword che rompe due scudi
- [ドラゴンギルド](term:term-dragonguild) — razza Dragon Guild, utile per
  sinergie e riferimenti di razza
- [ビートジョッキー](term:term-beat-jockey) — razza Beat Jockey, famiglia di
  creature aggressive Fire

Le tre keyword sono etichette tecniche compatte: ti dicono come la creatura entra in pressione e come rompe gli scudi. Le due razze, invece, servono quando un altro effetto cerca o conta ドラゴンギルド o ビートジョッキー. La riga decisiva per la lettura, però, è quella che lega distruzione, stato tapped e turno extra.

---

[～たら](grammar:grammar-tara) controlla se la condizione è vera; [{{B・A・D 2|びーえーでぃーつー}}](term:term-b-a-d-two), [スピードアタッカー](term:term-speed-attacker) e [W・ブレイカー](term:term-w-breaker) sono invece keyword già compatte, da riconoscere prima di seguire la frase lunga.

:::image
src: assets/cards/crash-hadou.png
alt: "Crash Hadou card."
caption: >-
  [{{勝利龍装|しょうりりゅうそう}} クラッシュ{{覇道|はどう}}](term:term-crash-hadou)。
  Razze: [ドラゴンギルド](term:term-dragonguild) /
  [ビートジョッキー](term:term-beat-jockey)。 Riga centrale: turno extra se
  viene distrutta da tappata.
:::

## 1. Il trigger: evento subito, stato controllato, turno inserito

La prima frase usa una struttura a tre passaggi. `このクリーチャーが` mette in primo piano la creatura come soggetto grammaticale, ma il verbo è passivo: non è lei a distruggere qualcosa, è lei che viene `破壊される`. Subito dopo, `{{時|とき}}` trasforma quell’evento in una finestra di trigger.

:::example_sentence
jp: >-
  このクリーチャーが[{{破壊|はかい}}](term:term-destroy)された
  [{{時|とき}}](grammar:grammar-sareta-toki)、
  [タップ{{状態|じょうたい}}](term:term-tap-state)でいたら、このターンの
  [{{後|あと}}](grammar:grammar-no-ato-ni)に
  [{{自分|じぶん}}](term:term-self)の
  [ターンを{{追加|ついか}}する](term:term-add-turn)。
translation_it: >-
  Quando questa creatura viene distrutta, se era in stato tapped, aggiungi un
  tuo turno dopo questo turno.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーが` ➔ **Soggetto del trigger**: la particella `が` identifica proprio questa creatura come entità colpita dall’evento.
*   `破壊された時` ➔ **Timing passivo**: `された` dice “è stata distrutta / viene distrutta”, mentre `時` aggancia l’effetto a quel momento.
*   `タップ状態でいたら` ➔ **Condizione di stato**: `状態` nominalizza lo stato tapped, `でいる` indica “essere in quello stato” e `たら` lo rende una condizione.
*   `このターンの後に` ➔ **Punto di inserimento**: `このターンの後に` inserisce il nuovo turno subito dopo quello corrente.
*   `自分のターンを追加する` ➔ **Risultato**: `自分のターン` restringe il turno aggiunto al tuo lato della partita, e `追加する` lo presenta come aggiunta alla sequenza.

### A. `破壊された時`: il passivo decide chi subisce

*   `破壊` da solo è il nome “distruzione”. Con `する` diventa “distruggere”; con `される` diventa “essere distrutto”. In `このクリーチャーが破壊された時`, il testo non sta chiedendo chi abbia causato la distruzione: sta dicendo che il trigger si apre quando questa creatura è quella che finisce distrutta.
*   Il `た` di `された` non va letto come “nel passato della storia”. Dentro `[verbo al passato] + 時`, il passato segnala che l’evento è completato rispetto al momento del trigger: prima la creatura viene distrutta, poi il testo controlla il resto della frase.

### B. `タップ状態でいたら`: non crea lo stato, lo verifica

*   `タップ状態` è un nome composto: `タップ` indica la posizione tapped della carta, `状態` indica lo stato o condizione in cui si trova. `でいたら` aggiunge l’idea di “se era rimasta / si trovava in quello stato”.
*   Questo dettaglio evita una lettura sbagliata importante: la carta non dice “tappara e poi ottieni un turno”. Dice che, quando viene distrutta, bisogna controllare se era già in `タップ状態`. La grammatica separa lo stato controllato dall’evento che lo sfrutta.

### C. `このターンの後に`: il turno extra ha una posizione precisa

*   `～の後に` prende un nome o blocco nominale prima di `の` e lo usa come punto di riferimento. Qui il blocco è `このターン`: “questo turno”. Perciò il nuovo turno non viene messo “prima possibile” in modo vago, ma dopo il turno attuale.
*   `自分のターン` chiarisce la proprietà del turno aggiunto. In rules text, `自分` non significa “me stesso” in senso psicologico: indica il proprio lato della partita, il giocatore che legge l’effetto come controllore della carta.

#### ⚖️ Contrasto operativo: timing e condizione non sono la stessa cosa

*   `破壊された時` risponde a “quando si apre l’effetto?”.
*   `タップ状態でいたら` risponde a “quale controllo deve essere vero in quel momento?”.
*   `このターンの後に` risponde a “dove viene inserito il risultato?”.

Se confondi questi tre ruoli, la frase sembra un unico blocco opaco. Se li separi, il testo diventa una procedura ordinata: evento subito ➔ stato verificato ➔ turno aggiunto.

#### 🧠 Gancio cognitivo: `状態` come fotografia della carta

Pensa a `状態` come a una fotografia della carta nel momento della distruzione. Non è etimologia: è un trucco di memoria. La domanda da farti quando leggi `タップ状態でいたら` è “nella fotografia di quel momento, la creatura era tapped?”.

## 2. La finestra di battle: potere modificato solo durante lo scontro

La seconda riga è più corta, ma contiene un contrasto utile. `バトル中` non descrive tutta la fase d’attacco: delimita la finestra dello scontro in cui il valore di `パワー` viene modificato.

:::example_sentence
jp: >-
  [バトル](term:term-battle)[{{中|ちゅう}}](grammar:grammar-ui-chuu)、この
  クリーチャーの[パワー](term:term-power)を{{+5000|プラスごせん}}する。
translation_it: >-
  Durante il battle, questa creatura prende +5000 potere.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `バトル中` ➔ **Finestra temporale**: `中` attaccato a un nome indica “durante / nel mezzo di”; qui il nome è il battle.
*   `このクリーチャーのパワーを` ➔ **Valore bersaglio**: `の` collega il potere a questa creatura, mentre `を` marca il valore che l’effetto modifica.
*   `+5000する` ➔ **Modifica numerica**: `する` applica l’aumento; il testo non crea un nuovo oggetto, cambia il valore di `パワー` dentro la finestra indicata.

#### ⚖️ Contrasto operativo: `バトル中` non è “quando attacca”

*   `バトル中` punta al momento dello scontro definito dalle regole, non a qualunque punto dell’attacco.
*   Una formula come `攻撃する時` direbbe “quando attacca” e aprirebbe un trigger diverso. Qui, invece, il testo aspetta la finestra del battle e lì applica il bonus di `パワー`.

## 3. Etichette, razze e lettura della riga centrale

Le etichette in alto vanno riconosciute in fretta, ma non hanno tutte lo stesso peso per il parsing della frase centrale.

*   B・A・D 2, スピードアタッカー e W・ブレイカー sono keyword: danno proprietà operative alla creatura, ma la frase del turno extra si legge attraverso `破壊`, `タップ状態` e `ターンを追加する`.
*   ドラゴンギルド e ビートジョッキー sono razze. Quando un altro testo dice di scegliere, contare o cercare una di queste razze, questa carta può rientrare nel gruppo bersaglio; qui però restano etichette di identità, non il motore grammaticale del turno extra.
*   Il nome 勝利龍装 クラッシュ覇道 contiene kanji forti e riconoscibili, ma nel rules text il nome proprio non decide il timing. La lettura pratica parte dalla frase dopo le keyword: evento ➔ condizione ➔ payoff.

## Esempi guidati di riepilogo

*   `このクリーチャーが破壊された時` ➔ cerca prima chi subisce l’evento. Qui è `このクリーチャー`, quindi il trigger appartiene alla distruzione di questa creatura.
*   `タップ状態でいたら` ➔ controlla la fotografia dello stato in quel momento. Se non era tapped, la condizione non apre il payoff.
*   `このターンの後に自分のターンを追加する` ➔ il risultato L'effetto aggiunge un turno dopo quello in corso.
*   `バトル中、このクリーチャーのパワーを+5000する` ➔ la finestra è il battle; il bersaglio grammaticale marcato da `を` è il valore di potere della creatura.

---

## Nota finale

勝利龍装 クラッシュ覇道 si legge bene quando non schiacci tutto su “muore e dà un turno”. Il giapponese divide il testo in ruoli molto precisi: `～された時` apre il timing passivo, `～たら` verifica lo stato, `～の後に` piazza il turno extra e `中` restringe il bonus di `パワー` alla finestra di battle.
