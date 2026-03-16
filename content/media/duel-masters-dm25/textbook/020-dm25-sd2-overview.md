---
id: lesson-duel-masters-dm25-dm25-sd2-overview
media_id: media-duel-masters-dm25
slug: dm25-sd2-overview
title: DM25-SD2 力の王道 - gallery completa, invasione e chiusura
order: 40
segment_ref: analisi-mazzi
difficulty: n4
status: active
tags: [deck, evolution, invasion, attack, duel-masters]
prerequisites: [lesson-duel-masters-dm25-tcg-core-patterns]
summary: >-
  Lezione verticale sullo starter deck `DM25-SD2 力の王道`: gallery completa
  delle 11 carte, selezione delle vere novita linguistiche del deck e parsing
  mirato di keyword come `G・ストライク`, `究極進化`, `メテオバーン` e
  `スーパー・S・トリガー`.
---

# Obiettivo

Questa lezione analizza `DM25-SD2` carta per carta. In tutte le 11 card
mettiamo a fuoco il valore linguistico operativo: keyword, struttura delle condizioni e
ordine delle azioni nel piano di gioco.

Alla fine dovresti riconoscere:

- quali card cambiano la lettura operativa del deck;
- come leggere keyword compatte come [G・ストライク](term:term-g-strike),
  [{{究極進化|きゅうきょくしんか}}](term:term-ultimate-evolution) e
  [メテオバーン](term:term-meteorburn);
- come funzionano frasi di supporto molto tipiche del deck, per esempio
  [{{表向|おもてむ}}き](term:term-face-up),
  [好きな順序で](grammar:grammar-sukina-junjo-de) e
  [～てから](grammar:grammar-te-kara).

## Contesto

`DM25-SD2 力の王道` è un deck d'ingresso dell'asse Apollo / Red Zone. In 11 carte
riunisce payoff aggressivi e setup, quindi la lettura si basa sempre sul flusso:
`condizione -> tempo dell'effetto -> esito`.

## Termini chiave

- [レッドゾーン](term:term-red-zone)
- [アポロヌス・ドラゲリオン](term:term-apollonus-dragelion)
- [G・ストライク](term:term-g-strike)
- [{{究極進化|きゅうきょくしんか}}](term:term-ultimate-evolution)
- [メテオバーン](term:term-meteorburn)
- [スーパー・S・トリガー](term:term-super-s-trigger)
- [{{表向|おもてむ}}き](term:term-face-up)
- [バトルさせる](term:term-battle-saseru)
- [{{進化設計図|しんかせっけいず}}](term:term-shinka-sekkeizu)
- [{{未来設計図|みらいせっけいず}}](term:term-mirai-sekkeizu)

## Pattern grammaticali chiave

- [～てから](grammar:grammar-te-kara)
- [好きな順序で](grammar:grammar-sukina-junjo-de)
- [～ていれば](grammar:grammar-teireba)
- [そうしたら](grammar:grammar-soushitara)
- [～てもよい](grammar:grammar-temoyoi)
- [～のはじめに / ～の終わりに](grammar:grammar-turn-timing)

## Spiegazione

### 1. Come leggere la gallery

`DM25-SD2` alterna due registri:

- payoff aggressivo di [{{侵略|しんりゃく}}](term:term-invasion),
  [{{攻撃|こうげき}}](term:term-attack) e breaker;
- setup delle due `{{設計図|せっけいず}}`, dove ordini, mostri, aggiungi alla
  mano e rimetti il resto in basso.

Mentre scorri la gallery, chiediti sempre:

1. e una carta di payoff immediato o di setup?
2. la carta parla di [{{侵略|しんりゃく}}](term:term-invasion) /
   [{{進化|しんか}}](term:term-evolution) oppure di ricerca nel mazzo?
3. compare una keyword nuova o solo una combinazione di pezzi gia noti?

### 2. La gallery del deck, carta per carta

