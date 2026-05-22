---
id: lesson-duel-masters-dm25-live-duel-encounters-max-crimson-blade-lord
media_id: media-duel-masters-dm25
slug: live-duel-encounters-max-crimson-blade-lord
title: "Quando l'attacco passa: passivo negativo e stato tapped"
order: 84
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, fire, evolution, passive, state, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-tcg-card-types,
    lesson-duel-masters-dm25-live-duel-encounters-crash-hadou
  ]
summary: >-
  Leggere il trigger in cui l'attacco non viene bloccato e il filtro che
  colpisce una creatura avversaria già tappata.
---

# Quando l'attacco passa: passivo negativo e stato tapped

ブレードグレンオー・マックス mette quasi tutta la difficoltà in una sola riga di rules text. Prima controlla se l'attacco al giocatore avversario è arrivato fino in fondo senza blocco; solo dopo apre il filtro sulla creatura da distruggere.

La carta è utile perché affianca due forme passive molto diverse: `ブロックされなかった` racconta un evento che non è successo, mentre `タップされている` descrive uno stato già visibile sul tavolo. Se le leggi come semplici traduzioni isolate, la frase sembra lineare; se le leggi come condizioni operative, capisci quando l'effetto parte e quale bersaglio può davvero prendere.


## Termini chiave

- [{{攻撃|こうげき}}](term:term-attack) — attacco; qui avvia la sequenza, ma non basta da solo a far partire l'effetto.
- [{{相手|あいて}}](term:term-opponent) — avversario; prima è il giocatore attaccato, poi il lato da cui scegliere la creatura.
- [クリーチャー](term:term-creature) — creatura; il tipo di bersaglio contato con {{1体|いったい}}.
- [パワー](term:term-power) — power/potenza stampata; entra nel filtro numerico prima della distruzione.
- [{{破壊|はかい}}する](term:term-destroy) — distruggere; il risultato finale dopo trigger e scelta valida.

## Espressioni ricorrenti

- [ブロックされなかった](grammar:grammar-sarenakatta)[{{時|とき}}](grammar:grammar-toki) — quando non è stato bloccato; trasforma l'attacco riuscito in finestra dell'effetto.
- [タップされている](grammar:grammar-sareteiru)クリーチャー — creatura già tappata; non una creatura che viene tappata ora.
- [パワー](term:term-power){{3000以下|さんぜんいか}}のクリーチャー — creatura con power 3000 o meno; il numero include anche 3000.

## Pattern grammaticali chiave

- [～されなかった](grammar:grammar-sarenakatta) — passivo negativo al passato: non essere stato X.
- [～されている](grammar:grammar-sareteiru) — passivo risultativo: essere già in uno stato prodotto da un'azione.
- [～{{時|とき}}](grammar:grammar-toki) — quando / nel momento in cui; qui aggancia il trigger alla condizione appena descritta.
- [～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) — soglie inclusive; {{3000以下|さんぜんいか}} significa 3000 o meno.

## Etichette da riconoscere

- ブレードグレンオー・マックス — il nome della creatura; il titolo inglese è Max, Crimson Blade Lord.
- [タップ{{状態|じょうたい}}](term:term-tap-state) — stato tapped; in questa carta è espresso come relativa, タップされている.
- [{{能力|のうりょく}}](term:term-ability) — abilità / testo di effetto
- [{{選|えら}}ぶ](term:term-erabu) — scegliere

---

:::image
src: assets/cards/live-duel/max-crimson-blade-lord.webp
alt: "ブレードグレンオー・マックス card."
caption: >-
  ブレードグレンオー・マックス。 La riga chiave unisce `ブロックされなかった` e
  `タップされている`: il primo blocco nega un passivo, il secondo descrive uno
  stato già presente, vicino a [タップ{{状態|じょうたい}}](term:term-tap-state).
:::

## 1. Dal colpo al trigger: `攻撃してブロックされなかった時`

La prima metà della frase non dice semplicemente "quando attacca". Il testo costruisce una piccola catena: このクリーチャーが mette in scena la creatura, [{{相手|あいて}}](term:term-opponent)プレイヤーを indica il bersaglio dell'attacco, [{{攻撃|こうげき}}](term:term-attack)して collega quell'azione alla condizione successiva, e [ブロックされなかった](grammar:grammar-sarenakatta)[{{時|とき}}](grammar:grammar-toki) chiude la finestra.

