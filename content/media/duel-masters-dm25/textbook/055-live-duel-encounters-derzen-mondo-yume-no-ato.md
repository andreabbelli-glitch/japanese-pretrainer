---
id: lesson-duel-masters-dm25-live-duel-encounters-derzen-mondo-yume-no-ato
media_id: media-duel-masters-dm25
slug: live-duel-encounters-derzen-mondo-yume-no-ato
title: Carte incontrate - der`Zen Mondo / ♪必殺で つわものどもが夢の跡
order: 83
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, twinpact, deck-out, extra-turn, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-crash-hadou,
    lesson-duel-masters-dm25-live-duel-encounters-magic-circle-of-the-wicked-heart
  ]
summary: >-
  der Zen Mondo: focus su nokori no game chuu, sulla frase che annulla la
  sconfitta da deck-out e sul controllo che aggiunge un turno extra.
---

# der`Zen Mondo / ♪必殺で つわものどもが夢の跡

:::image
src: assets/cards/live-duel/derzen-mondo-yume-no-ato.webp
alt: "der`Zen Mondo / With a Signature Move, Strongest are the Traces of a Dream card."
caption: >-
  der`Zen Mondo / ♪{{必殺|ひっさつ}}で つわものどもが{{夢|ゆめ}}の{{跡|あと}}。
  Twinpact con lato creatura semplice e lato spell molto didattico: prima apre
  una durata con `{{残|のこ}}りのゲーム{{中|ちゅう}}`, poi riscrive la sconfitta da
  mazzo vuoto e infine collega quel controllo a un turno extra.
:::

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーが[バトルゾーン](term:term-battle-zone)に
  [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  [{{相手|あいて}}](term:term-opponent)のエレメントを{{1|ひと}}つ
  [{{選|えら}}び](term:term-erabu)、[{{持|も}}ち{{主|ぬし}}](term:term-mochinushi)の
  [{{手札|てふだ}}](term:term-hand)に[{{戻|もど}}す](term:term-modosu)。
translation_it: >-
  Quando questa creatura entra nel battle zone, scegli 1 elemento avversario e
  rimettilo nella mano del suo proprietario.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{残|のこ}}りのゲーム{{中|ちゅう}}](grammar:grammar-nokori-no-game-chuu)、
  [{{自分|じぶん}}](term:term-self)の[{{山札|やまふだ}}](term:term-deck)にカードが
  なくなっても、[{{自分|じぶん}}](term:term-self)はゲームに
  [{{負|ま}}けない](grammar:grammar-deck-empty-demo-makenai)。
translation_it: >-
  Per il resto della partita, anche se nel tuo mazzo non restano carte, tu non
  perdi la partita.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  カードを{{5枚|ごまい}}[{{引|ひ}}く](term:term-hiku)。[その{{後|あと}}](grammar:grammar-sonoato)、
  [{{自分|じぶん}}](term:term-self)の[{{山札|やまふだ}}](term:term-deck)にカードが
  [なければ](grammar:grammar-nakereba)、このターンの
  [{{後|あと}}](grammar:grammar-no-ato-ni)に[{{自分|じぶん}}](term:term-self)の
  [ターンを{{追加|ついか}}する](term:term-add-turn)。
translation_it: >-
  Pesca 5 carte. Poi, se il tuo mazzo è rimasto senza carte, aggiungi un tuo
  turno dopo questo turno.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. 残りのゲーム中

- [{{残|のこ}}りのゲーム{{中|ちゅう}}](grammar:grammar-nokori-no-game-chuu) apre una
  durata che vale da adesso fino alla fine della partita.
- `{{残|のこ}}り` non è un dettaglio decorativo: dice `quello che resta da qui
  in avanti`.
- Quindi la regola successiva non vale solo in questo turno o in questa
  risoluzione, ma per tutto il resto del match.

### 2. 山札にカードがなくなっても、自分はゲームに負けない

- Il nucleo del primo blocco è `カードがなくなる`: il mazzo si esaurisce.
- `～ても` è concessivo: `anche se succede questo`.
- La parte decisiva è
  [{{自分|じぶん}}](term:term-self)はゲームに[{{負|ま}}けない](grammar:grammar-deck-empty-demo-makenai)。
  Il testo sta negando proprio l'esito normale del deck-out.
- Il chunk intero va quindi letto come una regola riscritta: anche a mazzo
  vuoto, non perdi.

### 3. カードを5枚引く。その後...

- Prima il testo ti fa pescare `{{5枚|ごまい}}`, poi
  [その{{後|あと}}](grammar:grammar-sonoato) controlla lo stato del mazzo.
- Se dopo quella pescata non restano carte,
  [なければ](grammar:grammar-nakereba) accende il payoff finale:
  [ターンを{{追加|ついか}}する](term:term-add-turn)。
- `このターンの[{{後|あと}}](grammar:grammar-no-ato-ni)` è lo stesso tipo di
  aggancio temporale visto su Crash Hadou: il turno extra entra subito dopo il
  turno attuale.

## Lessico utile in questa carta

- [{{残|のこ}}りのゲーム{{中|ちゅう}}](grammar:grammar-nokori-no-game-chuu) è il
  chunk da fissare quando una carta impone una durata che copre tutto il resto
  della partita.
- [{{自分|じぶん}}の{{山札|やまふだ}}にカードがなくなっても、自分はゲームに{{負|ま}}けない](grammar:grammar-deck-empty-demo-makenai)
  è il vero blocco da memorizzare: deck-out + concessione + esito negato.
- [ターンを{{追加|ついか}}する](term:term-add-turn) qui ritorna in una forma nuova:
  non nasce da una distruzione, ma dal fatto di aver svuotato il mazzo.
