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
  distrugge tutte quelle non scelte.
---

# {{偽|いつわ}}りのコード シャーロック: こうして chiude la scelta

{{偽|いつわ}}りのコード シャーロック non distrugge il campo in modo indistinto.
Prima obbliga ogni player a isolare una propria creatura, poi usa
[こうして](term:term-koushite) per richiamare esattamente quella procedura e
colpire il resto. La frase si legge bene solo se tieni insieme tre segnali:
[{{各|かく}}](term:term-kaku) distribuisce la scelta, [{{自身|じしん}}](term:term-jishin)
fissa il possessore corretto, e [すべて](term:term-subete) chiude senza
eccezioni il gruppo non salvato.

La riga successiva, {{水晶武装|すいしょうぶそう}}{{4|よん}}, lavora con una logica
diversa: non sceglie bersagli, ma controlla una soglia nella mana zone e poi
conferisce keyword a tutte le tue creature. Qui il punto di lettura resta lo
stesso: prima costruire il gruppo, poi guardare la particella che dice che cosa
succede a quel gruppo.

## Termini chiave

- [こうして](term:term-koushite) — così, in questo modo, tramite la procedura appena fatta
- [{{各|かく}}](term:term-kaku) — ogni player considerato separatamente
- [{{自身|じしん}}](term:term-jishin) — il proprio, riferito allo stesso player nominato
- [すべて](term:term-subete) — tutto il gruppo già definito
- [{{破壊|はかい}}する](term:term-destroy) — distruggere come azione di rules text

## Espressioni ricorrenti

- [{{1体|いったい}}ずつ](grammar:grammar-zutsu) — una creatura per ciascun player, non un totale comune
- [{{選|えら}}ばれなかったクリーチャー](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru) — le creature che non hanno ricevuto la scelta
- [すべて](term:term-subete)に — tutto il gruppo come destinatario di una proprietà

## Pattern grammaticali chiave

- [こうして{{選|えら}}ばれなかったクリーチャーをすべて{{破壊|はかい}}する](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru) — il risultato colpisce tutto ciò che non è stato scelto in quel modo
- [{{1体|いったい}}ずつ](grammar:grammar-zutsu) — stessa quantità distribuita su ogni player

## Etichette da riconoscere

- Q・ブレイカー — keyword di break multiplo già chiusa come etichetta
- {{水晶武装|すいしょうぶそう}}{{4|よん}} — keyword che controlla una soglia di carte a faccia in giù nella mana zone
- アンノウン・セレス — razza della creatura, utile come contesto ma non parte della frase di distruzione

---

:::image
src: assets/cards/itsuwari-no-code-sherlock.jpg
alt: >-
  Carta Duel Masters Itsuwari no Code Sherlock, creatura Unknown Celes con
  effetto di scelta per ciascun player e distruzione delle creature non scelte.
caption: >-
  {{偽|いつわ}}りのコード シャーロック crea prima un gruppo salvato con
  {{1体|いったい}}ずつ, poi richiama quella scelta con
  [こうして](term:term-koushite).
:::

## 1. 各プレイヤー e 自身: la scelta resta separata per player

La prima frase dopo il trigger non dice semplicemente "scegli una creatura".
Parte da [{{各|かく}}](term:term-kaku)プレイヤー, quindi ogni player viene
considerato come unità separata. Subito dopo, [{{自身|じしん}}](term:term-jishin)
stringe il riferimento: ogni player sceglie una creatura propria, non una
creatura qualsiasi sul campo.

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
    creatura per ciascun player, non una creatura totale per tutto il tavolo.
*   [{{選|えら}}ぶ](term:term-erabu) ➔ **Azione di selezione**: il testo crea il
    gruppo delle creature scelte, che la frase successiva userà come confine.

#### ⚖️ Contrasto operativo: `各` non crea un gruppo unico

