---
id: lesson-duel-masters-dm25-live-duel-encounters-itsuwari-no-code-sherlock
media_id: media-duel-masters-dm25
slug: live-duel-encounters-itsuwari-no-code-sherlock
title: "シャーロック: こうして riprende la scelta"
order: 101
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card, rules-text, selection, destruction, koushite, scope]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-nothing-zero-secret-destruction,
    lesson-duel-masters-dm25-live-duel-encounters-aqua-gyakutenpointer
  ]
summary: >-
  Leggere come シャーロック salva una creatura per ciascun player e poi
  distrugge tutte quelle rimaste fuori dalla scelta.
---

# {{偽|いつわ}}りのコード シャーロック: こうして chiude la scelta

{{偽|いつわ}}りのコード シャーロック tratta il campo come una procedura a due tempi.
Prima ogni player isola una propria creatura; subito dopo
[こうして](term:term-koushite) richiama esattamente quella scelta e colpisce il
resto. La frase si legge bene solo se tieni insieme tre segnali:
[{{各|かく}}](term:term-kaku) distribuisce la scelta, [{{自身|じしん}}](term:term-jishin)
fissa il possessore corretto, e [すべて](term:term-subete) chiude senza
eccezioni il gruppo rimasto fuori.

La riga successiva, {{水晶武装|すいしょうぶそう}}{{4|よん}}, apre un frame separato:
controlla una soglia nella mana zone e poi conferisce keyword a tutte le tue
creature. Qui il punto di lettura resta lo stesso: prima costruire il gruppo,
poi guardare la particella che dice che cosa succede a quel gruppo.

## Termini chiave

- [こうして](term:term-koushite) — così, in questo modo, tramite la procedura appena fatta
- [{{各|かく}}](term:term-kaku) — ogni player considerato separatamente
- [{{自身|じしん}}](term:term-jishin) — il proprio, riferito allo stesso player nominato
- [すべて](term:term-subete) — tutto il gruppo già definito
- [{{破壊|はかい}}する](term:term-destroy) — distruggere come azione di rules text

## Espressioni ricorrenti

- [{{1体|いったい}}ずつ](grammar:grammar-zutsu) — una creatura assegnata a ciascun player come quantità distribuita
- [{{選|えら}}ばれなかったクリーチャー](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru) — le creature rimaste senza scelta ricevuta
- [すべて](term:term-subete)に — tutto il gruppo come destinatario di una proprietà

## Pattern grammaticali chiave

- [こうして{{選|えら}}ばれなかったクリーチャーをすべて{{破壊|はかい}}する](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru) — il risultato colpisce tutte le creature rimaste fuori da quella scelta
- [{{1体|いったい}}ずつ](grammar:grammar-zutsu) — stessa quantità distribuita su ogni player

## Etichette da riconoscere

- Q・ブレイカー — keyword di break multiplo già chiusa come etichetta
- {{水晶武装|すいしょうぶそう}}{{4|よん}} — keyword che controlla una soglia di carte a faccia in giù nella mana zone
- アンノウン・セレス — razza della creatura, utile per riconoscere la carta e il contesto dell'effetto

---

:::image
src: assets/cards/live-duel/itsuwari-no-code-sherlock.webp
alt: >-
  Carta Duel Masters Itsuwari no Code Sherlock, creatura Unknown Celes con
  effetto di scelta per ciascun player e distruzione delle creature rimaste fuori.
caption: >-
  {{偽|いつわ}}りのコード シャーロック crea prima un gruppo salvato con
  {{1体|いったい}}ずつ, poi richiama quella scelta con
  [こうして](term:term-koushite).
:::

## 1. 各プレイヤー e 自身: la scelta resta separata per player

La prima frase dopo il trigger distribuisce subito la scelta. Parte da
[{{各|かく}}](term:term-kaku)プレイヤー, quindi ogni player viene considerato come
unità separata. Subito dopo, [{{自身|じしん}}](term:term-jishin) stringe il
riferimento: la creatura scelta appartiene allo stesso player che sta risolvendo
quello slot.

:::example_sentence
jp: >-
  この[クリーチャー](term:term-creature)が{{出|で}}た{{時|とき}}、
  [{{各|かく}}](term:term-kaku)プレイヤーは
  [{{自身|じしん}}](term:term-jishin)の[クリーチャー](term:term-creature)を
  [{{1体|いったい}}ずつ](grammar:grammar-zutsu)[{{選|えら}}ぶ](term:term-erabu)。
translation_it: >-
  Quando questa creatura entra, ogni player sceglie una propria creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{各|かく}}](term:term-kaku)プレイヤーは ➔ **Distribuzione del soggetto**:
    ogni player risolve la scelta dal proprio lato.
*   [{{自身|じしん}}](term:term-jishin)の[クリーチャー](term:term-creature)を ➔
    **Possesso riflessivo**: `自身` rimanda al player appena nominato, quindi la
    creatura scelta deve appartenere a quel player.
*   [{{1体|いったい}}ずつ](grammar:grammar-zutsu) ➔ **Quantità ripetuta**: una
    creatura per ogni player come slot separato sul tavolo.
*   [{{選|えら}}ぶ](term:term-erabu) ➔ **Azione di selezione**: il testo crea il
    gruppo delle creature scelte, che la frase successiva userà come confine.

#### ⚖️ Scope operativo di `各`

Leggere solo `プレイヤーは...選ぶ` può far immaginare una selezione comune.
[{{各|かく}}](term:term-kaku) assegna a ogni player il suo slot da
{{1体|いったい}}. In una partita multiplayer, il numero degli slot cresce con i
player e ciascuno viene riempito dal lato corrispondente.

## 2. こうして: il ponte verso le creature rimaste fuori