- `ブロックする` è l'azione di bloccare. Quando diventa `ブロックされる`, la frase cambia punto di vista: non guarda chi blocca, ma ciò che viene bloccato.
- `ブロックされなかった` aggiunge negazione e passato al passivo. La lettura concreta è "non è stato bloccato", cioè l'attacco non ha incontrato un blocco valido.
- [{{時|とき}}](grammar:grammar-toki) non è un "tempo" generico. Dopo una frase completa, prende tutto ciò che precede e lo trasforma nel momento in cui il testo controlla se l'effetto può partire.

:::example_sentence
jp: >-
  このクリーチャーが[{{相手|あいて}}](term:term-opponent)プレイヤーを
  [{{攻撃|こうげき}}](term:term-attack)して
  [ブロックされなかった](grammar:grammar-sarenakatta)[{{時|とき}}](grammar:grammar-toki)、
  [{{相手|あいて}}](term:term-opponent)のタップされている
  [パワー](term:term-power){{3000以下|さんぜんいか}}の
  [クリーチャー](term:term-creature)を{{1体|いったい}}、
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Quando questa creatura attacca il giocatore avversario e non viene bloccata,
  distruggi 1 creatura dell'avversario già tappata con power 3000 o inferiore.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーが` → **Soggetto del trigger**. La creatura indicata dalla carta è quella che deve attaccare.
*   [{{相手|あいて}}](term:term-opponent)プレイヤーを → **Bersaglio dell'attacco**. Il colpo deve andare al giocatore avversario, non a una creatura.
*   [{{攻撃|こうげき}}](term:term-attack)して → **Azione collegata**. La forma in して non chiude la frase: prepara la condizione successiva.
*   [ブロックされなかった](grammar:grammar-sarenakatta) → **Passivo negativo**. Il soggetto non ha subito l'azione di essere bloccato.
*   [{{時|とき}}](grammar:grammar-toki) → **Finestra di controllo**. Tutta la sequenza precedente diventa il "quando" dell'effetto.

#### ⚖️ Contrasto operativo

`ブロックしなかった` e `ブロックされなかった` non distribuiscono i ruoli allo stesso modo. `ブロックしなかった` metterebbe al centro chi non ha bloccato; `ブロックされなかった` mette al centro l'attacco o la creatura che non è stata bloccata. Nel rules text di questa carta il soggetto è `このクリーチャー`, quindi la forma passiva è quella che tiene la frase agganciata alla creatura attaccante.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, immagina `される` come un'azione che arriva addosso al soggetto. Con `されなかった`, quell'azione non arriva: ブレードグレンオー・マックス ha attaccato e il "blocco" non si è posato su di lui.

## 2. Il bersaglio filtrato: `タップされているパワー3000以下のクリーチャー`

Dopo il trigger, il giapponese non passa subito a [{{破壊|はかい}}する](term:term-destroy). Prima costruisce il bersaglio con tre filtri in fila: deve essere dell'[{{相手|あいて}}](term:term-opponent), deve essere [タップされている](grammar:grammar-sareteiru), e deve avere [パワー](term:term-power){{3000以下|さんぜんいか}}.

- [{{相手|あいて}}](term:term-opponent)の restringe il lato del tavolo. Non stai cercando una creatura qualsiasi: il bersaglio deve appartenere al lato avversario.
- [タップされている](grammar:grammar-sareteiru) modifica direttamente [クリーチャー](term:term-creature). La forma されている non dice che la creatura viene tappata adesso; dice che lo stato tapped è già vero nel momento della scelta.
- [パワー](term:term-power){{3000以下|さんぜんいか}}の aggiunge una soglia inclusiva. {{3000|さんぜん}} è dentro la soglia, {{4000|よんせん}} no.
- `{{1体|いったい}}` conta creature come unità vive sul tavolo. Il testo non sta scegliendo una carta in modo generico, ma una creatura valida tra quelle che superano tutti i filtri precedenti.

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の
  [タップされている](grammar:grammar-sareteiru)[パワー](term:term-power){{3000以下|さんぜんいか}}の
  [クリーチャー](term:term-creature)を{{1体|いったい}}、
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Distruggi 1 creatura dell'avversario già tappata con power 3000 o inferiore.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{相手|あいて}}](term:term-opponent)の → **Dominio del bersaglio**. La creatura deve stare dal lato avversario.
*   [タップされている](grammar:grammar-sareteiru) → **Stato risultativo**. La creatura è già in posizione tapped; la frase non le sta dando ora quel nuovo stato.
*   [パワー](term:term-power){{3000以下|さんぜんいか}}の → **Filtro numerico**. Il power deve essere 3000 o meno, con 3000 incluso.
*   [クリーチャー](term:term-creature)を{{1体|いったい}} → **Oggetto e quantità**. Tra i bersagli validi, l'effetto ne prende uno.
*   [{{破壊|はかい}}する](term:term-destroy) → **Risultato**. Solo dopo tutti i filtri arriva l'azione finale.

