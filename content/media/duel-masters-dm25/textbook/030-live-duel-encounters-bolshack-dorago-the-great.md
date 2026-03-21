---
id: lesson-duel-masters-dm25-live-duel-encounters-bolshack-dorago-the-great
media_id: media-duel-masters-dm25
slug: live-duel-encounters-bolshack-dorago-the-great
title: Carte incontrate - Bolshack Dorago the Great
order: 59
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, bolshack, dragon, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-bad-brand-first
  ]
summary: >-
  Bolshack Dorago the Great: trigger di attacco che legge il numero di
  avversari, mette in vista carte pari a quel conteggio e converte i draghi
  scelti in pressione immediata.
---

# ボルシャック・ドラゴ{{大王|だいおう}}

:::image
src: assets/cards/live-duel/bolshack-dorago-the-great.webp
alt: "Bolshack Dorago the Great card."
caption: >-
  ボルシャック・ドラゴ{{大王|だいおう}}。[{{文明|ぶんめい}}](term:term-civilization):
  {{火|か}} / {{自然|しぜん}}。[{{種族|しゅぞく}}](term:term-race):
  アーマード・ドラゴン /
  レッド・コマンド・ドラゴン。La riga centrale parte da
  「[{{攻撃|こうげき}}](term:term-attack)する[{{時|とき}}](grammar:grammar-toki)」,
  conta i giocatori avversari, mostra
  un numero di carte pari a quel conteggio, poi mette in campo quanti draghi
  vuoi e dà loro [スピードアタッカー](term:term-speed-attacker) per questo turno.
:::

## Keyword presenti sulla carta

- [スピードアタッカー](term:term-speed-attacker)
- [T・ブレイカー](term:term-t-breaker)

[スピードアタッカー](term:term-speed-attacker) e
[T・ブレイカー](term:term-t-breaker) sono già nel keyword bank. Qui il
pezzo nuovo da studiare è il conteggio che lega le carte guardate al numero di
avversari.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが[{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki)、[{{自分|じぶん}}](term:term-self)の
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から、
  [{{相手|あいて}}](term:term-opponent)の[{{人数|にんずう}}](term:term-ninzuu)と
  [{{同|おな}}じ{{枚数|まいすう}}](grammar:grammar-to-onaji-maisuu)、{{見|み}}る。
translation_it: >-
  Quando questa creatura attacca, guardi dal tuo mazzo un numero di carte pari
  al numero di avversari.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  その{{中|なか}}から、[{{好|す}}きな{{数|かず}}](term:term-suki-na-kazu)の
  ドラゴンを[{{出|だ}}し](term:term-dasu)、
  [{{残|のこ}}り](term:term-nokoru)を[タップ](term:term-tap)して
  [マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku)。
  このターン、[それら](grammar:grammar-sorera)のドラゴンに
  [スピードアタッカー](term:term-speed-attacker)を
  [{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Tra quelle carte, metti in campo quanti draghi vuoi, metti il resto tappato
  nella mana zone e, per questo turno, dai Speed Attacker a quei draghi.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーが[{{攻撃|こうげき}}](term:term-attack)する[{{時|とき}}](grammar:grammar-toki)

- [{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki) è un trigger di timing classico: l'effetto
  parte nel momento in cui questa creatura attacca.
- `このクリーチャーが` tiene fisso il soggetto del trigger. Non sta parlando
  di qualunque creatura in campo, ma proprio di questa carta.

### 2. [{{相手|あいて}}](term:term-opponent)の[{{人数|にんずう}}](term:term-ninzuu)と[{{同|おな}}じ{{枚数|まいすう}}](grammar:grammar-to-onaji-maisuu)

- `[{{相手|あいて}}](term:term-opponent)の[{{人数|にんずう}}](term:term-ninzuu)` prende il numero di avversari presenti in
  quel momento.
- `[{{同|おな}}じ{{枚数|まいすう}}](grammar:grammar-to-onaji-maisuu)` lega la quantità delle carte viste a quel numero:
  non una quantità libera, ma una quantità identica al conteggio dei player
  avversari.
- Il punto importante è il legame di misura, non il totale delle carte in sé:
  prima conti gli avversari, poi leggi quante carte guardare.

### 3. その{{中|なか}}から、[{{好|す}}きな{{数|かず}}](term:term-suki-na-kazu)のドラゴンを[{{出|だ}}し](term:term-dasu)

- `その{{中|なか}}から` riprende il gruppo appena visto, quindi la scelta avviene
  solo dentro quel sottoinsieme.
- [{{好|す}}きな{{数|かず}}](term:term-suki-na-kazu) è già un chunk utile altrove: qui non dice
  "tante carte", ma "quante ne vuoi tu".
- `ドラゴンを[{{出|だ}}し](term:term-dasu)` seleziona i draghi scelti come risultato positivo del
  filtro.

### 4. [{{残|のこ}}り](term:term-nokoru)を[タップ](term:term-tap)して[マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku)

- `[{{残|のこ}}り](term:term-nokoru)` è ciò che non hai scelto nel passo precedente.
- `[タップ](term:term-tap)して[マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku)`
  descrive una destinazione con stato finale preciso: le carte non scartate
  vanno in mana tapped.
- Il giapponese tiene separati scelta e destinazione: prima scegli i draghi,
  poi il resto viene spostato.

### 5. このターン、[それら](grammar:grammar-sorera)のドラゴンに[スピードアタッカー](term:term-speed-attacker)を[{{与|あた}}える](term:term-ataeru)

- `このターン` limita il bonus al turno corrente; non crea un effetto
  permanente.
- `[それら](grammar:grammar-sorera)` riprende esattamente i draghi appena messi
  in campo.
- `[スピードアタッカー](term:term-speed-attacker)を[{{与|あた}}える](term:term-ataeru)` dà a quei draghi una capacità offensiva
  immediata, quindi il payoff del testo è sia di risorse sia di pressione.
