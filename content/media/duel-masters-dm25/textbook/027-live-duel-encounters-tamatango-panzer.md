---
id: lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
media_id: media-duel-masters-dm25
slug: live-duel-encounters-tamatango-panzer
title: Tamatango Panzer e il bersaglio obbligato
order: 56
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, gransect, shield-trigger, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-kuromame-danshaku
  ]
summary: >-
  Tamatango Panzer entra tapped, reindirizza gli attacchi avversari se possibile
  e riceve S-Trigger negli scudi quando il mana supera una soglia di creature
  enormi.
---

# [タマタンゴ・パンツァー](term:term-tamatango-panzer) e il bersaglio obbligato

タマタンゴ・パンツァー non è scritto come una creatura che entra in campo e basta:
il testo la appoggia già tapped, poi cambia il modo in cui gli attacchi
avversari scelgono il bersaglio. La terza riga sposta invece lo sguardo negli
scudi: se nel mana ci sono abbastanza creature enormi, la carta riceve
`S・トリガー` proprio mentre si trova lì.

Il giapponese della carta lavora su tre coppie molto leggibili: `{{置|お}}く`
per lo stato di ingresso, `{{場合|ばあい}}` più `{{可能|かのう}}なら` per il vincolo
di attacco, e `にある...に{{与|あた}}える` per dire dove si trova il bersaglio e
quale abilità gli viene conferita.


## Termini chiave

- [タマタンゴ・パンツァー](term:term-tamatango-panzer) — carta incontrata, da
  leggere attraverso ingresso tapped e condizione di attacco.
- [グランセクト](term:term-gransect) — razza naturale della creatura, letta sulla
  riga di tipo.
- [クリーチャー](term:term-creature) — corpo in campo che può ricevere S-Trigger o
  diventare bersaglio di attacco.
- [{{自分|じぶん}}](term:term-self) — lato del giocatore che controlla potere e
  condizioni.
- [パワー](term:term-power) — valore numerico usato come soglia.
- [{{相手|あいて}}](term:term-opponent) — l'avversario come controllore della
  creatura che sta attaccando.
- [{{攻撃|こうげき}}](term:term-attack) — l'azione di attaccare, prima come
  situazione avversaria e poi come bersaglio imposto.
- [{{与|あた}}える](term:term-ataeru) — conferire una keyword o proprietà a una
  carta precisa.

## Espressioni ricorrenti

- [タップして{{置|お}}く](term:term-enter-battle-zone-tapped) — mettere una carta in
  campo già tapped.
- [{{可能|かのう}}なら](grammar:grammar-kanou-nara) — se l'azione è legalmente
  possibile, il vincolo va rispettato.
- [S・トリガー](term:term-s-trigger) — keyword ricevuta solo dentro la condizione
  descritta dalla riga finale.

## Pattern grammaticali chiave

- [{{時|とき}}](grammar:grammar-toki) — timing, il momento in cui la carta viene
  collocata nel battle zone.
- [{{場合|ばあい}}](term:term-baai) — caso o situazione in cui una regola deve
  essere controllata.
- [あれば](grammar:grammar-areba) — condizione di esistenza; se il gruppo richiesto
  c'è, parte il payoff.

## Etichette da riconoscere

- [T（トリプル）・ブレイカー](term:term-t-breaker) — keyword offensiva stampata
  sulla carta.
- [バトルゾーン](term:term-battle-zone) — zona in cui la creatura viene messa
  tapped.
- [マナゾーン](term:term-mana-zone) e [シールドゾーン](term:term-shield-zone) — le
  due zone che la riga finale distingue con precisione.

---

[T（トリプル）・ブレイカー](term:term-t-breaker) è una label quantitativa: ti dice quanti scudi può rompere la creatura, non quando parte il trigger degli scudi.

:::image
src: assets/cards/live-duel/tamatango-panzer.webp
alt: "Tamatango Panzer card."
caption: >-
  [タマタンゴ・パンツァー](term:term-tamatango-panzer)。 Razza:
  [グランセクト](term:term-gransect)。 Il testo centrale tiene insieme ingresso
  tapped, attacco obbligato verso questa creatura e
  [S・トリガー](term:term-s-trigger) condizionato dalla mana zone.
:::

## 1. Ingresso tapped: quando `置く` descrive anche lo stato

