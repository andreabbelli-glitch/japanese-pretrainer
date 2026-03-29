---
id: cards-duel-masters-dm25-live-duel-encounters-do-sumonma
media_id: media-duel-masters-dm25
slug: live-duel-encounters-do-sumonma
title: Carte incontrate in partita 26 - Do:Sumonma, のうち, いずれか e 1つ
order: 75
segment_ref: live-duel-encounters
---

:::term
id: term-do-sumonma
lemma: ド:スモンマー
reading: ど すもんまー
romaji: do sumonmaa
meaning_it: Do:Sumonma / Noir Abyss che sceglie una delle opzioni seguenti quando entra
pos: proper-noun
aliases: [ド:スモンマー, Do:Sumonma, do sumonma]
notes_it: >-
  E` il nome proprio della carta. La parte da fissare non e` solo il body con
  `ブロッカー`, ma soprattutto il comando
  `{{次|つぎ}}のうちいずれか{{1|ひと}}つを{{選|えら}}ぶ`, che ti insegna come
  il rules text delimita una lista e chiede una sola scelta.
level_hint: custom
:::

:::term
id: term-abyss-mekureido
lemma: アビス・メクレイド
reading: あびす めくれいど
romaji: abisu mekureido
meaning_it: keyword che guarda le prime 3 carte e ti lascia usare gratis un Abyss entro il costo indicato
pos: noun
aliases:
  [アビス・メクレイド, アビス・メクレイド8, abisu mekureido, abyss mekureido]
notes_it: >-
  Il numero che segue la keyword fissa il costo massimo dell'Abyss che puoi
  usare. In `アビス・メクレイド{{8|はち}}`, guardi le prime
  `{{3枚|さんまい}}`, puoi usare un Abyss di costo `{{8以下|はちいか}}` senza
  pagarlo e poi rimetti il resto in fondo al mazzo.
level_hint: custom
:::

:::grammar
id: grammar-no-uchi
pattern: ～のうち
title: Fra / tra / all'interno di questo gruppo
reading: のうち
meaning_it: fra / tra / dentro il gruppo indicato
aliases: [のうち, 次のうち]
notes_it: >-
  `のうち` seleziona un sottoinsieme o un elemento da un gruppo gia`
  delimitato. Nel rules text e` molto utile perche` trasforma un elenco o un
  set nominato in un bacino chiuso da cui devi prendere qualcosa.
level_hint: n4
:::

:::grammar
id: grammar-izureka
pattern: いずれか
title: Uno qualsiasi tra le alternative
reading: いずれか
meaning_it: uno dei / uno qualsiasi fra le opzioni
aliases: [いずれか]
notes_it: >-
  `いずれか` e` una parola di scelta formale. In giapponese da rules text non
  lascia l'idea di `forse`: dice che devi prendere uno dei candidati gia`
  nominati, senza cumularli tutti.
level_hint: n3
:::

:::card
id: card-do-sumonma-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-do-sumonma
entry_type: term
entry_id: term-do-sumonma
card_type: recognition
front: 'ド:スモンマー'
back: 'Do:Sumonma / Noir Abyss che ti fa scegliere una sola opzione fra quelle seguenti'
example_jp: >-
  ド:スモンマーは、このクリーチャーが{{出|で}}た{{時|とき}}
  {{次|つぎ}}のうちいずれか{{1|ひと}}つを{{選|えら}}ぶ。
example_it: >-
  Do:Sumonma, quando entra, ti fa scegliere una sola delle opzioni seguenti.
notes_it: >-
  Il nome va collegato subito al suo chunk distintivo di scelta: `fra le
  opzioni che seguono, prendine una`.
tags: [live-duel, proper-name, noir-abyss, choice]
:::

:::card
id: card-abyss-mekureido-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-do-sumonma
entry_type: term
entry_id: term-abyss-mekureido
card_type: recognition
front: アビス・メクレイド
back: Abyss Mekureido / guarda 3 carte e usa gratis un Abyss entro il costo indicato
example_jp: >-
  アビス・メクレイド{{8|はち}}は、{{山札|やまふだ}}の{{上|うえ}}から
  {{3枚|さんまい}}{{見|み}}て、その{{中|なか}}からコスト{{8以下|はちいか}}の
  アビスを{{1枚|いちまい}}{{使|つか}}える。
example_it: >-
  Abyss Mekureido 8 guarda le prime 3 carte e ti lascia usare 1 Abyss di costo
  8 o meno.
notes_it: >-
  Il numero non e` decorativo: fissa il tetto di costo dell'Abyss che puoi
  usare senza pagarlo.
tags: [live-duel, keyword, abyss]
:::

:::card
id: card-tsugi-no-uchi-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-do-sumonma
entry_type: grammar
entry_id: grammar-no-uchi
card_type: concept
front: '{{次|つぎ}}のうち'
back: fra le seguenti opzioni / tra quanto segue
example_jp: >-
  `{{次|つぎ}}のうち`があるから、すぐ{{下|した}}の{{選択肢|せん.たく.し}}が
  {{選|えら}}ぶ{{対象|たいしょう}}になる。
example_it: >-
  Se leggi `fra le seguenti opzioni`, le righe subito sotto diventano il set da
  cui scegliere.
notes_it: >-
  Qui non basta `{{次|つぎ}}の` da sola. Il valore nuovo nasce da `のうち`,
  che chiude il gruppo e lo rende il bacino da cui prendere una sola opzione.
tags: [live-duel, grammar, options, scope]
:::

:::card
id: card-izureka-hitotsu-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-do-sumonma
entry_type: grammar
entry_id: grammar-izureka
card_type: concept
front: 'いずれか{{1|ひと}}つ'
back: uno dei candidati / una sola delle opzioni
example_jp: >-
  `いずれか{{1|ひと}}つ`は、{{候補|こうほ}}の{{中|なか}}から
  {{1個|いっこ}}だけ{{選|えら}}ぶことを{{示|しめ}}す。
example_it: >-
  `Uno dei candidati` indica che devi prenderne soltanto uno dal gruppo.
notes_it: >-
  Qui `いずれか` porta l'idea di `uno qualsiasi fra le alternative`, mentre
  `{{1|ひと}}つ` fissa la quantita`. La flashcard sta sul blocco intermedio
  perche` e` li` che il valore di scelta singola diventa davvero leggibile.
tags: [live-duel, grammar, options, quantity]
:::

:::card
id: card-choose-one-of-the-following-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-do-sumonma
entry_type: grammar
entry_id: grammar-no-uchi
card_type: concept
front: '{{次|つぎ}}のうちいずれか{{1|ひと}}つを{{選|えら}}ぶ'
back: scegli una delle seguenti opzioni
example_jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、
  {{次|つぎ}}のうちいずれか{{1|ひと}}つを{{選|えら}}ぶ。
example_it: >-
  Quando questa creatura entra, scegli una delle opzioni seguenti.
notes_it: >-
  Questa e` la card-sintesi del chunk completo. `{{次|つぎ}}の` punta in avanti,
  `のうち` delimita il gruppo, `いずれか{{1|ひと}}つ` impone la scelta unica e
  [{{選|えら}}ぶ](term:term-erabu) chiude l'istruzione operativa.
tags: [live-duel, grammar, options, selection]
:::
