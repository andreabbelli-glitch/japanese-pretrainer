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
  [S・トリガー](term:term-s-trigger) è già la keyword che ti fa usare una carta
  dagli scudi. `スーパー` è il rinforzo in katakana: ti segnala che non sei
  davanti alla forma base, ma a una versione più spinta. In Duel Masters questa
  intuizione resta valida, però la parte davvero importante è la parentesi che
  segue la keyword. Su `SMAPON`, per esempio, la parentesi non si limita a dire
  `senza costo`: specifica il momento esatto in cui la carta viene eseguita e,
  se in quell'istante i tuoi scudi sono zero, le assegna perfino una seconda
  abilità `出た時`.
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
  avvengono apertamente. In carte come `{{進化設計図|しん.か.せっ.けい.ず}}` o `{{未来設計図|み.らい.せっ.けい.ず}}`, il controllo
  del giocatore e distinguere informazione pubblica da informazione privata
  durante la risoluzione.
level_hint: custom
:::

:::term
id: term-kaku
lemma: 各
reading: かく
romaji: kaku
meaning_it: ciascun / ogni singolo
pos: noun
aliases: [各, かく, each]
notes_it: >-
  In giapponese generale `{{各|かく}}` distribuisce la stessa proprietà a ogni
  elemento di una serie: ogni giocatore, ogni carta, ogni turno. Nel rules text
  di Duel Masters il significato non cambia, ma diventa un marcatore di scope.
  In `{{各|かく}}ターン`, per esempio, l'effetto non vale `una volta in generale`:
  viene controllato separatamente in ogni turno.
level_hint: n4
:::

:::term
id: term-saisho
lemma: 最初
reading: さいしょ
romaji: saisho
meaning_it: il primo / l'inizio della sequenza
pos: noun
aliases: [最初, さいしょ, first]
notes_it: >-
  In giapponese generale `{{最初|さいしょ}}` indica il primo elemento o il punto
  iniziale di un ordine: la prima persona, il primo passo, il primo attacco.
  Nel rules text di Duel Masters serve a selezionare quale evento conta davvero.
  In `このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}`, solo il primo
  attacco di quella creatura apre la finestra dell'effetto.
level_hint: n4
:::

:::term
id: term-owari
lemma: 終わり
reading: おわり
romaji: owari
meaning_it: fine / conclusione / ultimo momento
pos: noun
aliases: [終わり, 終り, おわり, end]
notes_it: >-
  In giapponese generale `{{終|お}}わり` è la parte finale di qualcosa: la fine
  di un discorso, di una giornata, di un'azione. Nel rules text di Duel Masters
  questo nucleo resta uguale, ma con timing più rigido. In `{{攻撃|こうげき}}の
  {{終|お}}わりに`, il testo non guarda il mezzo dell'attacco: aspetta che
  quell'attacco sia finito e solo allora applica l'effetto.
level_hint: n4
:::

:::term
id: term-ichiban-ue
lemma: 一番上
reading: いちばんうえ
romaji: ichiban ue
meaning_it: il punto più in alto / la cima
pos: noun
aliases: [一番上, いちばんうえ, top]
notes_it: >-
  `{{一番|いちばん}}` marca l'estremo e `{{上|うえ}}` indica la parte alta.
  Insieme formano un chunk di posizione molto utile: `la cima`, `il punto più
  in alto`. In Duel Masters compare spesso con il mazzo o con una pila di carte
  per dire qual è esattamente la carta che viene rivelata, spostata o colpita.
level_hint: n4
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-shinka-sekkeizu
card_type: recognition
front: '{{進化設計図|しん.か.せっ.けい.ず}}'
back: schema di evoluzione
example_jp: >-
  {{進化設計図|しん.か.せっ.けい.ず}}で
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-mirai-sekkeizu
card_type: recognition
front: '{{未来設計図|み.らい.せっ.けい.ず}}'
back: schema del futuro
example_jp: >-
  {{未来設計図|み.らい.せっ.けい.ず}}で{{次|つぎ}}のターンの{{準備|じゅんび}}をする。
example_it: >-
  Con Mirai Sekkeizu prepari il turno successivo.
notes_it: >-
  Condivide `設計図` con [{{進化設計図|しん.か.せっ.けい.ず}}](term:term-shinka-sekkeizu):
  entrambe marcano preparazione. In partita segnala che il turno sta ordinando
  risorse e sequenza, prima della finestra offensiva finale.
tags: [dm25-sd2, setup, proper-name]
:::

