---
id: lesson-duel-masters-dm25-live-duel-encounters-max-crimson-blade-lord
media_id: media-duel-masters-dm25
slug: live-duel-encounters-max-crimson-blade-lord
title: Carte incontrate - ブレードグレンオー・マックス / Max, Crimson Blade Lord
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
  ブレードグレンオー・マックス: focus su ブロックされなかった e タップされている,
  con spiegazione del passivo negativo e dello stato già presente.
---

# ブレードグレンオー・マックス

:::image
src: assets/cards/live-duel/max-crimson-blade-lord.webp
alt: "ブレードグレンオー・マックス card."
caption: >-
  ブレードグレンオー・マックス。 Qui il punto da leggere bene è la
  coppia `ブロックされなかった` e `タップされている`: la prima è una negazione
  passiva, la seconda è uno stato già presente.
:::

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが{{相手|あいて}}プレイヤーを{{攻撃|こうげき}}してブロックされなかった
  {{時|とき}}、{{相手|あいて}}のタップされているパワー{{3000以下|さんぜんいか}}の
  クリーチャーを{{1体|いったい}}、{{破壊|はかい}}する。
translation_it: >-
  Quando questa creatura attacca il giocatore avversario e non viene bloccata,
  distruggi 1 creatura dell'avversario tappata con potere 3000 o inferiore.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. ブロックされなかった時

- `ブロックする` diventa `ブロックされる` quando il testo sposta il punto di
  vista sul fatto che l'attacco è stato fermato.
- `されなかった` è il passivo negativo: qui non stai leggendo `non ha
  bloccato`, ma `non è stato bloccato`.
- `{{時|とき}}` aggancia il trigger a quella condizione precisa. Il momento utile
  non è l'attacco in generale, ma il caso in cui l'attacco arriva fino in
  fondo senza blocco.

### 2. タップされているパワー3000以下のクリーチャー

- `タップされている` è lo stesso tipo di stato che in altri testi appare come
  [タップ状態](term:term-tap-state), ma qui è scritto come relativa che modifica
  direttamente `クリーチャー`.
- `されている` qui non vuol dire `sta venendo tappato` in tempo reale. Vuol
  dire che il risultato dell'azione è già presente e continua a valere nel
  momento della selezione.
- `パワー{{3000以下|さんぜんいか}}` restringe il bersaglio: prima controlli lo stato
  tapped, poi il limite di potere.
- `{{1体|いったい}}` ti ricorda che il testo conta creature, non carte in senso
  generico.

### 3. La frase intera

- La struttura è: soggetto `このクリーチャー` -> condizione di attacco ->
  condizione negativa sul blocco -> bersaglio filtrato -> risultato
  `破壊する`.
- In pratica il giapponese mette la condizione prima dell'effetto, ma la lettura
  utile è tutta nella catena di stati: `attacca`, `non viene bloccata`, `il
  bersaglio è già tappato`, `potere 3000 o meno`.
- È una buona carta per fissare che `～されなかった` e `～されている` non sono solo
  forme astratte: una descrive un evento mancato, l'altra un vero stato già in
  corso nel momento del controllo.
