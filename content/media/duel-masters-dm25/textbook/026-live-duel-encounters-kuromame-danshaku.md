---
id: lesson-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
media_id: media-duel-masters-dm25
slug: live-duel-encounters-kuromame-danshaku
title: Carte incontrate - Kuromame Danshaku
order: 55
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, twinpact, gransect, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-kenzan-no-sabaki
  ]
summary: >-
  Kuromame Danshaku: filtro sulle abilita che iniziano con "questa creatura
  entra in gioco" e spell side che trasforma il topdeck in mana con recupero
  opzionale.
---

# [{{黒豆|くろまめ}}だんしゃく](term:term-kuromame-danshaku) / {{白米|はくまい}}{{男|だん}}しゃく

:::image
src: assets/cards/live-duel/kuromame-danshaku.webp
alt: "Kuromame Danshaku / Hakumai Danshaku card."
caption: >-
  [{{黒豆|くろまめ}}だんしゃく](term:term-kuromame-danshaku) /
  {{白米|はくまい}}{{男|だん}}しゃく。
  Twinpact naturale. Razze del lato creatura: グランセクト / スペシャルズ.
  Riga centrale: filtra le abilita avversarie che iniziano con
  「このクリーチャーが{{出|で}}た{{時|とき}}」; sotto,
  {{白米|はくまい}}{{男|だん}}しゃく mette in mana la prima carta del mazzo e poi
  puo recuperare una carta dalla mana.
:::

## Keyword presenti sulla carta

- [T・ブレイカー](term:term-t-breaker)

`T・ブレイカー` e gia nella keyword bank. Qui vale la pena di concentrarsi sul
filtro metalinguistico `～で始まる能力` e sulla mini-sequenza dello spell side.

## Effetti da leggere

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の、「[バトルゾーン](term:term-battle-zone)に
  [このクリーチャーが{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)」で
  [{{始|はじ}}まる](grammar:grammar-de-hajimaru)
  [{{能力|のうりょく}}](term:term-ability)を{{持|も}}つ
  [クリーチャー](term:term-creature)が
  [バトルゾーン](term:term-battle-zone)に
  [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、その
  クリーチャーを[マナゾーン](term:term-mana-zone)に
  [{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando una creatura avversaria con un'abilita che comincia con "quando questa
  creatura entra" entra nel battle zone, metti quella creatura nel mana zone.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{自分|じぶん}}](term:term-self)の
  [{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}](term:term-top-card-of-deck)を
  [マナゾーン](term:term-mana-zone)に[{{置|お}}く](term:term-oku)。
  [その{{後|あと}}](grammar:grammar-sonoato)、カードを{{1枚|いちまい}}、
  {{自分|じぶん}}の[マナゾーン](term:term-mana-zone)から
  [{{手札|てふだ}}](term:term-hand)に{{戻|もど}}してもよい。
translation_it: >-
  Metti nel mana zone la prima carta del tuo mazzo. Poi puoi restituire una
  carta dal tuo mana zone alla mano.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 「このクリーチャーが出た時」で始まる能力

- Il pezzo tra virgolette non descrive genericamente un "effetto di ingresso":
  cita proprio l'apertura testuale che la carta sta cercando.
- [～で{{始|はじ}}まる](grammar:grammar-de-hajimaru) dice quindi `che comincia
  con questa formula`, non `che assomiglia piu o meno a questa idea`.
- Quando leggi un filtro cosi, la domanda giusta non e "che cosa fa
  l'abilita?", ma "con quali parole si apre l'abilita?".

### 2. 能力を持つクリーチャーがバトルゾーンに出た時

- `{{能力|のうりょく}}を持つ` modifica `クリーチャー`: prima costruisci il tipo
  di creatura bersaglio, poi leggi l'evento `が出た時`.
- Il soggetto di `が出た時` resta quindi la creatura appena filtrata, non la
  sua abilita.
- `そのクリーチャー` nella seconda meta della frase richiude lo stesso
  referente: la carta appena entrata e la stessa carta che finira nel mana
  zone.

### 3. そのクリーチャーをマナゾーンに置く

- [{{置|お}}く](term:term-oku) e il verbo neutro di spostamento; quello che
  conta davvero e la destinazione indicata dopo.
- Qui la destinazione e [マナゾーン](term:term-mana-zone), quindi il payoff non
  e distruggere o rimbalzare, ma spostare la creatura nella tua risorsa.
- In lettura pratica conviene dividere la frase in due blocchi: `quale
  creatura passa il filtro` e `dove finisce quella creatura`.

### 4. 自分の山札の上から1枚目をマナゾーンに置く。その後…

- Lo spell side e molto piu lineare ma utile: prima prendi la prima carta del
  mazzo e la converti in mana.
- [その{{後|あと}}](grammar:grammar-sonoato) avvisa che la risoluzione non e
  finita con il primo spostamento.
- `{{戻|もど}}してもよい` rende opzionale il secondo passo: dopo aver aumentato
  la mana, puoi anche recuperare una carta dalla mana alla mano.
- Il giapponese costruisce quindi una sequenza pulita: `mana subito`, `pickup
  facoltativo dopo`.

## Lessico utile in questa carta

- [{{能力|のうりょく}}](term:term-ability) e un sostantivo molto ricorrente: quando
  compare, il testo sta parlando del blocco di effetto che una carta possiede.
- `グランセクト` e la razza principale del lato creatura: in futuro puo
  ricomparire come filtro tribale nelle carte natura.
- `スペシャルズ` e una seconda etichetta di razza piu verticale; qui basta
  riconoscerla come nome di gruppo, non come parola di lessico generale.