:::card
id: card-g-strike-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-g-strike
card_type: recognition
front: G・ストライク
back: G-Strike / keyword difensiva da risposta
example_jp: >-
  このクリーチャーの{{攻撃中|こう.げき.ちゅう}}、{{相手|あいて}}は
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
id: card-kaku-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-kaku
card_type: recognition
front: '{{各|かく}}'
back: ciascun / ogni singolo
example_jp: >-
  {{各|かく}}ターン、このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の
  {{終|お}}わりに、このクリーチャーをアンタップする。
example_it: >-
  A ogni turno, alla fine del primo attacco di questa creatura, STAPpa questa
  creatura.
notes_it: >-
  Qui `{{各|かく}}` distribuisce il controllo a ogni turno separatamente. Non
  significa `adesso in questo turno e basta`, ma `ogni volta che si arriva a un
  nuovo turno`.
tags: [dm25-sd2, timing, structure]
:::

:::card
id: card-saisho-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-saisho
card_type: recognition
front: '{{最初|さいしょ}}'
back: il primo / l'evento iniziale
example_jp: >-
  このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに、
  {{能力|のうりょく}}が{{使|つか}}える。
example_it: >-
  Alla fine del primo attacco di questa creatura, l'abilità si può usare.
notes_it: >-
  `{{最初|さいしょ}}` filtra quale evento conta. Su `レッドゾーンF` non basta
  che la creatura attacchi: conta solo il primo attacco di quel turno.
tags: [dm25-sd2, timing, structure]
:::

:::card
id: card-owari-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-owari
card_type: recognition
front: '{{終|お}}わり'
back: fine / momento conclusivo
example_jp: >-
  このクリーチャーの{{攻撃|こうげき}}の{{終|お}}わりに、
  {{一番上|いち.ばん.うえ}}のカードを{{破壊|はかい}}する。
example_it: >-
  Alla fine dell'attacco di questa creatura, distruggi la carta in cima.
notes_it: >-
  `{{終|お}}わり` non indica il mezzo dell'azione, ma il momento successivo alla
  sua conclusione. In questo chunk il gioco aspetta la fine dell'attacco e poi
  applica il resto.
tags: [dm25-sd2, timing, structure]
:::

