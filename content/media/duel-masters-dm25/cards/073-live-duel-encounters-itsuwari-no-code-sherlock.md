---
id: cards-duel-masters-dm25-live-duel-encounters-itsuwari-no-code-sherlock
media_id: media-duel-masters-dm25
slug: live-duel-encounters-itsuwari-no-code-sherlock
title: Carte incontrate in partita 51 - シャーロック e こうして
order: 101
segment_ref: live-duel-encounters
---

:::term
id: term-koushite
lemma: こうして
reading: こうして
romaji: koushite
meaning_it: così / in questo modo / tramite questa procedura
pos: adverb
aliases: [こうして, koushite]
notes_it: >-
  In giapponese generale `こうして` riprende il modo o la procedura appena
  mostrata: "così", "in questo modo". Nel rules text di Duel Masters è molto
  utile quando una frase crea un gruppo e quella successiva deve riferirsi
  proprio a quel gruppo. Qui rimanda alla scelta di una creatura per ciascun
  player.
level_hint: n4
:::

:::grammar
id: grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru
pattern: こうして選ばれなかったクリーチャーをすべて破壊する。
title: Distruggi tutte le creature non scelte in questo modo
reading: こうしてえらばれなかったくりーちゃーをすべてはかいする
meaning_it: distruggere tutte le creature che non sono state scelte in questo modo
aliases:
  [
    こうして選ばれなかったクリーチャーをすべて破壊する,
    選ばれなかったクリーチャーをすべて破壊する,
    こうして選ばれなかったクリーチャー
  ]
notes_it: >-
  Il chunk unisce tre pezzi. `こうして` richiama la scelta appena fatta;
  `{{選|えら}}ばれなかった` è passivo negativo e modifica `クリーチャー`; `すべて` chiude
  l'intero gruppo come oggetto di `{{破壊|はかい}}する`. La frase non chiede una
  nuova scelta: distrugge tutto ciò che è rimasto fuori dalla scelta precedente.
level_hint: n3
:::

:::card
id: card-koushite-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-itsuwari-no-code-sherlock
entry_type: term
entry_id: term-koushite
card_type: recognition
front: こうして
back: così / in questo modo / tramite questa procedura
example_jp: >-
  [{{各|かく}}](term:term-kaku)プレイヤーは
  [{{自身|じしん}}](term:term-jishin)の[クリーチャー](term:term-creature)を
  {{1体|いったい}}ずつ[{{選|えら}}ぶ](term:term-erabu)。
  こうして{{選|えら}}ばれなかった[クリーチャー](term:term-creature)をすべて
  [{{破壊|はかい}}する](term:term-destroy)。
example_it: >-
  Ogni player sceglie una propria creatura. Tutte le creature che non sono state
  scelte in questo modo vengono distrutte.
notes_it: >-
  `こうして` non introduce un effetto separato: rimanda alla procedura appena
  descritta. In シャーロック, la procedura è la scelta di una creatura per
  ciascun player; la frase successiva usa quel risultato per capire quali
  creature restano fuori e vengono distrutte.
tags: [live-duel, term, procedure, reference, scope]
:::

:::card
id: card-koushite-erabarenakatta-creature-wo-subete-hakaisuru-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-itsuwari-no-code-sherlock
entry_type: grammar
entry_id: grammar-koushite-erabarenakatta-creature-wo-subete-hakaisuru
card_type: concept
front: 'こうして{{選|えら}}ばれなかったクリーチャーをすべて{{破壊|はかい}}する。'
back: distruggi tutte le creature che non sono state scelte in questo modo
example_jp: >-
  [{{各|かく}}](term:term-kaku)プレイヤーは
  [{{自身|じしん}}](term:term-jishin)の[クリーチャー](term:term-creature)を
  {{1体|いったい}}ずつ[{{選|えら}}ぶ](term:term-erabu)。
  こうして{{選|えら}}ばれなかった[クリーチャー](term:term-creature)をすべて
  [{{破壊|はかい}}する](term:term-destroy)。
example_it: >-
  Ogni player sceglie una propria creatura. Tutte le creature che non sono state
  scelte in questo modo vengono distrutte.
notes_it: >-
  `{{選|えら}}ばれなかった` è passivo negativo: descrive le creature che non hanno
  ricevuto la scelta, non creature che non hanno scelto qualcosa. `すべて` prende
  tutto quel gruppo e を lo mette come oggetto di
  `{{破壊|はかい}}する`.
tags: [live-duel, grammar, passive, destruction, scope]
:::
