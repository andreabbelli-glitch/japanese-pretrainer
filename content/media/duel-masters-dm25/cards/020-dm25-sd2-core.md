---
id: cards-duel-masters-dm25-dm25-sd2-core
media_id: media-duel-masters-dm25
slug: dm25-sd2-core
title: DM25-SD2 - Nomi, keyword e parsing dell'asse Apollo / Red Zone
order: 40
segment_ref: mazzo-apollo-red-zone
---

:::term
id: term-red-zone
lemma: レッドゾーン
reading: れっどぞーん
romaji: reddo zoon
meaning_it: Red Zone / linea di finisher aggressivi
pos: proper-noun
aliases: [レッドゾーン, reddo zoon]
notes_it: >-
  Nome-simbolo del lato offensivo di `DM25-SD2`. Nel parsing di decklist e
  testo, `レッドゾーン` segnala un piano di chiusura: pressione immediata sugli
  scudi e meno turni concessi all'avversario.
level_hint: custom
:::

:::term
id: term-apollonus-dragelion
lemma: アポロヌス・ドラゲリオン
reading: あぽろぬす・どらげりおん
romaji: aporonusu doragerion
meaning_it: Apollonus Dragelion / finisher del deck
pos: proper-noun
aliases:
  [アポロヌス・ドラゲリオン, 超神羅星アポロヌス・ドラゲリオン, aporonusu doragerion]
notes_it: >-
  Nome del payoff più esplosivo dell'asse Apollo. Nel gioco indica il punto di
  arrivo della sequenza di setup/evoluzione: quando compare, il piano passa da
  preparazione a chiusura immediata della partita.
level_hint: custom
:::

:::term
id: term-shinka-sekkeizu
lemma: 進化設計図
reading: しんかせっけいず
romaji: shinka sekkeizu
meaning_it: schema di evoluzione / carta di setup
pos: proper-noun
aliases: [進化設計図, しんかせっけいず, shinka sekkeizu]
notes_it: >-
  Il nome e trasparente se lo leggi a pezzi:
  [{{進化|しんか}}](term:term-evolution) + `設計図` = "blueprint / schema di
  preparazione" dell'evoluzione. In `DM25-SD2` indica una fase di setup: il
  testo prepara mano e risorse per entrare poi nella linea di
  [{{進化|しんか}}](term:term-evolution) / [{{侵略|しんりゃく}}](term:term-invasion).
level_hint: custom
:::

:::term
id: term-mirai-sekkeizu
lemma: 未来設計図
reading: みらいせっけいず
romaji: mirai sekkeizu
meaning_it: schema del futuro / carta di setup
pos: proper-noun
aliases: [未来設計図, みらいせっけいず, mirai sekkeizu]
notes_it: >-
  Anche qui `設計図` marca una fase di preparazione. Quando compare, l'effetto
  sta ancora allineando la mano e la sequenza del turno successivo, non
  chiudendo subito il game.
level_hint: custom
:::

:::term
id: term-g-strike
lemma: G・ストライク
reading: がーどすとらいく
romaji: gaado sutoraiku
meaning_it: G-Strike / keyword difensiva da risposta
pos: keyword
aliases: [G・ストライク, ガード・ストライク, gaado sutoraiku]
notes_it: >-
  Keyword difensiva distinta da [S・トリガー](term:term-s-trigger). Quando il
  testo dice `「G・ストライク」を使えない`, il controllo richiesto al giocatore e
  verificare la finestra di risposta: in quel combat l'avversario perde proprio
  quell'interazione difensiva.
level_hint: custom
:::

:::term
id: term-ultimate-evolution
lemma: 究極進化
reading: きゅうきょくしんか
romaji: kyuukyoku shinka
meaning_it: Ultimate Evolution
pos: keyword
aliases: [究極進化, きゅうきょくしんか, kyuukyoku shinka]
notes_it: >-
  Forma avanzata di [{{進化|しんか}}](term:term-evolution): non basta una base
  generica, serve già una
  [{{進化|しんか}}クリーチャー](term:term-evolution-creature). In risoluzione il
  controllo del giocatore è la base sotto: se non è già evoluzione, la giocata
  non è legale.
level_hint: custom
:::

:::term
id: term-meteorburn
lemma: メテオバーン
reading: めておばーん
romaji: meteo baan
meaning_it: Meteorburn / keyword che consuma carte sotto la creatura
pos: keyword
aliases: [メテオバーン, めておばーん, meteo baan]
notes_it: >-
  Keyword di payoff per carte con materiale sotto di loro. Nel testo va
  controllato il costo in "carte da sotto" e il risultato che sblocca. In
  `アポロヌス`, consumare la pila converte direttamente quel materiale in
  pressione estrema sugli scudi.
