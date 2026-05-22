---
id: lesson-duel-masters-dm25-live-duel-encounters-infelstarge
media_id: media-duel-masters-dm25
slug: live-duel-encounters-infelstarge
title: "Infelstarge: owner, limite e trigger dal battle zone al mana"
order: 64
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, owner, guard-strike, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
  ]
summary: >-
  Leggere Infelstarge come sequenza di bersaglio, limite massimo, owner e
  trigger passivo quando una carta passa dal battle zone al tuo mana.
---

# Infelstarge: owner, limite e trigger dal battle zone al mana

[インフェル{{星樹|スタージュ}}](term:term-infelstarge) mette insieme due movimenti
che sembrano simili ma si leggono in modo diverso: prima sposta carte non
creatura dal [バトルゾーン](term:term-battle-zone) alla
[マナゾーン](term:term-mana-zone) del rispettivo owner, poi reagisce quando una
carta arriva dal battle zone nella tua mana zone.

Il rules text ti chiede quindi di seguire quattro segnali in ordine: il timing
`{{出|で}}た{{時|とき}}`, il gruppo bersaglio `クリーチャーではないカード`, il limite
[{{2枚|にまい}}まで](grammar:grammar-made) e il trigger passivo
[{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki). Se li leggi come un
unico flusso, la carta diventa molto meno ambigua: prima sceglie cosa muovere,
poi controlla se quel movimento accende la pesca.

:::image
src: assets/cards/live-duel/infelstarge.jpg
alt: "Infelstarge card."
caption: >-
  [インフェル{{星樹|スタージュ}}](term:term-infelstarge) combina keyword compatte e
  due frasi di movimento: rimozione dei non-creature nel mana del
  [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi), poi pesca quando una carta viene
  messa dal battle zone nel tuo mana. Keyword:
  [G（ガード）・ストライク](term:term-g-strike), [W（ダブル）・ブレイカー](term:term-w-breaker),
  razze ジャイアント・ドラゴン / レクスターズ.
:::

## Termini chiave

- [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi) — owner / proprietario della carta
- [{{選|えら}}ぶ](term:term-erabu) — scegliere un bersaglio dentro un gruppo
- [{{置|お}}く](term:term-oku) — mettere / collocare in una zona
- [{{引|ひ}}く](term:term-hiku) — pescare una carta
- [{{自分|じぶん}}](term:term-self) — il tuo lato, visto dal testo della carta

## Espressioni ricorrenti

- `クリーチャーではないカード` — una carta che non è una creatura
- `それらを` — quelle carte, cioè il gruppo appena scelto
- タップして[{{置|お}}く](term:term-oku) — mettere in una zona in stato tapped
- [バトルゾーン](term:term-battle-zone)から[{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に — dal battle zone alla tua mana zone

## Pattern grammaticali chiave

- [〜た{{時|とき}}](grammar:grammar-toki) — quando l'evento appena descritto accade
- [{{2枚|にまい}}まで](grammar:grammar-made) — fino a due carte, come limite massimo
- [{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki) — quando qualcosa viene messo, con focus passivo sull'evento

## Etichette da riconoscere

- [インフェル{{星樹|スタージュ}}](term:term-infelstarge) — nome proprio della creatura
- [G（ガード）・ストライク](term:term-g-strike) — keyword difensiva dichiarata sulla carta
- [W（ダブル）・ブレイカー](term:term-w-breaker) — keyword che segnala doppio break
- [バトルゾーン](term:term-battle-zone) — zona da cui partono le carte nominate
- [マナゾーン](term:term-mana-zone) — zona di destinazione e zona osservata dal trigger

---

## 1. Quando entra: prima restringi il gruppo, poi scegli

:::example_sentence
jp: >-
  このクリーチャーが{{出|で}}た[{{時|とき}}](grammar:grammar-toki)、
  [バトルゾーン](term:term-battle-zone)にある、クリーチャーではないカードを
  [{{2枚|にまい}}まで](grammar:grammar-made)[{{選|えら}}ぶ](term:term-erabu)。
  それらを[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi)の
  [マナゾーン](term:term-mana-zone)にタップして[{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando questa creatura entra, scegli fino a 2 carte non creatura nel battle
  zone. Mettile tapped nella mana zone dei rispettivi proprietari.
reveal_mode: sentence
:::

La prima frase non parte dal verbo di payoff, ma dal campo di scelta. Il testo
fa entrare [インフェル{{星樹|スタージュ}}](term:term-infelstarge), guarda il
[バトルゾーン](term:term-battle-zone), restringe il gruppo alle carte che non sono
creature e solo dopo usa [{{選|えら}}ぶ](term:term-erabu). Questo ordine è
importante perché `クリーチャーではないカード` non è una descrizione decorativa:
decide quali carte possono essere considerate prima del limite numerico.

*   `このクリーチャーが{{出|で}}た{{時|とき}}`: la forma `{{出|で}}た` modifica
    [{{時|とき}}](grammar:grammar-toki). Il timing è "quando questa creatura è
    entrata", non un effetto sempre attivo.
*   [バトルゾーン](term:term-battle-zone)`にある`: `に` marca il luogo, `ある`
    descrive l'esistenza della carta in quella zona. Prima di scegliere, il
    testo ti dice dove deve trovarsi il candidato.
*   `クリーチャーではないカードを`: `ではない` nega il nome prima di `カード`.
    Il risultato è "carte che non sono creature"; la particella `を` prepara
    quelle carte come oggetto di [{{選|えら}}ぶ](term:term-erabu).
*   [{{2枚|にまい}}まで](grammar:grammar-made)[{{選|えら}}ぶ](term:term-erabu):
    `まで` si attacca al conteggio e impone un tetto. La frase autorizza una
    selezione entro il massimo, non obbliga a trovare esattamente due carte.

#### 🗺️ Anatomia della frase

*   `このクリーチャーが`: **soggetto dell'evento di ingresso**. `が` aggancia il
    trigger alla creatura che è appena entrata.
*   `{{出|で}}た{{時|とき}}`: **finestra temporale**. `た` qui costruisce la
    relativa prima di `{{時|とき}}`; non racconta un passato distante.
*   `バトルゾーンにある`: **posizione del gruppo cercato**. La carta deve essere
    "nel battle zone", non in mano, mana o cimitero.
*   `クリーチャーではないカードを`: **filtro più oggetto**. Il nome `カード` resta il
    bersaglio grammaticale; `クリーチャーではない` restringe che tipo di carta può
    essere.
*   `{{2枚|にまい}}まで{{選|えら}}ぶ`: **scelta con limite massimo**. `まで`
    chiude il numero in alto, mentre [{{選|えら}}ぶ](term:term-erabu) conferma
    che c'è una decisione da prendere.

#### ⚖️ Contrasto operativo: `{{2枚|にまい}}まで` non significa "due carte"

`{{2枚|にまい}}` da solo dà il conteggio "due carte". Con `まで`, il conteggio
diventa soglia massima: puoi scegliere due carte, una carta o nessuna carta se
il contesto lo consente. In una riga come
`クリーチャーではないカードを{{2枚|にまい}}まで{{選|えら}}ぶ`, l'informazione decisiva è
la libertà dentro il limite, non l'obbligo di riempire il numero.

## 2. Owner e `それら`: il gruppo scelto si divide per proprietario

Dopo la scelta, il testo non dice semplicemente "mettile nel tuo mana". Usa
それらを[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi)の[マナゾーン](term:term-mana-zone)に,
quindi riprende tutte le carte scelte con `それら` e assegna a ciascuna la
destinazione del proprio owner.

*   [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi) nasce da `{{持|も}}つ`
    "avere/tenere" e `{{主|ぬし}}` "principale proprietario". Nel rules text non
    indica chi sta usando la carta in quel momento, ma la persona a cui la
    carta appartiene come oggetto di gioco.
*   `それら` è più forte di un generico `それ`: riprende il gruppo plurale appena
    formato da `クリーチャーではないカードを{{2枚|にまい}}まで{{選|えら}}ぶ`. Quando lo
    incontri, torna sempre al gruppo precedente e chiediti che cosa è stato
    selezionato, rivelato o nominato.
*   タップして[{{置|お}}く](term:term-oku) mette insieme stato e movimento:
    `タップして` dice in che stato la carta arriva, mentre
    [{{置|お}}く](term:term-oku) chiude l'azione di collocarla nella zona di
    destinazione.

#### ⚖️ Contrasto operativo: owner non è controllo momentaneo

`{{持|も}}ち{{主|ぬし}}のマナゾーン` non si risolve guardando chi ha la carta davanti
in quel momento. Si risolve guardando il proprietario della carta. Perciò il
giapponese evita una lettura troppo rapida come "mettile nel mio mana": ogni
carta scelta va nella mana zone del suo
[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi).

#### 🧠 Gancio cognitivo

Per ricordare [{{持|も}}ち{{主|ぬし}}](term:term-mochinushi), leggi il composto
come "la persona principale che tiene quella cosa". È un gancio pratico sulla
forma `{{持|も}}ち` più `{{主|ぬし}}`: nel testo della carta ti porta subito alla
domanda giusta, cioè "di chi è questa carta?".

## 3. Il trigger passivo: non chi mette la carta, ma dove finisce

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)から
  [{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に
  カードが[{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki)、
  カードを{{1枚|いちまい}}[{{引|ひ}}く](term:term-hiku)。
translation_it: >-
  Quando una carta viene messa dal battle zone nella tua mana zone, pesca 1
  carta.
reveal_mode: sentence
:::

La seconda frase cambia prospettiva. Non ripete l'azione dell'effetto di
ingresso; osserva un evento: una carta passa dal
[バトルゾーン](term:term-battle-zone) alla tua
[マナゾーン](term:term-mana-zone). Per questo la forma passiva
[{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki) è il cuore della
lettura. Il testo non cerca chi ha messo la carta, ma registra che la carta è
stata collocata nella zona giusta.

*   [バトルゾーン](term:term-battle-zone)`から`: `から` marca la provenienza. Il
    trigger non riguarda qualsiasi carta che entra nel mana, ma una carta che
    parte da quella zona precisa.
*   [{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)`に`:
    `{{自分|じぶん}}の` restringe la destinazione al tuo mana. La carta può essere
    qualunque carta, ma il punto di arrivo deve essere il tuo lato.
*   `カードが`: `が` mette la carta come soggetto dell'evento passivo. Non c'è
    bisogno di nominare il giocatore che causa lo spostamento.
*   [{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki): passivo più
    [{{時|とき}}](grammar:grammar-toki). La collocazione è già avvenuta e proprio
    quel momento fa partire il testo successivo.
*   カードを{{1枚|いちまい}}[{{引|ひ}}く](term:term-hiku): payoff breve e
    diretto. `カードを` è l'oggetto, `{{1枚|いちまい}}` quantifica, e
    [{{引|ひ}}く](term:term-hiku) è il verbo tecnico di pescare.

#### 🗺️ Anatomia della frase

*   `バトルゾーンから`: **origine del movimento**. La particella `から` chiude la
    porta ad altri ingressi nel mana.
*   `{{自分|じぶん}}のマナゾーンに`: **destinazione richiesta**. `に` indica il punto
    di arrivo, mentre `{{自分|じぶん}}の` lo rende tuo.
*   `カードが`: **soggetto passivo**. La carta è ciò a cui succede lo
    spostamento.
*   `{{置|お}}かれた{{時|とき}}`: **trigger su evento compiuto**. Il passivo
    `{{置|お}}かれた` concentra l'attenzione sul risultato: la carta è stata
    messa lì.
*   `カードを{{1枚|いちまい}}{{引|ひ}}く`: **effetto conseguente**. Dopo la virgola,
    la frase torna attiva e ti dice di pescare una carta.

#### ⚖️ Contrasto operativo: `{{置|お}}く` attivo vs `{{置|お}}かれた` passivo

Nel primo effetto, タップして[{{置|お}}く](term:term-oku) descrive l'azione da
compiere: metti quelle carte in una zona. Nel secondo,
[{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki) descrive un fatto
accaduto alla carta: è stata messa nella tua mana zone. Se leggi entrambe come
comandi identici, perdi il trigger; se distingui attivo e passivo, capisci che
la pesca può reagire anche a un movimento già prodotto da un altro testo.

## 4. Le keyword: etichette compatte prima del testo lungo

La riga keyword di [インフェル{{星樹|スタージュ}}](term:term-infelstarge) è breve
ma cambia il modo in cui prepari la lettura degli effetti. Le keyword non
spiegano il movimento verso la mana zone; etichettano capacità già codificate,
mentre le frasi successive gestiscono bersagli, owner e trigger.

*   [G（ガード）・ストライク](term:term-g-strike) usa una sigla con lettura
    esplicitata tra parentesi. Quando trovi `G（ガード）`, non leggere la lettera
    come informazione autonoma: la parentesi ti dà la lettura ufficiale della
    keyword.
*   [W（ダブル）・ブレイカー](term:term-w-breaker) funziona nello stesso modo:
    `W` viene aperto da `ダブル`, poi `ブレイカー` segnala la funzione offensiva.
    È una label compatta, separata dalla grammatica delle frasi con
    [{{選|えら}}ぶ](term:term-erabu), [{{置|お}}く](term:term-oku) e
    [{{引|ひ}}く](term:term-hiku).

#### ⚖️ Contrasto operativo: keyword label vs frase di effetto

Le keyword si riconoscono come blocchi nominali: nome, sigla, parentesi o
katakana, senza soggetto e oggetto espliciti. Le frasi di effetto invece
contengono particelle e verbi: `カードを{{選|えら}}ぶ`, `マナゾーンに{{置|お}}く`,
`カードを{{1枚|いちまい}}{{引|ひ}}く`. Quando vedi particelle come `を`, `に` e
`から`, sei già dentro la logica della frase, non più nella semplice etichetta.

## Esempi guidati di riepilogo

Le tre frasi seguenti ricombinano lo stesso sistema: zona di partenza, scelta,
owner, destinazione e trigger passivo.

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)にあるカードを{{1枚|いちまい}}
  [{{選|えら}}ぶ](term:term-erabu)。
translation_it: >-
  Scegli 1 carta che si trova nel battle zone.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  それを[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi)の
  [マナゾーン](term:term-mana-zone)にタップして[{{置|お}}く](term:term-oku)。
translation_it: >-
  Mettila tapped nella mana zone del suo owner.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)から
  [{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に
  カードが[{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki)、
  カードを{{1枚|いちまい}}[{{引|ひ}}く](term:term-hiku)。
translation_it: >-
  Quando una carta viene messa dal battle zone nella tua mana zone, pesca 1
  carta.
reveal_mode: sentence
:::

---

## Nota finale

[インフェル{{星樹|スタージュ}}](term:term-infelstarge) è leggibile quando separi i
ruoli: [{{2枚|にまい}}まで](grammar:grammar-made) limita la scelta,
[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi) decide la destinazione corretta,
[{{置|お}}く](term:term-oku) descrive il movimento attivo e
[{{置|お}}かれた{{時|とき}}](grammar:grammar-sareta-toki) trasforma un movimento
già avvenuto in trigger. Il testo sembra lungo, ma il suo schema è stabile:
scegli un gruppo, manda ogni carta al suo owner, poi controlla se qualcosa è
arrivato dal battle zone nella tua mana zone.
