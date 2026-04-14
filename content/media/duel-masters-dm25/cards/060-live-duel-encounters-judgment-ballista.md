---
id: cards-duel-masters-dm25-live-duel-encounters-judgment-ballista
media_id: media-duel-masters-dm25
slug: live-duel-encounters-judgment-ballista
title: Carte incontrate in partita 39 - Judgment Ballista, 裏向き e どこからでも
order: 88
segment_ref: live-duel-encounters
---

:::term
id: term-face-down
lemma: 裏向き
reading: うらむき
romaji: uramuki
meaning_it: a faccia in giù / face-down
pos: noun
aliases: [裏向き, うらむき, uramuki]
notes_it: >-
  In giapponese generale `{{裏向|うらむ}}き` descrive qualcosa tenuto con il lato
  posteriore verso l'alto, quindi non visibile frontalmente. Nel rules text di
  Duel Masters questo significato resta concreto ma diventa anche uno stato di
  informazione: una carta messa `{{裏向|うらむ}}き` entra o resta coperta, quindi
  il tavolo non ne vede il contenuto.
level_hint: n3
:::

:::grammar
id: grammar-uramuki-no-mama
pattern: 裏向きのまま
title: Lasciandolo a faccia in giù
reading: うらむきのまま
meaning_it: lasciandolo a faccia in giù / senza girarlo
aliases: [裏向きのまま]
notes_it: >-
  In giapponese generale `Xのまま` vuol dire `lasciando X così com'è`, senza
  cambiarne lo stato. Nel rules text di Duel Masters questo è decisivo perché
  blocca una lettura sbagliata della procedura: la carta non viene mostrata e
  poi messa nello scudo, ma viene messa nello scudo restando coperta.
level_hint: n3
:::

:::grammar
id: grammar-dokokarademo
pattern: どこからでも
title: Da qualunque provenienza
reading: どこからでも
meaning_it: da ovunque / da qualunque posto
aliases: [どこからでも]
notes_it: >-
  In giapponese generale `どこからでも` allarga la provenienza e significa `da
  ovunque`. Nel rules text di Duel Masters non è un abbellimento: dopo un
  filtro come `{{手札|てふだ}}{{以外|いがい}}の`, dice che il trigger guarda tutte
  le altre origini valide, non una zona singola scelta in anticipo.
level_hint: n3
:::

:::card
id: card-face-down-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-judgment-ballista
entry_type: term
entry_id: term-face-down
card_type: recognition
front: '{{裏向|うらむ}}き'
back: a faccia in giù / face-down
example_jp: >-
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を
  {{裏向|うらむ}}きのまま、{{新|あたら}}しいシールドとして
  [シールドゾーン](term:term-shield-zone)に[{{置|お}}いて](term:term-oku)もよい。
example_it: >-
  Puoi mettere la prima carta del tuo mazzo nello shield zone come nuovo
  scudo, lasciandola face-down.
notes_it: >-
  In giapponese generale `{{裏向|うらむ}}き` descrive un oggetto tenuto con il
  retro in vista. Qui il valore utile è ancora più concreto: il nuovo scudo non
  viene rivelato al tavolo, ma entra direttamente nello stato coperto tipico
  degli scudi.
tags: [live-duel, term, shields, hidden-info]
:::

:::card
id: card-uramuki-no-mama-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-judgment-ballista
entry_type: grammar
entry_id: grammar-uramuki-no-mama
card_type: concept
front: '{{裏向|うらむ}}きのまま'
back: lasciandolo a faccia in giù / senza girarlo
example_jp: >-
  {{1枚目|いちまいめ}}を[{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama)、
  {{新|あたら}}しいシールドとして[シールドゾーン](term:term-shield-zone)に
  [{{置|お}}いて](term:term-oku)もよい。
example_it: >-
  Puoi mettere la prima carta nello shield zone come nuovo scudo, lasciandola
  a faccia in giù.
notes_it: >-
  `Xのまま` in giapponese generale conserva lo stato di `X` senza modificarlo.
  In questa carta il punto non è solo `{{裏向|うらむ}}き`, ma proprio il fatto
  che la carta resti così durante il passaggio a scudo: non si scopre, non si
  gira, non cambia stato nel mezzo della procedura.
tags: [live-duel, grammar, state, shields]
:::

:::card
id: card-dokokarademo-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-judgment-ballista
entry_type: grammar
entry_id: grammar-dokokarademo
card_type: concept
front: どこからでも
back: da ovunque / da qualunque provenienza
example_jp: >-
  [{{手札|てふだ}}](term:term-hand){{以外|いがい}}の
  [どこからでも](grammar:grammar-dokokarademo)
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  このトリガーを{{見|み}}る。
example_it: >-
  Quando entra nel battle zone da qualunque posto diverso dalla mano, controlli
  questo trigger.
notes_it: >-
  In giapponese generale `どこからでも` allarga l'origine e significa `da
  ovunque`. In Judgment Ballista il valore tecnico è nello scope: dopo
  `{{手札|てふだ}}{{以外|いがい}}の`, la carta non controlla una sola zona
  speciale, ma ogni altra provenienza valida della creatura.
tags: [live-duel, grammar, source, trigger]
:::
