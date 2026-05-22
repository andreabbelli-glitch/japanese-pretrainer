---
id: lesson-duel-masters-dm25-live-duel-encounters-2x2-4x5-plus-17-equals-1
media_id: media-duel-masters-dm25
slug: live-duel-encounters-2x2-4x5-plus-17-equals-1
title: "Un solo attacco nel turno avversario: ♪2×2-4×5+17=1"
order: 79
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, magic-song, attack-limit, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-garchainsaw-dragon,
    lesson-duel-masters-dm25-live-duel-encounters-shadan-q
  ]
summary: >-
  2x2-4x5+17=1 limita l'avversario a un solo attacco di creatura nel turno
  successivo, usando shika con la negazione finale.
---

# Un solo attacco nel turno avversario: ♪2×2-4×5+17=1

La carta ha un nome aritmetico rumoroso, ma il suo giapponese operativo è
molto pulito: prima delimita il prossimo turno dell'avversario, poi costruisce
un limite massimo con `{{一度|いちど}}しか...できない`.

Quando una riga di rules text usa [しか](grammar:grammar-shika), la parte più
importante arriva spesso alla fine. Il numero davanti a `しか` prepara il
tetto consentito, mentre la negazione chiude la frase e trasforma tutto in
“non più di...”.

:::image
src: assets/cards/live-duel/2x2-4x5-plus-17-equals-1.jpg
alt: "♪2×2-4×5+17=1 card."
caption: >-
  ♪2×2-4×5+17=1。 Razza: マジック・ソング. La riga dell'effetto limita
  l'avversario durante il suo prossimo turno: può fare al massimo un attacco
  con una creatura.
:::

## Termini chiave

- [{{相手|あいて}}](term:term-opponent) — avversario / l'altro giocatore
- [{{一度|いちど}}](term:term-ichido) — una volta / una singola occasione
- [クリーチャー](term:term-creature) — creatura
- [{{攻撃|こうげき}}](term:term-attack) — attacco / attaccare

## Espressioni ricorrenti

- [{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}} — durante il prossimo turno dell'avversario
- [クリーチャー](term:term-creature)で[{{攻撃|こうげき}}](term:term-attack)できない — non può attaccare usando creature

## Pattern grammaticali chiave

- [{{次|つぎ}}の](grammar:grammar-tsugi-no) — il prossimo elemento della sequenza, non un futuro generico
- [{{一度|いちど}}しか](grammar:grammar-shika) — solo una volta, letto insieme alla negazione finale

## Etichette da riconoscere

- マジック・ソング — razza della carta; segnala una magia-canzone, mentre la riga dell'effetto resta rules text ordinario

---

## 1. La finestra dell'effetto: prossimo turno, non blocco permanente

La frase apre con [{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}}. `{{次|つぎ}}の` prende il turno immediatamente successivo nella sequenza di gioco; non dice “un turno avversario qualsiasi” e non crea una regola permanente.

`ターン{{中|ちゅう}}` trasforma quel turno in una finestra temporale. Tutto ciò che segue nella frase va letto dentro quel perimetro: quando il turno avversario finisce, anche la restrizione ha finito il suo lavoro.

:::example_sentence
jp: >-
  [{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)の
  ターン{{中|ちゅう}}、[{{相手|あいて}}](term:term-opponent)は
  [{{一度|いちど}}しか](grammar:grammar-shika)
  [クリーチャー](term:term-creature)で
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Durante il prossimo turno dell'avversario, l'avversario può attaccare con
  creature una sola volta.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `[{{次|つぎ}}の](grammar:grammar-tsugi-no)` specifica il turno che viene subito dopo l'effetto, non una categoria abituale di turni futuri.
*   `[{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}}` mette il turno dell'avversario in funzione di cornice: la restrizione vive “durante” quel turno.
*   La virgola dopo `ターン{{中|ちゅう}}` separa la cornice temporale dal contenuto della regola: prima il quando, poi che cosa viene limitato.

#### ⚖️ Contrasto operativo

[{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}} non equivale a [{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}} da solo. Senza `{{次|つぎ}}の`, potresti leggere una regola più generale; con `{{次|つぎ}}の`, il giapponese restringe l'effetto al turno avversario immediatamente successivo.

#### 🧠 Gancio cognitivo

Immagina `{{次|つぎ}}の...{{中|ちゅう}}` come una parentesi temporale: la frase apre la parentesi sul prossimo turno avversario, applica il limite, poi la parentesi si chiude quando quel turno termina. È un trucco mnemonico, non un'etimologia.

## 2. Il tetto numerico: 一度しか...できない

[{{一度|いちど}}](term:term-ichido) indica una singola occorrenza. In una frase di combattimento, non conta creature, giocatori o carte: conta quante volte può avvenire l'azione di [{{攻撃|こうげき}}](term:term-attack).

`しか` si appoggia a quel numero, ma non basta da solo. Il pattern completo è `X しか...ない`: “non ... tranne X”, che in italiano diventa più naturale come “solo X” o “al massimo X”. Qui il finale `できない` è il pezzo che fa scattare la lettura negativa.

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)は
  [{{一度|いちど}}しか](grammar:grammar-shika)
  [クリーチャー](term:term-creature)で
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  L'avversario non può attaccare con creature più di una volta.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `[{{相手|あいて}}](term:term-opponent)は` stabilisce chi subisce la restrizione: l'avversario, non tu e non una creatura specifica.
*   `[{{一度|いちど}}しか](grammar:grammar-shika)` mette davanti il limite numerico: una sola occorrenza resta dentro l'area consentita.
*   `[{{攻撃|こうげき}}](term:term-attack)できない` è potenziale negativo: la regola parla di ciò che non è permesso fare, non di ciò che l'avversario sceglierà davvero di fare.

