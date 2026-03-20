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
  ボルシャック・ドラゴ{{大王|だいおう}}。{{文明|ぶんめい}}: {{火|か}} /
  {{自然|しぜん}}。{{種族|しゅぞく}}: アーマード・ドラゴン /
  レッド・コマンド・ドラゴン。La riga centrale parte da
  「{{攻撃|こうげき}}する{{時|とき}}」, conta i giocatori avversari, mostra
  un numero di carte pari a quel conteggio, poi mette in campo quanti draghi
  vuoi e dà loro [スピードアタッカー](term:term-speed-attacker) per questo turno.
:::

## Keyword presenti sulla carta

- [スピードアタッカー](term:term-speed-attacker)
- [T・ブレイカー](term:term-t-breaker)

`スピードアタッカー` e `T・ブレイカー` sono già nel keyword bank. Qui il
pezzo nuovo da studiare è il conteggio che lega le carte guardate al numero di
avversari.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが{{攻撃|こうげき}}する{{時|とき}}、{{自分|じぶん}}の
  {{山札|やまふだ}}の{{上|うえ}}から、{{相手|あいて}}の{{人数|にんずう}}と
  {{同|おな}}じ{{枚数|まいすう}}、{{見|み}}る。
translation_it: >-
  Quando questa creatura attacca, guardi dal tuo mazzo un numero di carte pari
  al numero di avversari.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  その{{中|なか}}から、{{好|す}}きな{{数|かず}}のドラゴンを{{出|だ}}し、
  {{残|のこ}}りを[タップ](term:term-tap)して[マナゾーン](term:term-mana-zone)に
  {{置|お}}く。このターン、それらのドラゴンに
  [スピードアタッカー](term:term-speed-attacker)を{{与|あた}}える。
translation_it: >-
  Tra quelle carte, metti in campo quanti draghi vuoi, metti il resto tappato
  nella mana zone e, per questo turno, dai Speed Attacker a quei draghi.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーが{{攻撃|こうげき}}する{{時|とき}}

- [{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki) è un trigger di timing classico: l'effetto
  parte nel momento in cui questa creatura attacca.
- `このクリーチャーが` tiene fisso il soggetto del trigger. Non sta parlando
  di qualunque creatura in campo, ma proprio di questa carta.

### 2. {{相手|あいて}}の{{人数|にんずう}}と{{同|おな}}じ{{枚数|まいすう}}

- `{{相手|あいて}}の{{人数|にんずう}}` prende il numero di avversari presenti in
  quel momento.
- `{{同|おな}}じ{{枚数|まいすう}}` lega la quantità delle carte viste a quel numero:
  non una quantità libera, ma una quantità identica al conteggio dei player
  avversari.
- Il punto importante è il legame di misura, non il totale delle carte in sé:
  prima conti gli avversari, poi leggi quante carte guardare.

### 3. その{{中|なか}}から、{{好|す}}きな{{数|かず}}のドラゴンを{{出|だ}}し

- `その{{中|なか}}から` riprende il gruppo appena visto, quindi la scelta avviene
  solo dentro quel sottoinsieme.
- [好きな数](term:term-suki-na-kazu) è già un chunk utile altrove: qui non dice
  "tante carte", ma "quante ne vuoi tu".
- `ドラゴンを{{出|だ}}し` seleziona i draghi scelti come risultato positivo del
  filtro.

### 4. {{残|のこ}}りをタップしてマナゾーンに{{置|お}}く

- `{{残|のこ}}り` è ciò che non hai scelto nel passo precedente.
- `[タップ](term:term-tap)して[マナゾーン](term:term-mana-zone)に{{置|お}}く`
  descrive una destinazione con stato finale preciso: le carte non scartate
  vanno in mana tapped.
- Il giapponese tiene separati scelta e destinazione: prima scegli i draghi,
  poi il resto viene spostato.

### 5. このターン、それらのドラゴンにスピードアタッカーを{{与|あた}}える

- `このターン` limita il bonus al turno corrente; non crea un effetto
  permanente.
- `[それら](grammar:grammar-sorera)` riprende esattamente i draghi appena messi
  in campo.
- `スピードアタッカーを{{与|あた}}える` dà a quei draghi una capacità offensiva
  immediata, quindi il payoff del testo è sia di risorse sia di pressione.