[こうして](term:term-koushite) porta nella seconda frase la procedura appena
conclusa. Nel rules text punta a "in questo modo": dopo una scelta di
{{1体|いったい}} per player, il campo viene diviso tra creature salvate e creature
rimaste fuori.

:::example_sentence
jp: >-
  [こうして{{選|えら}}ばれなかったクリーチャーをすべて{{破壊|はかい}}する](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru)。
translation_it: >-
  Distruggi tutte le creature rimaste fuori da questa scelta.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [こうして](term:term-koushite) ➔ **Rimando procedurale**: riprende la scelta
    di {{1体|いったい}} per ciascun player.
*   {{選|えら}}ばれなかった[クリーチャー](term:term-creature) ➔ **Relativa passiva
    negativa**: le creature sono descritte dal punto di vista della scelta
    ricevuta; ばれなかった segnala "rimaste senza essere scelte".
*   [すべて](term:term-subete) ➔ **Totalità del gruppo rimasto**: tutte le
    creature fuori dal gruppo salvato entrano nell'effetto.
*   [{{破壊|はかい}}する](term:term-destroy) ➔ **Payoff**: il gruppo marcato da
    を viene distrutto.

#### ⚖️ La scelta è già chiusa

`{{選|えら}}ばれなかった` usa la scelta appena fatta come confine già disponibile.
Dopo che ogni player ha scelto la propria creatura, la grammatica definisce
automaticamente il gruppo opposto. [こうして](term:term-koushite) mantiene la
distruzione agganciata a quel collegamento.

#### 🧠 Gancio cognitivo

Come gancio mnemonico, leggi [こうして](term:term-koushite) come una freccia
all'indietro: "con questa procedura". È un trucco di lettura per tenere la
seconda frase agganciata alla scelta precedente.

## 3. {{水晶武装|すいしょうぶそう}}{{4|よん}}: una soglia, poi proprietà concesse

La seconda abilità apre un altro frame, con il focus che passa da
[こうして](term:term-koushite) a
{{水晶武装|すいしょうぶそう}}{{4|よん}}：...あれば...{{与|あた}}える. Se nella mana
zone hai abbastanza carte a faccia in giù, il testo conferisce keyword a tutte
le tue creature. Il gruppo nasce da `すべてに`, quindi viene trattato come
destinatario delle capacità.

:::example_sentence
jp: >-
  {{水晶武装|すいしょうぶそう}}{{4|よん}}：[{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に
  [{{裏向|うらむ}}き](term:term-face-down)のカードが{{4枚以上|よんまいいじょう}}あれば、
  [{{自分|じぶん}}](term:term-self)の[クリーチャー](term:term-creature)すべてに
  「[ブロッカー](term:term-blocker)」と「[スピードアタッカー](term:term-speed-attacker)」と
  「[スレイヤー](term:term-slayer)」を[{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Crystal Armament 4: se nella tua mana zone ci sono almeno quattro carte a
  faccia in giù, dai Blocker, Speed Attacker e Slayer a tutte le tue creature.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に ➔
    **Luogo controllato**: la soglia guarda la tua mana zone.
*   [{{裏向|うらむ}}き](term:term-face-down)のカードが{{4枚以上|よんまいいじょう}}あれば ➔
    **Condizione**: servono almeno quattro carte a faccia in giù.
*   [{{自分|じぶん}}](term:term-self)の[クリーチャー](term:term-creature)すべてに ➔
    **Destinatario totale**: tutte le tue creature ricevono il bonus.
*   「[ブロッカー](term:term-blocker)」と「[スピードアタッカー](term:term-speed-attacker)」と
    「[スレイヤー](term:term-slayer)」を ➔ **Proprietà conferite**: を marca le
    keyword che vengono date.
*   [{{与|あた}}える](term:term-ataeru) ➔ **Verbo di assegnazione**: l'effetto
    attribuisce quelle capacità al gruppo marcato da に.

#### ⚖️ `を` e `に` cambiano il ruolo di `すべて`

Nella riga di distruzione, [すべて](term:term-subete) lavora con を: il gruppo
rimasto è l'oggetto da distruggere. Nella riga di
{{水晶武装|すいしょうぶそう}}{{4|よん}}, `すべてに` marca i destinatari: le tue
creature ricevono keyword. La differenza fra を e に cambia completamente il
tipo di azione.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  [{{各|かく}}](term:term-kaku)プレイヤーが
  [{{自身|じしん}}](term:term-jishin)の[クリーチャー](term:term-creature)を
  {{1体|いったい}}ずつ[{{選|えら}}ぶ](term:term-erabu)と、
  [こうして](term:term-koushite)[{{選|えら}}ばれなかったクリーチャーをすべて{{破壊|はかい}}する](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru)。
translation_it: >-
  Quando ogni player sceglie una propria creatura, tutte le creature rimaste
  fuori da quella scelta vengono distrutte.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に
  [{{裏向|うらむ}}き](term:term-face-down)のカードが{{4枚以上|よんまいいじょう}}あれば、
  [{{自分|じぶん}}](term:term-self)の[クリーチャー](term:term-creature)すべてに
  {{3|みっ}}つのキーワードを[{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Se nella tua mana zone ci sono almeno quattro carte a faccia in giù, dai tre
  keyword a tutte le tue creature.
reveal_mode: sentence
:::

## Nota finale

シャーロック si legge come una carta di scope: prima costruisce chi resta fuori
dalla distruzione, poi distrugge tutto il resto. Quando
[こうして](term:term-koushite) ti rimanda alla scelta precedente e le particelle
ti dicono se il gruppo è oggetto o destinatario, le due abilità diventano una
procedura leggibile.