La prima frase non usa solo un trigger di ingresso: ripete `{{置|お}}く` per
dire prima il momento e poi il modo in cui la carta viene collocata. In
`バトルゾーンに{{置|お}}く{{時|とき}}`, `に` marca la destinazione e `{{時|とき}}`
trasforma l'atto di mettere la carta in un timing. Subito dopo, `このカードは`
mette a tema proprio questa carta, e `タップして{{置|お}}く` specifica lo stato
con cui arriva sul campo.

:::example_sentence
jp: >-
  [バトルゾーン](term:term-battle-zone)に{{置|お}}く
  [{{時|とき}}](grammar:grammar-toki)、このカードは
  [タップして{{置|お}}く](term:term-enter-battle-zone-tapped)。
translation_it: >-
  Quando viene messa nel battle zone, questa carta viene messa tapped.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [バトルゾーン](term:term-battle-zone)に: destinazione della collocazione,
    non fonte dell'effetto.
*   {{置|お}}く[{{時|とき}}](grammar:grammar-toki): timing costruito sul verbo
    "mettere, collocare".
*   `このカードは`: topic della seconda metà; il testo restringe l'effetto a
    questa carta.
*   [タップして{{置|お}}く](term:term-enter-battle-zone-tapped): modo della
    collocazione; la carta viene appoggiata già in stato tapped.

#### ⚖️ Contrasto operativo

`タップして{{置|お}}く` non descrive un ingresso normale seguito da un secondo
evento di tap. Il `して` lega lo stato tapped al modo in cui la carta viene
messa nel battle zone. Se un altro effetto controlla "quando entra", vede una
carta che arriva già tappata, non una carta che entra untapped e poi viene
tappata dopo.

#### 🧠 Gancio cognitivo

Come trucco di memoria, pensa a `{{置|お}}く` come al gesto di appoggiare la
carta: il testo non racconta una corsa verso il campo, ma il modo in cui la
carta viene posata. Non è etimologia speciale; serve solo a riconoscere perché
`タップして` modifica direttamente la collocazione.

## 2. Attacco obbligato: `場合` apre il caso, `可能なら` limita il vincolo

La seconda frase parte dall'avversario e crea uno scenario: {{相手|あいて}}の
クリーチャーが{{攻撃|こうげき}}する{{場合|ばあい}}. {{場合|ばあい}} non è un
"quando" generico da tradurre in automatico; qui vuol dire "nel caso in cui si
presenti questa situazione". Dentro quel caso, `{{可能|かのう}}なら` non rende
l'attacco opzionale: restringe l'obbligo ai casi in cui questa creatura può
essere davvero scelta come bersaglio.

:::example_sentence
jp: >-
  [{{相手|あいて}}](term:term-opponent)の
  [クリーチャー](term:term-creature)が
  [{{攻撃|こうげき}}](term:term-attack)する
  [{{場合|ばあい}}](term:term-baai)、
  [{{可能|かのう}}なら](grammar:grammar-kanou-nara)この
  [クリーチャー](term:term-creature)を
  [{{攻撃|こうげき}}](term:term-attack)する。
translation_it: >-
  Nel caso in cui una creatura avversaria attacchi, se può farlo deve attaccare
  questa creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{相手|あいて}}](term:term-opponent)の[クリーチャー](term:term-creature)が:
    soggetto della situazione; l'attaccante appartiene all'avversario.
*   [{{攻撃|こうげき}}](term:term-attack)する[{{場合|ばあい}}](term:term-baai):
    cornice condizionale, cioè il caso in cui si controlla il vincolo.
*   [{{可能|かのう}}なら](grammar:grammar-kanou-nara): filtro di legalità; vale
    solo quando il bersaglio può essere scelto.
*   この[クリーチャー](term:term-creature)を[{{攻撃|こうげき}}](term:term-attack)する:
    effetto concreto; l'oggetto con `を` diventa il bersaglio dell'attacco.

#### ⚖️ Contrasto operativo

`{{可能|かのう}}なら` non significa "se vuoi" e non attenua l'obbligo. La frase
mantiene la forma dichiarativa `このクリーチャーを{{攻撃|こうげき}}する`: se questa
creatura è un bersaglio legale, l'attacco deve andare lì. Se invece non può
essere attaccata, il vincolo non crea un bersaglio impossibile; semplicemente
non si applica.

## 3. Soglia nel mana: `5体以上` conta creature, non carte qualunque

