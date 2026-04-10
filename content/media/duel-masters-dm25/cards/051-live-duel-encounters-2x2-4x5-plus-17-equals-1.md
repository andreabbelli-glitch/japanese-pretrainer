---
id: cards-duel-masters-dm25-live-duel-encounters-2x2-4x5-plus-17-equals-1
media_id: media-duel-masters-dm25
slug: live-duel-encounters-2x2-4x5-plus-17-equals-1
title: Carte incontrate in partita 30 - ♪2x2-4x5+17=1 e しか
order: 79
segment_ref: live-duel-encounters
---

:::term
id: term-ichido
lemma: 一度
reading: いちど
romaji: ichido
meaning_it: una volta / una singola volta
pos: adverb
aliases: [一度, いちど, ichido]
notes_it: >-
  In giapponese generale `{{一度|いちど}}` vuol dire `una volta`. Da sola può
  essere neutra, ma nel rules text diventa molto utile quando entra in chunk
  che fissano limiti o occorrenze. In `{{一度|いちど}}しか...ない`, non dice
  soltanto `una volta`: diventa il tetto massimo oltre cui l'azione non può
  andare.
level_hint: n4
:::

:::grammar
id: grammar-shika
pattern: ～しか ... ない
title: Nient'altro che / non più di / solo
reading: しか
meaning_it: solo / nient'altro che / non più di
aliases: [しか, ～しかない, 一度しか]
notes_it: >-
  `しか` non si legge mai bene da sola: costruisce il suo senso insieme alla
  negazione che arriva più avanti. In giapponese generale `Xしか...ない`
  significa che, fuori da `X`, non resta nient'altro di valido. Nel rules text
  di Duel Masters questa struttura è ottima per fissare un tetto o un insieme
  minimo-massimo: in `{{一度|いちど}}しかクリーチャーで{{攻撃|こうげき}}できない`,
  il testo dice che l'avversario non può superare un solo attacco di creatura.
level_hint: n3
:::

:::card
id: card-ichido-shika-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-2x2-4x5-plus-17-equals-1
entry_type: grammar
entry_id: grammar-shika
card_type: concept
front: '{{一度|いちど}}しか'
back: non più di una volta / solo una volta
example_jp: >-
  `{{一度|いちど}}しか`だけでは{{意味|いみ}}がまだ{{閉|と}}じず、
  {{後|うし}}ろの`{{攻撃|こうげき}}できない`まで{{読|よ}}んで、
  はじめて`{{一度|いちど}}より{{多|おお}}くはだめ`という{{意味|いみ}}になる。
example_it: >-
  `Ichido shika` da solo non chiude ancora il senso: solo leggendo fino a
  `non può attaccare` capisci che il limite è `non più di una volta`.
notes_it: >-
  Questo è il punto importante di `しか`: non funziona come un avverbio positivo
  autonomo. Appena lo vedi, devi aspettare la negazione successiva. Qui
  `{{一度|いちど}}しか` significa letteralmente `fuori da una volta, niente`, e
  in pratica si legge come `non più di una volta`.
tags: [live-duel, grammar, limit, quantity]
:::

:::card
id: card-shika-creature-attack-once-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-2x2-4x5-plus-17-equals-1
entry_type: grammar
entry_id: grammar-shika
card_type: concept
front: >-
  {{一度|いちど}}しかクリーチャーで{{攻撃|こうげき}}できない
back: non può attaccare con creature più di una volta
example_jp: >-
  [{{次|つぎ}}の](grammar:grammar-tsugi-no)[{{相手|あいて}}](term:term-opponent)の
  ターン{{中|ちゅう}}、[{{相手|あいて}}](term:term-opponent)は
  {{一度|いちど}}しか[クリーチャー](term:term-creature)で
  [{{攻撃|こうげき}}](term:term-attack)できない。
example_it: >-
  Durante il prossimo turno dell'avversario, l'avversario non può attaccare con
  creature più di una volta.
notes_it: >-
  La carta intera serve bene per fissare `しか`. `{{一度|いちど}}` mette il
  numero, `しか` segnala che quel numero sarà l'unico ammesso, e
  `{{攻撃|こうげき}}できない` chiude la lettura in negativo. Il risultato non è
  `attacca una volta e basta` come ordine positivo, ma `gli sono vietati gli
  attacchi di creatura oltre il primo`.
tags: [live-duel, grammar, attack-limit, shika]
:::
