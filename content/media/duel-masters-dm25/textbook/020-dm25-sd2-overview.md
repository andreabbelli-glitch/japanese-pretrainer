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
  Starter deck DM25-SD2 Chikara no Oudo: invasione, evoluzione e keyword come
  G-Strike, Ultimate Evolution, Meteorburn e Super S-Trigger.
---

# Obiettivo

Leggere `DM25-SD2` carta per carta: keyword, condizioni e ordine delle azioni.

Alla fine dovresti riconoscere:

- quali card cambiano la lettura operativa del deck;
- come leggere keyword compatte come [G・ストライク](term:term-g-strike),
  [{{究極進化|きゅう.きょく.しん.か}}](term:term-ultimate-evolution) e
  [メテオバーン](term:term-meteorburn);
- come funzionano frasi di supporto molto tipiche del deck, per esempio
  [{{表|おもて}}{{向|む}}き](term:term-face-up),
  [{{好|す}}きな{{順序|じゅんじょ}}で](grammar:grammar-sukina-junjo-de) e
  [～てから](grammar:grammar-te-kara).

## Contesto

`DM25-SD2 力の王道` è un deck d'ingresso dell'asse Apollo / Red Zone. In 11 carte
riunisce payoff aggressivi e setup, quindi la lettura si basa sempre sul flusso:
`condizione -> tempo dell'effetto -> esito`.

## Termini chiave

- [レッドゾーン](term:term-red-zone)
- [アポロヌス・ドラゲリオン](term:term-apollonus-dragelion)
- [G・ストライク](term:term-g-strike)
- [{{究極進化|きゅう.きょく.しん.か}}](term:term-ultimate-evolution)
- [メテオバーン](term:term-meteorburn)
- [スーパー・S・トリガー](term:term-super-s-trigger)
- [{{表|おもて}}{{向|む}}き](term:term-face-up)
- [バトルさせる](term:term-battle-saseru)
- [{{進化設計図|しん.か.せっ.けい.ず}}](term:term-shinka-sekkeizu)
- [{{未来設計図|み.らい.せっ.けい.ず}}](term:term-mirai-sekkeizu)

## Pattern grammaticali chiave

- [～てから](grammar:grammar-te-kara)
- [{{好|す}}きな{{順序|じゅんじょ}}で](grammar:grammar-sukina-junjo-de)
- [～ていれば](grammar:grammar-teireba)
- [そうしたら](grammar:grammar-soushitara)
- [～てもよい](grammar:grammar-temoyoi)
- [～のはじめに / ～の{{終|お}}わりに](grammar:grammar-turn-timing)

## Spiegazione

### 1. Come leggere la gallery

`DM25-SD2` alterna due registri:

- payoff aggressivo di [{{侵略|しんりゃく}}](term:term-invasion),
  [{{攻撃|こうげき}}](term:term-attack) e breaker;
- setup delle due `{{設計図|せっ.けい.ず}}`, dove ordini, mostri, aggiungi alla
  mano e rimetti il resto in basso.

Mentre scorri la gallery, chiediti sempre:

1. è una carta di payoff immediato o di setup?
2. la carta parla di [{{侵略|しんりゃく}}](term:term-invasion) /
   [{{進化|しんか}}](term:term-evolution) oppure di ricerca nel mazzo?
3. compare una keyword nuova o solo una combinazione di pezzi già noti?

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
  このクリーチャーの{{攻撃中|こう.げき.ちゅう}}、{{相手|あいて}}は
  「[G・ストライク](term:term-g-strike)」を{{使|つか}}えない。
translation_it: >-
  Durante l'attacco di questa creatura, l'avversario non può usare G-Strike.
:::

:::example_sentence
jp: >-
  {{各|かく}}ターン、このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の
  {{終|お}}わりに、このクリーチャーを[アンタップ](term:term-untap)し、
  {{一番上|いち.ばん.うえ}}のカードを{{破壊|はかい}}する。
translation_it: >-
  Ogni turno, alla fine del primo attacco di questa creatura, stappa questa
  creatura e distruggi la carta in cima.
:::