#### 2.1 {{覇帝|はてい}}なき{{侵略|しんりゃく}} レッドゾーンF

:::image
src: assets/cards/dm25-sd2/01-redzone-formula-overlordless-invasion.jpg
alt: "Carta di Redzone Formula, centrata e leggibile."
caption: >-
  Qui compaiono [G・ストライク](term:term-g-strike) e la finestra di timing
  `{{各|かく}}ターン、{{最初|さいしょ}}の{{攻撃|こうげき}}の
  {{終|お}}わりに`, con cui si legge il vincolo temporale dell'attacco.
:::

Il parsing utile qui è: `vincolo di uso + timing di fine attacco`.

:::example_sentence
jp: >-
  このクリーチャーの{{攻撃中|こうげきちゅう}}、{{相手|あいて}}は
  「[G・ストライク](term:term-g-strike)」を{{使|つか}}えない。
translation_it: >-
  Durante l'attacco di questa creatura, l'avversario non puo usare G-Strike.
:::

:::example_sentence
jp: >-
  {{各|かく}}ターン、このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の
  {{終|お}}わりに、このクリーチャーを[アンタップ](term:term-untap)し、
  {{一番上|いちばんうえ}}のカードを{{破壊|はかい}}する。
translation_it: >-
  Ogni turno, alla fine del primo attacco di questa creatura, stappa questa
  creatura e distruggi la carta in cima.
:::

Qui conta:

- `{{使|つか}}えない` = divieto di uso, non semplice annullamento.
- Le virgolette attorno a `G・ストライク` segnalano una keyword tecnica.
- `{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに` ti obbliga a leggere
  una finestra di timing molto precisa.

#### 2.2 {{轟|とどろ}}く{{侵略|しんりゃく}} レッドゾーン

:::image
src: assets/cards/red-zone.webp
alt: "Carta di とどろくしんりゃく レッドゾーン centrata e leggibile."
card_id: card-red-zone-recognition
caption: >-
  Immagine ufficiale di {{轟|とどろ}}く{{侵略|しんりゃく}} [レッドゾーン](term:term-red-zone), altra carta-simbolo del lato offensivo di `DM25-SD2`.
:::

:::image
src: assets/cards/dm25-sd2/02-redzone-roaring-invasion.jpg
alt: "Carta di Red Zone, centrata e leggibile."
card_id: card-red-zone-recognition
caption: >-
  Formula operativa di [{{侵略|しんりゃく}}](term:term-invasion) e
  [T・ブレイカー](term:term-t-breaker):
  `{{相手|あいて}}のパワーが{{一番|いちばん}}{{大|おお}}きい`.
:::

Registra il pattern:
`{{相手|あいて}}のパワーが{{一番|いちばん}}{{大|おお}}きい`.

#### 2.3 {{超神羅星|ちょうしんらせい}}アポロヌス・ドラゲリオン

:::image
src: assets/cards/apollonus-dragelion.webp
alt: "Carta di ちょうしんらせいアポロヌス・ドラゲリオン centrata e leggibile."
card_id: card-apollonus-dragelion-recognition
caption: >-
  Immagine ufficiale di {{超神羅星|ちょうしんらせい}} [アポロヌス・ドラゲリオン](term:term-apollonus-dragelion), finisher simbolo del deck `DM25-SD2`.
:::

:::image
src: assets/cards/dm25-sd2/03-super-enlightened-nova-apollonus-dragerion.jpg
alt: "Carta di Apollonus Dragelion, centrata e leggibile."
card_id: card-apollonus-dragelion-recognition
caption: >-
  Questa carta introduce
  [{{究極進化|きゅうきょくしんか}}](term:term-ultimate-evolution) e
  [メテオバーン](term:term-meteorburn).
:::

Qui entrano due keyword di impatto sul parsing del turno:
[{{究極進化|きゅうきょくしんか}}](term:term-ultimate-evolution) e
[メテオバーン](term:term-meteorburn).

