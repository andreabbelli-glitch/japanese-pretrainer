---
id: cards-duel-masters-dm25-live-duel-encounters-beethoven-zenith-of-horror
media_id: media-duel-masters-dm25
slug: live-duel-encounters-beethoven-zenith-of-horror
title: Carte incontrate in partita 12 - Beethoven e Eternal Omega
order: 61
segment_ref: live-duel-encounters
---

:::term
id: term-beethoven-zenith-of-horror
lemma: 「戦慄」の頂 ベートーベン
reading: せんりつ の いただき べーとーべん
romaji: senritsu no itadaki beetoben
meaning_it: Beethoven, Zenith of "Horror"
pos: proper-noun
aliases:
  [「戦慄」の頂 ベートーベン, 戦慄の頂 ベートーベン, Beethoven, Zenith of "Horror"]
notes_it: >-
  È il nome proprio della carta. `戦慄` si legge `せんりつ`, mentre `頂` qui si legge
  `いただき` e costruisce il titolo `Zenith`. Il nome compare su una Victory
  Creature incolore che concede `エターナル・Ω` ai propri Draghi e Command.
level_hint: custom
:::

:::term
id: term-eternal-omega
lemma: エターナル・Ω
reading: えたーなる おめが
romaji: etaanaru omega
meaning_it: "Eternal Omega: ritorno in mano al posto della destinazione prevista"
pos: keyword
aliases: [エターナル・Ω, Eternal Omega, eternal omega]
notes_it: "エターナル・Ω sostituisce la destinazione prevista con la mano del proprietario. La creatura lascia comunque la zona di battaglia: il ritorno in mano è un movimento tra zone."
level_hint: custom
:::

:::term
id: term-colorless-spell
lemma: 無色呪文
reading: むしょく じゅもん
romaji: mushoku jumon
meaning_it: spell incolore
pos: noun
aliases: [無色呪文, むしょくじゅもん, colorless spell, spell incolore]
notes_it: >-
  È il composto che unisce `無色` e `呪文` in una categoria precisa del rules
  text: non una magia qualunque, ma una spell priva di civiltà colorata. Su
  Beethoven compare come uno dei due gruppi che puoi recuperare insieme ai
  Draghi, quindi vale la pena fissarlo come blocco unico invece di leggerlo
  ogni volta pezzo per pezzo.
level_hint: custom
:::

:::grammar
id: grammar-shoukan-ni-yotte
pattern: 召喚によって
title: Entrata proprio tramite evocazione
reading: しょうかんによって
meaning_it: tramite evocazione / per il fatto di essere stato evocato
aliases: [召喚によって]
notes_it: >-
  Qui `によって` indica il mezzo preciso con cui avviene l'ingresso. In
  `このクリーチャーが{{召喚|しょうかん}}によって{{出|で}}た{{時|とき}}`, il trigger
  non controlla solo se la creatura è entrata: controlla che sia entrata
  proprio attraverso una `{{召喚|しょうかん}}`.
level_hint: custom
:::

:::card
id: card-beethoven-zenith-of-horror-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-beethoven-zenith-of-horror
entry_type: term
entry_id: term-beethoven-zenith-of-horror
card_type: recognition
front: '{{戦慄|せんりつ}}の{{頂|いただき}} ベートーベン'
back: Beethoven, Zenith of "Horror"
example_jp: >-
  {{戦慄|せんりつ}}の{{頂|いただき}} ベートーベンを{{召喚|しょうかん}}する。
example_it: >-
  Evoco Beethoven, Zenith of "Horror".
notes_it: >-
  Il titolo vale come lettura compatta: `戦慄` = `せんりつ`, `頂` = `いただき`.
  È un buon promemoria per non separare il titolo dal nome proprio.
tags: [live-duel, proper-name, victory]
:::

:::card
id: card-eternal-omega-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-beethoven-zenith-of-horror
entry_type: term
entry_id: term-eternal-omega
card_type: recognition
front: エターナル・Ω
back: "torna in mano al posto della destinazione prevista"
example_jp: "「エターナル・Ω」を{{持|も}}つクリーチャーが{{離|はな}}れる{{時|とき}}、   かわりに{{手札|てふだ}}に{{戻|もど}}す。"
example_it: "Quando una creatura con Eternal Omega sta per lasciare il campo, la rimetti in mano al posto di mandarla nella destinazione prevista."
notes_it: "エターナル・Ω sostituisce la destinazione prevista con la mano del proprietario. La creatura lascia comunque la zona di battaglia: il ritorno in mano è un movimento tra zone."
tags: [live-duel, keyword, replacement-effect]
:::
:::card
id: card-colorless-spell-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-beethoven-zenith-of-horror
entry_type: term
entry_id: term-colorless-spell
card_type: recognition
front: '{{無色呪文|む.しょく.じゅ.もん}}'
back: spell incolore
example_jp: >-
  ドラゴンまたは{{無色呪文|む.しょく.じゅ.もん}}を
  {{合計|ごうけい}}{{3枚|さんまい}}、{{手札|てふだ}}に{{戻|もど}}す。
example_it: >-
  Rimetti in mano un totale di 3 Draghi e/o spell incolori.
notes_it: >-
  Il valore utile non e` `呪文` da solo, ma il composto completo: nel rules
  text delimita una categoria di carte recuperabili, letta come blocco unico
  insieme a `ドラゴンまたは`.
tags: [live-duel, compound, spell, colorless]
:::

:::card
id: card-shoukan-ni-yotte-trigger
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-beethoven-zenith-of-horror
entry_type: grammar
entry_id: grammar-shoukan-ni-yotte
card_type: concept
front: 'このクリーチャーが[{{召喚|しょうかん}}によって](grammar:grammar-shoukan-ni-yotte){{出|で}}た{{時|とき}}'
back: quando questa creatura entra proprio tramite evocazione
example_jp: >-
  このクリーチャーが[{{召喚|しょうかん}}によって](grammar:grammar-shoukan-ni-yotte)
  {{出|で}}た{{時|とき}}、ドラゴンまたは
  [{{無色呪文|む.しょく.じゅ.もん}}](term:term-colorless-spell)を
  {{合計|ごうけい}}{{3枚|さんまい}}、{{手札|てふだ}}に{{戻|もど}}す。
example_it: >-
  Quando questa creatura entra proprio tramite evocazione, rimetti in mano un
  totale di 3 Draghi e/o spell incolori.
notes_it: >-
  Il punto non e` il semplice `{{出|で}}た{{時|とき}}`, ma il filtro aggiunto da
  `{{召喚|しょうかん}}によって`: l'effetto si accende solo se il mezzo
  d'ingresso e` una summon vera e propria.
tags: [live-duel, grammar, trigger, summon]
:::
