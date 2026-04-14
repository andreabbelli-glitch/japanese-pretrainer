---
id: lesson-duel-masters-dm25-live-duel-encounters-diamond-sword
media_id: media-duel-masters-dm25
slug: live-duel-encounters-diamond-sword
title: Carte incontrate - Diamond Sword
order: 87
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [
    live-duel,
    card-encounter,
    spell,
    blocker,
    attack-restriction,
    invalidation,
    duel-masters
  ]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Diamond Sword: perdere blocker, leggere bene le restrizioni d'attacco che la
  spell annulla e fissare il valore tecnico di mukou ni naru.
---

# ダイヤモンド・ソード

:::image
src: assets/cards/live-duel/diamond-sword.webp
alt: "Diamond Sword card."
caption: >-
  ダイヤモンド・ソード。 Spell Light che per questo turno fa perdere
  `ブロッカー`, lascia attaccare il giocatore avversario e annulla gli effetti
  non-spell che vietano quell'attacco. La chiusura
  `ただし...{{可能|かのう}}にならない`
  evita però una lettura troppo larga: la spell non apre l'attacco alle
  creature.
:::

## Etichette già note nella frase

- [ブロッカー](term:term-blocker)

Qui non ci sono keyword nuove da banca effetti. Il punto utile è leggere bene
come la spell parla di altri effetti e ne limita il campo.

## Effetti da leggere

:::example_sentence
jp: >-
  このターン、{{自分|じぶん}}のクリーチャーはすべて「ブロッカー」を
  {{失|うしな}}い、{{相手|あいて}}プレイヤーを
  [{{攻撃|こうげき}}](term:term-attack)できる。
translation_it: >-
  In questo turno, tutte le tue creature perdono Blocker e possono attaccare
  il giocatore avversario.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{呪文|じゅもん}}](term:term-spell){{以外|いがい}}で「{{相手|あいて}}プレイヤーを
  [{{攻撃|こうげき}}](term:term-attack)できない」または「このクリーチャーは
  [{{攻撃|こうげき}}](term:term-attack)できない」
  [{{効果|こうか}}](term:term-effect)があった[{{時|とき}}](grammar:grammar-toki)、
  その[{{効果|こうか}}](term:term-effect)は
  [{{無効|むこう}}](term:term-mukou)になる。
translation_it: >-
  Se c'era un effetto non proveniente da uno spell che diceva "non può
  attaccare il giocatore avversario" oppure "questa creatura non può
  attaccare", quell'effetto diventa nullo.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  ただし、この[{{呪文|じゅもん}}](term:term-spell)によって
  クリーチャーを[{{攻撃|こうげき}}](term:term-attack)することは
  {{可能|かのう}}にならない。
translation_it: >-
  Tuttavia, questa spell non rende possibile attaccare le creature.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このターン、自分のクリーチャーはすべて「ブロッカー」を失い

- `このターン` fissa una finestra temporanea: la modifica vale solo per il
  turno attuale.
- `{{自分|じぶん}}のクリーチャーはすべて` allarga l'effetto a tutto il tuo lato
  del campo, non a una creatura scelta.
- `ブロッカーを{{失|うしな}}い` non vuol dire che la creatura lascia il campo:
  perde quella keyword difensiva per la durata indicata dal turno.

### 2. 相手プレイヤーを攻撃できる

- `{{相手|あいて}}プレイヤーを{{攻撃|こうげき}}できる` specifica proprio il
  bersaglio giocatore.
- Qui la spell non dice genericamente `può attaccare tutto`: sblocca il
  passaggio verso il player avversario anche per creature che normalmente non
  potrebbero farlo.
- Per questo la frase successiva deve essere letta insieme a questa: la carta
  chiarisce quali restrizioni vengono spente e quali no.

### 3. 呪文以外で...効果があった時、その効果は無効になる

- `{{呪文|じゅもん}}{{以外|いがい}}で` non descrive il contenuto dell'effetto, ma
  la sua provenienza: conta che il blocco proibitivo non venga da uno spell.
- Le due citazioni
  `「{{相手|あいて}}プレイヤーを{{攻撃|こうげき}}できない」` e
  `「このクリーチャーは{{攻撃|こうげき}}できない」` sono collegate da
  `または`, quindi basta uno dei due tipi di divieto.
- `その{{効果|こうか}}は[{{無効|むこう}}](term:term-mukou)になる` è
  metalinguaggio tecnico: non distrugge la carta sorgente, ma spegne il pezzo
  di testo che stava impedendo l'attacco.

### 4. ただし、この呪文によってクリーチャーを攻撃することは可能にならない

- `ただし` corregge subito una lettura troppo ampia del testo precedente.
- `この{{呪文|じゅもん}}によって` vuol dire `grazie a questa spell`, cioè per
  effetto di Diamond Sword stessa.
- `クリーチャーを{{攻撃|こうげき}}することは{{可能|かのう}}にならない`
  chiude la finestra: la spell rimuove i divieti contro l'attacco al giocatore,
  ma non trasforma la creatura in un attaccante libero contro qualunque
  bersaglio.

## Lessico utile in questa carta

- [{{無効|むこう}}](term:term-mukou) è il verbo tecnico da fissare: un effetto
  può esistere come testo, ma non applicarsi più.
- `{{失|うしな}}う` qui vale come `perdere un'abilità`, non come `smarrire`
  qualcosa in senso narrativo.
- `{{相手|あいて}}プレイヤーを{{攻撃|こうげき}}できない{{効果|こうか}}` è un
  chunk utile perché la carta non parla direttamente dell'attacco: parla degli
  effetti che lo vietano.
