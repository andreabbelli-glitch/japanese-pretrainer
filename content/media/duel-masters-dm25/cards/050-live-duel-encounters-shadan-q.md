---
id: cards-duel-masters-dm25-live-duel-encounters-shadan-q
media_id: media-duel-masters-dm25
slug: live-duel-encounters-shadan-q
title: Carte incontrate in partita 29 - Shadan Q, G・ゼロ e 中止する
order: 78
segment_ref: live-duel-encounters
---

:::term
id: term-g-zero
lemma: G・ゼロ
reading: じーぜろ
romaji: jii zero
meaning_it: G-Zero / keyword che permette di evocare gratis se la soglia richiesta è già soddisfatta
pos: keyword
aliases: [G・ゼロ, G-zero, jii zero]
notes_it: >-
  È una keyword di ingresso gratuito. Il suo significato pratico non è
  semplicemente `zero costo`: prima controlli la condizione scritta dopo i due
  punti, poi solo se quella soglia è vera puoi mettere la creatura in gioco
  senza pagarne il costo. In `シャダンＱ`, il controllo richiesto è avere già un
  proprio ジョーカーズ di costo `{{5以上|ごいじょう}}`.
level_hint: custom
:::

:::term
id: term-chuushi-suru
lemma: 中止する
reading: ちゅうしする
romaji: chuushi suru
meaning_it: interrompere / sospendere / annullare
pos: verb
aliases: [中止する, 中止して, ちゅうしする, chuushi suru]
notes_it: >-
  In giapponese generale `{{中止|ちゅうし}}する` vuol dire `interrompere`,
  `sospendere`, `annullare` qualcosa che era in corso o stava per proseguire.
  Nel rules text di Duel Masters il significato non cambia, ma si restringe a
  una procedura di gioco precisa: in `その{{攻撃|こうげき}}を{{中止|ちゅうし}}してもよい`,
  la carta ti permette di fermare proprio quell'attacco appena dichiarato,
  invece di lasciarlo continuare normalmente.
level_hint: n3
:::

:::card
id: card-g-zero-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-shadan-q
entry_type: term
entry_id: term-g-zero
card_type: recognition
front: G・ゼロ
back: G-Zero / keyword che permette l'evocazione gratuita se la soglia è soddisfatta
example_jp: >-
  G・ゼロ：[{{自分|じぶん}}](term:term-self)の[コスト](term:term-cost)
  {{5以上|ごいじょう}}のジョーカーズがあれば、このクリーチャーをコストを
  [{{支払|しはら}}わずに](grammar:grammar-zuni)
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
example_it: >-
  G-Zero: se hai un tuo Jokers di costo 5 o più, puoi evocare questa creatura
  senza pagarne il costo.
notes_it: >-
  Qui la keyword non basta da sola: va letta insieme alla soglia che segue. Il
  significato operativo è `se il requisito è già vero sul campo, puoi evocare
  gratis`.
tags: [live-duel, keyword, free-summon]
:::

:::card
id: card-chuushi-shite-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-shadan-q
entry_type: term
entry_id: term-chuushi-suru
card_type: recognition
front: '{{中止|ちゅうし}}する'
back: interrompere / sospendere / annullare; in carta = fermare quell'attacco
example_jp: >-
  クリーチャーが[{{自分|じぶん}}](term:term-self)を
  [{{攻撃|こうげき}}](term:term-attack)する[{{時|とき}}](grammar:grammar-toki)、このクリーチャーを
  [タップ](term:term-tap)してその[{{攻撃|こうげき}}](term:term-attack)を
  {{中止|ちゅうし}}してもよい。
example_it: >-
  Quando una creatura attacca te, puoi tappare questa creatura e fermare
  quell'attacco.
notes_it: >-
  Il lemma da fissare è `{{中止|ちゅうし}}する`: `interrompere`, `sospendere`,
  `annullare`. Nella frase della carta compare come `{{中止|ちゅうし}}してもよい`
  perché il verbo va in forma in `て` davanti a `もよい`. Il punto utile da
  memorizzare resta il verbo base: qui `{{中止|ちゅうし}}する` non sospende la
  partita in generale, ma blocca proprio l'attacco appena richiamato da
  `その{{攻撃|こうげき}}`.
tags: [live-duel, term, attack, interruption]
:::