:::card
id: card-ichiban-ue-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-ichiban-ue
card_type: recognition
front: '{{一番上|いち.ばん.うえ}}'
back: la cima / il punto più in alto
example_jp: >-
  {{山札|やまふだ}}の{{一番上|いち.ばん.うえ}}を{{見|み}}て、{{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Guardi la carta in cima al mazzo e l'aggiungi alla mano.
notes_it: >-
  Questo chunk di posizione serve a individuare una carta sola e ben precisa:
  quella che sta proprio in cima al mazzo o alla pila considerata.
tags: [dm25-sd2, deck, structure]
:::

:::card
id: card-ultimate-evolution-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-ultimate-evolution
card_type: recognition
front: '{{究極進化|きゅう.きょく.しん.か}}'
back: Ultimate Evolution
example_jp: >-
  {{究極進化|きゅう.きょく.しん.か}}：
  {{進化|しんか}}クリーチャー{{1体|いったい}}の{{上|うえ}}に{{置|お}}く。
example_it: >-
  Ultimate Evolution: mettila sopra 1 creatura evoluzione.
notes_it: >-
  Soglia più alta di `{{進化|しんか}}`. Il controllo richiesto è la base: deve essere già
  una creatura evoluzione, altrimenti la procedura non parte.
tags: [dm25-sd2, keyword, evolution]
:::

:::card
id: card-ultimate-evolution-placement-concept
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-ultimate-evolution
card_type: concept
front: >-
  {{進化|しんか}}しているクリーチャーの{{上|うえ}}に、さらに{{重|かさ}}ねて{{出|だ}}す。
back: >-
  La metti sopra una creatura che è già evoluzione, aggiungendo un altro
  livello di evoluzione.
example_jp: >-
  {{究極進化|きゅう.きょく.しん.か}}では、{{進化|しんか}}しているクリーチャーの
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-super-s-trigger
card_type: recognition
front: スーパー・S・トリガー
back: Super S-Trigger
example_jp: >-
  スーパー・S・トリガー：
  このカードをシールドゾーンから{{手札|てふだ}}に{{加|くわ}}える{{時|とき}}、
  コストを{{支払|しはら}}わずにすぐ{{実行|じっこう}}してもよい。
example_it: >-
  Super S-Trigger: quando aggiungi questa carta dagli scudi alla mano, puoi
  eseguirla subito senza pagarne il costo.
notes_it: >-
  La keyword da sola ti dice solo che sei oltre la forma base di
  [S・トリガー](term:term-s-trigger). La lettura davvero utile è la parentesi:
  è lì che la carta spiega quando la esegui subito e quale bonus extra può
  ottenere.
tags: [dm25-sd2, keyword, shield]
:::

:::card
id: card-super-s-trigger-branching-concept
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-super-s-trigger
card_type: concept
front: >-
  その{{時|とき}}{{自分|じぶん}}のシールドが{{1|ひと}}つもなければ、
  このカードに{{能力|のうりょく}}を{{与|あた}}える。
back: >-
  In quel momento, se non hai nemmeno 1 scudo, questa carta ottiene
  un'abilità aggiuntiva.
example_jp: >-
  その{{時|とき}}{{自分|じぶん}}のシールドが{{1|ひと}}つもなければ、
  このカードに{{能力|のうりょく}}を{{与|あた}}える。
example_it: >-
  In quel momento, se non hai nemmeno 1 scudo, questa carta ottiene
  un'abilità aggiuntiva.
notes_it: >-
  Questa è la parte che spesso viene saltata troppo in fretta. `その時` punta
  allo stesso istante del passaggio da scudo a mano, `{{1|ひと}}つもない`
  controlla se sei davvero a zero scudi, e `{{与|あた}}える` significa
  `concedere`: l'effetto finale non si risolve ancora, viene prima assegnato
  come seconda abilità alla carta.
tags: [dm25-sd2, keyword, shield, chunk]
:::

:::card
id: card-smapon-destroy-small-creatures-concept
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-destroy
card_type: concept
front: >-
  {{相手|あいて}}のパワー{{2000以下|にせんいか}}のクリーチャーを
  すべて{{破壊|はかい}}する。
back: >-
  Distruggi tutte le creature avversarie con potenza 2000 o meno.
example_jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、
  {{相手|あいて}}のパワー{{2000以下|にせんいか}}のクリーチャーを
  すべて{{破壊|はかい}}する。
example_it: >-
  Quando questa creatura entra, distruggi tutte le creature avversarie con
  potenza 2000 o meno.
notes_it: >-
  Il chunk allena due cose insieme: `{{2000以下|にせんいか}}` fissa il filtro
  numerico e `すべて` estende l'effetto a tutto il gruppo che passa quel filtro,
  non a un solo bersaglio.
tags: [dm25-sd2, removal, scope, chunk]
:::

:::card
id: card-smapon-cannot-lose-turn-concept
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-super-s-trigger
card_type: concept
front: >-
  そのターン{{中|ちゅう}}、{{自分|じぶん}}はゲームに{{負|ま}}けない。
back: >-
  Per quel turno, tu non perdi la partita.
example_jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、そのターン{{中|ちゅう}}、
  {{自分|じぶん}}はゲームに{{負|ま}}けない。
example_it: >-
  Quando questa creatura entra, per il resto di quel turno tu non perdi la
  partita.
notes_it: >-
  `そのターン{{中|ちゅう}}` fissa la durata e `{{負|ま}}けない` parla solo della
  condizione di sconfitta. Non vuol dire che il turno si fermi: gli attacchi e
  gli altri trigger possono continuare, ma tu non perdi in quel turno.
tags: [dm25-sd2, shield, duration, chunk]
:::

:::card
id: card-face-up-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-face-up
card_type: recognition
front: '{{表|おもて}}{{向|む}}き'
back: a faccia in su / face-up
example_jp: >-
  {{山札|やまふだ}}の{{上|うえ}}から{{6枚|ろくまい}}を{{表|おもて}}{{向|む}}きにする。
example_it: >-
  Metti a faccia in su le prime 6 carte del tuo mazzo.
notes_it: >-
  Segnala che la ricerca non è nascosta. Quando compare, la risoluzione è
  pubblica e leggibile da entrambi i giocatori.
tags: [dm25-sd2, search, visibility]
:::

:::card
id: card-battle-saseru-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: grammar
entry_id: grammar-sukina-junjo-de
card_type: concept
front: '{{好|す}}きな{{順序|しゅんじょ}}で'
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
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: grammar
entry_id: grammar-youni
card_type: concept
front: ～ように
back: in modo che / così da soddisfare
example_jp: >-
  コスト{{表記|ひょうき}}にある{{数字|すうじ}}を{{合計|ごうけい}}したものが
  {{5以上|ごいじょう}}になるように、カードを{{表|おもて}}{{向|む}}きにする。
example_it: >-
  Rivela carte in modo che la somma dei numeri stampati nel costo arrivi a 5 o
  più.
notes_it: >-
  In questo uso non esprime intenzione personale: indica il criterio pratico
  che l'azione deve soddisfare.
tags: [dm25-sd2, grammar, condition]
:::