Qui conta:

- `{{使|つか}}えない` = divieto di uso, non semplice annullamento.
- Le virgolette attorno a `G・ストライク` segnalano una keyword tecnica.
- [{{各|かく}}](term:term-kaku) distribuisce il controllo a ogni turno preso
  separatamente.
- [{{最初|さいしょ}}](term:term-saisho) seleziona solo il primo attacco utile di
  quella creatura.
- [{{終|お}}わり](term:term-owari) apre la finestra solo dopo che quell'attacco è
  finito.
- [{{一番上|いち.ばん.うえ}}](term:term-ichiban-ue) identifica la carta precisa
  che viene colpita.

#### 2.2 {{轟|とどろ}}く{{侵略|しんりゃく}} レッドゾーン

:::image
src: assets/cards/red-zone.webp
alt: "Carta di とどろくしんりゃく レッドゾーン centrata e leggibile."
card_id: card-red-zone-recognition
caption: >-
  Immagine ufficiale di {{轟|とどろ}}く{{侵略|しんりゃく}}
  [レッドゾーン](term:term-red-zone). Qui il parsing utile resta la formula
  operativa di [{{侵略|しんりゃく}}](term:term-invasion) e
  [T・ブレイカー](term:term-t-breaker):
  `{{相手|あいて}}のパワーが{{一番|いちばん}}{{大|おお}}きい`.
:::

Registra il pattern:
`{{相手|あいて}}のパワーが{{一番|いちばん}}{{大|おお}}きい`.

#### 2.3 {{超神羅星|ちょう.しん.ら.せい}}アポロヌス・ドラゲリオン

:::image
src: assets/cards/apollonus-dragelion.webp
alt: "Carta di ちょうしんらせいアポロヌス・ドラゲリオン centrata e leggibile."
card_id: card-apollonus-dragelion-recognition
caption: >-
  Immagine ufficiale di {{超神羅星|ちょう.しん.ら.せい}}
  [アポロヌス・ドラゲリオン](term:term-apollonus-dragelion), finisher simbolo
  del deck `DM25-SD2`. Questa carta introduce
  [{{究極進化|きゅう.きょく.しん.か}}](term:term-ultimate-evolution) e
  [メテオバーン](term:term-meteorburn).
:::

Qui entrano due keyword di impatto sul parsing del turno:
[{{究極進化|きゅう.きょく.しん.か}}](term:term-ultimate-evolution) e
[メテオバーン](term:term-meteorburn).

:::example_sentence
jp: >-
  [{{究極進化|きゅう.きょく.しん.か}}](term:term-ultimate-evolution)：
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

- `{{進化|しんか}}クリーチャー` è già un filtro richiesto dalla keyword.
- [メテオバーン](term:term-meteorburn) consuma materiale sotto la creatura.
- `そうしたら` apre il payoff solo se il costo materiale è stato davvero pagato.

#### 2.4 {{進化設計図|しん.か.せっ.けい.ず}}

:::image
src: assets/cards/dm25-sd2/04-evolution-blueprint.jpg
alt: "Carta di Evolution Blueprint, centrata e leggibile."
card_id: card-shinka-sekkeizu-recognition
caption: >-
  Schema leggibile per [{{表|おもて}}{{向|む}}き](term:term-face-up) e
  [{{好|す}}きな{{順序|じゅんじょ}}で](grammar:grammar-sukina-junjo-de).
:::

Il nucleo operativo è: rivelazione iniziale, filtro delle evoluzioni, riordino del
resto.

:::example_sentence
jp: >-
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{6枚|ろくまい}}を[{{表|おもて}}{{向|む}}き](term:term-face-up)にする。その
  {{中|なか}}から[{{進化|しんか}}クリーチャー](term:term-evolution-creature)を
  すべて{{手札|てふだ}}に{{加|くわ}}え、
  {{残|のこ}}りを[{{好|す}}きな{{順序|じゅんじょ}}で](grammar:grammar-sukina-junjo-de)
  [{{山札|やまふだ}}](term:term-deck)の{{下|した}}に{{置|お}}く。
