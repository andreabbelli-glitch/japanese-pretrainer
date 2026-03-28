---
id: lesson-duel-masters-dm25-live-duel-encounters-felix-misery
media_id: media-duel-masters-dm25
slug: live-duel-encounters-felix-misery
title: Carte incontrate - Felix Misery
order: 68
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, mafi-gang, neo-evolution, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-tcg-card-types,
    lesson-duel-masters-dm25-dm25-sd1-overview
  ]
summary: >-
  Felix Misery: sconto se evocata come NEO evolution, chiamata dal cimitero con
  2 creature Darkness e attacco che macina 2 per rianimare un non evolution
  Darkness costo 6 o meno.
---

# [フェリックス・ミザリィ](term:term-felix-misery)

:::image
src: assets/cards/live-duel/felix-misery.webp
alt: "Felix Misery card."
caption: >-
  [フェリックス・ミザリィ](term:term-felix-misery)。 Razza:
  [マフィ・ギャング](term:term-mafi-gang). Tipo:
  [NEOクリーチャー](term:term-neo-creature). Riga centrale:
  `NEO{{進化|しんか}}`,
  sconto in [{{召喚|しょうかん}}](term:term-summon) nel
  [{{場合|ばあい}}](term:term-baai) NEO, chiamata dal
  [{{墓地|ぼち}}](term:term-graveyard) con soglia di
  `{{2体以上|に.たい.い.じょう}}` e attacco che manda `{{2枚|にまい}}` al cimitero
  per poi rianimare un Darkness non evolution di costo `{{6以下|ろくいか}}`.
:::

## Etichette da riconoscere

- [NEOクリーチャー](term:term-neo-creature)
- [マフィ・ギャング](term:term-mafi-gang)
- [W・ブレイカー](term:term-w-breaker)

Le etichette di base sono già coperte altrove. Qui il valore didattico sta
soprattutto in tre punti: come `{{場合|ばあい}}` delimita il caso della NEO
evolution, come `{{2体以上|に.たい.い.じょう}}あれば` apre la soglia per evocare
dal cimitero e come `{{進化|しんか}}でない` filtra con precisione che cosa puoi
mettere nel [バトルゾーン](term:term-battle-zone).

## Effetti da leggere

:::example_sentence
jp: >-
  NEO{{進化|しんか}}クリーチャーとして
  [{{召喚|しょうかん}}](term:term-summon)する
  [{{場合|ばあい}}](term:term-baai)、[コスト](term:term-cost)を
  {{2|ふた}}つ{{少|すく}}なくする。