level_hint: custom
:::

:::term
id: term-super-s-trigger
lemma: スーパー・S・トリガー
reading: すーぱーしーるどとりがー
romaji: suupaa shiirudo torigaa
meaning_it: Super S-Trigger
pos: keyword
aliases:
  [スーパー・S・トリガー, スーパーSトリガー, super s-trigger, suupaa shiirudo torigaa]
notes_it: >-
  Variante più spinta di [S・トリガー](term:term-s-trigger). In risoluzione non è
  solo "uso dagli scudi": può aprire la sequenza scudo -> mano -> ingresso
  immediato senza costo, quindi cambia direttamente il ritmo del turno.
level_hint: custom
:::

:::term
id: term-face-up
lemma: 表向き
reading: おもてむき
romaji: omotemuki
meaning_it: a faccia in su / face-up
pos: noun
aliases: [表向き, おもてむき, omotemuki]
notes_it: >-
  Nel TCG non vuol dire solo "visibile": segnala che ricerca o rivelazione
  avvengono apertamente. In carte come `進化設計図` o `未来設計図`, il controllo
  del giocatore e distinguere informazione pubblica da informazione privata
  durante la risoluzione.
level_hint: custom
:::

:::term
id: term-battle-saseru
lemma: バトルさせる
reading: ばとるさせる
romaji: batoru saseru
meaning_it: far combattere / forzare un battle
pos: verb-phrase
aliases: [バトルさせる, ばとるさせる, batoru saseru]
notes_it: >-
  Formula tipica del linguaggio di gioco: non descrive un attacco normale, ma
  forza un combattimento fra due creature precise. Il causativo marca proprio
  l'effetto operativo: il battle viene imposto dal testo, non dall'attacco
  dichiarato di una creatura.
level_hint: custom
:::

:::grammar
id: grammar-te-kara
pattern: ～てから
title: Sequenza dopo il primo passo
meaning_it: dopo aver fatto / e solo dopo
aliases: [てから]
notes_it: >-
  Introduce una sequenza stretta: prima il primo passo, poi il secondo. In
  `相手に見せてから手札に加える`, la procedura obbliga prima la rivelazione e solo
  dopo il passaggio in mano.
level_hint: n4
:::

:::grammar
id: grammar-sukina-junjo-de
pattern: 好きな順序で
title: Ordine a tua scelta
reading: すきなじゅんじょで
meaning_it: nell'ordine che preferisci
aliases: [好きな順序で, すきなじゅんじょで]
notes_it: >-
  Formula comune quando il testo rimette "il resto" nel mazzo o sotto una pila.
  L'ordine non è fissato dalla carta: lo decide il giocatore, quindi il testo
  assegna un controllo reale sullo stato futuro delle pescate.
level_hint: custom
:::

:::grammar
id: grammar-youni
pattern: ～ように
title: Criterio da soddisfare
meaning_it: in modo che / così che
aliases: [ように]
notes_it: >-
  Nel rules text introduce il criterio che l'azione deve soddisfare. In
  frasi come `{{合計|ごうけい}}したものが{{5以上|ごいじょう}}になるように`, non
  descrive un desiderio: imposta la condizione pratica con cui devi rivelare o
  scegliere le carte.
level_hint: n4
:::

:::card
id: card-red-zone-recognition
entry_type: term
entry_id: term-red-zone
card_type: recognition
front: レッドゾーン
back: Red Zone
example_jp: >-
  レッドゾーンで{{一気|いっき}}にシールドを{{攻|せ}}める。
example_it: >-
  Con Red Zone metti subito pressione agli scudi.
notes_it: >-
  Nome associato a pressione offensiva. Nel turno indica che il piano sta
  entrando nella fase di chiusura sugli scudi.
tags: [dm25-sd2, attack, proper-name]
:::

:::card
id: card-apollonus-dragelion-recognition
entry_type: term
entry_id: term-apollonus-dragelion
card_type: recognition
front: アポロヌス・ドラゲリオン
back: Apollonus Dragelion
example_jp: >-
  アポロヌス・ドラゲリオンで{{一気|いっき}}に{{勝負|しょうぶ}}を{{決|き}}める。
example_it: >-
  Con Apollonus Dragelion chiudi la partita di colpo.
notes_it: >-
  Questo nome identifica il payoff più esplosivo del mazzo. Nel piano di gioco
  i testi di [{{進化|しんか}}](term:term-evolution) e
  [{{侵略|しんりゃく}}](term:term-invasion) diventano la sequenza concreta che
  porta al finisher.
tags: [dm25-sd2, finisher, proper-name]
:::

