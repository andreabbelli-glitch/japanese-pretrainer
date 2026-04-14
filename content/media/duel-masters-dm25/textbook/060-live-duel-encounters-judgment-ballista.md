---
id: lesson-duel-masters-dm25-live-duel-encounters-judgment-ballista
media_id: media-duel-masters-dm25
slug: live-duel-encounters-judgment-ballista
title: Carte incontrate - 「戒律の大弓」 / Judgment Ballista
order: 88
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [live-duel, card-encounter, blocker, shield-addition, metallica, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-savark-dg
  ]
summary: >-
  Judgment Ballista: non può attaccare il giocatore, resiste nel battle contro
  creature Fire e trasforma gli ingressi da fuori mano in nuovi scudi face-down.
---

# 「戒律の大弓」

:::image
src: assets/cards/live-duel/judgment-ballista.jpg
alt: "Judgment Ballista card."
caption: >-
  「{{戒律|かいりつ}}の{{大弓|だいきゅう}}」。 Light a costo basso con
  [ブロッカー](term:term-blocker). La
  riga davvero utile è l'ultima: `{{手札|てふだ}}{{以外|いがい}}のどこからでも`
  allarga la provenienza del trigger, mentre
  `{{裏向|うらむ}}きのまま、{{新|あたら}}しいシールドとして` spiega che la carta
  presa dal top del mazzo diventa uno scudo aggiuntivo senza essere scoperta.
:::

## Keyword presenti sulla carta

- [ブロッカー](term:term-blocker)

Qui non serve aprire una nuova sezione keyword: `ブロッカー` è già noto. Il
valore didattico della carta sta invece nelle formule che controllano da dove
arriva una creatura e in quale stato finisce il nuovo scudo.

## Effetti da leggere

:::example_sentence
jp: >-
  このクリーチャーは、{{相手|あいて}}プレイヤーを
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Questa creatura non può attaccare il giocatore avversario.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  このクリーチャーは、{{火|ひ}}の[クリーチャー](term:term-creature)と
  バトル{{中|ちゅう}}、
  [{{破壊|はかい}}](term:term-destroy)されない。
translation_it: >-
  Questa creatura non viene distrutta mentre è in battle con una creatura Fire.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  {{相手|あいて}}の[{{コスト|こすと}}](term:term-cost){{4以下|よんいか}}の
  [クリーチャー](term:term-creature)が、
  [{{手札|てふだ}}](term:term-hand){{以外|いがい}}の
  [どこからでも](grammar:grammar-dokokarademo)
  [バトルゾーン](term:term-battle-zone)に
  [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{1枚目|いちまいめ}}を
  [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama)、
  {{新|あたら}}しいシールドとして
  [シールドゾーン](term:term-shield-zone)に[{{置|お}}いて](term:term-oku)もよい。
translation_it: >-
  Quando una creatura avversaria di costo 4 o meno entra nel battle zone da
  qualunque posto diverso dalla mano, puoi prendere la prima carta del tuo
  mazzo e metterla nello shield zone come nuovo scudo, lasciandola face-down.
reveal_mode: sentence
:::

## Parsing grammaticale

### 1. このクリーチャーは、相手プレイヤーを攻撃できない

- Il punto chiave è `{{相手|あいて}}プレイヤーを`: la frase vieta l'attacco al
  giocatore avversario, non ogni attacco in assoluto.
- Per questo la carta può ancora avere senso come difensore con
  [ブロッカー](term:term-blocker): il testo non la spegne, le limita solo il
  bersaglio offensivo.
- `{{攻撃|こうげき}}できない` va letto come impossibilità reale, non come scelta
  tattica.

### 2. 火のクリーチャーとバトル中、破壊されない

- `{{火|ひ}}のクリーチャー` è il filtro che decide quando si accende la
  protezione: conta la civiltà Fire della creatura con cui sta combattendo.
- `バトル中` non indica tutto il turno. Restringe l'effetto solo alla finestra
  in cui quel battle è in corso.
- `{{破壊|はかい}}されない` non impedisce il battle: impedisce il risultato
  `essere distrutta` mentre quella condizione resta vera.

### 3. 手札以外のどこからでもバトルゾーンに出た時

- `{{手札|てふだ}}{{以外|いがい}}の` esclude una sola provenienza: la mano.
- Dopo quell'esclusione, [どこからでも](grammar:grammar-dokokarademo) riallarga
  tutto il resto. Cimitero, mazzo, scudi o altre zone valide rientrano nello
  stesso controllo.
- `バトルゾーンに{{出|で}}た{{時|とき}}` chiude il trigger sul momento
  dell'ingresso: il testo guarda l'entrata effettiva nel battle zone, non il
  semplice spostamento precedente.

### 4. 山札の上から1枚目を裏向きのまま、新しいシールドとしてシールドゾーンに置いてもよい

- `{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}` identifica una carta
  precisa: proprio la prima del mazzo, non una carta scelta.
- [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama) è il blocco più
  utile da fissare. `{{裏向|うらむ}}き` descrive lo stato nascosto, `のまま` dice
  che quello stato non cambia durante il trasferimento.
- `{{新|あたら}}しいシールドとして` non è una descrizione poetica: specifica il
  ruolo finale della carta dopo il movimento.
- `{{置|お}}いてもよい` mantiene tutto facoltativo. Se vuoi, aggiungi lo scudo;
  se non vuoi, il trigger non ti obbliga a farlo.

## Lessico utile in questa carta

- [{{裏向|うらむ}}き](term:term-face-down) qui non vuol dire solo `nascosto` in
  astratto: indica lo stato coperto tipico di uno scudo non rivelato.
- [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama) è il chunk che
  impedisce una lettura sbagliata del tipo `la giri e poi la metti`: la carta
  entra nello shield zone restando coperta.
- [どこからでも](grammar:grammar-dokokarademo) vale come allargatore di scope:
  dopo `{{手札|てふだ}}{{以外|いがい}}`, il trigger controlla ogni altra
  provenienza valida della creatura.
