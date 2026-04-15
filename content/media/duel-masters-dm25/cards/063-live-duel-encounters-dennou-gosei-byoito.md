---
id: cards-duel-masters-dm25-live-duel-encounters-dennou-gosei-byoito
media_id: media-duel-masters-dm25
slug: live-duel-encounters-dennou-gosei-byoito
title: Carte incontrate in partita 42 - 電脳護聖ビョイト, scope del modificatore e すべてに
order: 91
segment_ref: live-duel-encounters
---

:::grammar
id: grammar-blocker-wo-motsu-hikari-matawa-mizu-no-shield-card
pattern: 「ブロッカー」を持つ光または水のシールドカード
title: Shield card Luce o Acqua che hanno Blocker
reading: ぶろっかーをもつひかりまたはみずのしーるどかーど
meaning_it: le carte scudo Luce o Acqua che hanno "Blocker"
aliases:
  [
    "「ブロッカー」を持つ光または水のシールドカード",
    ブロッカーを持つ光または水のシールドカード
  ]
notes_it: >-
  `「[ブロッカー](term:term-blocker)」を[{{持|も}}つ](term:term-motsu)` è una
  relativa verbale che si aggancia all'intero blocco
  `{{光|ひかり}}または{{水|みず}}のシールドカード`. Quindi Blocker vale sia per
  Luce sia per Acqua: non stai leggendo `Luce con Blocker oppure Acqua in
  generale`, ma `carte scudo di civiltà Luce o Acqua che hanno Blocker`.
level_hint: n3
:::

:::grammar
id: grammar-subete-ni-s-trigger-wo-ataeru
pattern: すべてに「S・トリガー」を与える
title: Conferire S-Trigger a tutto il gruppo
reading: すべてにえすとりがーをあたえる
meaning_it: conferire "S-Trigger" a tutte le carte del gruppo
aliases:
  [すべてに「S・トリガー」を与える, すべてにS・トリガーを与える]
notes_it: >-
  `すべて` chiude l'intero gruppo appena costruito e significa `tutti /
  l'insieme completo`. `に` marca il destinatario del verbo
  [{{与|あた}}える](term:term-ataeru), mentre `を` marca ciò che viene
  conferito. In pratica la carta dice: `a tutte quelle carte, dai
  S-Trigger`.
level_hint: n3
:::

:::grammar
id: grammar-byoito-full-effect
pattern: >-
  自分の手札に加える、「ブロッカー」を持つ光または水のシールドカードすべてに、「S・トリガー」を与える
title: Conferire S-Trigger alle shield card Luce o Acqua con Blocker che entrano in mano
reading: >-
  じぶんのてふだにくわえる ぶろっかーをもつひかりまたはみずのしーるどかーどすべてに えすとりがーをあたえる
meaning_it: >-
  conferisce S-Trigger a tutte le carte scudo Luce o Acqua con Blocker che aggiungi alla tua mano
aliases:
  [
    自分の手札に加える、「ブロッカー」を持つ光または水のシールドカードすべてに、「S・トリガー」を与える,
    自分の手札に加える、ブロッカーを持つ光または水のシールドカードすべてに、S・トリガーを与える
  ]
notes_it: >-
  L'apertura `{{自分|じぶん}}の{{手札|てふだ}}に[{{加|くわ}}える](term:term-add)`
  mette subito davanti il contesto delle carte che finiscono in mano. Poi il
  giapponese accumula i filtri prima del nome `シールドカード`, e solo alla
  fine chiude tutto con `すべてに` e
  `「[S・トリガー](term:term-s-trigger)」を[{{与|あた}}える](term:term-ataeru)`.
  La frase sembra rovesciata rispetto all'italiano, ma se la leggi a blocchi il
  meccanismo è lineare.
level_hint: n3
:::

:::card
id: card-blocker-wo-motsu-hikari-matawa-mizu-no-shield-card-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-dennou-gosei-byoito
entry_type: grammar
entry_id: grammar-blocker-wo-motsu-hikari-matawa-mizu-no-shield-card
card_type: concept
front: >-
  「ブロッカー」を{{持|も}}つ{{光|ひかり}}または{{水|みず}}のシールドカード
back: le carte scudo Luce o Acqua che hanno "Blocker"
example_jp: >-
  `「ブロッカー」を{{持|も}}つ`が{{後|うし}}ろの{{全部|ぜんぶ}}にかかるので、
  {{光|ひかり}}だけでなく{{水|みず}}のシールドカードにも{{条件|じょうけん}}がかかる。
example_it: >-
  Siccome `ha Blocker` modifica tutto ciò che segue, la condizione vale non
  solo per Luce ma anche per le carte scudo Acqua.
notes_it: >-
  Questo è il pezzo che evita l'errore di scope. In giapponese le descrizioni
  si impilano prima del nome: qui il nome vero è `シールドカード`, mentre
  `「[ブロッカー](term:term-blocker)」を[{{持|も}}つ](term:term-motsu)` e
  `{{光|ひかり}}または{{水|みず}}の` restringono entrambe quel gruppo.
tags: [live-duel, concept, scope, modifier]
:::

:::card
id: card-subete-ni-s-trigger-wo-ataeru-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-dennou-gosei-byoito
entry_type: grammar
entry_id: grammar-subete-ni-s-trigger-wo-ataeru
card_type: concept
front: 'すべてに「S・トリガー」を{{与|あた}}える'
back: conferire "S-Trigger" a tutto il gruppo / a tutte quelle carte
example_jp: >-
  `に`だから、ここは{{受|う}}け{{手|て}}を{{示|しめ}}している。`を`は
  {{与|あた}}えるもの、つまり `S・トリガー` の{{側|がわ}}につく。
example_it: >-
  Siccome c'è `ni`, qui il testo marca il destinatario. `Wo` resta sul lato di
  ciò che viene conferito, cioè `S-Trigger`.
notes_it: >-
  Il punto da fissare non è solo `すべて`, ma `すべてに`. `に` funziona come il
  nostro `a`: il gruppo lungo costruito prima diventa il ricevente del verbo
  [{{与|あた}}える](term:term-ataeru).
tags: [live-duel, concept, recipient, particle]
:::

:::card
id: card-byoito-full-effect-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-dennou-gosei-byoito
entry_type: grammar
entry_id: grammar-byoito-full-effect
card_type: concept
front: >-
  {{自分|じぶん}}の{{手札|てふだ}}に{{加|くわ}}える、「ブロッカー」を{{持|も}}つ{{光|ひかり}}または{{水|みず}}のシールドカードすべてに、「S・トリガー」を{{与|あた}}える
back: >-
  conferisce "S-Trigger" a tutte le carte scudo Luce o Acqua con "Blocker" che aggiungi alla tua mano
example_jp: >-
  {{前半|ぜんはん}}で{{対象|たいしょう}}を{{細|こま}}かくしぼり、
  {{最後|さいご}}の `すべてに` でその{{全部|ぜんぶ}}を{{受|う}}け{{手|て}}として{{閉|と}}じている。
example_it: >-
  La prima metà restringe con precisione il gruppo bersaglio, e l'ultimo
  `subete ni` chiude tutto quel gruppo come destinatario.
notes_it: >-
  Questa è la lettura completa da fissare. L'ordine giapponese è rovesciato
  rispetto all'italiano: prima arrivi alle carte che finiscono in mano, poi
  aggiungi i due filtri `Blocker` e `{{光|ひかり}}または{{水|みず}}`, poi
  `すべてに` chiude tutto il gruppo come destinatario, e solo alla fine il
  verbo dice cosa viene assegnato.
tags: [live-duel, concept, full-sentence, scope]
:::