translation_it: >-
  Nel caso in cui tu la evochi come creatura NEO evolution, riduci il costo di
  2.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{闇|やみ}}の[クリーチャー](term:term-creature)が
  {{2体以上|に.たい.い.じょう}}[あれば](grammar:grammar-areba)、
  {{自分|じぶん}}の[{{墓地|ぼち}}](term:term-graveyard)からこの
  [クリーチャー](term:term-creature)を
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  Se hai due o più creature Darkness, puoi evocare questa creatura dal tuo
  cimitero.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki)、{{自分|じぶん}}の
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{2枚|にまい}}を
  [{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku)。
  [その{{後|あと}}](grammar:grammar-sonoato)、{{自分|じぶん}}の
  [{{墓地|ぼち}}](term:term-graveyard)から[コスト](term:term-cost)
  {{6以下|ろくいか}}の、[{{進化|しんか}}](term:term-evolution)でない
  {{闇|やみ}}の[クリーチャー](term:term-creature){{1枚|いちまい}}を
  [バトルゾーン](term:term-battle-zone)に[{{出|だ}}してもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Quando attacca, metti nel cimitero le prime 2 carte del tuo mazzo. Poi puoi
  mettere nel battle zone dal tuo cimitero 1 creatura Darkness non evolution
  di costo 6 o meno.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. NEO進化クリーチャーとして召喚する場合

- Qui il centro non è `NEO` da solo, ma l'intero blocco
  `NEO進化クリーチャーとして召喚する場合`.
- [{{場合|ばあい}}](term:term-baai) non aggiunge un effetto nuovo: delimita il
  caso preciso in cui va letta la riduzione di costo. Prima fissa lo scenario,
  poi la carta ti dice che cosa succede in quello scenario.
- `として` qui vale come `in qualità di / nel ruolo di`. Quindi il testo non
  sta dicendo semplicemente `quando la evochi`: sta dicendo `quando la evochi
  come NEO evolution creature`.
- Per questo la lettura corretta è: `se l'ingresso sta avvenendo nella forma
  NEO evolution, allora il costo scende di 2`. Lo sconto non è universale.

### 2. 自分の闇のクリーチャーが2体以上あれば

- Questo è un chunk molto utile da fissare in blocco, perché usa una struttura
  ricorrente da TCG: `gruppo filtrato + soglia numerica + あれば`.
- `{{自分|じぶん}}の{{闇|やみ}}のクリーチャー` restringe subito il gruppo:
  non tutte le creature che controlli, ma solo quelle di Darkness.
- `{{2体以上|に.たい.い.じょう}}` non è un numero decorativo. `体` è il contatore
  per i corpi creatura, mentre `以上` chiude la soglia minima: due o più.
- [あれば](grammar:grammar-areba) funziona come cancello condizionale. Se la
  soglia esiste, si apre la frase successiva; se non c'è, il ramo non parte.
- La conseguenza pratica aiuta a leggere bene il giapponese: prima controlli
  il numero di creature Darkness che hai già, solo dopo puoi passare a
  `墓地からこのクリーチャーを召喚してもよい`.

### 3. コスト6以下の、進化でない闇のクリーチャー1枚

- Questa parte è densa perché accumula filtri in serie sullo stesso bersaglio.
- `コスト{{6以下|ろくいか}}の` imposta il primo filtro numerico: il candidato
  deve costare 6 o meno.
- La virgola giapponese qui non spezza l'oggetto in due frasi. Ti aiuta solo a
  leggere meglio un filtro che continua.
- Il pezzo nuovo da fissare bene è
  `[{{進化|しんか}}](term:term-evolution)[でない](grammar:grammar-de-nai)`. In
  italiano non è semplicemente `senza evoluzione` in senso narrativo: vuol dire
  `che non conta come evolution creature`.
- Poi arriva `{{闇|やみ}}のクリーチャー{{1枚|いちまい}}`: stesso bersaglio, altri
  due restringimenti. Deve essere Darkness, deve essere una creatura e devi
  sceglierne una sola.
- Quindi il chunk completo va letto così: `dal mio cimitero, una creatura
  Darkness, non evolution, di costo 6 o meno`.

### 4. その後...バトルゾーンに出してもよい

- [その{{後|あと}}](grammar:grammar-sonoato) segnala che la frase non finisce
  col self mill delle prime `{{2枚|にまい}}`: c'è un secondo passo collegato.
- Quel secondo passo non è automatico, perché il testo chiude con
  [{{出|だ}}してもよい](grammar:grammar-temoyoi). La rianimazione è concessa,
  non obbligata.
- In termini di lettura giapponese, la carta ha quindi una struttura pulita:
  `attacca` -> `manda 2 al cimitero` -> `poi puoi scegliere un bersaglio che
  passa tutti i filtri`.
- Il punto da imparare non è solo `che cosa fa la carta`, ma come il giapponese
  costruisce i filtri prima e lascia l'azione facoltativa solo alla fine.

## Lessico utile in questa carta

- [フェリックス・ミザリィ](term:term-felix-misery) va collegato subito al doppio
  asse `evocazione dal cimitero` + `rianimazione su attacco`.
- [{{場合|ばあい}}](term:term-baai) qui è molto leggibile perché non introduce un
  effetto astratto: ti dice esattamente `in quale caso` vale la riduzione di
  costo.
- `{{2体以上|に.たい.い.じょう}}あれば` è un pattern altamente trasferibile per i
  testi che controllano soglie di board.
- `[{{進化|しんか}}](term:term-evolution)[でない](grammar:grammar-de-nai)` è un
  filtro molto utile da memorizzare come chunk, perché ricompare facilmente
  ogni volta che il testo vuole escludere una categoria specifica.
- `{{少|すく}}なくする` è giapponese generale molto riusabile: non vuol dire
  `pagare meno` in senso libero, ma `rendere minore una quantità`. Qui l'oggetto
  è il costo, quindi lo leggi come `ridurre il costo`.
- `として` è un marcatore di ruolo o qualifica. Fuori dal TCG può voler dire
  `come insegnante`, `come esempio`, `come problema`; qui restringe il senso a
  `come NEO evolution creature`.
- `{{召喚|しょうかん}}する` mostra un pattern molto comune del giapponese:
  sostantivo sino-giapponese + `する` per formare il verbo. `{{召喚|しょうかん}}`
  è `l'evocazione`, `{{召喚|しょうかん}}する` è `evocare`.
- `{{闇|やみ}}` in giapponese generale è `oscurità`, ma nel lessico di Duel
  Masters funziona spesso come nome compatto della civiltà Darkness. Per questo
  `{{闇|やみ}}のクリーチャー` va letto come categoria tecnica, non come descrizione
  poetica.