#### ⚖️ Contrasto operativo

タップする sarebbe un'azione: tappari qualcosa. [タップされている](grammar:grammar-sareteiru) è invece uno stato: la creatura è già tapped quando l'effetto la guarda. Se una creatura è untapped, questa riga non la rende tapped per poi distruggerla; resta semplicemente fuori dal gruppo valido.

#### 🧠 Gancio cognitivo

Per ricordare [～されている](grammar:grammar-sareteiru), pensa al risultato lasciato sul tavolo. Il verbo passato non è visibile come evento, ma il suo esito sì: la creatura è inclinata, quindi il giapponese la descrive come タップされている.

## 3. Ordine giapponese e decisione reale

La frase intera lavora da sinistra a destra come una serie di cancelli. Primo cancello: questa creatura deve attaccare il giocatore avversario. Secondo cancello: l'attacco non deve essere bloccato. Terzo cancello: tra le creature dell'avversario, devi trovarne una già tapped e con power 3000 o meno. Solo dopo il testo arriva a [{{破壊|はかい}}する](term:term-destroy).

Questo ordine evita una lettura troppo italiana del tipo "attacco, poi distruggo qualcosa". Il giapponese ti costringe prima a verificare la finestra, poi a restringere il bersaglio. La distruzione è l'ultimo verbo, ma non è l'unica informazione importante: tutta la parte prima del verbo decide se quel verbo può applicarsi e su che cosa.

#### ⚖️ Contrasto operativo

[～{{以下|いか}} / ～{{以上|いじょう}}](grammar:grammar-ika-ijou) usa soglie inclusive. {{3000以下|さんぜんいか}} non vuol dire "meno di 3000": include esattamente 3000. Se il testo volesse escludere la linea, useresti un'altra costruzione, non 以下.

#### 🧠 Gancio cognitivo

Immagina `{{3000以下|さんぜんいか}}` come una linea tracciata sul numero 3000: tutto ciò che sta sulla linea o sotto la linea passa il filtro. Il numero scritto nella carta non è il primo valore escluso, è l'ultimo valore incluso.

## Esempi guidati di riepilogo

Le frasi seguenti ricombinano gli stessi pezzi: passivo negativo per il blocco mancato, stato risultativo per il tapped e soglia inclusiva per il power.

:::example_sentence
jp: >-
  このクリーチャーが[{{攻撃|こうげき}}](term:term-attack)して
  [ブロックされなかった](grammar:grammar-sarenakatta)[{{時|とき}}](grammar:grammar-toki)、
  [{{能力|のうりょく}}](term:term-ability)を{{使|つか}}う。
translation_it: >-
  Quando questa creatura attacca e non viene bloccata, usa l'abilità.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [タップされている](grammar:grammar-sareteiru)[クリーチャー](term:term-creature)を
  {{1体|いったい}}[{{選|えら}}ぶ](term:term-erabu)。
translation_it: >-
  Scegli 1 creatura già tappata.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [パワー](term:term-power){{3000以下|さんぜんいか}}の
  [クリーチャー](term:term-creature)だけを
  [{{破壊|はかい}}する](term:term-destroy)。
translation_it: >-
  Distruggi solo le creature con power 3000 o inferiore.
reveal_mode: sentence
:::

---

## Nota finale

Quando incontri una riga come quella di ブレードグレンオー・マックス, non correre subito al verbo finale. Cerca prima la finestra con [{{時|とき}}](grammar:grammar-toki), poi il valore del passivo in [～されなかった](grammar:grammar-sarenakatta), poi il filtro di stato in [～されている](grammar:grammar-sareteiru). La carta diventa leggibile quando separi evento mancato, stato già presente e soglia numerica inclusiva.