#### ⚖️ Contrasto operativo

`[{{一度|いちど}}しか](grammar:grammar-shika)...できない` crea un massimo, non un obbligo. L'avversario può anche non attaccare; semplicemente non può superare un singolo attacco con una creatura durante quella finestra.

#### 🧠 Gancio cognitivo

Con `しか`, aspetta sempre la chiusura negativa: `{{一度|いちど}}しか` lascia aperta la domanda “una volta soltanto rispetto a che cosa?”. `できない` risponde e chiude il circuito: tutto ciò che va oltre una volta viene escluso.

## 3. Il mezzo dell'azione: creature, non qualsiasi effetto

Il blocco [クリーチャー](term:term-creature)で[{{攻撃|こうげき}}](term:term-attack)できない contiene un `で` strumentale. La creatura è il mezzo con cui avviene l'attacco: la frase non sta contando tutte le azioni del turno, ma gli attacchi effettuati usando creature.

Questo dettaglio evita una lettura troppo larga. La restrizione non dice che l'avversario può fare una sola cosa in tutto il turno; dice che, dentro quel turno, gli attacchi con creature non possono superare una singola occorrenza.

:::example_sentence
jp: >-
  [クリーチャー](term:term-creature)で
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Non può attaccare usando creature.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `[クリーチャー](term:term-creature)で` indica il mezzo o lo strumento dell'azione: l'attacco passa attraverso una creatura.
*   `[{{攻撃|こうげき}}](term:term-attack)できない` combina il nome verbale `{{攻撃|こうげき}}` con `できない`: “non poter attaccare”.
*   Quando questo blocco segue `[{{一度|いちど}}しか](grammar:grammar-shika)`, il divieto non è totale: resta permesso un solo attacco di creatura.

#### ⚖️ Contrasto operativo

`[クリーチャー](term:term-creature)で[{{攻撃|こうげき}}](term:term-attack)` non significa “ogni creatura può attaccare una volta”. Il topic è `[{{相手|あいて}}](term:term-opponent)は`, quindi il limite ricade sul giocatore avversario nel suo complesso: una sola azione di attacco con una creatura.

## 4. Come tenere insieme l'intera riga

La riga completa procede in tre passi leggibili: cornice temporale, giocatore limitato, azione consentita una sola volta. Se provi a tradurre pezzo per pezzo nell'ordine italiano, `しか` può sembrare “solo” attaccato al numero e basta; nel giapponese della carta, invece, lavora insieme al potenziale negativo finale.

*   [{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}} apre la finestra temporale.
*   [{{相手|あいて}}](term:term-opponent)は indica il giocatore colpito dalla restrizione.
*   [{{一度|いちど}}しか](grammar:grammar-shika)[クリーチャー](term:term-creature)で[{{攻撃|こうげき}}](term:term-attack)できない chiude il senso: non più di un attacco con una creatura.

#### ⚖️ Contrasto operativo

La frase non vuol dire “l'avversario solo una volta non può attaccare”. In italiano la negazione va spostata sul superamento del limite: “l'avversario non può attaccare con creature più di una volta”. Questo è il modo naturale di rendere `{{一度|いちど}}しか...できない`.

## Esempi guidati di riepilogo

Le stesse forme diventano più rapide da riconoscere quando cambi il contesto ma lasci intatta la logica di finestra, limite e azione:

:::example_sentence
jp: >-
  [{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)の
  ターン{{中|ちゅう}}、[{{相手|あいて}}](term:term-opponent)は
  [{{一度|いちど}}しか](grammar:grammar-shika)
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Durante il prossimo turno dell'avversario, l'avversario può attaccare una
  sola volta.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  この[クリーチャー](term:term-creature)は
  [{{一度|いちど}}しか](grammar:grammar-shika)
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Questa creatura può attaccare una sola volta.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)は
  [クリーチャー](term:term-creature)で
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  L'avversario non può attaccare usando creature.
reveal_mode: sentence
:::

## Nota finale

La carta si legge bene se aspetti la negazione finale: [{{一度|いちど}}しか](grammar:grammar-shika) prepara il limite, [{{攻撃|こうげき}}](term:term-attack)できない lo chiude, e [{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)のターン{{中|ちゅう}} impedisce di trasformare un blocco di un turno in una restrizione permanente.