:::example_sentence
jp: >-
  [{{究極進化|きゅうきょくしんか}}](term:term-ultimate-evolution)：
  [{{進化|しんか}}クリーチャー](term:term-evolution-creature)
  {{1体|いったい}}の{{上|うえ}}に{{置|お}}く。
translation_it: >-
  Ultimate Evolution: mettila sopra 1 creatura evoluzione.
:::

:::example_sentence
jp: >-
  [メテオバーン](term:term-meteorburn)：このクリーチャーが{{出|で}}た
  {{時|とき}}、このクリーチャーの{{下|した}}にあるカードを
  {{3枚|さんまい}}{{墓地|ぼち}}に{{置|お}}いてもよい。そうしたら、この
  クリーチャーは{{相手|あいて}}のシールドをすべて[ブレイク](term:term-break)する。
translation_it: >-
  Meteorburn: quando questa creatura entra, puoi mettere nel cimitero 3 carte
  da sotto questa creatura. Se lo fai, questa creatura rompe tutti gli scudi
  dell'avversario.
:::

Qui separa subito i due piani:

- `{{進化|しんか}}クリーチャー` e gia un filtro richiesto dalla keyword.
- [メテオバーン](term:term-meteorburn) consuma materiale sotto la creatura.
- `そうしたら` apre il payoff solo se il costo materiale e stato davvero pagato.

#### 2.4 {{進化設計図|しんかせっけいず}}

:::image
src: assets/cards/dm25-sd2/04-evolution-blueprint.jpg
alt: "Carta di Evolution Blueprint, centrata e leggibile."
card_id: card-shinka-sekkeizu-recognition
caption: >-
  Schema leggibile per [{{表向|おもてむ}}き](term:term-face-up) e
  [{{好|す}}きな{{順序|じゅんじょ}}で](grammar:grammar-sukina-junjo-de).
:::