translation_it: >-
  Metti a faccia in su le prime 6 carte del tuo mazzo. Aggiungi alla mano tutte
  le creature evoluzione tra quelle e metti il resto in fondo al mazzo
  nell'ordine che preferisci.
:::

Qui confermiamo tre punti:

- [{{表|おもて}}{{向|む}}き](term:term-face-up) rende esplicita la scoperta
  dell'insieme.
- `その{{中|なか}}から` limita il filtro alle carte già rivelate.
- [{{好|す}}きな{{順序|じゅんじょ}}で](grammar:grammar-sukina-junjo-de) organizza il riordino finale.

#### 2.5 SMAPON

:::image
src: assets/cards/dm25-sd2/05-smapon.jpg
alt: "Carta di SMAPON, centrata e leggibile."
caption: >-
  Qui bisogna leggere tutta la parentesi di
  [スーパー・S・トリガー](term:term-super-s-trigger) e separare bene le due
  abilità `このクリーチャーが{{出|で}}た{{時|とき}}`.
:::

Il punto tecnico qui non è solo distinguere
[スーパー・S・トリガー](term:term-super-s-trigger) da
[S・トリガー](term:term-s-trigger). Bisogna anche vedere:

- dove finisce la keyword e dove comincia la procedura reale tra parentesi;
- quale condizione controlla `その{{時|とき}}`;
- quali effetti `このクリーチャーが{{出|で}}た{{時|とき}}` sono sempre presenti e
  quale invece viene aggiunto solo se la condizione degli scudi è vera.

:::example_sentence
jp: >-
  [スーパー・S・トリガー](term:term-super-s-trigger)
  （このカードをシールドゾーンから{{手札|てふだ}}に{{加|くわ}}える
  {{時|とき}}、コストを{{支払|しはら}}わずにすぐ{{実行|じっこう}}してもよい。
  その{{時|とき}}{{自分|じぶん}}のシールドが{{1|ひと}}つもなければ、
  このカードに[{{能力|のうりょく}}](term:term-ability)を
  [{{与|あた}}える](term:term-ataeru)）
translation_it: >-
  Super S-Trigger: quando aggiungi questa carta dagli scudi alla mano, puoi
  eseguirla subito senza pagarne il costo. In quel momento, se non hai nemmeno
  1 scudo, questa carta ottiene un'abilità aggiuntiva.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、
  {{相手|あいて}}のパワー{{2000以下|にせんいか}}のクリーチャーを
  [すべて](term:term-subete)[{{破壊|はかい}}](term:term-destroy)する。
translation_it: >-
  Quando questa creatura entra, distruggi tutte le creature avversarie con
  potenza 2000 o meno.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、そのターン{{中|ちゅう}}、
  {{自分|じぶん}}はゲームに{{負|ま}}けない。
translation_it: >-
  Quando questa creatura entra, per il resto di quel turno tu non perdi la
  partita.
reveal_mode: sentence
:::

La distinzione sintattica è questa:

- [S・トリガー](term:term-s-trigger) si ferma alla lettura base: usare la carta
  dagli scudi senza pagarne il costo.
- `すぐ{{実行|じっこう}}してもよい` qui non vuol dire `la usi più tardi`: su una
  creatura vuol dire che la esegui subito, quindi `SMAPON` entra immediatamente
  nel [バトルゾーン](term:term-battle-zone).
- `その{{時|とき}}` punta proprio a quell'istante di passaggio da scudo a mano.
  `{{1|ひと}}つもなければ` controlla se in quel momento i tuoi scudi sono
  zero, non se lo diventano più avanti nello stesso turno.
- `このカードに[{{能力|のうりょく}}](term:term-ability)を
  [{{与|あた}}える](term:term-ataeru)` non applica ancora il testo `ゲームに
  {{負|ま}}けない`: prima assegna alla carta una seconda abilità separata.
- Quindi, se `SMAPON` entra con la condizione soddisfatta, ha due abilità
  `このクリーチャーが{{出|で}}た{{時|とき}}`: la distruzione dei `2000以下` e il
  blocco `そのターン{{中|ちゅう}}、{{自分|じぶん}}はゲームに{{負|ま}}けない`.