:::card
id: card-shinka-sekkeizu-recognition
entry_type: term
entry_id: term-shinka-sekkeizu
card_type: recognition
front: 進化設計図
back: schema di evoluzione
example_jp: >-
  {{進化設計図|しんかせっけいず}}で
  {{進化|しんか}}クリーチャーを{{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Con Shinka Sekkeizu aggiungi una creatura evoluzione alla mano.
notes_it: >-
  [{{進化|しんか}}](term:term-evolution) + `設計図` indica una fase di
  preparazione. In gioco questa carta cerca il pezzo evoluzione e lo porta in
  mano, così il turno successivo può entrare nella linea di attacco.
tags: [dm25-sd2, setup, proper-name]
:::

:::card
id: card-mirai-sekkeizu-recognition
entry_type: term
entry_id: term-mirai-sekkeizu
card_type: recognition
front: 未来設計図
back: schema del futuro
example_jp: >-
  {{未来設計図|みらいせっけいず}}で{{次|つぎ}}のターンの{{準備|じゅんび}}をする。
example_it: >-
  Con Mirai Sekkeizu prepari il turno successivo.
notes_it: >-
  Condivide `設計図` con [{{進化設計図|しんかせっけいず}}](term:term-shinka-sekkeizu):
  entrambe marcano preparazione. In partita segnala che il turno sta ordinando
  risorse e sequenza, prima della finestra offensiva finale.
tags: [dm25-sd2, setup, proper-name]
:::

:::card
id: card-g-strike-recognition
entry_type: term
entry_id: term-g-strike
card_type: recognition
front: G・ストライク
back: G-Strike / keyword difensiva da risposta
example_jp: >-
  このクリーチャーの{{攻撃中|こうげきちゅう}}、{{相手|あいて}}は
  「G・ストライク」を{{使|つか}}えない。
example_it: >-
  Durante l'attacco di questa creatura, l'avversario non può usare G-Strike.
notes_it: >-
  Se compare tra virgolette, trattala come nome tecnico di meccanica. In
  risoluzione frasi come `「G・ストライク」を使えない` chiudono quella specifica
  finestra di risposta difensiva.
tags: [dm25-sd2, keyword, defense]
:::

:::card
id: card-ultimate-evolution-recognition
entry_type: term
entry_id: term-ultimate-evolution
card_type: recognition
front: 究極進化
back: Ultimate Evolution
example_jp: >-
  {{究極進化|きゅうきょくしんか}}：
  {{進化|しんか}}クリーチャー{{1体|いったい}}の{{上|うえ}}に{{置|お}}く。
example_it: >-
  Ultimate Evolution: mettila sopra 1 creatura evoluzione.
notes_it: >-
  Soglia più alta di `進化`. Il controllo richiesto è la base: deve essere già
  una creatura evoluzione, altrimenti la procedura non parte.
tags: [dm25-sd2, keyword, evolution]
:::

:::card
id: card-ultimate-evolution-placement-concept
entry_type: term
entry_id: term-ultimate-evolution
card_type: concept
front: >-
  {{進化|しんか}}しているクリーチャーの{{上|うえ}}に、さらに{{重|かさ}}ねて{{出|だ}}す。
back: >-
  La metti sopra una creatura che è già evoluzione, aggiungendo un altro
  livello di evoluzione.
example_jp: >-
  {{究極進化|きゅうきょくしんか}}では、{{進化|しんか}}しているクリーチャーの
  {{上|うえ}}にさらに{{重|かさ}}ねて{{出|だ}}す。
example_it: >-
  Con Ultimate Evolution la metti sopra una creatura già evoluzione,
  sovrapponendola ancora.
notes_it: >-
  Qui il pezzo importante è la relativa `進化しているクリーチャー` più
  `～の上に`, che insieme dicono quale base è legalmente valida.
tags: [dm25-sd2, keyword, evolution, chunk]
:::

:::card
id: card-meteorburn-recognition
entry_type: term
entry_id: term-meteorburn
card_type: recognition
front: メテオバーン
back: Meteorburn / consuma carte da sotto la creatura
example_jp: >-
  メテオバーン：このクリーチャーの{{下|した}}にあるカードを{{3枚|さんまい}}
  {{墓地|ぼち}}に{{置|お}}いてもよい。
example_it: >-
  Meteorburn: puoi mettere nel cimitero 3 carte da sotto questa creatura.
notes_it: >-
  Segnala che il testo usa il sotto della creatura come materiale da consumare.
  Il giocatore deve verificare quanti materiali può pagare e quale payoff si
  attiva dopo il pagamento.
tags: [dm25-sd2, keyword, evolution]
:::

:::card
id: card-super-s-trigger-recognition
entry_type: term
entry_id: term-super-s-trigger
card_type: recognition
front: スーパー・S・トリガー
back: Super S-Trigger
example_jp: >-
  スーパー・S・トリガーで、このクリーチャーをすぐ
  {{召喚|しょうかん}}してもよい。
example_it: >-
  Con Super S-Trigger puoi evocare subito questa creatura.
notes_it: >-
  Distingue la variante super dalla keyword base. In gioco prepara una risposta
  dagli scudi con ingresso immediato più forte del normale S-Trigger.
tags: [dm25-sd2, keyword, shield]
:::

:::card
id: card-super-s-trigger-branching-concept
entry_type: term
entry_id: term-super-s-trigger
card_type: concept
front: >-
  シールドから{{使|つか}}った{{後|あと}}、そのままクリーチャーを{{出|だ}}すか、
  さらに{{強|つよ}}い{{追加効果|ついかこうか}}まで{{続|つづ}}けて{{使|つか}}える。
back: >-
  Dopo averla usata dallo scudo, puoi far entrare subito una creatura oppure
  arrivare fino a un effetto aggiuntivo più forte.
example_jp: >-
  スーパー・S・トリガーなら、{{使|つか}}った{{後|あと}}にそのまま
  クリーチャーを{{出|だ}}すか、さらに{{追加効果|ついかこうか}}まで{{使|つか}}える。
example_it: >-
  Con Super S-Trigger, dopo averla usata puoi far entrare subito una creatura
  oppure continuare fino all'effetto aggiuntivo.
notes_it: >-
  Questa card allena il branching del rules text: `～た後`, l'alternativa
  `A か、B` e l'estensione `さらに ... まで`.
tags: [dm25-sd2, keyword, shield, chunk]
:::

:::card
id: card-face-up-recognition
entry_type: term
entry_id: term-face-up
card_type: recognition
front: 表向き
back: a faccia in su / face-up
example_jp: >-
  {{山札|やまふだ}}の{{上|うえ}}から{{6枚|ろくまい}}を{{表向|おもてむ}}きにする。
example_it: >-
  Metti a faccia in su le prime 6 carte del tuo mazzo.
notes_it: >-
  Segnala che la ricerca non è nascosta. Quando compare, la risoluzione è
  pubblica e leggibile da entrambi i giocatori.
tags: [dm25-sd2, search, visibility]
:::

:::card
id: card-battle-saseru-recognition
entry_type: term
entry_id: term-battle-saseru
card_type: recognition
front: バトルさせる
back: far combattere / forzare un battle
example_jp: >-
  その{{選|えら}}んだクリーチャーとこのクリーチャーをバトルさせる。
example_it: >-
  Fai combattere quella creatura scelta con questa creatura.
notes_it: >-
  Formula che condensa un'operazione di combattimento in un verbo misto. Quando
  compare, la carta non sta solo attaccando: impone uno scontro diretto tra i
  bersagli indicati.
tags: [dm25-sd2, combat, causative]
:::

:::card
id: card-te-kara-concept
entry_type: grammar
entry_id: grammar-te-kara
card_type: concept
front: ～てから
back: dopo aver fatto / e solo dopo
example_jp: >-
  {{相手|あいて}}に{{見|み}}せてから{{自分|じぶん}}の{{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Dopo averla mostrata all'avversario, la aggiungi alla tua mano.
notes_it: >-
  Segnala una sequenza obbligata. Se compare, il secondo passo non può essere
  letto come simultaneo o facoltativo rispetto al primo.
tags: [dm25-sd2, grammar, sequence]
:::

:::card
id: card-sukina-junjo-de-concept
entry_type: grammar
entry_id: grammar-sukina-junjo-de
card_type: concept
front: 好きな順序で
back: nell'ordine che preferisci
example_jp: >-
  {{残|のこ}}りを{{好|す}}きな{{順序|じゅんじょ}}で{{山札|やまふだ}}の{{下|した}}に{{置|お}}く。
example_it: >-
  Metti il resto in fondo al mazzo nell'ordine che preferisci.
notes_it: >-
  Assegna controllo sull'ordine finale. In risoluzione decide il giocatore come
  rimettere le carte, quindi influenza direttamente le pescate successive.
tags: [dm25-sd2, grammar, order]
:::

:::card
id: card-youni-concept
entry_type: grammar
entry_id: grammar-youni
card_type: concept
front: ～ように
back: in modo che / così da soddisfare
example_jp: >-
  コスト{{表記|ひょうき}}にある{{数字|すうじ}}を{{合計|ごうけい}}したものが
  {{5以上|ごいじょう}}になるように、カードを{{表向|おもてむ}}きにする。
example_it: >-
  Rivela carte in modo che la somma dei numeri stampati nel costo arrivi a 5 o
  più.
notes_it: >-
  In questo uso non esprime intenzione personale: indica il criterio pratico
  che l'azione deve soddisfare.
tags: [dm25-sd2, grammar, condition]
:::