Il nucleo operativo è: rivelazione iniziale, filtro delle evoluzioni, riordino del
resto.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{6枚|ろくまい}}を[{{表向|おもてむ}}き](term:term-face-up)にする。その
  {{中|なか}}から[{{進化|しんか}}クリーチャー](term:term-evolution-creature)を
  すべて{{手札|てふだ}}に{{加|くわ}}え、
  {{残|のこ}}りを[好きな順序で](grammar:grammar-sukina-junjo-de)
  [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に{{置|お}}く。
translation_it: >-
  Metti a faccia in su le prime 6 carte del tuo mazzo. Aggiungi alla mano tutte
  le creature evoluzione tra quelle e metti il resto in fondo al mazzo
  nell'ordine che preferisci.
:::

Qui confermiamo tre punti:

- [{{表向|おもてむ}}き](term:term-face-up) rende esplicita la scoperta
  dell'insieme.
- `その{{中|なか}}から` limita il filtro alle carte già rivelate.
- [好きな順序で](grammar:grammar-sukina-junjo-de) organizza il riordino finale.

#### 2.5 SMAPON

:::image
src: assets/cards/dm25-sd2/05-smapon.jpg
alt: "Carta di SMAPON, centrata e leggibile."
caption: >-
  Parsing comparativo tra [スーパー・S・トリガー](term:term-super-s-trigger) e
  [S・トリガー](term:term-s-trigger): la carta mostra il salto operativo.
:::

Il punto tecnico e distinguere:
[スーパー・S・トリガー](term:term-super-s-trigger) rispetto a
[S・トリガー](term:term-s-trigger).

:::example_sentence
jp: >-
  [スーパー・S・トリガー](term:term-super-s-trigger)
  （このクリーチャーをシールドゾーンから{{手札|てふだ}}に{{加|くわ}}える
  {{時|とき}}、コストを{{支払|しはら}}わずにすぐ
  [{{召喚|しょうかん}}](term:term-summon)してもよい。）
translation_it: >-
  Super S-Trigger: quando aggiungi questa creatura dagli scudi alla mano, puoi
  evocarla subito senza pagarne il costo.
:::

La distinzione sintattica è questa:

- [S・トリガー](term:term-s-trigger) ti fa usare la carta dallo scudo.
- [スーパー・S・トリガー](term:term-super-s-trigger) qui ti porta da scudo a
  mano e poi a ingresso immediato senza costo.

#### 2.6 {{未来設計図|みらいせっけいず}}

:::image
src: assets/cards/dm25-sd2/06-future-blueprint.jpg
alt: "Carta di Future Blueprint, centrata e leggibile."
card_id: card-mirai-sekkeizu-recognition
caption: >-
  Parsing sequenziale per [～てから](grammar:grammar-te-kara) e controllo
  numerico in fase di rivelazione:
  [～てから](grammar:grammar-te-kara) e il blocco
  `{{相手|あいて}}に{{見|み}}せてから`.
:::

Qui si combinano una condizione numerica e una sequenza obbligata.

:::example_sentence
jp: >-
  コスト{{表記|ひょうき}}にある{{数字|すうじ}}を
  [{{合計|ごうけい}}](term:term-goukei)したものが{{5以上|ごいじょう}}になる
  ように、{{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  カードを{{表向|おもてむ}}きにする。
translation_it: >-
  Rivela carte dalla cima del tuo mazzo in modo che la somma dei numeri stampati
  nel costo arrivi a 5 o piu.
:::

:::example_sentence
jp: >-
  その{{中|なか}}からクリーチャーを{{1体|いったい}}{{選|えら}}び、
  {{相手|あいて}}に{{見|み}}せ[てから](grammar:grammar-te-kara)
  {{自分|じぶん}}の{{手札|てふだ}}に{{加|くわ}}えてもよい。
translation_it: >-
  Scegli 1 creatura tra quelle, mostrala all'avversario e solo dopo puoi
  aggiungerla alla tua mano.
:::

Qui il parser giusto e:

- [{{合計|ごうけい}}](term:term-goukei) ti dice che devi sommare, non leggere
  una singola cifra.
- [～ように](grammar:grammar-youni) e istruzione pratica sul criterio da
  soddisfare.
- [～てから](grammar:grammar-te-kara) impone un ordine obbligato: prima mostri,
  poi aggiungi.

#### 2.7 カチコミ{{入道|にゅうどう}} ＜バトライ.{{鬼|おーが}}＞

:::image
src: assets/cards/dm25-sd2/07-kachikomi-nyudo-batorai-oni.jpg
alt: "Carta di Kachikomi Nyudo, centrata e leggibile."
caption: >-
  Focus sul verbo operativo:
  [バトルさせる](term:term-battle-saseru).
:::

Qui il punto e il causativo di
[バトルさせる](term:term-battle-saseru).

:::example_sentence
jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、タマシードから
  [{{進化|しんか}}](term:term-evolution)していれば、
  {{相手|あいて}}のクリーチャーを{{1体|いったい}}{{選|えら}}んでもよい。
  その{{選|えら}}んだクリーチャーとこのクリーチャーを
  [バトルさせる](term:term-battle-saseru)。
translation_it: >-
  Quando questa creatura entra, se si e evoluta da un Tamaseed puoi scegliere 1
  creatura dell'avversario. Fai combattere quella creatura con questa creatura.
:::

Qui cambia il parsing dell'effetto:

- [バトルさせる](term:term-battle-saseru) non descrive un attacco normale.
- La forma `させる` ti dice che il gioco fa succedere il battle.
- `〜ていれば` qui apre subito una conseguenza concreta.

#### 2.8 オンクン{{童子|どうじ}} ＜ターボ.{{鬼|おーが}}＞

:::image
src: assets/cards/dm25-sd2/08-onsoku-doji-turbo-oni.jpg
alt: "Carta di Onsoku Doji, centrata e leggibile."
caption: >-
  Parsing operativo di [～てもよい](grammar:grammar-temoyoi),
  [{{捨|す}}てる](term:term-suteru) e `もう{{1枚|いちまい}}` in sequenza.
:::

La sequenza qui è: condizione (`〜てもよい`) → scarto → pescata.

#### 2.9 ストリエ{{雷鬼|らいき}}の{{巻|まき}}

:::image
src: assets/cards/dm25-sd2/09-stris-thunder-oni-scroll.jpg
alt: "Carta di Stri's Thunder Oni Scroll, centrata e leggibile."
caption: >-
  Parsing di [シンカライズ](term:term-shinkarize) e applicazione formula
  `クリーチャーであるかのように`.
:::

Qui la verifica passa da: trigger -> effetto -> verifica categoria.

#### 2.10 {{冒険妖精|ぼうけんようせい}}ポレコ

:::image
src: assets/cards/dm25-sd2/10-pollico-adventure-faerie.jpg
alt: "Carta di Pollico, centrata e leggibile."
caption: >-
  Punto di parsing per il timing:
  [～のはじめに / ～の{{終|お}}わりに](grammar:grammar-turn-timing)
  con `{{自分|じぶん}}のターンの{{終|お}}わりに`.
:::

Il marker operativo e:
`{{自分|じぶん}}のターンの{{終|お}}わりに`.

#### 2.11 ヘルコプ{{太|た}}の{{心絵|めもりー}}

:::image
src: assets/cards/dm25-sd2/11-helcoptas-memory.jpg
alt: "Carta di Helcopta's Memory, centrata e leggibile."
caption: >-
  Parsing di ricerca, rivelazione e riordino del mazzo.
:::

Fa da ponte tra
[{{進化設計図|しんかせっけいず}}](term:term-shinka-sekkeizu) e
[{{未来設計図|みらいせっけいず}}](term:term-mirai-sekkeizu).

### 3. Piano del deck

Sequenza di lettura del piano testuale:

- Fase offensiva:
  - {{覇帝|はてい}}なき{{侵略|しんりゃく}} レッドゾーンF per
    [G・ストライク](term:term-g-strike) e timing del primo attacco.
  - [{{轟|とどろ}}く{{侵略|しんりゃく}} レッドゾーン](term:term-red-zone):
    confronto di potenza `{{相手|あいて}}のパワーが{{一番|いちばん}}{{大|おお}}きい`
    e rottura totale.
- Fase di setup:
  - {{進化設計図|しんかせっけいず}} per [{{表向|おもてむ}}き](term:term-face-up),
    [好きな順序で](grammar:grammar-sukina-junjo-de).
  - {{未来設計図|みらいせっけいず}} per [{{合計|ごうけい}}](term:term-goukei),
    [～てから](grammar:grammar-te-kara).
  - ヘルコプ{{太|た}}の{{心絵|めもりー}} come passaggio tecnico tra
    ricerca e riordino del mazzo.
- Fase payoff:
  - {{超神羅星|ちょうしんらせい}}アポロヌス・ドラゲリオン per
    [{{究極進化|きゅうきょくしんか}}](term:term-ultimate-evolution) e
    [メテオバーン](term:term-meteorburn).
  - SMAPON per differenza funzionale tra
    [スーパー・S・トリガー](term:term-super-s-trigger) e
    [S・トリガー](term:term-s-trigger).
  - カチコミ{{入道|にゅうどう}} ＜バトライ.{{鬼|おーが}}＞ per
    [バトルさせる](term:term-battle-saseru).
- Fase di verifica e chiusura:
  - オンクン{{童子|どうじ}} ＜ターボ.{{鬼|おーが}}＞ per
    [～てもよい](grammar:grammar-temoyoi) e [{{捨|す}}てる](term:term-suteru).
  - ストリエ{{雷鬼|らいき}}の{{巻|まき}} per [シンカライズ](term:term-shinkarize).
  - {{冒険妖精|ぼうけんようせい}}ポレコ per
    [～のはじめに / ～の{{終|お}}わりに](grammar:grammar-turn-timing).