Se leggi solo `プレイヤーは...選ぶ`, potresti immaginare una selezione comune.
[{{各|かく}}](term:term-kaku) impedisce questa lettura: ogni player ha il suo
slot da {{1体|いったい}}. In una partita multiplayer, questo dettaglio evita di
pensare che un solo lato possa occupare tutti gli slot di scelta.

## 2. こうして: il ponte verso le creature non salvate

[こうして](term:term-koushite) non è un riempitivo traducibile con un vago
"così". Nel rules text punta alla procedura appena finita: le creature sono
state scelte una per player, e proprio "in questo modo" il testo può distinguere
le scelte dal resto del campo.

:::example_sentence
jp: >-
  [こうして{{選|えら}}ばれなかったクリーチャーをすべて{{破壊|はかい}}する](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru)。
translation_it: >-
  Distruggi tutte le creature che non sono state scelte in questo modo.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [こうして](term:term-koushite) ➔ **Rimando procedurale**: riprende la scelta
    di {{1体|いったい}} per ciascun player.
*   {{選|えら}}ばれなかった[クリーチャー](term:term-creature) ➔ **Relativa passiva
    negativa**: non "le creature che non hanno scelto", ma "le creature che non
    sono state scelte".
*   [すべて](term:term-subete) ➔ **Totalità del gruppo rimasto**: tutte le
    creature fuori dal gruppo salvato entrano nell'effetto.
*   [{{破壊|はかい}}する](term:term-destroy) ➔ **Payoff**: il gruppo marcato da
    を viene distrutto.

#### ⚖️ Contrasto operativo: non è una seconda scelta

`{{選|えら}}ばれなかった` non chiede di scegliere di nuovo. È il passivo negativo
della scelta appena fatta: dopo che ogni player ha scelto la propria creatura,
la grammatica definisce automaticamente il gruppo opposto. [こうして](term:term-koushite)
serve proprio a chiudere quel collegamento.

#### 🧠 Gancio cognitivo

Come gancio mnemonico, leggi [こうして](term:term-koushite) come una freccia
all'indietro: "con questa procedura". Non è etimologia, ma aiuta a non trattare
la seconda frase come un effetto isolato.

## 3. {{水晶武装|すいしょうぶそう}}{{4|よん}}: una soglia, poi proprietà concesse

La seconda abilità non usa [こうして](term:term-koushite), perché non deve
richiamare una scelta appena fatta. Usa invece
{{水晶武装|すいしょうぶそう}}{{4|よん}}：...あれば...{{与|あた}}える: se nella mana
zone hai abbastanza carte a faccia in giù, il testo conferisce keyword a tutte
le tue creature.

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

#### ⚖️ Contrasto operativo: `すべてに` non è `すべてを`

Nella riga di distruzione, [すべて](term:term-subete) lavora con を: il gruppo
rimasto è l'oggetto da distruggere. Nella riga di
{{水晶武装|すいしょうぶそう}}{{4|よん}}, invece, `すべてに` marca i destinatari: le tue
creature non vengono distrutte, ricevono keyword. La differenza fra を e に
cambia completamente il tipo di azione.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  [{{各|かく}}](term:term-kaku)プレイヤーが
  [{{自身|じしん}}](term:term-jishin)の[クリーチャー](term:term-creature)を
  {{1体|いったい}}ずつ[{{選|えら}}ぶ](term:term-erabu)と、
  [こうして](term:term-koushite)[{{選|えら}}ばれなかったクリーチャーをすべて{{破壊|はかい}}する](grammar:grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru)。
translation_it: >-
  Quando ogni player sceglie una propria creatura, tutte le creature non scelte
  in questo modo vengono distrutte.
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
dalla distruzione, poi distrugge tutto ciò che non è entrato in quel gruppo. Se
[こうして](term:term-koushite) ti rimanda alla scelta precedente e le particelle
ti dicono se il gruppo è oggetto o destinatario, le due abilità smettono di
sembrare una lista di keyword e diventano una procedura leggibile.