La riga finale mette una condizione lunga prima del verbo principale.
`{{自分|じぶん}}のマナゾーンに` dice dove guardare, mentre
パワー{{12000以上|いちまんにせんいじょう}}のクリーチャーが
{{5体以上|ごたいいじょう}} costruisce il gruppo richiesto: creature, non carte
qualsiasi, e solo quelle con potere almeno 12000. `あれば` chiude la condizione
di esistenza; tutto ciò che segue è il risultato attivo solo se quel gruppo è
presente.

:::example_sentence
jp: >-
  [{{自分|じぶん}}](term:term-self)の
  [マナゾーン](term:term-mana-zone)に
  [パワー](term:term-power){{12000以上|いちまんにせんいじょう}}の
  [クリーチャー](term:term-creature)が{{5体以上|ごたいいじょう}}あれば、
  [シールドゾーン](term:term-shield-zone)にあるこの
  [クリーチャー](term:term-creature)に
  「[S・トリガー](term:term-s-trigger)」を[{{与|あた}}える](term:term-ataeru)。
translation_it: >-
  Se nella tua mana zone ci sono almeno cinque creature con potere 12000 o più,
  conferisce S-Trigger a questa creatura mentre si trova nello shield zone.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   [{{自分|じぶん}}](term:term-self)の[マナゾーン](term:term-mana-zone)に:
    luogo in cui viene controllata l'esistenza del gruppo.
*   [パワー](term:term-power){{12000以上|いちまんにせんいじょう}}の
    [クリーチャー](term:term-creature)が{{5体以上|ごたいいじょう}}: soggetto contato,
    ristretto insieme da potere, tipo di carta e quantità minima.
*   [あれば](grammar:grammar-areba): condizione; se quel gruppo esiste, la
    frase passa al risultato.
*   [シールドゾーン](term:term-shield-zone)にあるこの
    [クリーチャー](term:term-creature)に: destinatario del conferimento; è questa
    creatura mentre si trova negli scudi.
*   「[S・トリガー](term:term-s-trigger)」を[{{与|あた}}える](term:term-ataeru):
    oggetto e verbo; la keyword viene attribuita alla carta in quella
    condizione.

#### ⚖️ Contrasto operativo

I due `に` della frase non fanno lo stesso lavoro. In `マナゾーンに`, `に` indica
il posto in cui cercare le cinque creature. In シールドゾーンにあるこの
クリーチャーに, il primo に appartiene a にある e descrive dove si trova la
carta, mentre il secondo `に` marca il destinatario di `{{与|あた}}える`. Questa
differenza evita una lettura confusa: la keyword non viene data alla mana zone,
ma alla creatura che è nello shield zone.

#### 🧠 Gancio cognitivo

`{{与|あた}}える` conserva l'immagine generale di "dare, conferire". Qui però
l'oggetto dato non è una carta fisica: è la proprietà `S・トリガー`. Il gancio
pratico è seguire la catena `Aに Bを{{与|あた}}える`: a chi viene dato qualcosa
con `に`, che cosa viene dato con `を`.

## Esempi guidati di riepilogo

Quando leggi `バトルゾーンに{{置|お}}く{{時|とき}}`, preparati a un timing di
ingresso; quando subito dopo arriva `タップして{{置|お}}く`, lo stato tapped fa
parte della collocazione stessa. La carta non entra neutra: viene posata già
tappata.

In {{相手|あいて}}のクリーチャーが{{攻撃|こうげき}}する{{場合|ばあい}}、
{{可能|かのう}}ならこのクリーチャーを{{攻撃|こうげき}}する, il primo
`{{攻撃|こうげき}}する` apre il caso, il secondo indica il bersaglio richiesto.
`{{可能|かのう}}なら` non aggiunge scelta al giocatore; aggiunge il limite legale
del "se può farlo".

Nella riga degli scudi, パワー{{12000以上|いちまんにせんいじょう}}のクリーチャーが
{{5体以上|ごたいいじょう}}あれば è tutto il cancello condizionale. Solo dopo quel
cancello il testo arriva a `「S・トリガー」を{{与|あた}}える`, cioè al conferimento
della keyword.

## Nota finale

タマタンゴ・パンツァー si legge bene se separi stato, obbligo e conferimento.
`タップして{{置|お}}く` decide come entra, `{{場合|ばあい}}` più
`{{可能|かのう}}なら` decide quando l'attacco deve cambiare bersaglio, e
`にある...に{{与|あた}}える` decide quale carta riceve `S・トリガー`
mentre si trova negli scudi.