- `そのターン{{中|ちゅう}}` fissa una durata. `{{自分|じぶん}}はゲームに
  {{負|ま}}けない` protegge dalla sconfitta per quel turno, ma non ferma gli
  attacchi né cancella il resto della risoluzione.

#### 2.6 {{未来設計図|み.らい.せっ.けい.ず}}

:::image
src: assets/cards/dm25-sd2/06-future-blueprint.jpg
alt: "Carta di Future Blueprint, centrata e leggibile."
card_id: card-mirai-sekkeizu-recognition
caption: >-
  Parsing sequenziale per [～てから](grammar:grammar-te-kara) e controllo
  numerico in fase di rivelazione:
  [～てから](grammar:grammar-te-kara) è il blocco
  `{{相手|あいて}}に{{見|み}}せてから`.
:::

Qui si combinano una condizione numerica e una sequenza obbligata.

:::example_sentence
jp: >-
  コスト{{表記|ひょうき}}にある{{数字|すうじ}}を
  [{{合計|ごうけい}}](term:term-goukei)したものが{{5以上|ごいじょう}}になる
  ように、{{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  カードを{{表|おもて}}{{向|む}}きにする。
translation_it: >-
  Rivela carte dalla cima del tuo mazzo in modo che la somma dei numeri stampati
  nel costo arrivi a 5 o più.
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

Qui il parser giusto è:

- [{{合計|ごうけい}}](term:term-goukei) ti dice che devi sommare, non leggere
  una singola cifra.
- [～ように](grammar:grammar-youni) è istruzione pratica sul criterio da
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

Qui il punto è il causativo di
[バトルさせる](term:term-battle-saseru).

:::example_sentence
jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、タマシードから
  [{{進化|しんか}}](term:term-evolution)していれば、
  {{相手|あいて}}のクリーチャーを{{1体|いったい}}{{選|えら}}んでもよい。
  その{{選|えら}}んだクリーチャーとこのクリーチャーを
  [バトルさせる](term:term-battle-saseru)。
translation_it: >-
  Quando questa creatura entra, se si è evoluta da un Tamaseed puoi scegliere 1
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

#### 2.10 {{冒険妖精|ぼう.けん.よう.せい}}ポレコ

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
[{{進化設計図|しん.か.せっ.けい.ず}}](term:term-shinka-sekkeizu) e
[{{未来設計図|み.らい.せっ.けい.ず}}](term:term-mirai-sekkeizu).

### 3. Piano del deck

Sequenza di lettura del piano testuale:

- Fase offensiva:
  - {{覇帝|はてい}}なき{{侵略|しんりゃく}} レッドゾーンF per
    [G・ストライク](term:term-g-strike) e timing del primo attacco.
  - [{{轟|とどろ}}く{{侵略|しんりゃく}} レッドゾーン](term:term-red-zone):
    confronto di potenza `{{相手|あいて}}のパワーが{{一番|いちばん}}{{大|おお}}きい`
    e rottura totale.
- Fase di setup:
  - {{進化設計図|しん.か.せっ.けい.ず}} per [{{表|おもて}}{{向|む}}き](term:term-face-up),
    [{{好|す}}きな{{順序|じゅんじょ}}で](grammar:grammar-sukina-junjo-de).
  - {{未来設計図|み.らい.せっ.けい.ず}} per [{{合計|ごうけい}}](term:term-goukei),
    [～てから](grammar:grammar-te-kara).
  - ヘルコプ{{太|た}}の{{心絵|めもりー}} come passaggio tecnico tra
    ricerca e riordino del mazzo.
- Fase payoff:
  - {{超神羅星|ちょう.しん.ら.せい}}アポロヌス・ドラゲリオン per
    [{{究極進化|きゅう.きょく.しん.か}}](term:term-ultimate-evolution) e
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
  - {{冒険妖精|ぼう.けん.よう.せい}}ポレコ per
    [～のはじめに / ～の{{終|お}}わりに](grammar:grammar-turn-timing).
